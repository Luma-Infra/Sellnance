import asyncio
import time
import sys
import os
import json
import aiohttp
import re

sys.path.insert(0, os.getcwd())

def _construct_tv_msg(func, param_list):
    msg = json.dumps({"m": func, "p": param_list})
    return f"~m~{len(msg)}~m~{msg}"

async def test_optimized(symbol="BITHUMB:BTCKRW", timeframe="1D", n_bars=200):
    url = "wss://data.tradingview.com/socket.io/websocket"
    headers = {
        "Origin": "https://www.tradingview.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    t0 = time.time()
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url, headers=headers) as ws:
            t_connected = time.time()
            # 1. auth
            await ws.send_str(_construct_tv_msg("set_auth_token", ["unauthorized_user_token"]))
            
            # 2. 배치 일괄 전송 (3개 메시지를 1개 문자열로 결합)
            chart_session = f"cs_bench_{int(time.time()*1000)}"
            batch_msg = (
                _construct_tv_msg("chart_create_session", [chart_session, ""]) +
                _construct_tv_msg("resolve_symbol", [chart_session, "sds_sym_1", f"={json.dumps({'symbol': symbol, 'adjustment': 'splits'})}"]) +
                _construct_tv_msg("create_series", [chart_session, "sds_1", "s1", "sds_sym_1", timeframe, n_bars, ""])
            )
            t_send = time.time()
            await ws.send_str(batch_msg)
            
            # 수신 대기
            candles = []
            while True:
                msg = await ws.receive_str()
                if not msg:
                    break
                if "~h~" in msg:
                    h_val = msg.split("~h~")[1]
                    await ws.send_str(f"~m~{len(h_val)}~m~~h~{h_val}")
                    continue
                if "timescale_update" in msg:
                    t_recv = time.time()
                    print(f"[{symbol}] 연결: {t_connected - t0:.3f}s | 전송: {t_send - t_connected:.3f}s | 수신: {t_recv - t_send:.3f}s | 총합: {t_recv - t0:.3f}s")
                    break

if __name__ == "__main__":
    asyncio.run(test_optimized("BITHUMB:BTCKRW", "1D", 200))
    asyncio.run(test_optimized("BITHUMB:ETHKRW", "60", 200))
    asyncio.run(test_optimized("BITHUMB:XRPKRW", "240", 200))
