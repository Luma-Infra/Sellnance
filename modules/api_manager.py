# api_manager.py
from contextlib import contextmanager
from datetime import datetime
import threading
import traceback
import pytz
import sys
import os
import re

# ✅ 수정 (옆방 부하들 호출하는 정석)
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
CACHE_TIMEOUT_SECONDS = 3600  # 1시간


# 🚀 [추가] 9시 정밀 캡처 스케줄러
def start_kst_9am_scheduler():
    import time

    def run_scheduler():
        print("⏰ [SYSTEM] 9시 정밀 시가 스케줄러 가동 중...")
        last_captured_sec = -1
        while True:
            try:
                now = datetime.now(KST)
                if now.hour == 9 and now.minute == 0 and now.second in [0, 10, 20]:
                    if last_captured_sec != now.second:
                        capture_utc0_prices_bulk()
                        last_captured_sec = now.second
                if now.hour != 9:
                    last_captured_sec = -1
            except Exception as e:
                print(f"🚨 [SCHEDULER ERROR] {e}")
            time.sleep(1)

    thread = threading.Thread(target=run_scheduler, daemon=True)
    thread.start()


# 서버 로드 시 즉시 실행
start_kst_9am_scheduler()

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
def _fetch_and_process_data(silent_mode=False):
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
    cmc_expired = False
    if GLOBAL_CMC_CACHE["timestamp"] != datetime.min:
        cmc_expired = (
            now_kst - GLOBAL_CMC_CACHE["timestamp"].astimezone(KST)
        ).total_seconds() > CACHE_TIMEOUT_SECONDS
    else:
        cmc_expired = True

    if silent_mode and not cmc_expired and GLOBAL_CMC_CACHE.get("map"):
        market_data_map = GLOBAL_CMC_CACHE["map"]
        asset_to_lookup_key = GLOBAL_CMC_CACHE["lookup"]
        print("🛡️ [2/3 CMC 캐시 재활용] API 크레딧 소모 0! 기존 시가총액 장부 유지")
    else:
        market_data_map, asset_to_lookup_key = cmc_api.fetch_cmc_market_data(
            binance_data, upbit_only_assets, MAPPING_DATA
        )
        GLOBAL_CMC_CACHE = {
            "map": market_data_map,
            "lookup": asset_to_lookup_key,
            "timestamp": now_kst,
        }
        print(
            f"📊 [2/3 CMC 매칭 완료 (API 호출)] 장부 매칭 성공:{len(market_data_map)}개"
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
        import traceback

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
        re.sub(r"_(binance|upbit|bithumb)$", "", k, flags=re.IGNORECASE)
        for k in dup_names
    }

    for saved_name in list(MAPPING_DATA["TICKER_DATA"].keys()):
        if (
            saved_name not in live_bases
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
        final_results.sort(key=lambda x: float(x.get("MarketCap_Raw") if x.get("MarketCap_Raw") is not None else 0.0), reverse=True)

    if is_mapping_updated:
        config_manager.save_mapping_data(MAPPING_DATA)
        print(f"💾 새로운 코인 정보가 mapping.json에 저장 완료되었습니다!")

    return final_results


data_lock = threading.Lock()


def get_cached_data(force_reload=False, silent_mode=False):
    global GLOBAL_CACHE
    _ensure_initialized()
    with data_lock:
        kst = pytz.timezone("Asia/Seoul")
        now_kst = datetime.now(kst)

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
            ).total_seconds() > CACHE_TIMEOUT_SECONDS
        else:
            is_expired = True

        # 🚀 [쌀먹 핵심] silent_mode일 때는 1시간 만료와 무관하게 무조건 펀비/시세만 새로 긁어와 캐시 갱신!
        if force_reload or needs_reset or is_expired or silent_mode:
            try:
                raw_data = _fetch_and_process_data(silent_mode=silent_mode)

                if raw_data:
                    GLOBAL_CACHE.update(
                        {
                            "data": raw_data,
                            "timestamp": now_kst,
                            "last_updated_str": now_kst.strftime("%Y-%m-%d %H:%M:%S"),
                        }
                    )
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
