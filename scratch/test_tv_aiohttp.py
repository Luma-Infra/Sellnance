import asyncio
import aiohttp
import json
import re
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

def construct_message(func, param_list):
    param_str = json.dumps(param_list)
    msg = json.dumps({"m": func, "p": param_list})
    return f"~m~{len(msg)}~m~{msg}"

async def get_tv_candles_aio(symbol="MEXC:AIAUSDT", timeframe="1D", n_bars=1000):
    url = "wss://data.tradingview.com/socket.io/websocket"
    headers = {
        "Origin": "https://www.tradingview.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url, headers=headers) as ws:
            # 1. Create Session
            chart_session = "cs_fast_" + str(int(time.time()))
            await ws.send_str(construct_message("set_auth_token", ["unauthorized_user_token"]))
            await ws.send_str(construct_message("chart_create_session", [chart_session, ""]))
            await ws.send_str(construct_message("resolve_symbol", [chart_session, "sds_sym_1", f"={json.dumps({'symbol': symbol, 'adjustment': 'splits'})}"]))
            await ws.send_str(construct_message("create_series", [chart_session, "sds_1", "s1", "sds_sym_1", timeframe, n_bars, ""]))

            candles = []
            while True:
                msg = await asyncio.wait_for(ws.receive_str(), timeout=3.0)
                # Handle heartbeat
                if "~h~" in msg:
                    h_val = msg.split("~h~")[1]
                    await ws.send_str(f"~m~{len(h_val)}~m~~h~{h_val}")
                    continue

                for packet in re.split(r"~m~\d+~m~", msg):
                    if not packet:
                        continue
                    try:
                        parsed = json.loads(packet)
                        if parsed.get("m") == "timescale_update":
                            plots = parsed.get("p", [])[1].get("sds_1", {}).get("s", [])
                            for p in plots:
                                v = p.get("v", [])
                                if len(v) >= 6:
                                    # [ts, open, high, low, close, volume]
                                    candles.append([int(v[0] * 1000), str(v[1]), str(v[2]), str(v[3]), str(v[4]), str(v[5])])
                            if candles:
                                t1 = time.time()
                                print(f"[SUCCESS] {symbol} {timeframe} fetched {len(candles)} candles in {(t1-t0)*1000:.2f}ms via aiohttp websocket!")
                                return candles
                    except Exception:
                        pass
    return candles

if __name__ == "__main__":
    # Test with BINANCE:BTCUSDT and AIA
    candles = asyncio.run(get_tv_candles_aio("BINANCE:BTCUSDT", "1D", 500))
    print("Sample candle:", candles[-1] if candles else "None")
