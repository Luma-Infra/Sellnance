import asyncio
import aiohttp
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

async def fetch_tradingview_aia():
    # 1. CryptoCompare / TradingView Compatible UDF REST for AIA
    url = "https://min-api.cryptocompare.com/data/v2/histoday?fsym=AIA&tsym=USD&limit=2000"
    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=5) as resp:
            data = await resp.json()
            t1 = time.time()
            candles = data.get("Data", {}).get("Data", [])
            print(f"[AIOHTTP] AIA Daily Candles fetched in {(t1-t0)*1000:.2f}ms! Count: {len(candles)}")
            if candles:
                print("First candle:", candles[0])
                print("Last candle:", candles[-1])

if __name__ == "__main__":
    asyncio.run(fetch_tradingview_aia())
