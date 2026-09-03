import requests
import time

t0 = time.time()
res = requests.get("http://127.0.0.1:8000/api/candles?exchange=binance_futures&symbol=AIAUSDT&interval=1d&limit=200")
t1 = time.time()
print(f"Status: {res.status_code}, Time: {(t1-t0)*1000:.2f}ms")
data = res.json()
if isinstance(data, list):
    print(f"Fetched {len(data)} candles!")
    print("Oldest candle:", data[0])
    print("Latest candle:", data[-1])
else:
    print("Response:", data)
