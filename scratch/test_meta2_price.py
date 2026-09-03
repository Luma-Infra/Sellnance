import json

with open("market_data_cache.json", "r", encoding="utf-8") as f:
    data = json.load(f)

meta = [c for c in data if "META" in c.get("Symbol", "").upper()]
for m in meta:
    print("Symbol:", m.get("Symbol"), "DisplayTicker:", m.get("DisplayTicker"))
    print("Price:", m.get("Price"), "Price_KRW:", m.get("Price_KRW"), "Price_Raw:", m.get("Price_Raw"))
    print("Upbit_Price:", m.get("Upbit_Price"), "Bithumb_Price:", m.get("Bithumb_Price"))
    print("Listed_Exchanges:", m.get("Listed_Exchanges"))
    print("-" * 40)
