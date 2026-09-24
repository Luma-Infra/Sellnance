import asyncio
import time
import sys
import os

sys.path.insert(0, os.getcwd())

from modules.candle_proxy import PERSISTENT_TV_CLIENT, _raw_fetch_candles, fetch_candles_guarded

async def main():
    symbols = ["BTC", "ETH", "XRP", "SOL", "DOGE"]
    for sym in symbols:
        t0 = time.time()
        res = await fetch_candles_guarded("bithumb", sym, "1d", 200)
        t1 = time.time()
        count = len(res[0]["data"]) if isinstance(res[0], dict) and "data" in res[0] else len(res[0]) if isinstance(res[0], list) else 0
        print(f"[{sym}] 소요 시간: {t1 - t0:.3f}초, 캔들 개수: {count}, 타입: {type(res[0])}")

if __name__ == "__main__":
    asyncio.run(main())
