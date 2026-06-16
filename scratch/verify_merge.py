import sys
import os

sys.path.append(os.getcwd())

from modules import config_manager, exchange_api

print("Loading mapping data...")
mapping = config_manager.load_mapping_data()

print("Fetching binance data...")
bybit_data = exchange_api.fetch_bybit_prices()
binance_data, binance_base_assets = exchange_api.fetch_binance_futures_spot(bybit_data)

target = "SPCXUSDT"
if target in binance_data:
    print(f"\nTarget {target} found in binance_data:")
    for k, v in binance_data[target].items():
        print(f"  {k}: {v}")
else:
    print(f"\nTarget {target} NOT found in binance_data!")

# Let's also check if SPCXBUSDT is gone
if "SPCXBUSDT" in binance_data:
    print("WARNING: SPCXBUSDT still exists in binance_data!")
else:
    print("SUCCESS: SPCXBUSDT successfully removed/merged from binance_data.")
