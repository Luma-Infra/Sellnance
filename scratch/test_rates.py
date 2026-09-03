import requests

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

print("=== [1] 야후 파이낸스 실시간 환율 (KRW=X) ===")
try:
    url = "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=1d&interval=1m"
    res = requests.get(url, headers=headers, timeout=5)
    data = res.json()
    meta = data["chart"]["result"][0]["meta"]
    current_price = meta.get("regularMarketPrice")
    print(f"야후 실시간 환율: {current_price}원 (타임스탬프: {meta.get('regularMarketTime')})")
except Exception as e:
    print("야후 실시간 에러:", e)

print("\n=== [2] 네이버 금융 실시간 환율 ===")
try:
    # 네이버 페이 증권 환율 API
    url = "https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_USDKRW"
    res = requests.get(url, headers=headers, timeout=5)
    data = res.json()
    if data and "result" in data:
        items = data["result"]
        print(f"네이버 금융 실시간 환율: {items[0].get('closePrice')}원 (일자: {items[0].get('localTradedAt')})")
        print(f"네이버 제공 개수: {len(items)}개")
except Exception as e:
    print("네이버 금융 에러:", e)

print("\n=== [3] 한국수출입은행 / 하나은행 오픈 API / 업비트 USDT ===")
try:
    # 업비트 KRW-USDT 실시간 가격
    url = "https://api.upbit.com/v1/ticker?markets=KRW-USDT"
    res = requests.get(url, headers=headers, timeout=5)
    data = res.json()
    print(f"업비트 테더(USDT) 실시간: {data[0].get('trade_price')}원")
except Exception as e:
    print("업비트 에러:", e)
