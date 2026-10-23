import json
from modules import api_manager, config_manager, builder, builder_upbit, exchange_api, utils

mapping = config_manager.load_mapping_data()
bybit_data = exchange_api.fetch_bybit_prices()
global_listings = exchange_api.fetch_global_listings()

print("Testing build_upbit_row for META...")
# Check what build_upbit_row does for META
DUPLICATED_LIST = mapping.get("DUPLICATED_LIST", {})
REVERSE_LOOKUP = {}
for k, v in DUPLICATED_LIST.items():
    if len(v) >= 4:
        ex = v[3].upper()
        virtual_key = k.split("(")[0].upper()
        REVERSE_LOOKUP[f"{virtual_key}_{ex}"] = k

for k, v in DUPLICATED_LIST.items():
    if len(v) >= 4:
        ex = v[3].upper()
        sym_key = v[2].upper()
        REVERSE_LOOKUP[f"{sym_key}_{ex}"] = k

row, updated = builder_upbit.build_upbit_row(
    "META",
    {"price": 10.6, "utc0_open": 10.3, "change_24h": 2.91},
    {},
    {},
    {},
    global_listings,
    {"META"},
    {"META"},
    REVERSE_LOOKUP,
    set(),
    1325.0,
    mapping,
    bybit_data,
    {"META": {"price": 10.6}},
    {"META": {"price": 10.58}}
)

print("META row:")
print("  DisplayTicker:", row.get("DisplayTicker"))
print("  Name:", row.get("Name"))
print("  UID:", row.get("UID"))
print("  Listed_Exchanges:", row.get("Listed_Exchanges"))

print("\nTesting build_upbit_row for ON (Orochi Network)...")
row_on, _ = builder_upbit.build_upbit_row(
    "ON",
    {"price": 164.0, "utc0_open": 160.0, "change_24h": 2.5},
    {},
    {},
    {},
    global_listings,
    set(),
    {"ON"},
    REVERSE_LOOKUP,
    set(),
    1325.0,
    mapping,
    bybit_data,
    {},
    {"ON": {"price": 164.0}}
)

print("ON row:")
print("  DisplayTicker:", row_on.get("DisplayTicker"))
print("  Name:", row_on.get("Name"))
print("  UID:", row_on.get("UID"))
print("  Listed_Exchanges:", row_on.get("Listed_Exchanges"))

print("\nTesting build_upbit_row for EDGE (Definitive)...")
row_edge, _ = builder_upbit.build_upbit_row(
    "EDGE",
    {"price": 122.0, "utc0_open": 120.0, "change_24h": 1.5},
    {},
    {},
    {},
    global_listings,
    {"EDGE"},
    {"EDGE"},
    REVERSE_LOOKUP,
    set(),
    1325.0,
    mapping,
    bybit_data,
    {"EDGE": {"price": 122.0}},
    {"EDGE": {"price": 122.0}}
)

print("EDGE row:")
print("  DisplayTicker:", row_edge.get("DisplayTicker"))
print("  Name:", row_edge.get("Name"))
print("  UID:", row_edge.get("UID"))
print("  Listed_Exchanges:", row_edge.get("Listed_Exchanges"))
