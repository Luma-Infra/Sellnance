import requests
import json
from datetime import datetime, timezone

intervals = ["1m", "15m", "1h", "6h", "24h"]
for inv in intervals:
    url = f"https://api.bithumb.com/public/candlestick/BTC_KRW/{inv}"
    res = requests.get(url, timeout=5)
    data = res.json()
    candles = data.get("data", [])
    if candles:
        c = candles[-1]
        ts = int(c[0]) / 1000
        dt_utc = datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        dt_kst = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S KST')
        print(f"[{inv:4s}] count:{len(candles):3d} | 최신TS: {int(c[0])} | {dt_utc} | {dt_kst}")
    else:
        print(f"[{inv:4s}] FAIL: {data}")
