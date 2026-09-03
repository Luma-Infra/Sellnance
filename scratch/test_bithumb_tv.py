import requests
import time

t0 = time.time()
res = requests.get("http://127.0.0.1:8000/api/candles?exchange=bithumb&symbol=BTC_KRW&interval=1d&limit=500")
t1 = time.time()
print(f"Status: {res.status_code}, Time: {(t1-t0)*1000:.2f}ms")
data = res.json()
if isinstance(data, dict) and "data" in data:
    candles = data["data"]
    print(f"Fetched {len(candles)} Bithumb TV candles!")
    print("Oldest candle:", candles[0])
    print("Latest candle:", candles[-1])
else:
    print("Response:", data)
