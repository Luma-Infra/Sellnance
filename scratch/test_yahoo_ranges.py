import requests
from datetime import datetime
from collections import Counter

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for r in ["5y", "10y", "15y", "max"]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range={r}&interval=1d"
    res = requests.get(url, headers=headers, timeout=10)
    data = res.json()
    result = data["chart"]["result"][0]
    timestamps = result.get("timestamp", [])
    granularity = result.get("meta", {}).get("dataGranularity", "")
    print(f"range={r}: {len(timestamps)}개 (granularity={granularity})")
    if timestamps:
        print(f"   시작: {datetime.fromtimestamp(timestamps[0]).strftime('%Y-%m-%d')} ~ 끝: {datetime.fromtimestamp(timestamps[-1]).strftime('%Y-%m-%d')}")
        year_counts = Counter(datetime.fromtimestamp(ts).year for ts in timestamps)
        sample_years = [y for y in sorted(year_counts.keys())][-3:]
        print(f"   최근 연도별 개수: { {y: year_counts[y] for y in sample_years} }")
