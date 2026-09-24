import sys
import io
import os
import asyncio

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

os.environ['PYTHONIOENCODING'] = 'utf-8'

from modules.candle_proxy import PERSISTENT_TV_CLIENT

async def test():
    await PERSISTENT_TV_CLIENT._ensure_connected()
    candidates = [
        'BINANCE:APMUSDT',
        'BINANCE:APM',
        'BINANCE_ALPHA:APMUSDT',
        'BINANCE:ALPHA_1189USDT',
        'BINANCE:ALPHA1189USDT'
    ]
    for sym in candidates:
        try:
            cand = await PERSISTENT_TV_CLIENT.get_candles(sym, '60', 5)
            print(f'{sym} => len: {len(cand) if cand else 0}')
        except Exception as e:
            print(f'{sym} => error: {e}')

if __name__ == '__main__':
    asyncio.run(test())
