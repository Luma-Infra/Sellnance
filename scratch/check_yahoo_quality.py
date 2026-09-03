import requests

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

url = "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=15y&interval=1d"
res = requests.get(url, headers=headers, timeout=10)
data = res.json()
result = data["chart"]["result"][0]
timestamps = result["timestamp"]
closes = result["indicators"]["quote"][0]["close"]

nulls = [i for i, c in enumerate(closes) if c is None]
print(f"야후 15y 일봉: 총 {len(timestamps)}개 중 Null 개수: {len(nulls)}개")

# 20년치(20y)도 가능한지 테스트
url20 = "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=20y&interval=1d"
res20 = requests.get(url20, headers=headers, timeout=10)
data20 = res20.json()
result20 = data20["chart"]["result"][0]
granularity20 = result20.get("meta", {}).get("dataGranularity", "")
print(f"야후 20y 요청 시: {len(result20.get('timestamp', []))}개 (granularity={granularity20})")
