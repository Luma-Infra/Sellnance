import os
import sys

def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    # Sellnance 프로젝트 루트 경로를 sys.path에 등록
    cwd = os.getcwd()
    if cwd not in sys.path:
        sys.path.insert(0, cwd)

    from modules.ticker_matcher import main as matcher_main
    matcher_main()


if __name__ == "__main__":
    main()
