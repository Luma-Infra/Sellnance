import os
import sys
from datetime import datetime

# Windows console encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

print("=== [1] tvDatafeed FX_IDC:USDKRW 테스트 ===")
try:
    from tvDatafeed import TvDatafeed, Interval
    tv = TvDatafeed()
    
    # 15년치는 최소 4000~6000 바
    for n in [5000, 7000, 10000]:
        df = tv.get_hist(symbol="USDKRW", exchange="FX_IDC", interval=Interval.in_daily, n_bars=n)
        if df is not None and not df.empty:
            start_date = df.index[0]
            end_date = df.index[-1]
            total_bars = len(df)
            years = (end_date - start_date).days / 365.25
            print(f"FX_IDC (n_bars={n}): 총 {total_bars}개 캔들 | 시작: {start_date} ~ 종료: {end_date} (약 {years:.1f}년치)")
        else:
            print(f"FX_IDC (n_bars={n}): 데이터 없음")
except Exception as e:
    print(f"FX_IDC 수집 중 에러: {e}")

print("\n=== [2] 기타 거래소 심볼 테스트 (OANDA, FX 등) ===")
exchanges_to_test = [
    ("USDKRW", "FX"),
    ("USDKRW", "OANDA"),
    ("USDKRW", "CAPITALCOM"),
    ("USDKRW", "KRX")
]

for sym, ex in exchanges_to_test:
    try:
        df = tv.get_hist(symbol=sym, exchange=ex, interval=Interval.in_daily, n_bars=6000)
        if df is not None and not df.empty:
            start_date = df.index[0]
            end_date = df.index[-1]
            total_bars = len(df)
            years = (end_date - start_date).days / 365.25
            print(f"{ex}:{sym}: 총 {total_bars}개 캔들 | {start_date} ~ {end_date} (약 {years:.1f}년치)")
        else:
            print(f"{ex}:{sym}: 빈 데이터")
    except Exception as e:
        print(f"{ex}:{sym}: 에러 ({e})")

print("\n=== [3] yfinance 설치 여부 및 테스트 ===")
try:
    import yfinance as yf
    ticker = yf.Ticker("KRW=X")
    df_yf = ticker.history(period="max")
    if not df_yf.empty:
        start_date = df_yf.index[0]
        end_date = df_yf.index[-1]
        years = (end_date - start_date).days / 365.25
        print(f"yfinance (KRW=X): 총 {len(df_yf)}개 캔들 | {start_date} ~ {end_date} (약 {years:.1f}년치)")
except ImportError:
    print("yfinance 라이브러리 미설치")
except Exception as e:
    print(f"yfinance 에러: {e}")
