# modules/alpha_rules.py
"""
💎 [Custom Alpha Gems Rule Engine]
바이낸스 알파(Binance Alpha) 전용 커스텀 규칙 및 동적 자동 선별 엔진
- 향후 규칙 알고리즘 변경/추가/삭제 시 이 파일의 evaluate_gem_rules()만 수정하면 됩니다.
"""

from datetime import datetime, timezone
import concurrent.futures
import requests
import asyncio


def fetch_tv_1d_opens_sync(symbols):
    """
    🚀 [트레이딩뷰 1D 시가 전담 병렬 수집기 (폴백 전용)]
    - 오늘 09시 시가 캐시(utc0_prices.json)에 누락된 알파 코인만 선별하여 트뷰 1D 일봉 시가를 병렬 조회
    - 트뷰 일봉이 없으면 임의 추정하지 않고 그대로 pass
    """
    if not symbols:
        return {}

    async def _async_fetch():
        from modules.candle_proxy import PERSISTENT_TV_CLIENT

        opens = {}

        async def _fetch_one(sym):
            clean_base = sym.upper().strip()
            candidates = [
                f"BYBIT:{clean_base}USDT",
                f"BITGET:{clean_base}USDT",
                f"GATEIO:{clean_base}USDT",
            ]
            for tv_sym in candidates:
                try:
                    c = await PERSISTENT_TV_CLIENT.get_candles(tv_sym, "1D", 2)
                    if c and len(c) > 0:
                        op = float(c[-1][1])
                        if op > 0:
                            return sym, op
                except Exception:
                    pass
            return sym, None

        tasks = [_fetch_one(s) for s in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, tuple) and len(r) == 2 and r[1]:
                opens[r[0]] = r[1]
        return opens

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(lambda: asyncio.run(_async_fetch())).result(
                    timeout=10
                )
        else:
            return asyncio.run(_async_fetch())
    except Exception as e:
        print(f"⚠️ [Alpha TV 1D Open Error]: {e}")
        return {}


SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }
)


def fetch_binance_alpha_raw():
    """바이낸스 알파 API 전체 토큰 목록 및 실시간 시세/메타 수집"""
    alpha_map = {}
    try:
        url = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
        res = SESSION.get(url, timeout=5).json()
        items = res.get("data", []) if isinstance(res, dict) else []
        for item in items:
            sym = (item.get("symbol") or "").upper().strip()
            if sym and sym not in alpha_map:
                alpha_map[sym] = item
    except Exception as e:
        print(f"[Alpha Engine Error] Binance alpha fetch failed: {e}")
    return alpha_map


def evaluate_gem_rules(sym, exch_tags):
    """
    🎯 [커스텀 규칙 알고리즘 판정기]
    - 규칙을 바꾸고 싶을 때 이 함수 내부의 조건식만 수정하면 됩니다.
    - True 반환 시 선별되어 바이낸스 현물 파이프라인으로 주입됩니다.
    """
    # 🚫 [공통 제외 규칙] 업비트 상장, 바이낸스 선물 상장, 주식(STOCK) 토큰 원천 배제
    if "UPBIT" in exch_tags:
        return False
    if "BINANCE_FUTURES" in exch_tags:
        return False
    if "BINANCE_STOCK" in exch_tags:
        return False

    # 거래소 보유 상태
    has_bithumb = "BITHUMB" in exch_tags
    has_coinbase = "COINBASE_SPOT" in exch_tags or "COINBASE" in exch_tags
    has_gateio = "GATEIO_SPOT" in exch_tags or "GATEIO" in exch_tags
    has_bitget = "BITGET_SPOT" in exch_tags or "BITGET" in exch_tags
    has_bybit = "BYBIT_SPOT" in exch_tags or "BYBIT" in exch_tags

    # 4대 조건식 (하나라도 만족 시 통과)
    # Case 1: 빗썸 상장 알파 보석
    if has_bithumb:
        return True

    # Case 2: 코인베이스 현물 + 게이트아이오 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_coinbase and has_gateio:
        return True

    # Case 3: 비트겟 현물 + 코인베이스 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_bitget and has_coinbase:
        return True

    # Case 4: 비트겟 현물 + 바이비트 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_bitget and has_bybit:
        return True

    return False


def filter_dynamic_alpha_gems(
    alpha_map,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
    binance_futures_set=None,
    binance_stock_set=None,
):
    """
    전체 알파 코인 중 커스텀 알고리즘을 통과한 보석 코인들만 딕셔너리로 반환
    """
    if binance_futures_set is None:
        binance_futures_set = set()
    if binance_stock_set is None:
        binance_stock_set = set()

    matched_gems = {}
    for sym, alpha_item in alpha_map.items():
        # 심볼 상장 거래소 목록 종합
        exch_tags = set(global_listings.get(sym, set()))
        if sym in upbit_krw_set:
            exch_tags.add("UPBIT")
        if sym in bithumb_krw_set:
            exch_tags.add("BITHUMB")
        if sym in binance_futures_set or f"{sym}USDT" in binance_futures_set:
            exch_tags.add("BINANCE_FUTURES")
        if sym in binance_stock_set or f"{sym}(STOCK)" in binance_stock_set:
            exch_tags.add("BINANCE_STOCK")

        if evaluate_gem_rules(sym, exch_tags):
            matched_gems[sym] = alpha_item

    return matched_gems


def inject_alpha_gems_into_pipeline(
    binance_data,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
):
    """
    🚀 [파이프라인 원클릭 주입 함수]
    선별된 보석 코인들을 바이낸스 현물(Spot) 파이프라인과 글로벌 상장 태그에 직접 주입
    """
    try:
        alpha_map = fetch_binance_alpha_raw()
        binance_fut_set = {
            k.replace("USDT", "")
            for k, v in binance_data.items()
            if v.get("is_futures")
        }
        binance_stock_set = {
            k.replace("USDT", "")
            for k, v in binance_data.items()
            if "STOCK" in str(v.get("underlying_type", "")).upper() or "(STOCK)" in k
        }

        dynamic_gems = filter_dynamic_alpha_gems(
            alpha_map,
            global_listings,
            upbit_krw_set,
            bithumb_krw_set,
            binance_fut_set,
            binance_stock_set,
        )

        from . import exchange_api

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_cache = exchange_api.UTC0_OPEN_CACHE.setdefault(today_str, {})

        # 🚀 [시가 보정 (트뷰 1D 폴백)] 오늘 시가 캐시에 누락된 알파 코인만 트뷰 일봉 시가 병렬 조회 (없으면 pass)
        missing_syms = [
            sym
            for sym in dynamic_gems.keys()
            if not today_cache.get(sym) or float(today_cache.get(sym) or 0) <= 0
        ]
        if missing_syms:
            tv_opens = fetch_tv_1d_opens_sync(missing_syms)
            cache_dirty = False
            for sym, tv_open in tv_opens.items():
                if tv_open and tv_open > 0:
                    today_cache[sym] = tv_open
                    cache_dirty = True
            if cache_dirty:
                exchange_api.save_utc0_cache()

        injected_count = 0
        for sym, alpha_item in dynamic_gems.items():
            ticker = f"{sym}USDT"

            # 1. 글로벌 리스팅 태그 보강
            if sym not in global_listings:
                global_listings[sym] = set()
            global_listings[sym].add("BINANCE_ALPHA")
            global_listings[sym].add("BINANCE_SPOT")
            global_listings[sym].add("BINANCE")

            spot_utc0 = today_cache.get(sym)
            if spot_utc0 is not None and float(spot_utc0) > 0:
                spot_utc0 = float(spot_utc0)
            else:
                spot_utc0 = None

            # 2. 바이낸스 현물 파이프라인 주입 (기존 데이터가 있으면 알파 플래그 부여)
            if ticker in binance_data:
                binance_data[ticker]["is_alpha"] = True
                binance_data[ticker]["is_spot"] = True
                binance_data[ticker]["alpha_meta"] = alpha_item
                if not binance_data[ticker].get("spot_utc0_open") and spot_utc0:
                    binance_data[ticker]["spot_utc0_open"] = spot_utc0
                if not binance_data[ticker].get("utc0_open") and spot_utc0:
                    binance_data[ticker]["utc0_open"] = spot_utc0
            else:
                try:
                    p = float(alpha_item.get("price") or 0.0)
                    chg = float(alpha_item.get("percentChange24h") or 0.0)
                    vol = float(alpha_item.get("volume24h") or 0.0)
                except:
                    p, chg, vol = 0.0, 0.0, 0.0

                binance_data[ticker] = {
                    "price": p,
                    "spot_price": p,
                    "futures_price": 0.0,
                    "change_24h": chg,
                    "spot_change_24h": chg,
                    "futures_change_24h": 0.0,
                    "vol_futures": 0.0,
                    "vol_spot": vol,
                    "precision": 4 if p < 1 else 2,
                    "is_spot_only": True,
                    "is_futures": False,
                    "is_spot": True,  # 🚀 바낸 현물(Spot) 체제 흡수!
                    "is_alpha": True,  # 🚀 알파 플래그!
                    "spot_utc0_open": spot_utc0,
                    "futures_utc0_open": None,
                    "utc0_open": spot_utc0,
                    "funding_rate": 0.0,
                    "binance_futures_funding_interval": 8,
                    "funding_interval": 8,
                    "underlying_type": "",
                    "contract_type": "",
                    "alpha_meta": alpha_item,
                }
                injected_count += 1

        if injected_count > 0:
            print(
                f"[Alpha Engine] {len(dynamic_gems)} gems auto-selected ({injected_count} new injected into Binance Spot)"
            )

        return dynamic_gems
    except Exception as e:
        print(f"[Alpha Engine Error] Injection failed: {e}")
        return {}
