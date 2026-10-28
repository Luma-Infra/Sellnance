import os
import sys

# 윈도우 콘솔 UTF-8 입출력 인코딩
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 루트 디렉토리 sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from modules.ticker_matcher import main


if __name__ == "__main__":
    print("\n🔍 [TICKER MATCHER] 8대 거래소 전수 매칭 스캔을 시작합니다...")
    print("💡 스캔 완료 시 브라우저에서 'matcher.html' 뷰어가 자동으로 열립니다.\n")
    main()
