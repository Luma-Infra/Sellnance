# config_manager.py
from modules import utils
import json
import os

# 파일 경로 고정
MAPPING_FILE = "mapping.json"

# --- ⭐️ LOAD MAPPING CONFIG ⭐️ ---
_LAST_VALID_MAPPING_DATA = {}


def load_mapping_data():
    """mapping.json을 읽어서 딕셔너리로 반환 (실패 시 마지막 유효 캐시 자동 폴백)"""
    global _LAST_VALID_MAPPING_DATA
    try:
        if os.path.exists(MAPPING_FILE):
            with open(MAPPING_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if (
                    data
                    and isinstance(data, dict)
                    and (len(data.get("TICKER_DATA", {})) > 10 or len(data.get("DUPLICATED_LIST", {})) >= 5)
                ):
                    _LAST_VALID_MAPPING_DATA = data
                    # utils의 캐시 갱신
                    skip_list = data.get("HARDCODE_VERIFY_SKIP_LIST", [])
                    sym_to_id_keys = list(data.get("SYMBOL_TO_ID_MAP", {}).keys())
                    utils._SKIP_LIST_CACHE = list(set(skip_list + sym_to_id_keys))
                    return data
        if _LAST_VALID_MAPPING_DATA:
            print(
                "🛡️ [SAFEGUARD] mapping.json 읽기 이상 감지 -> 메모리 백업 족보로 즉각 복구 반환"
            )
            return dict(_LAST_VALID_MAPPING_DATA)
        return {}
    except Exception as e:
        print(f"🚨 족보 로드 중 치명적 에러: {e}")
        if _LAST_VALID_MAPPING_DATA:
            return dict(_LAST_VALID_MAPPING_DATA)
        return {}


def save_mapping_data(mapping_data):
    """업데이트된 족보 데이터를 정렬해서 mapping.json에 저장"""
    try:
        if not mapping_data or not isinstance(mapping_data, dict):
            print("🚨 [CRITICAL SAFEGUARD] mapping_data가 비어 있어 저장을 차단합니다.")
            return False

        # 🛡️ [데이터 증발 방어막] 필수 족보 키(TICKER_DATA, DUPLICATED_LIST 등)가 비어있는 경우 덮어쓰기 금지!
        ticker_data = mapping_data.get("TICKER_DATA", {})
        dup_list = mapping_data.get("DUPLICATED_LIST", {})
        if len(ticker_data) < 10 and len(dup_list) < 5:
            print(
                "🚨 [CRITICAL SAFEGUARD] TICKER_DATA 또는 DUPLICATED_LIST가 비정상적으로 비어있어 mapping.json 덮어쓰기를 강제 차단합니다!"
            )
            return False

        # 🚀 [요청] TICKER_DATA를 A-Z 알파벳 순으로 깔끔하게 정렬!
        if "TICKER_DATA" in mapping_data and isinstance(
            mapping_data["TICKER_DATA"], dict
        ):
            mapping_data["TICKER_DATA"] = dict(
                sorted(mapping_data["TICKER_DATA"].items())
            )

        # utils의 캐시 갱신
        skip_list = mapping_data.get("HARDCODE_VERIFY_SKIP_LIST", [])
        sym_to_id_keys = list(mapping_data.get("SYMBOL_TO_ID_MAP", {}).keys())
        utils._SKIP_LIST_CACHE = list(set(skip_list + sym_to_id_keys))

        utils.atomic_save_json(MAPPING_FILE, mapping_data, indent=4, ensure_ascii=False)

        print("💾 족보(mapping.json)가 최신화되어 저장되었습니다.")
        return True
    except Exception as e:
        print(f"🚨 [System] mapping.json 저장 실패: {e}")
        return False


# --- ⭐️ 아래는 다른 파일에서 "부품"으로 쓰기 좋게 파싱해주는 함수들 ⭐️ ---
def get_mapping_parts(mapping_data):
    """조립에 필요한 각 리스트/맵을 튜플로 한 방에 뱉어줌"""
    if not isinstance(mapping_data, dict):
        mapping_data = {}
    return (
        mapping_data.get("NOTE_MAP") or {},
        mapping_data.get("TICKER_DATA") or {},
        mapping_data.get("CHAIN_LOGO_MAP") or {},
        mapping_data.get("EXCLUSION_LIST") or [],
        mapping_data.get("DUPLICATED_LIST") or {},
        mapping_data.get("SYMBOL_TO_ID_MAP") or {},
        mapping_data.get("MANUAL_SUPPLY_MAP") or {},
        mapping_data.get("SPECIAL_SYMBOL_MAP") or {},
        mapping_data.get("HARDCODE_VERIFY_SKIP_LIST") or [],
    )
