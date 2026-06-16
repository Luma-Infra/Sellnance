import urllib.request
import json

try:
    print("Querying SPCXBUSDT and TSLABUSDT from Binance Spot exchangeInfo...")
    req = urllib.request.Request(
        "https://api.binance.com/api/v3/exchangeInfo?symbols=[\"SPCXBUSDT\",\"TSLABUSDT\"]",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
