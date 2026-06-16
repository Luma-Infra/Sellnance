import json
with open("mapping.json", "r", encoding="utf-8") as f:
    data = json.load(f)
print("Keys:", list(data.keys()))
if "STOCK_SPOT_TO_FUTURES" in data:
    print("Found STOCK_SPOT_TO_FUTURES!")
else:
    print("STOCK_SPOT_TO_FUTURES NOT found in keys!")
