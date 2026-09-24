import requests
import json

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
})

# 1. 알파 토큰 목록에서 실제 심볼 하나 가져오기
r = SESSION.get('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list', timeout=5).json()
items = r.get('data', [])
print(f'Total alpha tokens: {len(items)}')
if items:
    sample = items[0]
    sym = sample.get('symbol')
    print('Sample token:', sym, sample.get('name'))
    
    # 2. klines 테스트
    test_urls = [
        f'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?symbol={sym}&interval=1h&limit=10',
        f'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?symbol={sym}USDT&interval=1h&limit=10',
        f'https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?symbol={sym}_USDT&interval=1h&limit=10',
        f'https://www.binance.com/bapi/defi/v1/public/alpha/kline?symbol={sym}&interval=1h&limit=10',
    ]
    for url in test_urls:
        try:
            res = SESSION.get(url, timeout=5)
            print(f'URL: {url} => Status: {res.status_code}, Body: {res.text[:300]}')
        except Exception as e:
            print(f'URL: {url} => Err: {e}')
