import json

with open("mapping.json", "r", encoding="utf-8") as f:
    mapping = json.load(f)

print("Root keys of mapping.json:")
for k in mapping.keys():
    print(f"- {k}")
