import asyncio
import aiohttp
import json
import re

def construct_tv_msg(func, param_list):
    msg = json.dumps({"m": func, "p": param_list})
    return f"~m~{len(msg)}~m~{msg}"

async def test():
    session = aiohttp.ClientSession()
    ws = await session.ws_connect(
        "wss://data.tradingview.com/socket.io/websocket",
        headers={"Origin": "https://www.tradingview.com"},
    )
    await ws.send_str(construct_tv_msg("set_auth_token", ["unauthorized_user_token"]))

    cs = "cs_test_range_1"
    msg = (
        construct_tv_msg("chart_create_session", [cs, ""])
        + construct_tv_msg(
            "resolve_symbol",
            [cs, "sds_sym_1", '={"symbol":"BITHUMB:BTCKRW","adjustment":"splits"}'],
        )
        + construct_tv_msg("create_series", [cs, "sds_1", "s1", "sds_sym_1", "1D", 5, ""])
    )
    await ws.send_str(msg)

    async for raw in ws:
        if raw.type == aiohttp.WSMsgType.TEXT:
            if "timescale_update" in raw.data:
                print("1. Initial 5 bars received!")
                break

    # Send request_more_data for 10 more bars
    print("2. Sending request_more_data for 10 bars...")
    await ws.send_str(construct_tv_msg("request_more_data", [cs, "sds_1", 10]))

    async for raw in ws:
        if raw.type == aiohttp.WSMsgType.TEXT:
            if "timescale_update" in raw.data:
                print("3. More data received successfully!")
                break

    await ws.close()
    await session.close()

if __name__ == "__main__":
    asyncio.run(test())
