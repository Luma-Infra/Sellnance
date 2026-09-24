import requests
import json
from datetime import datetime, timezone

# 빗썸 신규 v1 API 테스트 (업비트 클론 규격)
urls = [
    "https://api.bithumb.com/v1/candles/minutes/60?market=KRW-BTC&count=5",
    "https://api.bithumb.com/v1/candles/minutes/240?market=KRW-BTC&count=5",
    "https://api.bithumb.com/v1/candles/days?market=KRW-BTC&count=5"
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

for url in urls:
    try:
        res = requests.get(url, headers=headers, timeout=5)
        print(f"URL: {url} -> Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and data:
                c = data[0]
                print(f"  최신 캔들: UTC:{c.get('candle_date_time_utc')} | KST:{c.get('candle_date_time_kst')} | O:{c.get('opening_price')} C:{c.get('trade_price')}")
            else:
                print(f"  Empty or not list: {data}")
        else:
            print(f"  Error body: {res.text[:100]}")
    except Exception as e:
        print(f"  Exception: {e}")
