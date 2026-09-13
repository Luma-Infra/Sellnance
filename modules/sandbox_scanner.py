# modules/sandbox_scanner.py
"""
🧪 [Sandbox Scanner]
9대 메이저 거래소 + 바이낸스 알파(Binance Alpha) 전수조사 스캐너
- 외부 API 단 1회성(One-shot) 병렬 호출로 2~3초 만에 수집
- 정적 캐시 파일(static/sandbox_data.json)로 저장하여 무한 재호출 방지 (IP 밴 0%)
- 심볼(Symbol), 가격, 5~9대 거래소 태그(Listed_Exchanges) 집중 매핑
"""

import json
import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding="utf-8")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
OUTPUT_FILE = os.path.join(STATIC_DIR, "sandbox_data.json")

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
})


def fetch_json(url, timeout=6):
    try:
        res = SESSION.get(url, timeout=timeout)
        if res.status_code == 200:
            return res.json()
        print(f"⚠️ [스캔 에러] {url[:50]}... : HTTP {res.status_code}")
        return None
    except Exception as e:
        print(f"⚠️ [스캔 에러] {url[:50]}... : {e}")
        return None


def run_full_scan():
    print("\n🚀 [SANDBOX SCANNER] 9대 거래소 + 바이낸스 알파 전수조사 시작...")
    t0 = time.time()

    # 1. 11대 마켓 병렬 수집 타겟 정의
    tasks = {
        "UPBIT": ("https://api.upbit.com/v1/market/all?isDetails=true", 5),
        "BITHUMB": ("https://api.bithumb.com/v1/market/all?isDetails=true", 5),
        "BINANCE_SPOT": ("https://api.binance.com/api/v3/ticker/price", 5),
        "BINANCE_FUTURES": ("https://fapi.binance.com/fapi/v1/ticker/price", 5),
        "BYBIT_SPOT": ("https://api.bybit.com/v5/market/instruments-info?category=spot", 5),
        "BYBIT_FUTURES": ("https://api.bybit.com/v5/market/instruments-info?category=linear", 5),
        "OKX_SPOT": ("https://www.okx.com/api/v5/public/instruments?instType=SPOT", 5),
        "BITGET_SPOT": ("https://api.bitget.com/api/v2/spot/public/symbols", 5),
        "GATEIO_SPOT": ("https://api.gateio.ws/api/v4/spot/currency_pairs", 5),
        "COINBASE_SPOT": ("https://api.exchange.coinbase.com/products", 5),
        "BINANCE_ALPHA": ("https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list", 5),
    }

    results = {}
    with ThreadPoolExecutor(max_workers=len(tasks)) as executor:
        future_map = {executor.submit(fetch_json, url, timeout): k for k, (url, timeout) in tasks.items()}
        for future in future_map:
            k = future_map[future]
            try:
                results[k] = future.result()
            except Exception as e:
                print(f"⚠️ [스캔 실패]: {k} -> {e}")
                results[k] = None

    print(f"⏱️ [수집 완료]: {time.time() - t0:.2f}초 소요. 데이터 파싱 중...")

    # 2. 거래소별 심볼 및 메타데이터 파싱
    # { SYMBOL: { "exchanges": set(), "names": set(), "prices": {}, "alpha_meta": {} } }
    universe = {}

    def get_or_create(sym):
        clean_sym = sym.strip().upper()
        if clean_sym not in universe:
            universe[clean_sym] = {
                "symbol": clean_sym,
                "exchanges": set(),
                "name": clean_sym,
                "name_kr": clean_sym,
                "price": 0.0,
                "change_24h": 0.0,
                "volume": 0.0,
                "logo": "",
                "alpha_meta": None,
            }
        return universe[clean_sym]

    # [1] UPBIT
    upbit_data = results.get("UPBIT") or []
    if isinstance(upbit_data, list):
        for m in upbit_data:
            market = m.get("market", "")
            if market.startswith("KRW-"):
                sym = market.split("-")[-1]
                u = get_or_create(sym)
                u["exchanges"].add("UPBIT")
                if m.get("korean_name"):
                    u["name_kr"] = m["korean_name"]
                if m.get("english_name"):
                    u["name"] = m["english_name"]

    # [2] BITHUMB
    bithumb_data = results.get("BITHUMB") or []
    if isinstance(bithumb_data, list):
        for m in bithumb_data:
            market = m.get("market", "")
            sym = market.split("-")[-1]
            u = get_or_create(sym)
            u["exchanges"].add("BITHUMB")
            if m.get("korean_name"):
                u["name_kr"] = m["korean_name"]
            if m.get("english_name"):
                u["name"] = m["english_name"]

    # [3] BINANCE SPOT
    binance_spot = results.get("BINANCE_SPOT") or []
    if isinstance(binance_spot, list):
        for item in binance_spot:
            sym_pair = item.get("symbol", "")
            price = float(item.get("price", 0.0))
            for quote in ("USDT", "FDUSD", "USDC", "BTC"):
                if sym_pair.endswith(quote):
                    base = sym_pair[: -len(quote)]
                    if base:
                        u = get_or_create(base)
                        u["exchanges"].add("BINANCE_SPOT")
                        u["exchanges"].add("BINANCE")
                        if u["price"] == 0.0 and quote in ("USDT", "USDC", "FDUSD"):
                            u["price"] = price
                    break

    # [4] BINANCE FUTURES
    binance_fut = results.get("BINANCE_FUTURES") or []
    if isinstance(binance_fut, list):
        for item in binance_fut:
            sym_pair = item.get("symbol", "")
            for quote in ("USDT", "USDC"):
                if sym_pair.endswith(quote):
                    base = sym_pair[: -len(quote)]
                    if base:
                        u = get_or_create(base)
                        u["exchanges"].add("BINANCE_FUTURES")
                    break

    # [5] BYBIT SPOT
    bybit_spot = (results.get("BYBIT_SPOT") or {}).get("result", {}).get("list", [])
    for item in bybit_spot:
        base = item.get("baseCoin", "")
        if base:
            u = get_or_create(base)
            u["exchanges"].add("BYBIT_SPOT")
            u["exchanges"].add("BYBIT")

    # [6] BYBIT FUTURES
    bybit_fut = (results.get("BYBIT_FUTURES") or {}).get("result", {}).get("list", [])
    for item in bybit_fut:
        base = item.get("baseCoin", "")
        if base:
            u = get_or_create(base)
            u["exchanges"].add("BYBIT_FUTURES")

    # [7] OKX SPOT
    okx_spot = (results.get("OKX_SPOT") or {}).get("data", [])
    for item in okx_spot:
        base = item.get("baseCcy", "")
        if base:
            u = get_or_create(base)
            u["exchanges"].add("OKX_SPOT")
            u["exchanges"].add("OKX")

    # [8] BITGET SPOT
    bitget_spot = (results.get("BITGET_SPOT") or {}).get("data", [])
    for item in bitget_spot:
        base = item.get("baseCoin", "")
        if base:
            u = get_or_create(base)
            u["exchanges"].add("BITGET_SPOT")
            u["exchanges"].add("BITGET")

    # [9] GATEIO SPOT
    gateio_spot = results.get("GATEIO_SPOT") or []
    if isinstance(gateio_spot, list):
        for item in gateio_spot:
            base = item.get("base", "")
            if base:
                u = get_or_create(base)
                u["exchanges"].add("GATEIO_SPOT")
                u["exchanges"].add("GATEIO")

    # [10] COINBASE SPOT
    coinbase_spot = results.get("COINBASE_SPOT") or []
    if isinstance(coinbase_spot, list):
        for item in coinbase_spot:
            base = item.get("base_currency", "")
            if base:
                u = get_or_create(base)
                u["exchanges"].add("COINBASE_SPOT")
                u["exchanges"].add("COINBASE")

    # [11] BINANCE ALPHA
    alpha_res = results.get("BINANCE_ALPHA") or {}
    alpha_list = alpha_res.get("data", []) if isinstance(alpha_res, dict) else []
    for item in alpha_list:
        base = item.get("symbol", "")
        if base:
            u = get_or_create(base)
            u["exchanges"].add("BINANCE_ALPHA")
            # 알파 메타데이터 및 시세 주입
            if not u.get("alpha_meta"):
                u["alpha_meta"] = {
                    "alphaId": item.get("alphaId"),
                    "mulPoint": item.get("mulPoint", 1),
                    "chainName": item.get("chainName"),
                    "contractAddress": item.get("contractAddress"),
                    "liquidity": float(item.get("liquidity") or 0),
                }
            if item.get("name") and u["name"] == u["symbol"]:
                u["name"] = item.get("name")
            if item.get("iconUrl") and not u["logo"]:
                u["logo"] = item.get("iconUrl")
            # 가격 및 변동률
            try:
                p = float(item.get("price") or 0)
                if p > 0 and (u["price"] == 0.0 or "BINANCE_SPOT" not in u["exchanges"]):
                    u["price"] = p
                u["change_24h"] = float(item.get("percentChange24h") or 0)
                u["volume"] = float(item.get("volume24h") or 0)
            except:
                pass

    # 3. Sellnance Row 포맷으로 조립 (Rank, Ticker_EXCH, Listed_Exchanges)
    print(f"📊 [유니버스 집계 완료]: 총 {len(universe)}개 유니크 코인")

    # 거래소 수 및 볼륨/시세 순 정렬
    sorted_items = sorted(
        universe.values(),
        key=lambda x: (len(x["exchanges"]), x["volume"], x["price"]),
        reverse=True,
    )

    final_rows = []
    for idx, item in enumerate(sorted_items):
        sym = item["symbol"]
        exch_list = sorted(list(item["exchanges"]))
        
        # 거래소 언더바 식별 Ticker (예: NES_ALPHA, PUMP_BITGET_ALPHA, BTC_MAJOR)
        if len(exch_list) > 3:
            exch_suffix = "MULTI"
        else:
            exch_suffix = "_".join([e.replace("_SPOT", "").replace("BINANCE_", "B_") for e in exch_list])
        ticker_key = f"{sym}_{exch_suffix}"

        vol = item["volume"]
        if vol >= 1_000_000_000:
            vol_fmt = f"{vol / 1_000_000_000:.2f} B"
        elif vol >= 1_000_000:
            vol_fmt = f"{vol / 1_000_000:.2f} M"
        elif vol >= 1_000:
            vol_fmt = f"{vol / 1_000:.1f} K"
        elif vol > 0:
            vol_fmt = f"{vol:.1f}"
        else:
            vol_fmt = "-"

        row = {
            "UID": 900000 + idx,
            "Rank": idx + 1,
            "Ticker": ticker_key,
            "DisplayTicker": sym,
            "Symbol": sym,
            "Name": item["name"],
            "Name_KR": item["name_kr"],
            "Korean_Name": item["name_kr"],
            "Price": item["price"],
            "Price_Raw": item["price"],
            "Price_KRW": item["price"] * 1400 if item["price"] > 0 else 0,
            "Upbit_Price": item["price"] * 1400 if "UPBIT" in item["exchanges"] else 0,
            "Bithumb_Price": item["price"] * 1400 if "BITHUMB" in item["exchanges"] else 0,
            "Binance_Price_Spot": item["price"] if "BINANCE_SPOT" in item["exchanges"] else 0,
            "Binance_Price_Futures": item["price"] if "BINANCE_FUTURES" in item["exchanges"] else 0,
            "Change_24h": item["change_24h"],
            "Change_Today": item["change_24h"],
            "Change_24h_Raw": item["change_24h"],
            "Change_Today_Raw": item["change_24h"],
            "Volume_Raw": vol,
            "Volume_Formatted": vol_fmt,
            "Binance_Vol_24h": vol,
            "Upbit_Vol_24h": 0,
            "Upbit_Vol_Formatted": "-",
            "MarketCap": 0,
            "MarketCap_Formatted": "-",
            "Kimchi_Premium": 0,
            "Kimchi_Formatted": "-",
            "Funding_Formatted": "-",
            "precision": 4 if item["price"] < 1 else 2,
            "Logo": item["logo"],
            # 5~9대 거래소별 플래그
            "Binance": "O" if "BINANCE_SPOT" in item["exchanges"] else "X",
            "Binance_Futures": "O" if "BINANCE_FUTURES" in item["exchanges"] else "X",
            "Upbit": "O" if "UPBIT" in item["exchanges"] else "X",
            "Bithumb": "O" if "BITHUMB" in item["exchanges"] else "X",
            "Bybit": "O" if "BYBIT_SPOT" in item["exchanges"] else "X",
            "Bybit_Futures": "O" if "BYBIT_FUTURES" in item["exchanges"] else "X",
            "OKX": "O" if "OKX_SPOT" in item["exchanges"] else "X",
            "Bitget": "O" if "BITGET_SPOT" in item["exchanges"] else "X",
            "Gateio": "O" if "GATEIO_SPOT" in item["exchanges"] else "X",
            "Coinbase": "O" if "COINBASE_SPOT" in item["exchanges"] else "X",
            "Binance_Alpha": "O" if "BINANCE_ALPHA" in item["exchanges"] else "X",
            "Listed_Exchanges": exch_list,
            "Exchanges": exch_list,
            "ListingDate": "-",
            "Warnings": "4X" if (item.get("alpha_meta") or {}).get("mulPoint") == 4 else "",
            "isFavorite": False,
            "_isSandboxRow": True,
            "alpha_meta": item.get("alpha_meta"),
        }
        final_rows.append(row)

    payload = {
        "status": "success",
        "total_count": len(final_rows),
        "scanned_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "data": final_rows,
    }

    os.makedirs(STATIC_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ [저장 성공]: {OUTPUT_FILE} (총 {len(final_rows)}개 종목 저장 완료)")
    return payload


if __name__ == "__main__":
    run_full_scan()
