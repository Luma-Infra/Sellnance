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
        symbols = data.get("symbols", [])
        print("Futures total symbols:", len(symbols))
        
        # Print symbols that match SPCX, TSL, or are EQUITY / TRADIFI_PERPETUAL
        for s in symbols:
            underlying = s.get("underlyingType", "")
            contract = s.get("contractType", "")
            symbol = s.get("symbol", "")
            if "SPCX" in symbol or "TSLA" in symbol or "EQUITY" in underlying or "TRADIFI" in contract:
                print(f"Futures: {symbol} - underlyingType: {underlying}, contractType: {contract}")
                
except Exception as e:
    print("Futures error:", e)

try:
    print("\nFetching Binance Spot exchangeInfo...")
    req = urllib.request.Request(
        "https://api.binance.com/api/v3/exchangeInfo",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        symbols = data.get("symbols", [])
        print("Spot total symbols:", len(symbols))
        for s in symbols:
            symbol = s.get("symbol", "")
            if "SPCX" in symbol or "TSLA" in symbol:
                print(f"Spot: {symbol}")
except Exception as e:
    print("Spot error:", e)
