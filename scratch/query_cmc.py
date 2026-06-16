import urllib.request
import json
import os
import sys

# We need CMC API Key. Let's check config.py or config_manager or env.
try:
    sys.path.append(os.getcwd())
    import config
    api_key = config.CMC_API_KEY
except Exception as e:
    print("Could not load CMC key:", e)
    sys.exit(1)

url = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=36921,40217'
headers = {
    'Accepts': 'application/json',
    'X-CMC_PRO_API_KEY': api_key
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        print(json.dumps(data, indent=2))
except Exception as e:
    print("CMC API Error:", e)
