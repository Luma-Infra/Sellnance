import requests
import json
from datetime import datetime

url = "https://api.bithumb.com/public/candlestick/BTC_KRW/1h"
res = requests.get(url, timeout=5)
data = res.json()
print("status:", data.get("status"))
candles = data.get("data", [])
print("count:", len(candles))
if candles:
    for c in candles[-5:]:
        ts = int(c[0]) / 1000
        dt_utc = datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S UTC')
        dt_kst = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S KST')
        print(f"TS: {int(c[0])} | {dt_utc} | {dt_kst} | O:{c[1]} C:{c[2]} H:{c[3]} L:{c[4]}")
