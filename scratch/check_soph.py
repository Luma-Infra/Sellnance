import urllib.request
import json

def check_soph():
    # 1. Binance Futures Ticker 24hr
    try:
        url_f = "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=SOPHUSDT"
        req = urllib.request.Request(url_f, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data_f = json.loads(resp.read().decode())
            print("Futures SOPHUSDT 24hr:")
            print(f"  lastPrice: {data_f.get('lastPrice')}")
            print(f"  volume (base): {data_f.get('volume')}")
            print(f"  quoteVolume (USDT): {data_f.get('quoteVolume')}")
    except Exception as e:
        print(f"Futures error: {e}")

    # 2. Binance Spot Ticker 24hr
    try:
        url_s = "https://api.binance.com/api/v3/ticker/24hr?symbol=SOPHUSDT"
        req = urllib.request.Request(url_s, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data_s = json.loads(resp.read().decode())
            print("Spot SOPHUSDT 24hr:")
            print(f"  lastPrice: {data_s.get('lastPrice')}")
            print(f"  volume (base): {data_s.get('volume')}")
            print(f"  quoteVolume (USDT): {data_s.get('quoteVolume')}")
    except Exception as e:
        print(f"Spot error: {e}")

if __name__ == "__main__":
    check_soph()
