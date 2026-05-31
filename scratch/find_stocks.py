import json
with open('mapping.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def search_nested(obj, path=""):
    results = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            results.extend(search_nested(v, f"{path}.{k}" if path else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            results.extend(search_nested(v, f"{path}[{i}]"))
    elif isinstance(obj, str):
        if 'stock' in obj.lower() or 'derivatives' in obj.lower():
            results.append((path, obj))
    return results

print("Matches:", search_nested(data))
