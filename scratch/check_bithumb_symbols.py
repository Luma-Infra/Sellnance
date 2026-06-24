import requests

res = requests.get("https://api.bithumb.com/public/ticker/ALL_KRW")
data = res.json()
if "data" in data:
    keys = list(data["data"].keys())
    print("Bithumb symbols count:", len(keys))
    print("Is CTR in Bithumb:", "CTR" in keys)
    print("Sample symbols:", keys[:10])
else:
    print("Invalid Bithumb response:", data)
