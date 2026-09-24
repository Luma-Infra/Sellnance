import asyncio
import time
import sys
import os

sys.path.insert(0, os.getcwd())

from modules.candle_proxy import PERSISTENT_TV_CLIENT, _raw_fetch_candles, fetch_candles_guarded

async def main():
    # 트뷰에 없을 법한 코인들 테스트
    symbols = ["CON", "WEMIX", "ASTR", "LM", "CTC", "OAS"]
    for sym in symbols:
        t0 = time.time()
        res = await fetch_candles_guarded("bithumb", sym, "1d", 200)
        t1 = time.time()
        data = res[0]
        count = len(data["data"]) if isinstance(data, dict) and "data" in data else len(data) if isinstance(data, list) else 0
        src = res[1] if len(res) > 1 else None
        print(f"[{sym}] 소요 시간: {t1 - t0:.3f}초, 캔들 개수: {count}, 소스: {src}")

if __name__ == "__main__":
    asyncio.run(main())
