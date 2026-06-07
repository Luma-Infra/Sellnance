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
        print("Total symbols fetched:", len(symbols))

        target_symbols = ["SAMSUNGUSDT", "AAPLUSDT", "TSLAUSDT", "BTCUSDT"]
        for sym_info in symbols:
            if sym_info.get("symbol") in target_symbols:
                print(f"\n--- Symbol: {sym_info.get('symbol')} ---")
                print(json.dumps(sym_info, indent=2, ensure_ascii=False))
except Exception as e:
    print("Error:", e)
