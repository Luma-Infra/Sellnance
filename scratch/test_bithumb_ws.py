import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("websockets module not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets

async def test_bithumb():
    url = "wss://pubwss.bithumb.com/pub/ws"
    async with websockets.connect(url) as ws:
        print("Connected to Bithumb WS")
        sub_msg = {
            "type": "orderbookdepth",
            "symbols": ["CTR_KRW"]
        }
        await ws.send(json.dumps(sub_msg))
        
        # Read a few messages
        for _ in range(5):
            msg = await ws.recv()
            print("Received:", msg)

asyncio.run(test_bithumb())
