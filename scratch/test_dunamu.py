import requests
import json
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

print("=== [1] 두나무 실시간 현재가 (/recent) ===")
try:
    url = "https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD"
    res = requests.get(url, headers=headers, timeout=5)
    data = res.json()
    print("Status:", res.status_code)
    if data and isinstance(data, list):
        item = data[0]
        print(f"현재 환율: {item.get('basePrice')}원 (기준일시: {item.get('date')} {item.get('time')})")
        print("전체 반환 개수:", len(data))
except Exception as e:
    print("두나무 recent 에러:", e)

print("\n=== [2] 두나무 과거 일봉 (/candles) 최대 개수 테스트 ===")
for count in [10, 50, 200, 500, 1000]:
    try:
        # 두나무 캔들 엔드포인트 테스트
        url = f"https://quotation-api-cdn.dunamu.com/v1/forex/candles?codes=FRX.KRWUSD&count={count}"
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            d = res.json()
            items = d.get("FRX.KRWUSD", []) if isinstance(d, dict) else d
            print(f"요청 count={count} -> 수신: {len(items)}개")
            if items:
                print(f"   기간: {items[-1].get('date')} ~ {items[0].get('date')}")
        else:
            print(f"요청 count={count} -> HTTP {res.status_code}")
    except Exception as e:
        print(f"count={count} 에러:", e)

print("\n=== [3] 야후 파이낸스 직접 HTTP (15년치) ===")
try:
    url = "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=15y&interval=1d"
    res = requests.get(url, headers=headers, timeout=5)
    if res.status_code == 200:
        d = res.json()
        timestamps = d["chart"]["result"][0]["timestamp"]
        print(f"야후 파이낸스 KRW=X: {len(timestamps)}개 일봉 수신 완료 (15년치 직통)")
    else:
        print(f"야후 파이낸스 HTTP {res.status_code}")
except Exception as e:
    print("야후 파이낸스 에러:", e)
