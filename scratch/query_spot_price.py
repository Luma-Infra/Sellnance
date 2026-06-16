import urllib.request
import json

try:
    print("Fetching SPCXBUSDT ticker price from Binance Spot API...")
    req = urllib.request.Request(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=SPCXBUSDT",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        print("Spot Price data:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
