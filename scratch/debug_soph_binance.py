import sys
sys.path.insert(0, ".")
import urllib.request
import json
from modules import exchange_api

def debug_binance():
    binance_data, base_assets = exchange_api.fetch_binance_futures_spot()
    soph_entry = binance_data.get("SOPHUSDT")
    print("SOPHUSDT in binance_data:")
    print(soph_entry)

if __name__ == "__main__":
    debug_binance()
