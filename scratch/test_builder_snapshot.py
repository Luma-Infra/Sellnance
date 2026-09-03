# 프로젝트 루트 경로 추가
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import logging
from deepdiff import DeepDiff

# 🚀 로거를 먼저 세팅하여 다른 라이브러리 출력 오염 방지
from modules import logger
from modules import api_manager, config_manager, app

SNAPSHOT_FILE = os.path.join(os.path.dirname(__file__), "snapshot_original.json")

def capture_snapshot():
    print("⏳ [스냅샷] 데이터 수집 및 조립 파이프라인 가동 중...")
    # 초기화 및 캐시 로드
    app._init_listing_dates()
    # 1회 강제 수행 (블로킹 모드)
    fresh_data = api_manager._fetch_and_process_data()
    return fresh_data

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("--save", "--verify"):
        print("Usage: uv run python scratch/test_builder_snapshot.py [--save | --verify]")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == "--save":
        data = capture_snapshot()
        if not data:
            print("🚨 데이터 수집 실패! 스냅샷을 저장할 수 없습니다.")
            sys.exit(1)
            
        with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ [SUCCESS] 원본 스냅샷 저장 완료! (코인 {len(data)}개)")

    elif mode == "--verify":
        if not os.path.exists(SNAPSHOT_FILE):
            print("🚨 원본 스냅샷 파일이 없습니다. --save를 먼저 실행하세요.")
            sys.exit(1)

        with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
            original_data = json.load(f)

        new_data = capture_snapshot()
        
        print("🔍 [스냅샷] 원본과 현재 조립 결과 1:1 정밀 대조 중...")
        diff = DeepDiff(original_data, new_data, ignore_order=True, significant_digits=4)
        
        if diff:
            print("❌ [FAILED] 로직 불일치 발생! (오차 발견)")
            import pprint
            pprint.pprint(diff)
            sys.exit(1)
        else:
            print("✅ [SUCCESS] 완벽하게 100% 일치합니다! (오차 0%)")
            sys.exit(0)

if __name__ == "__main__":
    main()
