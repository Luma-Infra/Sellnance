# api_manager.py
from contextlib import contextmanager
from datetime import datetime
import threading
import traceback
import hashlib
import time
import json
import pytz
import sys
import os
import re
import asyncio
import aiohttp

# ✅ 수정
from modules import builder, cmc_api, exchange_api, config_manager, utils
from modules.exchange_api import capture_utc0_prices_bulk

# --- ⭐️ GLOBAL CACHE SETTINGS ⭐️ ---
KST = pytz.timezone("Asia/Seoul")
GLOBAL_CACHE = {"data": [], "timestamp": datetime.min, "last_updated_str": ""}
GLOBAL_CMC_CACHE = {
    "map": {},
    "lookup": {},
    "timestamp": datetime.min,
}  # 🚀 CMC 크레딧 방어용 독립 캐시

MARKET_DATA_CACHE_FILE = os.path.join(
    os.path.dirname(__file__), "../static/market_data_cache.json"
)
OWNER_CACHE_FILE = os.path.join(
    os.path.dirname(__file__), "../static/cmc_owner_cache.json"
)
OWNER_CACHE_TIMEOUT = 14400  # 4시간
USER_CACHE_TIMEOUT = 900  # 15분

USER_CMC_CACHES = {}
user_cache_lock = threading.Lock()
data_lock = threading.Lock()


def _load_market_data_cache_from_file():
    global GLOBAL_CACHE
    try:
        if os.path.exists(MARKET_DATA_CACHE_FILE):
            with open(MARKET_DATA_CACHE_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                data = saved.get("data", [])
                ts_str = saved.get("last_updated_str", "")
                if data:
                    GLOBAL_CACHE["data"] = data
                    GLOBAL_CACHE["last_updated_str"] = ts_str
                    raw_ts = saved.get("timestamp", "")
                    if raw_ts:
                        try:
                            GLOBAL_CACHE["timestamp"] = datetime.fromisoformat(raw_ts)
                        except:
                            GLOBAL_CACHE["timestamp"] = datetime.now(KST)
                    print(
                        f"⚡ [MARKET DATA CACHE] 파일에서 {len(data)}개 전체 코인 장부 즉시 로드 완료 (0초 서빙 준비 완료)"
                    )
    except Exception as e:
        print(f"🚨 [MARKET DATA CACHE LOAD ERROR] {e}")


def _save_market_data_cache_to_file():
    try:
        utils.atomic_save_json(
            MARKET_DATA_CACHE_FILE,
            {
                "data": GLOBAL_CACHE["data"],
                "last_updated_str": GLOBAL_CACHE["last_updated_str"],
                "timestamp": (
                    GLOBAL_CACHE["timestamp"].isoformat()
                    if GLOBAL_CACHE["timestamp"] != datetime.min
                    else ""
                ),
            },
            indent=2,
            ensure_ascii=False,
        )
        print("💾 [MARKET DATA CACHE] 파일 캐시 저장 완료 (market_data_cache.json)")
    except Exception as e:
        print(f"🚨 [MARKET DATA CACHE SAVE ERROR] {e}")


def _load_owner_cache_from_file():
    global GLOBAL_CMC_CACHE
    try:
        if os.path.exists(OWNER_CACHE_FILE):
            with open(OWNER_CACHE_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                GLOBAL_CMC_CACHE["map"] = saved.get("map", {})
                GLOBAL_CMC_CACHE["lookup"] = saved.get("lookup", {})
                ts_str = saved.get("timestamp", "")
                if ts_str:
                    GLOBAL_CMC_CACHE["timestamp"] = datetime.fromisoformat(ts_str)
                print(
                    f"💾 [CMC CACHE] 파일에서 {len(GLOBAL_CMC_CACHE['map'])}개 캐시 데이터 로드 완료"
                )
    except Exception as e:
        print(f"🚨 [CMC CACHE LOAD ERROR] {e}")


def _save_owner_cache_to_file():
    try:
        utils.atomic_save_json(
            OWNER_CACHE_FILE,
            {
                "map": GLOBAL_CMC_CACHE["map"],
                "lookup": GLOBAL_CMC_CACHE["lookup"],
                "timestamp": (
                    GLOBAL_CMC_CACHE["timestamp"].isoformat()
                    if GLOBAL_CMC_CACHE["timestamp"] != datetime.min
                    else ""
                ),
            },
            indent=2,
            ensure_ascii=False,
        )
        print("💾 [CMC CACHE] 파일 캐시 저장 완료")
    except Exception as e:
        print(f"🚨 [CMC CACHE SAVE ERROR] {e}")


# 모듈 로드 시점에 파일 캐시 불러오기
_load_owner_cache_from_file()
_load_market_data_cache_from_file()


# 9시 정각 시가 초기화 & 원자적 캐시 갱신 원스톱 파이프라인
def trigger_kst_9am_reset_atomic():
    """
    9시 정각 초기화 원스톱 파이프라인
    1. 구 날짜 시가 캐시 초기화 (capture_utc0_prices_bulk)
    2. 09:00 당일 시가 벌크 수집 + 마켓 데이터 캐시 즉시 갱신 (_fetch_and_process_data_and_cache)
    """
    print("🎯 [9AM PIPELINE] KST 09:00 시가 초기화 및 캐시 갱신 개시...")
    try:
        capture_utc0_prices_bulk()
        _fetch_and_process_data_and_cache(silent_mode=True)
        print("✅ [9AM PIPELINE] KST 09:00 동기화 완료!")
        return True
    except Exception as e:
        print(f"🚨 [9AM PIPELINE ERROR] 9시 초기화 파이프라인 오류: {e}")
        return False


# 🚀 [단일 지휘관 스케줄러] 15분 정각(:00, :15, :30, :45) 단일 스케줄러
# 09:00 정각에는 9시 전담 파이프라인을 실행하고, 그 외 시각에는 일반 정기 갱신을 실행하여 중복 실행 0% 보장
def get_seconds_until_next_15min():
    now = datetime.now(KST)
    current_minute = now.minute
    current_second = now.second
    next_minute = ((current_minute // 15) + 1) * 15
    if next_minute == 60:
        seconds_left = (60 - current_minute) * 60 - current_second
    else:
        seconds_left = (next_minute - current_minute) * 60 - current_second
    return max(1, seconds_left)


def start_unified_background_scheduler():
    """
    🛡️ 단일 통합 백그라운드 스케줄러
    - 스레드 1개로만 동작하여 09:00 중복 실행 및 락 경합 물리적 0% 차단
    - 09:00:00 -> 9시 시가 초기화 + 당일 시가 벌크 수집 + 캐시 갱신 (원스톱)
    - :15, :30, :45, 타 시간대 :00 -> 일반 15분 무음 정기 갱신
    """

    def run():
        print("🔄 [SYSTEM] 단일 통합 백그라운드 스케줄러 가동 (:00, :15, :30, :45)...")
        while True:
            sleep_sec = get_seconds_until_next_15min()
            time.sleep(sleep_sec)
            try:
                now = datetime.now(KST)
                if now.hour == 9 and now.minute == 0:
                    print(
                        "🎯 [BG SCHEDULER] KST 09:00 정각 9시 시가 초기화 파이프라인 단독 실행..."
                    )
                    trigger_kst_9am_reset_atomic()
                else:
                    print(
                        f"🔄 [BG SCHEDULER] {now.strftime('%H:%M:%S')} 정각 자동 갱신 시작..."
                    )
                    _fetch_and_process_data_and_cache(silent_mode=True)
            except Exception as e:
                print(f"🚨 [BG SCHEDULER ERROR] {e}")

    thread = threading.Thread(target=run, daemon=True)
    thread.start()


def _fetch_and_process_data_and_cache(silent_mode=False):
    """캐시까지 업데이트하는 내부 유틸 (스케줄러 전용)"""
    global GLOBAL_CACHE
    kst = pytz.timezone("Asia/Seoul")
    now_kst = datetime.now(kst)
    try:
        raw_data = _fetch_and_process_data(silent_mode=silent_mode)
        if raw_data:
            with data_lock:
                GLOBAL_CACHE.update(
                    {
                        "data": raw_data,
                        "timestamp": now_kst,
                        "last_updated_str": now_kst.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                )
            print(
                f"✅ [BG] 캐시 갱신 완료! (총 {len(raw_data)}개, Silent:{silent_mode})"
            )
    except Exception as e:
        print(f"🚨 [BG CACHE ERROR] {e}")


# 서버 로드 시 단일 통합 스케줄러 즉시 실행 (스레드 1개로 중복 실행 100% 원천 방지)
start_unified_background_scheduler()


# [초경량 실시간 상장 감시 엔진] aiohttp 비동기 멀티플렉싱 10초 무음 폴러
def start_realtime_listing_watcher():
    """
    ⚡ aiohttp 비동기 멀티플렉싱 초경량 무음 상장 감시 엔진 (5대 거래소 동시 병렬 수거)
    """
    targets = [
        (
            "UPBIT",
            "https://api.upbit.com/v1/market/all?isDetails=false",
            lambda d: {
                m["market"] for m in d if m.get("market", "").startswith("KRW-")
            },
        ),
        (
            "BITHUMB",
            "https://api.bithumb.com/v1/market/all?isDetails=false",
            lambda d: {
                m["market"] for m in d if m.get("market", "").startswith("KRW-")
            },
        ),
        (
            "BINANCE_FUTURES",
            "https://fapi.binance.com/fapi/v1/ticker/price",
            lambda d: {m["symbol"] for m in d if m.get("symbol", "").endswith("USDT")},
        ),
        (
            "BINANCE_SPOT",
            "https://api.binance.com/api/v3/ticker/price",
            lambda d: {m["symbol"] for m in d if m.get("symbol", "").endswith("USDT")},
        ),
        (
            "BYBIT_FUTURES",
            "https://api.bybit.com/v5/market/tickers?category=linear",
            lambda d: {
                m["symbol"]
                for m in d.get("result", {}).get("list", [])
                if m.get("symbol", "").endswith("USDT")
            },
        ),
    ]

    async def async_watcher_loop():
        timeout = aiohttp.ClientTimeout(total=3)
        connector = aiohttp.TCPConnector(limit=10, ssl=False)
        known = {ex: set() for ex, _, _ in targets}
        initialized = False

        async with aiohttp.ClientSession(
            timeout=timeout, connector=connector
        ) as session:
            while True:
                try:
                    current = {}

                    async def _fetch(ex, url, parser):
                        try:
                            async with session.get(url) as r:
                                if r.status == 200:
                                    current[ex] = parser(await r.json())
                        except Exception:
                            pass

                    await asyncio.gather(
                        *[_fetch(ex, url, parser) for ex, url, parser in targets]
                    )

                    if not initialized:
                        for ex, mkts in current.items():
                            if mkts:
                                known[ex] = set(mkts)
                        if any(known.values()):
                            initialized = True
                    else:
                        new_diff = {
                            ex: current[ex] - known[ex]
                            for ex in current
                            if known.get(ex) and (current[ex] - known[ex])
                        }
                        if new_diff:
                            for ex, syms in new_diff.items():
                                known[ex].update(syms)
                            discovery_msgs = [
                                f"[{ex}] {', '.join(sorted(syms))}"
                                for ex, syms in new_diff.items()
                            ]
                            print(
                                f"\n🚨 [신규 상장 감지] {' | '.join(discovery_msgs)} 신규 상장 포착! 긴급 0초 장부 동기화 가동..."
                            )
                            _fetch_and_process_data_and_cache(silent_mode=True)
                            print(
                                f"⚡ [신규 상장 동기화 완료] 신규 상장 코인이 장부에 즉시 입고되었습니다.\n"
                            )
                except Exception:
                    pass
                await asyncio.sleep(10)

    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(async_watcher_loop())
        finally:
            loop.close()

    threading.Thread(target=run, daemon=True).start()


# 실시간 신규 상장 aiohttp 비동기 멀티플렉싱 와처 즉시 가동 (10초 주기)
start_realtime_listing_watcher()

# 🚀 [수정] 모듈 로드 시점에 즉시 실행하지 않고, 처음 호출될 때 초기화하도록 변경
_INITIALIZED = False
MAPPING_DATA = None


def _ensure_initialized():
    global _INITIALIZED, MAPPING_DATA
    if _INITIALIZED:
        return
    try:
        MAPPING_DATA = config_manager.load_mapping_data()
        _INITIALIZED = True
    except:
        pass


@contextmanager
def suppress_output():
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    try:
        with open(os.devnull, "w") as devnull:
            sys.stdout = devnull
            sys.stderr = devnull
            yield
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr


# ==========================================
# 👑 최종 함수 BOSS
# ==========================================
def _fetch_and_process_data(silent_mode=False, api_key=None):
    global GLOBAL_CMC_CACHE
    # 🚀 1. 족보 로드 (항상 최신본으로 시작!)
    MAPPING_DATA = config_manager.load_mapping_data()
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
    ) = config_manager.get_mapping_parts(MAPPING_DATA)

    # 1. 시세 수집 (바낸/업비트/바이비트/펀비 무료 무제한 타격!)
    (
        binance_data,
        upbit_data,
        upbit_krw_set,
        upbit_only_assets,
        bithumb_krw_set,
        bybit_data,
        bithumb_data,
    ) = exchange_api.fetch_exchange_market_data(MAPPING_DATA)
    print(
        f"📊 [1/3 시세/펀비 수집 완료 (Silent:{silent_mode})] 바낸:{len(binance_data)}, 업비트:{len(upbit_data)}, 바이비트:{len(bybit_data)}"
    )

    # 2. 정보 수집 (CMC 크레딧 철벽 방어!)
    now_kst = datetime.now(KST)
    is_user_key = bool(api_key and isinstance(api_key, str) and api_key.strip() != "")

    if is_user_key and api_key:
        # 유저 개별 키 처리 (15분 주기 메모리 캐시)
        key_hash = hashlib.sha256(api_key.strip().encode()).hexdigest()
        with user_cache_lock:
            user_cache = USER_CMC_CACHES.setdefault(
                key_hash, {"map": {}, "lookup": {}, "timestamp": datetime.min}
            )

        cmc_expired = False
        if user_cache["timestamp"] != datetime.min:
            cmc_expired = (
                now_kst - user_cache["timestamp"].astimezone(KST)
            ).total_seconds() > USER_CACHE_TIMEOUT
        else:
            cmc_expired = True

        if not cmc_expired and user_cache.get("map"):
            market_data_map = user_cache["map"]
            asset_to_lookup_key = user_cache["lookup"]
            print(
                "🛡️ [2/3 CMC 유저 캐시 재활용] API 크레딧 소모 0, 기존 시가총액 장부 유지"
            )
        else:
            market_data_map, asset_to_lookup_key = cmc_api.fetch_cmc_market_data(
                binance_data, upbit_only_assets, MAPPING_DATA, api_key=api_key
            )
            with user_cache_lock:
                USER_CMC_CACHES[key_hash] = {
                    "map": market_data_map,
                    "lookup": asset_to_lookup_key,
                    "timestamp": now_kst,
                }
            print(
                f"📊 [2/3 CMC 유저 키 호출 완료] 장부 매칭 성공:{len(market_data_map)}개"
            )
    else:
        # 서버 키 처리 (4시간 정각 캐시: 01:00, 05:00, 09:00, 13:00, 17:00, 21:00)
        cmc_expired = False
        if GLOBAL_CMC_CACHE["timestamp"] != datetime.min:
            last_ts = GLOBAL_CMC_CACHE["timestamp"].astimezone(KST)
            seconds_diff = (now_kst - last_ts).total_seconds()
            is_at_4h_mark = (now_kst.hour in [1, 5, 9, 13, 17, 21]) and (
                last_ts.hour != now_kst.hour or last_ts.date() != now_kst.date()
            )
            cmc_expired = (seconds_diff >= OWNER_CACHE_TIMEOUT) or is_at_4h_mark
        else:
            cmc_expired = True

        if not cmc_expired and GLOBAL_CMC_CACHE.get("map"):
            market_data_map = GLOBAL_CMC_CACHE["map"]
            asset_to_lookup_key = GLOBAL_CMC_CACHE["lookup"]
            print(
                "🛡️ [2/3 CMC 서버 캐시 재활용] API 크레딧 소모 0, 기존 시가총액 장부 유지"
            )
        else:
            market_data_map, asset_to_lookup_key = cmc_api.fetch_cmc_market_data(
                binance_data, upbit_only_assets, MAPPING_DATA, api_key=None
            )
            GLOBAL_CMC_CACHE = {
                "map": market_data_map,
                "lookup": asset_to_lookup_key,
                "timestamp": now_kst,
            }
            _save_owner_cache_to_file()
            print(
                f"📊 [2/3 CMC 서버 키 호출 완료 (4시간 정각 API 호출)] 장부 매칭 성공:{len(market_data_map)}개"
            )

    # 3. 조립 및 계산
    global_listings = exchange_api.fetch_global_listings()

    # ✅ 조립 부대 가동 (에러 방어막 가동)
    final_results = []
    is_mapping_updated = False
    try:
        final_results, is_mapping_updated = builder.assemble_final_dashboard(
            global_listings,
            binance_data,
            upbit_data,
            market_data_map,
            asset_to_lookup_key,
            upbit_krw_set,
            bithumb_krw_set,
            upbit_only_assets,
            MAPPING_DATA,
            bybit_data,
            bithumb_data,
        )
        print(f"📊 [3/3 장부 조립 완료] 최종 {len(final_results)}개 자산 입고")
    except Exception as e:
        print(f"🚨 [조립 치명적 에러]: {e}")
        traceback.print_exc()

    if is_mapping_updated:
        config_manager.save_mapping_data(MAPPING_DATA)
        print("💾 [업데이트] 새로운 족보(mapping.json)가 저장되었습니다.")

    all_live_assets = binance_data.keys() | upbit_krw_set | bybit_data.keys()
    live_bases = {utils.get_pure_base_asset(a).upper() for a in all_live_assets}

    # 🚀 [청소기 가동 구간 - 철벽 방어막 장착]
    # 사일런트 모드이거나, 수집된 데이터가 평소보다 적으면 족보 청소를 절대 하지 않고 즉시 퇴근합니다!!!
    if silent_mode or len(binance_data) < 10 or len(upbit_krw_set) < 10:
        print(
            f"⚠️ [SAFEGUARD] 족보 청소 생략 (Silent:{silent_mode}, 바낸:{len(binance_data)}, 업비트:{len(upbit_krw_set)})"
        )
        return final_results

    keys_to_delete = []
    dup_names = set(MAPPING_DATA.get("DUPLICATED_LIST", {}).keys())
    dup_names_clean = {
        re.sub(
            r"_(binance|upbit|bithumb|bybit|binance_stock)$", "", k, flags=re.IGNORECASE
        )
        for k in dup_names
    }

    if "TICKER_DATA" not in MAPPING_DATA:
        MAPPING_DATA["TICKER_DATA"] = {}

    for saved_name in list(MAPPING_DATA["TICKER_DATA"].keys()):
        # 🚀 [추가] (STOCK) 접미사가 붙은 주식 자산의 경우, 접미사 제거한 base 심볼로 실시간 수집 리스트(live_bases)와 매칭 체크
        clean_name = re.sub(r"\(STOCK\)$", "", saved_name, flags=re.IGNORECASE)
        if (
            clean_name not in live_bases
            and saved_name not in SPECIAL_SYMBOL_MAP
            and saved_name not in SYMBOL_TO_ID_MAP
            and saved_name not in dup_names_clean
        ):
            keys_to_delete.append(saved_name)

    for k in keys_to_delete:
        del MAPPING_DATA["TICKER_DATA"][k]
        is_mapping_updated = True
        print(f"🧹 [청소] 상폐/미거래 코인 {k} 족보에서 삭제 완료!")

    if isinstance(final_results, list):
        final_results.sort(
            key=lambda x: float(
                x.get("MarketCap_Raw") if x.get("MarketCap_Raw") is not None else 0.0
            ),
            reverse=True,
        )

    if is_mapping_updated:
        config_manager.save_mapping_data(MAPPING_DATA)
        print(f"💾 새로운 코인 정보가 mapping.json에 저장 완료되었습니다!")

    return final_results


def get_cached_data(force_reload=False, silent_mode=False, user_api_key=None):
    global GLOBAL_CACHE
    _ensure_initialized()

    kst = pytz.timezone("Asia/Seoul")
    now_kst = datetime.now(kst)

    # 🚀 유저 개별 API 키가 주입된 경우: 15분 동안 조립된 장부(assembled_data)를 메모리 캐시하여 새로고침 시 0초 즉시 반환!
    if user_api_key and isinstance(user_api_key, str) and user_api_key.strip() != "":
        key_hash = hashlib.sha256(user_api_key.strip().encode()).hexdigest()
        with user_cache_lock:
            user_cache = USER_CMC_CACHES.setdefault(
                key_hash,
                {
                    "map": {},
                    "lookup": {},
                    "timestamp": datetime.min,
                    "assembled_data": None,
                },
            )
            is_user_expired = (
                user_cache["timestamp"] == datetime.min
                or (now_kst - user_cache["timestamp"].astimezone(KST)).total_seconds()
                > USER_CACHE_TIMEOUT
            )
            if (
                not force_reload
                and not is_user_expired
                and user_cache.get("assembled_data")
            ):
                user_ts = user_cache.get("timestamp", datetime.min)
                ts_str = (
                    user_ts.astimezone(kst).strftime("%Y-%m-%d %H:%M:%S")
                    if user_ts != datetime.min
                    else now_kst.strftime("%Y-%m-%d %H:%M:%S")
                )
                return user_cache["assembled_data"], ts_str

        raw_data = _fetch_and_process_data(silent_mode=False, api_key=user_api_key)
        with user_cache_lock:
            user_cache = USER_CMC_CACHES.setdefault(key_hash, {})
            user_cache["assembled_data"] = raw_data
            user_ts = user_cache.get("timestamp", datetime.min)
        ts_str = (
            user_ts.astimezone(kst).strftime("%Y-%m-%d %H:%M:%S")
            if user_ts != datetime.min
            else now_kst.strftime("%Y-%m-%d %H:%M:%S")
        )
        return raw_data, ts_str

    with data_lock:
        needs_reset = False
        if GLOBAL_CACHE["timestamp"] != datetime.min:
            last_update_kst = GLOBAL_CACHE["timestamp"].astimezone(kst)
            if now_kst.hour >= 9 and (
                last_update_kst.date() < now_kst.date() or last_update_kst.hour < 9
            ):
                needs_reset = True
                print("🚨 오전 9시 정각 리셋 트리거 발동!")

        is_expired = False
        if GLOBAL_CACHE["timestamp"] != datetime.min:
            is_expired = (
                now_kst - GLOBAL_CACHE["timestamp"].astimezone(kst)
            ).total_seconds() > OWNER_CACHE_TIMEOUT
        else:
            is_expired = True

        # 🚀 [핵심] silent_mode일 때는 만료와 무관하게 무조건 펀비/시세만 새로 긁어와 캐시 갱신!
        if force_reload or needs_reset or is_expired or silent_mode:
            try:
                raw_data = _fetch_and_process_data(
                    silent_mode=silent_mode, api_key=None
                )

                if raw_data:
                    GLOBAL_CACHE.update(
                        {
                            "data": raw_data,
                            "timestamp": now_kst,
                            "last_updated_str": now_kst.strftime("%Y-%m-%d %H:%M:%S"),
                        }
                    )
                    _save_market_data_cache_to_file()
                    print(
                        f"✅ 데이터 캐싱 완료! (총 {len(raw_data)}개, Silent:{silent_mode})"
                    )
            except Exception as e:
                print(f"데이터 수집 에러: {e}")
                traceback.print_exc()

    data_to_return = GLOBAL_CACHE["data"]
    if isinstance(data_to_return, dict):
        data_to_return = list(data_to_return.values())

    return data_to_return, GLOBAL_CACHE["last_updated_str"]
