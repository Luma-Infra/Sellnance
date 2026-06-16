import urllib.request
import json

try:
    print("Fetching Binance Futures exchangeInfo...")
    req = urllib.request.Request(
        "https://fapi.binance.com/fapi/v1/exchangeInfo",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        futures_symbols = {s["symbol"].replace("USDT", "") for s in data.get("symbols", []) if s["symbol"].endswith("USDT")}

    print("Fetching Binance Spot exchangeInfo...")
    req = urllib.request.Request(
        "https://api.binance.com/api/v3/exchangeInfo",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        spot_symbols = {s["symbol"].replace("USDT", "") for s in data.get("symbols", []) if s["symbol"].endswith("USDT")}

    # Find spot symbols that end with B where the same symbol without B is in futures
    mismatches = []
    for s in spot_symbols:
        if s.endswith("B") and s[:-1] in futures_symbols:
            mismatches.append((s[:-1], s))
            
    print("\nIdentified Spot-Futures Stock B-Suffix Mismatches:")
    for fut, spot in mismatches:
        print(f"Futures: {fut}USDT <-> Spot: {spot}USDT")
except Exception as e:
    print("Error:", e)
