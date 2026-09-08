import sys
sys.path.insert(0, ".")
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
from modules import exchange_api, builder_binance

def debug_row():
    binance_data, base_assets = exchange_api.fetch_binance_futures_spot()
    b_info = binance_data["SOPHUSDT"]
    row, _ = builder_binance.build_binance_row(
        ticker="SOPHUSDT",
        b_info=b_info,
        binance_data=binance_data,
        upbit_data={},
        market_data_map={"krw_usd_rate": 1380.0},
        asset_to_lookup_key={},
        global_listings={},
        upbit_krw_set=set(),
        bithumb_krw_set=set(),
        REVERSE_LOOKUP={},
        processed_uids=set(),
        mapping=({}, {}, {}, set(), {}, {}, {}, {}, set(), {}),
        krw_usd_rate=1380.0,
        bybit_data={},
        bithumb_data={},
    )
    print("Built Row for SOPHUSDT:")
    print("Ticker:", row.get("Ticker"))
    print("DisplayTicker:", row.get("DisplayTicker"))
    print("Volume_Formatted:", row.get("Volume_Formatted"))
    print("Binance_Vol_Formatted:", row.get("Binance_Vol_Formatted"))
    print("Binance_Futures_Vol_Formatted:", row.get("Binance_Futures_Vol_Formatted"))
    print("Binance_Spot_Vol_Formatted:", row.get("Binance_Spot_Vol_Formatted"))
    print("Volume_Raw:", row.get("Volume_Raw"))
    print("Binance_Vol_Futures:", row.get("Binance_Vol_Futures"))
    print("Binance_Vol_Spot:", row.get("Binance_Vol_Spot"))

if __name__ == "__main__":
    debug_row()
