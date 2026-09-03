import requests
from datetime import datetime
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

print("=== [1] 야후 파이낸스 KRW=X range=max 전수 조사 ===")
try:
    url = "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=max&interval=1d"
    res = requests.get(url, headers=headers, timeout=10)
    data = res.json()
    result = data["chart"]["result"][0]
    timestamps = result.get("timestamp", [])
    quotes = result["indicators"]["quote"][0]
    closes = quotes.get("close", [])
    
    # None 필터링
    valid_data = [(ts, c) for ts, c in zip(timestamps, closes) if c is not None]
    
    first_dt = datetime.fromtimestamp(timestamps[0])
    last_dt = datetime.fromtimestamp(timestamps[-1])
    
    null_count = len(timestamps) - len(valid_data)
    years = (last_dt - first_dt).days / 365.25
    
    print(f"총 수신 데이터: {len(timestamps)}개 일봉")
    print(f"유효한 종가 데이터: {len(valid_data)}개 (null/결측치: {null_count}개)")
    print(f"시작일: {first_dt.strftime('%Y-%m-%d')}")
    print(f"종료일: {last_dt.strftime('%Y-%m-%d')}")
    print(f"총 기간: 약 {years:.1f}년치")
    print(f"첫날 종가: {valid_data[0][1]:.2f}원 ({datetime.fromtimestamp(valid_data[0][0]).strftime('%Y-%m-%d')})")
    print(f"최근 종가: {valid_data[-1][1]:.2f}원 ({datetime.fromtimestamp(valid_data[-1][0]).strftime('%Y-%m-%d')})")

    # 연도별 데이터 개수 분포 확인
    from collections import Counter
    year_counts = Counter(datetime.fromtimestamp(ts).year for ts, _ in valid_data)
    print("\n--- 연도별 일봉 개수 분포 ---")
    for y in sorted(year_counts.keys()):
        print(f"{y}년: {year_counts[y]}일", end=" | " if y % 5 != 0 else "\n")
    print()

except Exception as e:
    print("야후 전수조사 에러:", e)
