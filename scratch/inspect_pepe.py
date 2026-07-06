import urllib.request
import json

try:
    url = "http://127.0.0.1:8000/api/market-data"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        data = res.get('data', [])
        pepe_rows = [row for row in data if 'PEPE' in str(row.get('Ticker', '')) or 'PEPE' in str(row.get('Symbol', ''))]
        for row in pepe_rows:
            print("--- Pepe Row ---")
            for k, v in row.items():
                print(f"{k}: {v}")
except Exception as e:
    print("Error:", e)
