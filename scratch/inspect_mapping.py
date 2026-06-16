import json

with open("mapping.json", "r", encoding="utf-8") as f:
    mapping = json.load(f)

print("DUPLICATED_LIST sample:")
dup = mapping.get("DUPLICATED_LIST", {})
for i, (k, v) in enumerate(dup.items()):
    if i < 5:
        print(f"  {k}: {v}")

print("\nSPECIAL_SYMBOL_MAP sample:")
spec = mapping.get("SPECIAL_SYMBOL_MAP", {})
for i, (k, v) in enumerate(spec.items()):
    if i < 5:
        print(f"  {k}: {v}")
