import json
from modules import exchange_api, utils

with open('static/market_data_cache.json', 'r', encoding='utf-8') as f:
    cache = json.load(f)

with open('mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

rows = cache.get('data', [])
gl = exchange_api.fetch_global_listings()
bybit_prices = exchange_api.fetch_bybit_prices()

print(f"Total cache rows: {len(rows)}")

# Find all rows where domestic coins have overseas tags in Listed_Exchanges
# and check if the prices or assets are actually mismatched!
mismatched_coins = []

for row in rows:
    sym = row.get('Symbol') or ''
    disp = row.get('DisplayTicker') or sym
    name = row.get('Name') or ''
    uid = str(row.get('UID') or '')
    listed = row.get('Listed_Exchanges') or []
    
    up_krw = row.get('Upbit_Price') or 0.0
    bithumb_krw = row.get('Bithumb_Price') or 0.0
    dom_krw = up_krw or bithumb_krw
    rate = row.get('krw_usd_rate') or 1325.0
    dom_usd = dom_krw / rate if dom_krw > 0 else (row.get('Price_Raw') or 0.0)
    
    # Check Bybit
    has_bybit = any('BYBIT' in x for x in listed)
    by_data = bybit_prices.get(sym, {})
    by_fut_p = by_data.get('futures_price') or 0.0
    by_spot_p = by_data.get('spot_price') or by_data.get('price') or 0.0
    by_target_p = by_fut_p or by_spot_p
    
    if dom_usd > 0 and by_target_p > 0 and has_bybit:
        # Check if valid price ratio
        mult = utils.get_multiplier(sym)
        adj_dom = dom_usd / mult
        adj_by = by_target_p / mult
        ratio = max(adj_dom, adj_by) / min(adj_dom, adj_by)
        if ratio > 3.0:
            mismatched_coins.append({
                'disp': disp,
                'name': name,
                'sym': sym,
                'uid': uid,
                'dom_usd': dom_usd,
                'bybit_p': by_target_p,
                'ratio': ratio,
                'reason': f"Bybit Price Mismatch (Dom: ${dom_usd:.6f} vs Bybit: ${by_target_p:.6f}, ratio: {ratio:.1f}x)",
                'listed': listed
            })

print(f"\n=== BYBIT MISMATCHES FOUND: {len(mismatched_coins)} ===")
for m in mismatched_coins:
    print(f"[{m['disp']}] ({m['name']}, UID: {m['uid']})")
    print(f"   -> {m['reason']}")
    print(f"   -> Listed_Exchanges: {m['listed']}\n")
