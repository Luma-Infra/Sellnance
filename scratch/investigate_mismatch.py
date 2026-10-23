import json
import re

with open('static/market_data_cache.json', 'r', encoding='utf-8') as f:
    cache = json.load(f)

rows = cache.get('data', [])
print(f"Total rows in cache: {len(rows)}")

with open('mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

dup_list = mapping.get('DUPLICATED_LIST', {})

print(f"Total entries in DUPLICATED_LIST: {len(dup_list)}")

# Investigate all coins in DUPLICATED_LIST
print("\n--- DUPLICATED_LIST Entries and their Listed_Exchanges ---")
for row in rows:
    disp = row.get('DisplayTicker') or row.get('Symbol') or ''
    sym = row.get('Symbol') or ''
    uid = str(row.get('UID') or '')
    name = row.get('Name') or ''
    listed = row.get('Listed_Exchanges') or []
    
    # Check if this coin or symbol is involved in duplicates
    is_in_dup = False
    for k, v in dup_list.items():
        if len(v) >= 4 and (v[2].upper() == sym.upper() or str(v[0]) == uid or k.startswith(sym + "(")):
            is_in_dup = True
            break
            
    if is_in_dup:
        # Check if it has overseas listings
        ovs = [x for x in listed if x not in ('UPBIT', 'UPBIT_SPOT', 'BITHUMB', 'BITHUMB_SPOT')]
        if ovs:
            print(f"[{sym}] {disp} (UID: {uid}, Name: {name}) -> Overseas Tags: {ovs}")
            print(f"     Dom Price: {row.get('Price_KRW')} KRW | Bybit P: {row.get('Bybit_Price')} | Binance P: {row.get('Binance_Price')}")
