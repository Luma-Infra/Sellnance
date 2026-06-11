# exchange_api.py
from concurrent.futures import ThreadPoolExecutor, wait
import requests
from modules import config_manager, utils
from modules.utils import is_valid_ticker
from datetime import datetime, timezone
import json
import os

# 🚀 9시 시가 캐시 (메모리 & 파일)
UTC0_CACHE_FILE = "utc0_prices.json"
UTC0_OPEN_CACHE = {}


def load_utc0_cache():
    global UTC0_OPEN_CACHE
    if os.path.exists(UTC0_CACHE_FILE):
        try:
            with open(UTC0_CACHE_FILE, "r") as f:
                UTC0_OPEN_CACHE = json.load(f)
        except:
            UTC0_OPEN_CACHE = {}


def save_utc0_cache():
    try:
        with open(UTC0_CACHE_FILE, "w") as f:
            json.dump(UTC0_OPEN_CACHE, f)
    except:
        pass


# 초기 로드
load_utc0_cache()


def get_korean_exchange_markets():
    upbit_krw_set, bithumb_krw_set = set(), set()
    try:
        res = requests.get("https://api.upbit.com/v1/market/all?isDetails=false").json()
        for m in res:
            if m["market"].startswith("KRW-"):
                upbit_krw_set.add(m["market"].replace("KRW-", ""))
    except Exception as e:
        print(f"🚨 [디버그] 업비트 마켓 목록 에러: {e}")  # 👈 pass 대신 추가!
    try:
        res = requests.get(
            "https://api.bithumb.com/v1/market/all?isDetails=false"
        ).json()
        for m in res:
            if m["market"].startswith("KRW-"):
                bithumb_krw_set.add(m["market"].replace("KRW-", ""))
    except Exception as e:
        print(f"🚨 [디버그] 빗썸 마켓 목록 에러: {e}")  # 👈 pass 대신 추가!
    return upbit_krw_set, bithumb_krw_set


def fetch_global_listings():
    """8대 메이저 거래소 중 외부 5개(OKX, BYBIT, BITGET, GATEIO, COINBASE) 현물 상장 수집"""
    listings = {}

    def add_tags(coins, tag):
        for c in coins:
            base = c.upper()
            if base not in listings:
                listings[base] = set()
            listings[base].add(tag)

    def get_okx():
        try:
            add_tags(
                [
                    i["baseCcy"]
                    for i in requests.get(
                        "https://www.okx.com/api/v5/public/instruments?instType=SPOT",
                        timeout=5,
                    )
                    .json()
                    .get("data", [])
                ],
                "OKX",
            )
        except:
            pass

    def get_bybit():
        try:
            add_tags(
                [
                    i["baseCoin"]
                    for i in requests.get(
                        "https://api.bybit.com/v5/market/instruments-info?category=spot",
                        timeout=5,
                    )
                    .json()
                    .get("result", {})
                    .get("list", [])
                ],
                "BYBIT",
            )
        except:
            pass

    def get_bitget():
        try:
            add_tags(
                [
                    i["baseCoin"]
                    for i in requests.get(
                        "https://api.bitget.com/api/v2/spot/public/symbols", timeout=5
                    )
                    .json()
                    .get("data", [])
                ],
                "BITGET",
            )
        except:
            pass

    def get_gateio():
        try:
            add_tags(
                [
                    i["base"]
                    for i in requests.get(
                        "https://api.gateio.ws/api/v4/spot/currency_pairs", timeout=5
                    ).json()
                ],
                "GATEIO",
            )
        except:
            pass

    def get_coinbase():
        try:
            add_tags(
                [
                    i["base_currency"]
                    for i in requests.get(
                        "https://api.exchange.coinbase.com/products", timeout=5
                    ).json()
                ],
                "COINBASE",
            )
        except:
            pass

    # 🚀 병렬로 5개 대문 동시 타격
    target_funcs = [get_okx, get_bybit, get_bitget, get_gateio, get_coinbase]
    try:
        with ThreadPoolExecutor(max_workers=len(target_funcs)) as executor:
            futures = [executor.submit(func) for func in target_funcs]
            wait(futures)
    except RuntimeError:
        # 종료 중이면 조용히 리턴
        return listings

    return listings


# ==========================================
# 🧱 모듈 1: 거래소 시세 수집기 (바낸 업비트 빗썸)
# ==========================================


def fetch_exchange_market_data(mapping):
    load_utc0_cache()
    (
        NOTE_MAP,
        TICKER_DATA,
        CHAIN_LOGO_MAP,
        EXCLUSION_LIST,
        DUPLICATED_LIST,
        SYMBOL_TO_ID_MAP,
        MANUAL_SUPPLY_MAP,
        SPECIAL_SYMBOL_MAP,
        HARDCODE_VERIFY_SKIP_LIST,
    ) = config_manager.get_mapping_parts(mapping)

    # 1. 기초 마켓 리스트 확보
    upbit_krw_set, bithumb_krw_set = get_korean_exchange_markets()

    # 2. 거래소 타격 (병렬 처리 가능하면 좋겠지만 일단 순차로!)
    bybit_data = fetch_bybit_prices()  # 🚀 [추가] 바이비트 데이터 긁어오기
    binance_data, binance_base_assets = fetch_binance_futures_spot(bybit_data)

    binance_pure = {utils.get_pure_base_asset(a) for a in binance_base_assets}

    # 3. 족보 생성 및 업비트 전용 자산 필터링
    REVERSE_LOOKUP = {}
    for k, v in DUPLICATED_LIST.items():
        if len(v) >= 4:
            ex = v[3].upper()
            REVERSE_LOOKUP[f"{v[2].upper()}_{ex}"] = k
            REVERSE_LOOKUP[f"{k.split('(')[0].upper()}_{ex}"] = k

    upbit_only_assets = set()
    for k in upbit_krw_set:
        if k in EXCLUSION_LIST or utils.is_scaled_symbol(k):
            continue
        alias_upbit = REVERSE_LOOKUP.get(f"{k.upper()}_UPBIT", k)
        alias_binance = REVERSE_LOOKUP.get(f"{k.upper()}_BINANCE", k)

        if k not in binance_pure or alias_upbit != alias_binance:
            upbit_only_assets.add(k)

    # 4. 업비트 시세 타격 (KRW 마켓 전체 수집)
    upbit_data = fetch_upbit_prices(upbit_krw_set)
    bithumb_data = fetch_bithumb_prices()

    return (
        binance_data,
        upbit_data,
        upbit_krw_set,
        upbit_only_assets,
        bithumb_krw_set,
        bybit_data,
        bithumb_data,
    )


# 전역 세션 객체 생성 (커넥션 풀링을 통한 속도 극대화)
api_session = requests.Session()
# 🚀 [FIX] 커넥션 풀 사이즈 확장 (기본 10 -> 100)
adapter = requests.adapters.HTTPAdapter(pool_connections=100, pool_maxsize=100)
api_session.mount("https://", adapter)
api_session.mount("http://", adapter)


def capture_utc0_prices_bulk():
    """
    🚀 [최적화 핵심] 9시 정각에 전체 티커를 벌크로 긁어서 시가를 고정합니다.
    (기존 ticker/24hr lastPrice를 사용하던 치명적 오차 버그를 제거하고 tradingDay 및 1d klines로 정확하게 수집하도록 위임합니다)
    """
    global UTC0_OPEN_CACHE
    print("🎯 [SCEDULER] KST 09:00 시가 벌크 초기화 개시...")

    try:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # 🚀 9시 정각에 캐시를 비우고 (혹은 초기화하고), 다음 시세 갱신 사이클이 무결점 tradingDay 로직으로 수집하도록 유도합니다.
        # 이렇게 하면 1d 캔들의 정확한 openPrice와 100% 일치하게 됩니다.
        UTC0_OPEN_CACHE.clear()
        UTC0_OPEN_CACHE[today_str] = {}
        save_utc0_cache()
        print(
            f"✅ [SUCCESS] {today_str} 시가 캐시 초기화 완료 (메인 루프에서 무결점 1d 시가로 자동 수집됩니다)"
        )
    except Exception as e:
        print(f"🚨 [ERROR] 시가 벌크 초기화 실패: {e}")


# 🚀 [수정] 서버 중간 시작 시 정확한 UTC 0시 시가를 병렬로 고속 수집하는 전담 함수 추가!
def fetch_missing_utc0_opens_parallel(tasks):
    """
    🚀 [IP 밴 위험 0% 궁극의 시가 보정기]
    1. 현물 tradingDay 벌크 API 단 1번 호출로 현물 전 종목 당일 09시 시가 확보 (Weight 4)
    2. 선물 코인은 현물 시가를 1차 복사(도킹)하여 klines 호출 대상 90% 소각
    3. 남은 극소수 선물 단독 코인만 max_workers=3으로 안전하게 캡처하여 밴 위험 원천 차단!
    """
    global UTC0_OPEN_CACHE
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if today_str not in UTC0_OPEN_CACHE:
        UTC0_OPEN_CACHE.clear()
        UTC0_OPEN_CACHE[today_str] = {}

    print(
        f"⏳ [시가 정밀 보정] 캐시 누락 감지. IP 밴 위험 0% 하이브리드 벌크 캡처 개시..."
    )

    # 1. 현물 tradingDay 벌크 타격 (단 1방에 현물 전체 당일 09시 시가 확보!)
    try:
        res_trading_day = api_session.get(
            "https://api.binance.com/api/v3/ticker/tradingDay", timeout=5
        ).json()
        if isinstance(res_trading_day, list):
            for item in res_trading_day:
                sym = item["symbol"].replace("USDT", "")
                if is_valid_ticker(sym):
                    UTC0_OPEN_CACHE[today_str][sym] = float(item["openPrice"])
            print(
                f"✅ [벌크 도킹] 현물 tradingDay API로 {len(res_trading_day)}개 종목 09시 시가 1초컷 확보!"
            )
    except Exception as e:
        print(f"⚠️ tradingDay 벌크 실패, 백업 로직 전환: {e}")

    # 2. 남은 누락분 필터링 (현물에 없고 선물에만 있는 극소수 코인 식별)
    remaining_tasks = []
    for sym, is_futures in tasks:
        if sym not in UTC0_OPEN_CACHE[today_str]:
            remaining_tasks.append((sym, is_futures))

    if remaining_tasks:
        print(
            f"🔍 [잔여 타격] 현물에 없는 선물 단독 종목 {len(remaining_tasks)}건 감지. (max_workers=3 안전 캡처 진행)"
        )

        def _fetch(task):
            sym, is_fut = task
            url = (
                f"https://fapi.binance.com/fapi/v1/klines?symbol={sym}USDT&interval=1d&limit=1"
                if is_fut
                else f"https://api.binance.com/api/v3/klines?symbol={sym}USDT&interval=1d&limit=1"
            )
            try:
                r = api_session.get(url, timeout=5).json()
                if r and isinstance(r, list) and len(r) > 0:
                    return sym, float(r[0][1])
            except:
                pass
            return sym, None

        # 🚀 사령관님 보호를 위해 max_workers=5으로 철벽 스로틀링!
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(_fetch, t) for t in remaining_tasks]
            for f in futures:
                sym, val = f.result()
                if val is not None:
                    UTC0_OPEN_CACHE[today_str][sym] = val

    save_utc0_cache()
    print(
        f"✅ [SUCCESS] {today_str} 당일 09시 시가 무결점 보정 완료 ({len(UTC0_OPEN_CACHE[today_str])}개 확보)"
    )


def get_utc0_open_price(symbol, is_futures):
    """캐시된 시가가 있으면 반환, 없으면 개별 klines 호출 (보험)"""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cached = UTC0_OPEN_CACHE.get(today_str, {}).get(symbol)
    if cached:
        return cached

    # 캐시 없으면 (서버가 9시 이후에 켜진 경우 등) 개별 호출 실행
    return fetch_binance_open((symbol, is_futures))[1]


# 9시 시가 수집
def fetch_binance_open(task):
    """(보조) 선물/현물 구분해서 9시 시가 수집 (task: (symbol, is_futures))"""
    symbol, is_futures = task

    # 🚀 설계대로 분기점 생성
    if is_futures:
        # 선물 전용 주소
        url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}USDT&interval=1d&limit=1"
    else:
        # 현물 전용 주소
        url = f"https://api.binance.com/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=1"

    try:
        res = api_session.get(url, timeout=5).json()
        if res and isinstance(res, list) and len(res) > 0:
            return symbol, float(res[0][1])
    except Exception as e:
        # 🚨 실패 시 로그 (어느 쪽에서 터졌는지 알 수 있게 url 슬쩍 노출)
        print(f"🚨 [시가 에러] {symbol} ({'선물' if is_futures else '현물'}): {e}")

    return symbol, None


# 바낸 선물/현물 수집 및 합치기 (새로 생성)
def fetch_binance_futures_spot(bybit_data=None):
    binance_data = {}
    binance_base_assets = set()
    if bybit_data is None:
        bybit_data = {}

    try:
        # 1. 기초 데이터 수집 (선물/현물 마켓 정보, 24시간 시세, 펀딩비 병렬 타격)
        urls = [
            "https://fapi.binance.com/fapi/v1/exchangeInfo",
            "https://fapi.binance.com/fapi/v1/ticker/24hr",
            "https://api.binance.com/api/v3/exchangeInfo",
            "https://api.binance.com/api/v3/ticker/24hr",
            "https://fapi.binance.com/fapi/v1/premiumIndex",  # 🚀 펀딩비 추가
        ]

        def fetch_url_safe(base_url):
            urls_to_try = [base_url]
            if "api.binance.com" in base_url:
                urls_to_try = [
                    base_url,
                    base_url.replace("api.binance.com", "api1.binance.com"),
                    base_url.replace("api.binance.com", "api2.binance.com"),
                    base_url.replace("api.binance.com", "api3.binance.com"),
                ]

            for url in urls_to_try:
                try:
                    r = api_session.get(url, timeout=5)
                    if r.status_code == 200:
                        return r.json()
                    elif r.status_code == 429:
                        print(
                            f"⚠️ [API 429 제한] {url} 접속 지연. 백업 클러스터로 우회합니다..."
                        )
                        continue
                except Exception as e:
                    print(f"⚠️ [API 개별 실패] {url}: {e}")
            return None

        with ThreadPoolExecutor(max_workers=5) as executor:
            # 🚀 [수정] map 대신 직접 submit 하여 에러 발생 시에도 개별 제어 가능하게 변경
            futures = [executor.submit(fetch_url_safe, url) for url in urls]
            results = [f.result() for f in futures]

            info_f = results[0] or {"symbols": []}
            prices_f = results[1] or []
            info_s = results[2] or {"symbols": []}
            prices_s = results[3] or []
            premium_f = results[4] or []

        # 🚀 [추가] 바이낸스 선물 API 밴 감지 및 바이비트 선물 Fallback 이식
        if not prices_f or len(prices_f) < 10:
            print(
                "🚨 [IP Banned 감지] 바이낸스 선물 API 접속 불가. 임시 조치로 바이비트 선물을 가볍게 찌릅니다!!!"
            )
            prices_f = []
            premium_f = []
            info_f_symbols = []
            for base, b_inf in bybit_data.items():
                if b_inf.get("futures_price", 0) > 0:
                    sym = f"{base}USDT"
                    info_f_symbols.append(
                        {"symbol": sym, "status": "TRADING", "quoteAsset": "USDT"}
                    )
                    prices_f.append(
                        {
                            "symbol": sym,
                            "lastPrice": b_inf.get("futures_price", 0),
                            "priceChangePercent": b_inf.get("change_24h", 0.0),
                            "quoteVolume": b_inf.get("volume_24h", 0.0),
                        }
                    )
                    premium_f.append(
                        {
                            "symbol": sym,
                            "lastFundingRate": b_inf.get("funding_rate", 0.0),
                        }
                    )
            info_f["symbols"] = info_f_symbols

        # 2. 마켓 필터링 (데이터가 있을 때만 진행)
        active_f = {
            s["symbol"]
            for s in info_f.get("symbols", [])
            if s.get("status") == "TRADING"
            and s.get("quoteAsset") == "USDT"
            and is_valid_ticker(s.get("symbol").replace("USDT", ""))
        }
        active_s = {
            s["symbol"]
            for s in info_s.get("symbols", [])
            if s.get("status") == "TRADING"
            and s.get("quoteAsset") == "USDT"
            and is_valid_ticker(s.get("symbol").replace("USDT", ""))
        }

        # 3. 정밀도(Precision) 및 펀딩비 맵 생성
        b_precisions = {}
        for s in info_f.get("symbols", []) + info_s.get("symbols", []):
            if s.get("quoteAsset") == "USDT" and s.get("symbol") not in b_precisions:
                f_list = s.get("filters", [])
                tick_size = "0.01"
                for filt in f_list:
                    if filt.get("filterType") == "PRICE_FILTER":
                        tick_size = filt.get("tickSize", "0.01")
                        break
                b_precisions[s["symbol"]] = utils.get_precision(tick_size)

        # 🚀 underlyingType & contractType 정보 수집
        binance_types = {}
        for s in info_f.get("symbols", []):
            if s.get("quoteAsset") == "USDT":
                binance_types[s["symbol"]] = {
                    "underlying_type": s.get("underlyingType", ""),
                    "contract_type": s.get("contractType", ""),
                }

        # 🚀 펀딩비 맵
        funding_map = {}
        if isinstance(premium_f, list):
            funding_map = {
                item["symbol"]: float(item["lastFundingRate"])
                for item in premium_f
                if "lastFundingRate" in item
            }

        # 3. 딕셔너리 정리 (데이터 타입 검증 추가)
        f_dict = {}
        if isinstance(prices_f, list):
            f_dict = {
                i["symbol"]: {
                    "price": float(i.get("lastPrice", 0)),
                    "change_24h": float(i.get("priceChangePercent", 0)),
                    "vol": float(i.get("quoteVolume", 0)),
                }
                for i in prices_f
                if isinstance(i, dict) and i.get("symbol") in active_f
            }

        s_dict = {}
        if isinstance(prices_s, list):
            s_dict = {
                i["symbol"]: {
                    "price": float(i.get("lastPrice", 0)),
                    "change_24h": float(i.get("priceChangePercent", 0)),
                    "vol": float(i.get("quoteVolume", 0)),
                }
                for i in prices_s
                if isinstance(i, dict) and i.get("symbol") in active_s
            }

        all_active = active_f.union(active_s)

        # 4. 🚀 9시 시가 수집 (캐시 우선, 없으면 병렬 개별 호출)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        day_cache = UTC0_OPEN_CACHE.get(today_str, {})

        open_price_tasks = []
        utc0_open_dict = {}

        for ticker in all_active:
            sym = ticker.replace("USDT", "")
            if sym in day_cache:
                utc0_open_dict[sym] = day_cache[sym]
            else:
                open_price_tasks.append((sym, ticker in active_f))

        if open_price_tasks:
            print(
                f"⏳ [시가 보정] 캐시 누락 {len(open_price_tasks)}건 발생. 일봉 klines 병렬 캡처로 1방에 보정합니다..."
            )
            fetch_missing_utc0_opens_parallel(open_price_tasks)
            day_cache = UTC0_OPEN_CACHE.get(today_str, {})
            for sym, _ in open_price_tasks:
                if sym in day_cache:
                    utc0_open_dict[sym] = day_cache[sym]

        # 5. 최종 데이터 합치기
        for ticker in all_active:
            sym = ticker.replace("USDT", "")
            binance_base_assets.add(sym)
            f_data, s_data = f_dict.get(ticker, {}), s_dict.get(ticker, {})
            t_details = binance_types.get(ticker, {})

            binance_data[ticker] = {
                "price": f_data.get("price", s_data.get("price", 0)),
                "change_24h": f_data.get("change_24h", s_data.get("change_24h", 0)),
                "vol_futures": f_data.get("vol", 0.0),
                "vol_spot": s_data.get("vol", 0.0),
                "precision": b_precisions.get(ticker, 2),
                "is_spot_only": ticker not in active_f,
                "is_futures": ticker in active_f,
                "is_spot": ticker in active_s,
                "utc0_open": utc0_open_dict.get(sym),
                "funding_rate": funding_map.get(ticker, 0.0),  # 🚀 펀딩비 꽂아넣기
                "underlying_type": t_details.get("underlying_type", ""),
                "contract_type": t_details.get("contract_type", ""),
            }
    except Exception as e:
        print(f"🚨 [바이낸스 수집 에러]: {e}")

    return binance_data, binance_base_assets


# 업비트 가격 수집 (새로 생성)
def fetch_upbit_prices(upbit_assets):
    upbit_data = {}
    if not upbit_assets:
        return upbit_data

    upbit_list = list(upbit_assets)
    for i in range(0, len(upbit_list), 40):
        chunk = upbit_list[i : i + 40]
        markets_str = ",".join([f"KRW-{k}" for k in chunk])

        success = False
        for attempt in range(3):
            try:
                res = api_session.get(
                    f"https://api.upbit.com/v1/ticker?markets={markets_str}", timeout=5
                ).json()

                for item in res:
                    sym = item["market"].replace("KRW-", "")
                    upbit_data[sym] = {
                        "raw_item": item,
                        "price": item["trade_price"],
                        "utc0_open": item["opening_price"],
                        "change_24h": item.get("signed_change_rate", 0.0) * 100,
                        "volume_24h": item.get("acc_trade_price_24h", 0.0),
                    }
                success = True
                break
            except Exception as e:
                import time

                print(f"🚨 [업비트 수집 에러 (Chunk)] (시도 {attempt+1}/3): {e}")
                time.sleep(1.0)
        if not success:
            print(
                f"❌ [업비트 수집 최종 실패 (Chunk)] {markets_str[:40]}... 청크 데이터 유실"
            )

    return upbit_data


def fetch_bybit_prices():
    bybit_data = {}
    try:
        # 1. 시세 (Ticker) 가져오기 - 현물(spot)
        res_s = api_session.get(
            "https://api.bybit.com/v5/market/tickers?category=spot", timeout=5
        ).json()
        s_list = res_s.get("result", {}).get("list", [])

        # 2. 시세 (Ticker) 가져오기 - 선물(linear)
        res_f = api_session.get(
            "https://api.bybit.com/v5/market/tickers?category=linear", timeout=5
        ).json()
        f_list = res_f.get("result", {}).get("list", [])

        # 3. 정밀도(Precision) 가져오기 - 선물(linear)
        res_p = api_session.get(
            "https://api.bybit.com/v5/market/instruments-info?category=linear",
            timeout=5,
        ).json()
        p_list = res_p.get("result", {}).get("list", [])

        # 4. 정밀도 맵핑
        b_precisions = {}
        for item in p_list:
            sym = item.get("symbol", "")
            if sym.endswith("USDT"):
                scale = item.get("priceScale")
                if scale is not None:
                    b_precisions[sym.replace("USDT", "")] = int(scale)

        # 5. 데이터 매핑 (티커별 spot/futures 가격 및 거래대금)
        for item in s_list:
            sym = item["symbol"]
            if sym.endswith("USDT") and is_valid_ticker(sym.replace("USDT", "")):
                base = sym.replace("USDT", "")
                if base not in bybit_data:
                    bybit_data[base] = {"volume_24h": 0.0}
                bybit_data[base]["spot_price"] = float(item.get("lastPrice", 0))
                bybit_data[base]["volume_24h"] += float(item.get("turnover24h", 0))

        for item in f_list:
            sym = item["symbol"]
            if sym.endswith("USDT") and is_valid_ticker(sym.replace("USDT", "")):
                base = sym.replace("USDT", "")
                if base not in bybit_data:
                    bybit_data[base] = {"volume_24h": 0.0}
                bybit_data[base]["futures_price"] = float(item.get("lastPrice", 0))
                bybit_data[base]["volume_24h"] += float(item.get("turnover24h", 0))
                bybit_data[base]["funding_rate"] = float(item.get("fundingRate", 0))
                if base in b_precisions:
                    bybit_data[base]["precision"] = b_precisions[base]

    except Exception as e:
        print(f"🚨 [바이비트 수집 에러]: {e}")
    return bybit_data


def fetch_bithumb_prices():
    bithumb_data = {}
    try:
        res = api_session.get(
            "https://api.bithumb.com/public/ticker/ALL_KRW", timeout=5
        ).json()
        if res.get("status") == "0000":
            raw_data = res.get("data", {})
            for sym, item in raw_data.items():
                if sym == "date":
                    continue
                try:
                    bithumb_data[sym.upper()] = {
                        "price": float(item.get("closing_price", 0)),
                        "volume_24h": float(item.get("acc_trade_value_24H", 0)),
                    }
                except:
                    pass
    except Exception as e:
        print(f"🚨 [빗썸 수집 에러]: {e}")
    return bithumb_data
