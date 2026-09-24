import requests
import json

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
})

test_symbols = [
    'ALPHA_1189',
    'ALPHA_1189USDT',
    'ALPHA_1189_USDT',
    '06CEB9552E6764AA1640F5814227F9D2',
    '0x72a22faa6a522c81a8f5d508381e18af3da0921e',
    'APM/USDT',
    'APMUSDT',
    'APM-USDT',
    '1189',
    'ALPHA1189'
]

for s in test_symbols:
    url = f'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?symbol={s}&interval=1h&limit=5'
    res = SESSION.get(url, timeout=5).json()
    success = res.get('success')
    code = res.get('code')
    data = res.get('data')
    print(f'{s} => success: {success}, code: {code}, data: {len(data) if data else None}')
    if success and data:
        print('FOUND DATA:', data[:2])
        break
