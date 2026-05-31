import json
with open('listing.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

first_key = list(data.keys())[0]
print(first_key, ":", json.dumps(data[first_key], indent=2))

# Find keys that have "stock" or "derivative" in their dict or mapping values
for ticker, info in data.items():
    info_str = str(info).lower()
    if 'stock' in info_str or 'derivative' in info_str:
        print(f"Ticker {ticker} matches stock/derivative: {info.get('Symbol')}, {info.get('Name')}")
