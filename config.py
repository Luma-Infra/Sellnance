# config.py
from pathlib import Path

ENV_FILE = Path(".env")

def get_cmc_api_key():
    if not ENV_FILE.exists():
        print("\n🔑 [최초 실행] CoinMarketCap API 키가 필요합니다.")
        api_key = input("API 키를 붙여넣고 엔터를 누르세요: ").strip()
        with open(ENV_FILE, "w") as f:
            f.write(f"CMC_API_KEY={api_key}\n")
        print("✅ 키가 내 PC(.env 파일)에 안전하게 저장되었습니다!\n")
        return api_key
    
    # .env 파일에서 키 읽어오기
    with open(ENV_FILE, "r") as f:
        for line in f:
            if line.startswith("CMC_API_KEY="):
                return line.strip().split("=")[1]
    return ""

# 전역 변수로 할당 (다른 모듈에서 config.CMC_API_KEY 로 호출)
CMC_API_KEY = get_cmc_api_key()

# UI/차트 테마 설정
THEMES = {
    'upbit-dark': {'bg': '#0f111a', 'up': '#c84a31', 'down': '#1261c4'},
    'binance': {'bg': '#131722', 'up': '#26a69a', 'down': '#ef5350'}
}