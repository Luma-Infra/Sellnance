"""
modules/ticker_matcher.py
거래소간 티커 및 배수 매칭을 위한 지능형 8대 거래소 전수 탐색 및 DUPLICATED_LIST 매칭

[핵심 설계 원칙]
1. 기준축(Anchor): 바이낸스(현/선/알파) 및 업비트(KRW)를 기준으로 8대 거래소 전 종목을 전수 매칭
2. 맨 첫 글자부터 Base/Quote 안전 분리 (split_base_and_quote):
   - AUSDT -> Base: A (1글자 심볼 완벽 보존)
   - OLDUSDT -> Base: OLD (코인명 OLD 보존)
   - UPUSDT -> Base: UP (코인명 UP 보존)
   - USUSDT -> Base: US (코인명 US 보존)
   - DAIUSD -> Base: DAI, DAIDAI -> Base: DAI, USDTKRW -> Base: USDT
   - FOLD, CUP 등 일반 단어 내부의 철자를 함부로 자르지 않음
3. 공통 태그 규칙 기반 주식형 토큰(STOCK) 동적 배제:
   - 하드코딩 블랙리스트 없이, CMC 및 거래소의 Is_Stock, Chain, underlyingType, (STOCK) 태그로 수백 종 전수 차단
4. 스테이블코인 및 레버리지 토큰 오탐 방지:
   - USDT, DAI, USDC 등 스테이블코인은 상호간(USDT <-> DAI) 오매칭 차단.
   - BTC3L, ETHDOWN 등 레버리지 ETF만 차단하고 단독 코인(UP, DOWN)은 정상 보존
5. 디스크 캐싱:
   - 환율 디스크 캐시: static/fx_history_cache.json (일자별 USDT/KRW 일봉 200일 치)
   - 8대 거래소 원시 상장 목록 캐시: static/exchange_raw_listings_cache.json (12시간 TTL, 밴 방지)
6. 가두리/김프 시계열(1M, 3M, 6M) 과거 궤적 검증:
   - 현재가 괴리 허용: 0.1배(-90%) ~ 10배(+1000%) 광범위 개방
   - 오차 6% 초과 의심군은 과거 1개월(30일), 3개월(90일), 6개월(180일) 전 일봉 시계열을 역추적하여
     해당 일자의 실제 USDT/KRW 환율로 정규화 후 궤적 일치 여부로 가두리 동일 코인 확정
"""

import os
import sys
import json
import time
import math
import re
import argparse
from typing import Dict, List, Tuple, Optional, Set, Any
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import requests
from requests.adapters import HTTPAdapter

# 프로젝트 경로 설정
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

from modules import utils, config_manager

# 캐시 파일 경로
FX_CACHE_FILE = os.path.join(PROJECT_ROOT, "static", "fx_history_cache.json")
LISTINGS_CACHE_FILE = os.path.join(PROJECT_ROOT, "static", "exchange_raw_listings_cache.json")
CACHE_TTL_SECONDS = 43200  # 12시간

# 고성능 HTTP 세션
API_SESSION = requests.Session()
adapter = HTTPAdapter(pool_connections=30, pool_maxsize=30)
API_SESSION.mount("https://", adapter)
API_SESSION.mount("http://", adapter)

# 알려진 공통 마켓 결제 통화 (Quote)
COMMON_QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "KRW", "USD", "BTC", "ETH", "EUR", "DAI"]

# 알려진 스테이블코인 고유 베이스
KNOWN_STABLE_BASES = {
    "USDT", "USDC", "FDUSD", "DAI", "TUSD", "USDE", "PYUSD", "USDD", "BUSD",
    "USD1", "USDG", "USDS", "GUSD", "EUR", "GBP", "BRL", "TRY", "KRW", "JPY"
}


def safe_float(v: Any) -> float:
    """콤마, 공백 등이 포함된 가격 문자열을 안전하게 float으로 변환"""
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        s = str(v).replace(",", "").strip()
        return float(s) if s else 0.0
    except (ValueError, TypeError):
        return 0.0


def is_stock_token(item_or_row: dict, mapping_ticker_data: Optional[dict] = None) -> bool:
    """
    하드코딩 블랙리스트 없이, CMC 및 거래소의 '공통 태그 규칙'으로 수백 가지 주식형 토큰 전수 동적 판별
    1. Is_Stock 플래그
    2. Chain == "STOCK" 또는 "EQUITY"
    3. underlyingType / underlying_type / contractType에 "STOCK" 또는 "EQUITY" 포함
    4. 심볼/티커명/이름에 "(STOCK)" 표기 포함
    5. mapping.json TICKER_DATA type flag가 "STOCK"
    """
    if item_or_row.get("Is_Stock") is True:
        return True

    chain = str(item_or_row.get("Chain", "")).upper()
    if chain in ("STOCK", "EQUITY"):
        return True

    underlying = str(
        item_or_row.get("underlyingType")
        or item_or_row.get("underlying_type")
        or item_or_row.get("contractType")
        or ""
    ).upper()
    if "STOCK" in underlying or "EQUITY" in underlying:
        return True

    name = str(item_or_row.get("Name", "")).upper()
    sym = str(item_or_row.get("Ticker") or item_or_row.get("symbol") or item_or_row.get("base") or "").upper()
    if "(STOCK)" in name or "(STOCK)" in sym or sym.endswith("_STOCK") or sym.endswith("-STOCK"):
        return True

    tags = item_or_row.get("Tags") or []
    if isinstance(tags, list) and any(str(t).upper() in ("STOCK", "EQUITY", "PRE-IPO") for t in tags if isinstance(t, str)):
        return True

    if mapping_ticker_data:
        t_entry = mapping_ticker_data.get(sym) or mapping_ticker_data.get(item_or_row.get("base", ""))
        if t_entry and len(t_entry) >= 5 and str(t_entry[4]).upper() == "STOCK":
            return True

    return False


def is_stablecoin_asset(base: str, name: str = "") -> bool:
    """스테이블코인 여부 판별 (동일 자산 간의 거래소 매칭은 허용하되, 타 코인과의 오매칭 방지)"""
    b_upper = base.upper().strip()
    if b_upper in KNOWN_STABLE_BASES:
        return True
    if "USD" in b_upper and len(b_upper) <= 5 and any(c.isdigit() for c in b_upper):
        return True
    n_upper = name.upper()
    if "STABLECOIN" in n_upper or "USD COIN" in n_upper or "TETHER" in n_upper:
        return True
    return False


def is_leverage_token(symbol: str) -> bool:
    """
    레버리지 ETF 토큰(3L, 3S, 2L, 2S, BULL, BEAR) 판별
    - 단, 코인 이름 자체가 UP, DOWN, BULL, BEAR인 단독 코인은 제외하지 않음!
    - 반드시 앞에 기초 자산 심볼(BTC3L, ETHDOWN 등)이 결합된 경우만 레버리지 토큰으로 판별!
    """
    s = symbol.upper()
    m = re.match(r"^([A-Z0-9]{2,})(3L|3S|2L|2S|5L|5S|BULL|BEAR|UP|DOWN)$", s)
    if m:
        underlying = m.group(1)
        tag = m.group(2)
        if tag in ("3L", "3S", "2L", "2S", "5L", "5S"):
            return True
        if tag in ("UP", "DOWN", "BULL", "BEAR") and underlying in ("BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX"):
            return True
    return False


def split_base_and_quote(symbol: str) -> Tuple[str, str]:
    """
    거래소 티커에서 Base와 Quote를 맨 첫 글자부터 안전하게 분리
    예:
    - AUSDT -> Base: A, Quote: USDT
    - USUSDT -> Base: US, Quote: USDT
    - OLDUSDT -> Base: OLD, Quote: USDT
    - UPUSDT -> Base: UP, Quote: USDT
    - DAIUSD -> Base: DAI, Quote: USD
    - DAIDAI -> Base: DAI, Quote: DAI
    - USDTKRW -> Base: USDT, Quote: KRW
    - KRW-BTC -> Base: BTC, Quote: KRW
    - BTC_USDT -> Base: BTC, Quote: USDT
    """
    s = symbol.upper().strip()
    if not s:
        return "", ""

    # 1. 명시적 구분자 (_, -, /) 분리 (업비트, 빗썸, OKX, Gateio, 코인베이스 등)
    for sep in ["-", "_", "/"]:
        if sep in s:
            parts = s.split(sep)
            if len(parts) == 2:
                # 업비트 KRW-BTC (Quote-Base)
                if parts[0] in COMMON_QUOTES and parts[1] not in COMMON_QUOTES:
                    return parts[1], parts[0]
                # 일반 Base-Quote (BTC-USDT, BTC_KRW)
                return parts[0], parts[1]

    # 2. 결합형 티커에서 Quote 접미사 탐색 (긴 Quote부터 우선 매칭: USDT > USD)
    for q in sorted(COMMON_QUOTES, key=len, reverse=True):
        if s.endswith(q) and len(s) > len(q):
            base = s[:-len(q)]
            return base, q

    # 3. Quote가 없거나 심볼 자체가 자산인 경우
    return s, ""


# ==============================================================================
# 1. 환율 디스크 캐시 및 과거 일자별 환율 수집기
# ==============================================================================
def load_fx_history_cache(force_refresh: bool = False) -> Dict[str, float]:
    """
    업비트 KRW-USDT 200일 일봉 데이터를 활용하여 일자별(YYYY-MM-DD) 원화 USDT 환율 맵 반환
    """
    now = time.time()
    if not force_refresh and os.path.exists(FX_CACHE_FILE):
        try:
            with open(FX_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            cached_time = data.get("_timestamp", 0)
            if now - cached_time < CACHE_TTL_SECONDS and "rates" in data:
                return data["rates"]
        except Exception:
            pass

    rates: Dict[str, float] = {}
    try:
        url = "https://api.upbit.com/v1/candles/days?market=KRW-USDT&count=200"
        resp = API_SESSION.get(url, timeout=5)
        if resp.status_code == 200:
            candles = resp.json()
            for c in candles:
                dt_str = c.get("candle_date_time_utc", "")[:10]
                price = float(c.get("trade_price") or 0.0)
                if dt_str and price > 0:
                    rates[dt_str] = price
    except Exception as e:
        print(f"⚠️ [FX 환율 수집 실패] 업비트 호출 에러: {e}")

    if not rates:
        rates[datetime.now(timezone.utc).strftime("%Y-%m-%d")] = 1350.0

    try:
        payload = {"_timestamp": now, "rates": rates}
        utils.atomic_save_json(FX_CACHE_FILE, payload)
    except Exception:
        pass

    return rates


def get_rate_on_date(rates: Dict[str, float], target_date: datetime) -> float:
    """특정 일자의 환율 조회 (없을 시 가장 인접한 일자 반환)"""
    date_str = target_date.strftime("%Y-%m-%d")
    if date_str in rates:
        return rates[date_str]

    for i in range(1, 10):
        prev_d = (target_date - timedelta(days=i)).strftime("%Y-%m-%d")
        if prev_d in rates:
            return rates[prev_d]
        next_d = (target_date + timedelta(days=i)).strftime("%Y-%m-%d")
        if next_d in rates:
            return rates[next_d]

    return list(rates.values())[0] if rates else 1350.0


# ==============================================================================
# 2. 8대 거래소 원시 상장 목록 병렬 수집 및 디스크 캐싱
# ==============================================================================
def fetch_all_raw_listings(force_refresh: bool = False) -> Dict[str, List[dict]]:
    """
    8대 거래소(바이낸스, 업비트, 빗썸, 바이비트, OKX, 비트겟, 게이트아이오, 코인베이스)
    전 종목 현/선물 상장 목록 및 현재가 일괄 수집
    """
    now = time.time()
    if not force_refresh and os.path.exists(LISTINGS_CACHE_FILE):
        try:
            with open(LISTINGS_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            cached_time = data.get("_timestamp", 0)
            if now - cached_time < CACHE_TTL_SECONDS and "listings" in data:
                return data["listings"]
        except Exception:
            pass

    print("🌐 8대 거래소 전수 상장 목록 병렬 수집 시작 (밴 방지 세션 & 타임아웃 5초)...")
    listings: Dict[str, List[dict]] = {
        "BINANCE_SPOT": [],
        "BINANCE_FUTURES": [],
        "UPBIT": [],
        "BITHUMB": [],
        "BYBIT_SPOT": [],
        "BYBIT_FUTURES": [],
        "OKX_SPOT": [],
        "OKX_FUTURES": [],
        "BITGET_SPOT": [],
        "BITGET_FUTURES": [],
        "GATEIO_SPOT": [],
        "GATEIO_FUTURES": [],
        "COINBASE": [],
    }

    def fetch_binance_spot():
        try:
            r = API_SESSION.get("https://api.binance.com/api/v3/ticker/price", timeout=5).json()
            for item in r:
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("price") or 0.0)
                    if p > 0:
                        listings["BINANCE_SPOT"].append({"symbol": s, "base": base, "price": p, "market": "SPOT"})
        except Exception:
            pass

    def fetch_binance_futures():
        try:
            r = API_SESSION.get("https://fapi.binance.com/fapi/v1/ticker/price", timeout=5).json()
            for item in r:
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("price") or 0.0)
                    if p > 0:
                        listings["BINANCE_FUTURES"].append({"symbol": s, "base": base, "price": p, "market": "FUTURES"})
        except Exception:
            pass

    def fetch_upbit():
        try:
            m_res = API_SESSION.get("https://api.upbit.com/v1/market/all", timeout=5).json()
            krw_markets = [m["market"] for m in m_res if m["market"].startswith("KRW-")]
            if krw_markets:
                step = 100
                for i in range(0, len(krw_markets), step):
                    chunk = krw_markets[i:i + step]
                    t_res = API_SESSION.get(f"https://api.upbit.com/v1/ticker?markets={','.join(chunk)}", timeout=5).json()
                    for item in t_res:
                        s = item.get("market", "")
                        base = s.replace("KRW-", "")
                        p = float(item.get("trade_price") or 0.0)
                        chg_24 = float(item.get("signed_change_rate") or 0.0) * 100
                        if p > 0:
                            listings["UPBIT"].append({"symbol": s, "base": base, "price": p, "currency": "KRW", "change_24h": chg_24, "market": "SPOT"})
        except Exception:
            pass

    def fetch_bithumb():
        try:
            r = API_SESSION.get("https://api.bithumb.com/public/ticker/ALL_KRW", timeout=5).json()
            data = r.get("data", {})
            for sym, item in data.items():
                if isinstance(item, dict):
                    p = float(item.get("closing_price") or 0.0)
                    chg_24 = float(item.get("fluctate_rate_24H") or 0.0)
                    if p > 0:
                        listings["BITHUMB"].append({"symbol": f"{sym}_KRW", "base": sym, "price": p, "currency": "KRW", "change_24h": chg_24, "market": "SPOT"})
        except Exception:
            pass

    def fetch_bybit_spot():
        try:
            r = API_SESSION.get("https://api.bybit.com/v5/market/tickers?category=spot", timeout=5).json()
            for item in r.get("result", {}).get("list", []):
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("lastPrice") or 0.0)
                    if p > 0:
                        listings["BYBIT_SPOT"].append({"symbol": s, "base": base, "price": p, "market": "SPOT"})
        except Exception:
            pass

    def fetch_bybit_futures():
        try:
            r = API_SESSION.get("https://api.bybit.com/v5/market/tickers?category=linear", timeout=5).json()
            for item in r.get("result", {}).get("list", []):
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("lastPrice") or 0.0)
                    if p > 0:
                        listings["BYBIT_FUTURES"].append({"symbol": s, "base": base, "price": p, "market": "FUTURES"})
        except Exception:
            pass

    def fetch_okx():
        try:
            r_s = API_SESSION.get("https://www.okx.com/api/v5/market/tickers?instType=SPOT", timeout=5).json()
            for item in r_s.get("data", []):
                inst = item.get("instId", "")
                if inst.endswith("-USDT"):
                    base = inst.split("-")[0]
                    p = float(item.get("last") or 0.0)
                    if p > 0:
                        listings["OKX_SPOT"].append({"symbol": inst, "base": base, "price": p, "market": "SPOT"})
            r_f = API_SESSION.get("https://www.okx.com/api/v5/market/tickers?instType=SWAP", timeout=5).json()
            for item in r_f.get("data", []):
                inst = item.get("instId", "")
                if inst.endswith("-USDT-SWAP"):
                    base = inst.split("-")[0]
                    p = float(item.get("last") or 0.0)
                    if p > 0:
                        listings["OKX_FUTURES"].append({"symbol": inst, "base": base, "price": p, "market": "FUTURES"})
        except Exception:
            pass

    def fetch_bitget():
        try:
            r_s = API_SESSION.get("https://api.bitget.com/api/v2/spot/market/tickers", timeout=5).json()
            for item in r_s.get("data", []):
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("lastPr") or 0.0)
                    if p > 0:
                        listings["BITGET_SPOT"].append({"symbol": s, "base": base, "price": p, "market": "SPOT"})
            r_f = API_SESSION.get("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-futures", timeout=5).json()
            for item in r_f.get("data", []):
                s = item.get("symbol", "")
                if s.endswith("USDT"):
                    base = s[:-4]
                    p = float(item.get("lastPr") or 0.0)
                    if p > 0:
                        listings["BITGET_FUTURES"].append({"symbol": s, "base": base, "price": p, "market": "FUTURES"})
        except Exception:
            pass

    def fetch_gateio():
        try:
            r_s = API_SESSION.get("https://api.gateio.ws/api/v4/spot/tickers", timeout=5).json()
            for item in r_s:
                cp = item.get("currency_pair", "")
                if cp.endswith("_USDT"):
                    base = cp.split("_")[0]
                    p = float(item.get("last") or 0.0)
                    if p > 0:
                        listings["GATEIO_SPOT"].append({"symbol": cp, "base": base, "price": p, "market": "SPOT"})
            r_f = API_SESSION.get("https://api.gateio.ws/api/v4/futures/usdt/tickers", timeout=5).json()
            for item in r_f:
                c = item.get("contract", "")
                if c.endswith("_USDT"):
                    base = c.split("_")[0]
                    p = float(item.get("last") or 0.0)
                    if p > 0:
                        listings["GATEIO_FUTURES"].append({"symbol": c, "base": base, "price": p, "market": "FUTURES"})
        except Exception:
            pass

    def fetch_coinbase():
        try:
            r = API_SESSION.get("https://api.exchange.coinbase.com/products", timeout=5).json()
            for item in r:
                s = item.get("id", "")
                if s.endswith("-USD") or s.endswith("-USDT"):
                    base = item.get("base_currency", "")
                    listings["COINBASE"].append({"symbol": s, "base": base, "price": 0.0, "market": "SPOT"})
        except Exception:
            pass

    with ThreadPoolExecutor(max_workers=9) as executor:
        futs = [
            executor.submit(fetch_binance_spot),
            executor.submit(fetch_binance_futures),
            executor.submit(fetch_upbit),
            executor.submit(fetch_bithumb),
            executor.submit(fetch_bybit_spot),
            executor.submit(fetch_bybit_futures),
            executor.submit(fetch_okx),
            executor.submit(fetch_bitget),
            executor.submit(fetch_gateio),
            executor.submit(fetch_coinbase),
        ]
        for f in futs:
            try:
                f.result()
            except Exception:
                pass

    total_count = sum(len(v) for v in listings.values())
    print(f"✅ 8대 거래소 수집 완료: 총 {total_count}개 종목 확보")

    try:
        payload = {"_timestamp": now, "listings": listings}
        utils.atomic_save_json(LISTINGS_CACHE_FILE, payload)
    except Exception as e:
        print(f"⚠️ 디스크 캐시 저장 실패: {e}")

    return listings


# ==============================================================================
# 3. 고속 O(1) 정규화 검색 키 생성기 (다형성 티커/이름 분해)
# ==============================================================================
def clean_string_core(s: str) -> str:
    """공백, 특수문자, 하이픈, 언더바 제거 및 소문자화"""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def generate_search_keys(symbol: str, name: str = "") -> Set[str]:
    """
    맨 첫 글자부터 고려하여 코인 원형을 훼손하지 않는 안전한 정규화 키 생성기
    - AUSDT -> 'a' (1글자 코인 완벽 지원)
    - OLDUSDT -> 'old' (코인명 OLD 보존)
    - UPUSDT -> 'up' (코인명 UP 보존)
    - USUSDT -> 'us' (코인명 US 보존)
    - FOLDUSDT -> 'fold' (FOLD의 OLD를 함부로 자르지 않음!)
    - CUPUSDT -> 'cup' (CUP의 UP을 함부로 자르지 않음!)
    - PLAYSOUT -> 'playsout', 'play' (명시적 바이비트 SOUT 접미사 분리)
    - 1000PEPE -> '1000pepe', 'pepe' (배수 접두사 분리)
    """
    keys: Set[str] = set()
    base, quote = split_base_and_quote(symbol)
    if not base:
        return keys

    # 1. 원형 그대로의 클린 키는 항상 1순위로 포함 (1글자 'a', 'x' 등도 완전 보존)
    c_raw = clean_string_core(base)
    if c_raw:
        keys.add(c_raw)

    # 2. utils.get_pure_base_asset 활용
    pure_base = utils.get_pure_base_asset(base)
    c_pure = clean_string_core(pure_base)
    if c_pure:
        keys.add(c_pure)

    # 3. 명시적 구분자 뒤의 파생/버전 분리 (ETH_OLD, PEPE_V2, LUNA_NEW 등)
    m_delimited = re.match(r"^(.+)[_\-](OLD|NEW|V\d+|PERP|SWAP|SOUT)$", base, re.IGNORECASE)
    if m_delimited and len(m_delimited.group(1)) >= 1:
        keys.add(clean_string_core(m_delimited.group(1)))

    # 4. 거래소 전용 명시적 접미사 분리 (단, base 길이가 접미사보다 확연히 길 때만!)
    # 예: PLAYSOUT -> PLAY (SOUT 4글자, 남은 base 4글자)
    # 단, FOLD, COLD, HOLD, GOLD는 4글자 단어이므로 OLD를 자르지 않음!
    if base.upper().endswith("SOUT") and len(base) > 4:
        keys.add(clean_string_core(base[:-4]))

    # 5. 배수 접두사 분리 (10, 100, 1000, 1M, 1B, 1000000, 10k 등)
    m_scale = re.match(r"^(10+|1[MB]|\d+K)(.+)$", base, re.IGNORECASE)
    if m_scale and len(m_scale.group(2)) >= 1:
        keys.add(clean_string_core(m_scale.group(2)))

    # 6. 숫자 버전 접미사 분리 (PEPE2 -> PEPE, UP2 -> UP)
    m_num = re.match(r"^([A-Z]{2,})\d+$", base)
    if m_num:
        keys.add(clean_string_core(m_num.group(1)))

    # 7. 풀네임 기반 약칭 및 단어 추출
    if name:
        n_clean = clean_string_core(name)
        if n_clean:
            keys.add(n_clean)
        words = re.findall(r"[A-Za-z0-9]+", name)
        if len(words) >= 2:
            acronym = "".join(w[0] for w in words).lower()
            if len(acronym) >= 2:
                keys.add(acronym)
        if words and len(words[0]) >= 2:
            keys.add(clean_string_core(words[0]))

    # 빈 문자열만 제외하고 1글자 심볼(A, X 등)도 모두 허용
    return {k for k in keys if len(k) >= 1}


# ==============================================================================
# 4. 가격 배수 계산 및 시계열(1M, 3M, 6M) 캔들 검증 엔진
# ==============================================================================
def extract_scale_multiplier(symbol: str) -> Optional[float]:
    """
    심볼에 명시된 배수 접두사/단위를 감지하여 배율 반환 (없으면 None)
    예:
    - 1000PEPE, 1000SATS -> 1000.0
    - 10000SATS -> 10000.0
    - 1MPEPE -> 1000000.0
    - 1000000MOG -> 1000000.0
    - 100k -> 100000.0
    - 1B -> 1000000000.0
    """
    if not symbol:
        return None
    s = str(symbol).strip().upper().replace("-", "_")
    token = s.split("_")[0]

    # 1M, 1B
    m_mb = re.match(r"^1M([A-Z0-9]+)$", token)
    if m_mb:
        return 1000000.0
    m_b = re.match(r"^1B([A-Z0-9]+)$", token)
    if m_b:
        return 1000000000.0

    # 10, 100, 1000, 10000, 100000, 1000000 등 10의 거듭제곱 (단, 2글자 이상 토큰)
    m_pow = re.match(r"^(10+)([A-Z0-9]+)$", token)
    if m_pow:
        return float(m_pow.group(1))

    # 10K, 100K 등
    m_k = re.match(r"^(\d+)K([A-Z0-9]+)$", token)
    if m_k:
        return float(m_k.group(1)) * 1000.0

    return None


def find_best_multiplier_and_diff(p1: float, p2: float) -> Tuple[Optional[float], float]:
    """두 가격 사이의 10진수 배수(10^k) 및 정규화 후 오차율(%) 계산"""
    if p1 <= 0 or p2 <= 0:
        return None, 999.0
    try:
        ratio = p1 / p2
        k = round(math.log10(ratio))
        if abs(k) > 9:
            return None, 999.0
        m = 10.0 ** k
        norm_p1 = p1 / m
        diff_pct = abs(norm_p1 - p2) / p2 * 100.0
        return m, diff_pct
    except Exception:
        return None, 999.0


_DAILY_CANDLE_CACHE: Dict[str, Dict[str, float]] = {}


def fetch_historical_daily_prices(exchange: str, symbol: str) -> Dict[str, float]:
    """
    거래소별 과거 일봉 캔들(최대 200일)을 조회하여 {YYYY-MM-DD: 종가} 맵 반환 (인메모리 캐시 포함)
    """
    cache_key = f"{exchange.upper()}:{symbol.upper()}"
    if cache_key in _DAILY_CANDLE_CACHE:
        return _DAILY_CANDLE_CACHE[cache_key]

    history: Dict[str, float] = {}
    ex_upper = exchange.upper()

    try:
        if "UPBIT" in ex_upper:
            url = f"https://api.upbit.com/v1/candles/days?market={symbol}&count=200"
            r = API_SESSION.get(url, timeout=5).json()
            for c in r:
                dt_str = c.get("candle_date_time_utc", "")[:10]
                p = float(c.get("trade_price") or 0.0)
                if dt_str and p > 0:
                    history[dt_str] = p

        elif "BINANCE" in ex_upper:
            is_fut = "FUTURES" in ex_upper
            base_url = "https://fapi.binance.com/fapi/v1/klines" if is_fut else "https://api.binance.com/api/v3/klines"
            url = f"{base_url}?symbol={symbol}&interval=1d&limit=200"
            r = API_SESSION.get(url, timeout=5).json()
            if isinstance(r, list):
                for k in r:
                    ts = int(k[0]) // 1000
                    dt_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                    p = float(k[4])
                    if dt_str and p > 0:
                        history[dt_str] = p

        elif "BYBIT" in ex_upper:
            cat = "linear" if "FUTURES" in ex_upper else "spot"
            url = f"https://api.bybit.com/v5/market/kline?category={cat}&symbol={symbol}&interval=D&limit=200"
            r = API_SESSION.get(url, timeout=5).json()
            for k in r.get("result", {}).get("list", []):
                ts = int(k[0]) // 1000
                dt_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                p = float(k[4])
                if dt_str and p > 0:
                    history[dt_str] = p

        elif "GATEIO" in ex_upper:
            if "FUTURES" in ex_upper:
                url = f"https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract={symbol}&interval=1d&limit=200"
            else:
                url = f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={symbol}&interval=1d&limit=200"
            r = API_SESSION.get(url, timeout=5).json()
            if isinstance(r, list):
                for k in r:
                    ts = int(k[0])
                    dt_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                    p = float(k[2])
                    if dt_str and p > 0:
                        history[dt_str] = p

    except Exception:
        pass

    _DAILY_CANDLE_CACHE[cache_key] = history
    return history


def verify_historical_timeline(
    anchor_hist: Dict[str, float],
    cand_hist: Dict[str, float],
    anchor_is_krw: bool,
    cand_is_krw: bool,
    fx_rates: Dict[str, float],
) -> Tuple[bool, str]:
    """
    과거 시계열 궤적 비교:
    3개월, 6개월 존재 조건이 필수가 아니며(어제 상장 등 신규 상장 코인은 과거 캔들이 없음),
    존재하는 공통 과거 일자들을 유연하게 대조.
    공통 과거 캔들이 없거나 3일 이하인 신규 상장 코인이어도 거절하지 않고 현재가/티커 기반으로 진행 허용.
    """
    if not anchor_hist or not cand_hist:
        return True, "신규 상장/과거 캔들 부재 (진행 허용)"

    common_dates = sorted(set(anchor_hist.keys()) & set(cand_hist.keys()))
    if not common_dates:
        return True, "공통 과거 기간 부재 (신규 상장, 진행 허용)"

    # 공통 일자가 3일 이하인 갓 상장된 코인은 즉시 허용
    if len(common_dates) <= 3:
        return True, f"신규 상장 코인 (공통 기간 {len(common_dates)}일, 진행 허용)"

    # 공통 일자가 충분히 있다면 샘플링하여 궤적 일치 여부 검증 (가장 오래된 시점, 중간, 최근)
    sample_indices = [0, len(common_dates) // 2, -1]
    valid_points = 0
    passed_points = 0

    for idx in set(sample_indices):
        d_str = common_dates[idx]
        p_anchor = anchor_hist[d_str]
        p_cand = cand_hist[d_str]

        try:
            target_dt = datetime.strptime(d_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            rate = get_rate_on_date(fx_rates, target_dt)
        except Exception:
            rate = 1350.0

        if anchor_is_krw:
            p_anchor /= rate
        if cand_is_krw:
            p_cand /= rate

        valid_points += 1
        m, diff = find_best_multiplier_and_diff(p_anchor, p_cand)
        if diff <= 25.0:
            passed_points += 1

    if valid_points > 0 and (passed_points / valid_points) >= 0.5:
        return True, f"가용 시계열 {passed_points}/{valid_points} 시점 일치"

    return False, f"가용 시계열 불일치 ({passed_points}/{valid_points})"


# ==============================================================================
# 5. 전수 탐색 및 지능형 매칭 메인 알고리즘
# ==============================================================================
def run_full_scan_matching(
    force_refresh: bool = False,
    apply: bool = False,
    verbose: bool = True,
    non_interactive: bool = False,
):
    print("==================================================")
    print("   🚀 SELLNANCE 8대 거래소 전수 티커 & 배수 매칭 엔진")
    print("==================================================")

    mapping_path = os.path.join(PROJECT_ROOT, "mapping.json")
    if not os.path.exists(mapping_path):
        print("❌ mapping.json 파일을 찾을 수 없습니다.")
        return

    with open(mapping_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    cache_path = os.path.join(PROJECT_ROOT, "static", "market_data_cache.json")
    if not os.path.exists(cache_path):
        print("❌ static/market_data_cache.json 파일을 찾을 수 없습니다.")
        return

    with open(cache_path, "r", encoding="utf-8") as f:
        market_cache = json.load(f)

    market_data: List[dict] = market_cache.get("data", [])
    duplicated_list: dict = mapping.get("DUPLICATED_LIST", {})
    ticker_data: dict = mapping.get("TICKER_DATA", {})

    # 2. 환율 디스크 캐시 로드
    fx_rates = load_fx_history_cache(force_refresh=force_refresh)
    today_rate = get_rate_on_date(fx_rates, datetime.now(timezone.utc))
    print(f"💵 [환율 로드 완료] 기준 원화 USDT 환율: {today_rate:.2f}원 (디스크 캐시 {len(fx_rates)}일 치 확보)")

    # 3. 8대 거래소 전수 상장 목록 로드
    raw_listings = fetch_all_raw_listings(force_refresh=force_refresh)

    # 4. 고속 O(1) 해시 버킷 역색인(Inverted Index) 구축
    print("⚡ O(1) 해시 버킷 역색인 구축 중...")
    inverted_index: Dict[str, List[dict]] = {}
    already_docked_aliases: Set[str] = set()

    for k, v in duplicated_list.items():
        if len(v) >= 4:
            already_docked_aliases.add(f"{v[3].upper()}:{str(v[2]).upper()}")

    indexed_count = 0
    for exch_name, items in raw_listings.items():
        for item in items:
            raw_sym = item.get("symbol", "")
            base = item.get("base", "")

            # 1. 주식형 토큰 공통 태그 규칙 검사 (수백 가지 주식형 토큰 동적 배제)
            if is_stock_token(item, ticker_data):
                continue

            # 2. 레버리지 ETF 토큰(BTC3L, ETHDOWN 등) 배제 (단, 단독 코인 UP, DOWN은 보존)
            if is_leverage_token(raw_sym) or is_leverage_token(base):
                continue

            item["exchange_key"] = exch_name
            item_keys = generate_search_keys(raw_sym, base)
            for k in item_keys:
                if k not in inverted_index:
                    inverted_index[k] = []
                inverted_index[k].append(item)
            indexed_count += 1

    print(f"✅ 역색인 구축 완료: {indexed_count}개 종목 색인화 (고유 키 {len(inverted_index)}개)")

    # 5. 기준 코인(바이낸스 및 업비트 기준축) 순회 및 후보군 매칭
    print("\n🔍 기준축 코인 전수 탐색 및 가격/시계열 검증 진행 중...")
    discovered_matches: List[dict] = []

    for row in market_data:
        uid = str(row.get("UID", "")).strip()
        if not uid.isdigit():
            continue  # 순수 숫자 UID만 탐색 대상

        # 주식형 토큰(STOCK) 공통 태그 규칙 배제
        if is_stock_token(row, ticker_data):
            continue

        anchor_ticker = row.get("Ticker", "")
        anchor_name = row.get("Name", "")
        anchor_sym = row.get("Symbol", anchor_ticker)
        anchor_keys = generate_search_keys(anchor_ticker, anchor_name)
        anchor_keys.update(generate_search_keys(anchor_sym))

        # 기준 가격 (USD 단위로 정규화)
        anchor_p_fut = safe_float(row.get("Binance_Price_Futures"))
        anchor_p_spot = safe_float(row.get("Binance_Price_Spot") or row.get("Price_Raw") or row.get("Price"))
        anchor_p_upbit_krw = safe_float(row.get("Upbit_Price") or row.get("Price_KRW"))

        anchor_ref_price_usd = 0.0
        anchor_is_krw = False
        anchor_ex = "BINANCE"

        if anchor_p_fut > 0:
            anchor_ref_price_usd = anchor_p_fut
            anchor_ex = "BINANCE_FUTURES"
        elif anchor_p_spot > 0:
            anchor_ref_price_usd = anchor_p_spot
            anchor_ex = "BINANCE_SPOT"
        elif anchor_p_upbit_krw > 0:
            anchor_ref_price_usd = anchor_p_upbit_krw / today_rate
            anchor_is_krw = True
            anchor_ex = "UPBIT"

        if anchor_ref_price_usd <= 0:
            continue

        # O(1) 해시 버킷에서 후보 종목 추출
        candidate_pool: Dict[str, dict] = {}
        for ak in anchor_keys:
            if ak in inverted_index:
                for cand in inverted_index[ak]:
                    cand_unique = f"{cand['exchange_key']}:{cand['symbol']}"
                    if cand_unique not in already_docked_aliases:
                        candidate_pool[cand_unique] = cand

        # 후보군 검증
        listed_exchanges = set(row.get("Listed_Exchanges") or [])
        anchor_is_stable = is_stablecoin_asset(anchor_sym, anchor_name)

        for cand_unique, cand in candidate_pool.items():
            cand_ex = cand["exchange_key"]
            cand_sym = cand["symbol"]
            cand_base = cand["base"]
            cand_p_raw = cand.get("price", 0.0)

            if cand_p_raw <= 0:
                continue

            # 해당 코인이 이미 이 거래소에 도킹되어 시세가 채워져 있다면 중복 추천 스킵
            if cand_ex in listed_exchanges:
                continue
            if cand_ex == "UPBIT" and (row.get("Upbit") == "O" or safe_float(row.get("Upbit_Price")) > 0):
                continue
            if cand_ex == "BITHUMB" and (safe_float(row.get("Bithumb_Price")) > 0 or row.get("Bithumb_Symbol")):
                continue
            if cand_ex == "BYBIT_SPOT" and safe_float(row.get("Bybit_Price_Spot")) > 0:
                continue
            if cand_ex == "BYBIT_FUTURES" and safe_float(row.get("Bybit_Price_Futures")) > 0:
                continue
            if cand_ex in ("BINANCE_SPOT", "BINANCE") and (row.get("Binance") == "O" or safe_float(row.get("Binance_Price_Spot")) > 0):
                continue
            if cand_ex == "BINANCE_FUTURES" and (row.get("Binance_Futures") == "O" or safe_float(row.get("Binance_Price_Futures")) > 0):
                continue

            # 스테이블코인 교차 매칭 방지 (USDT가 DAI나 USDC, 일반 코인과 오매칭 차단)
            cand_is_stable = is_stablecoin_asset(cand_base)
            if anchor_is_stable != cand_is_stable:
                continue
            if anchor_is_stable and cand_is_stable:
                if clean_string_core(anchor_sym) != clean_string_core(cand_base):
                    continue

            cand_is_krw = (cand.get("currency") == "KRW")
            cand_p_usd = (cand_p_raw / today_rate) if cand_is_krw else cand_p_raw

            # 1단계: 배수(10^k) 계산 및 현재가 괴리 검증
            # [핵심 규칙] 배수(multiplier != 1.0)는 티커 심볼에 1000, 10000, 1M 등의 명시적 배수 접두사가 있을 때만 허용
            # 일반 종목에 임의로 10x, 100x 등을 적용하여 엉뚱한 타 코인(TRUST, RWUSDT 등)과 오매칭되는 것을 차단
            scale_anchor = extract_scale_multiplier(anchor_sym)
            scale_cand = extract_scale_multiplier(cand_base) or extract_scale_multiplier(cand_sym)

            if scale_anchor or scale_cand:
                # 명시적 배수 표기가 존재하는 계약 종목군 (예: 1000PEPE, 10000SATS 등)
                m, diff_pct = find_best_multiplier_and_diff(anchor_ref_price_usd, cand_p_usd)
                if m is None:
                    continue
                norm_anchor = anchor_ref_price_usd / m
                price_ratio = cand_p_usd / norm_anchor
                if price_ratio < 0.5 or price_ratio > 2.0:
                    continue
            else:
                # 일반 코인: 배수 적용 금지 (무조건 1.0x 기준)
                m = 1.0
                diff_pct = abs(anchor_ref_price_usd - cand_p_usd) / cand_p_usd * 100.0
                price_ratio = cand_p_usd / anchor_ref_price_usd
                # 현재가 허용 범위: 위로 2배(+100%), 아래로 50% 하락(0.5배)까지만 허용
                if price_ratio < 0.5 or price_ratio > 2.0:
                    continue

            # 매칭 판정
            is_match = False
            match_type = ""
            confidence = 0

            # 케이스 A: 정상 시세 근접 (오차 6% 이내)
            if diff_pct <= 6.0:
                # [기본 1:1 페어 노이즈 제외] 심볼명도 완전히 같고(BTC == BTC), 배율도 1배수(1x)인 표준 선물/현물 페어는
                # 이미 거래소의 기본 종목이므로 DUPLICATED_LIST(티커/배수 상이 족보)에 등록할 필요가 없음
                is_same_symbol = (clean_string_core(cand_base) == clean_string_core(anchor_sym))
                has_scale_prefix = any(
                    cand_sym.upper().startswith(p) or p in cand_sym.upper()
                    for p in ("1000", "1M", "1000000", "10000")
                )
                if is_same_symbol and m == 1.0 and not has_scale_prefix:
                    continue

                is_match = True
                match_type = "정상 시세 일치"
                confidence = 95
            else:
                # 케이스 B: 가두리/김프 의심군 (위로 2배, 아래로 -50% 범위)
                c_anchor = clean_string_core(anchor_sym)
                c_cand = clean_string_core(cand_base)
                is_related_name = (
                    (c_anchor == c_cand)
                    or (c_cand.startswith(c_anchor) or c_anchor.startswith(c_cand))
                    or (clean_string_core(anchor_name) == c_cand)
                    or (c_anchor in c_cand or c_cand in c_anchor)
                )

                if is_related_name:
                    anchor_hist = fetch_historical_daily_prices(anchor_ex, anchor_ticker)
                    cand_hist = fetch_historical_daily_prices(cand_ex, cand_sym)
                    passed, reason = verify_historical_timeline(
                        anchor_hist, cand_hist, anchor_is_krw, cand_is_krw, fx_rates
                    )
                    if passed:
                        is_match = True
                        match_type = f"가두리/김프 시계열 검증 ({reason})"
                        confidence = 88

            if is_match:
                anchor_chain = row.get("Chain", "") or (ticker_data.get(str(uid), ["", ""])[1] if str(uid) in ticker_data else "")
                alias_key = f"{anchor_sym}({anchor_name})_{cand_ex.lower()}"
                is_already = alias_key in duplicated_list

                discovered_matches.append({
                    "uid": str(uid),
                    "anchor_symbol": anchor_sym,
                    "anchor_name": anchor_name,
                    "anchor_chain": anchor_chain,
                    "anchor_price": round(anchor_ref_price_usd, 6),
                    "anchor_exchange": anchor_ex,
                    "target_exchange": cand_ex,
                    "target_symbol": cand_sym,
                    "target_base": cand_base,
                    "target_price": round(cand_p_usd, 6),
                    "multiplier": m,
                    "diff_pct": round(diff_pct, 2),
                    "match_type": match_type,
                    "confidence": confidence,
                    "alias_key": alias_key,
                    "is_already_mapped": is_already,
                })

    # 6. JSON 파일로 디스크 저장 (웹 UI 뷰어용)
    results_cache_file = os.path.join(PROJECT_ROOT, "static", "ticker_matcher_results.json")
    try:
        output_data = {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "total_count": len(discovered_matches),
            "high_confidence_count": sum(1 for item in discovered_matches if item.get("confidence", 0) >= 95),
            "multiplier_count": sum(1 for item in discovered_matches if item.get("multiplier", 1.0) != 1.0),
            "results": discovered_matches,
        }
        with open(results_cache_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ 매칭 결과 JSON 파일 저장 중 오류: {e}")

    # 7. 결과 리포트 출력
    print(f"\n==================================================")
    print(f"   🎯 탐색 결과: 총 {len(discovered_matches)}건의 매칭 후보 발견")
    print(f"   🌐 전용 웹 뷰어: http://localhost:8000/matcher")
    print(f"   📁 결과 JSON 저장: static/ticker_matcher_results.json")
    print(f"==================================================")

    if not discovered_matches:
        print("💡 현재 장부와 8대 거래소 간 미등록 매칭 후보가 없습니다. (족보 최적 상태)")
    else:
        for idx, m in enumerate(discovered_matches[:50], 1):
            mult_str = f"{m['multiplier']:.0f}x" if m['multiplier'] >= 1 else f"1/{1/m['multiplier']:.0f}x"
            print(
                f"[{idx:2d}] 신뢰도 {m['confidence']}점 | UID {m['uid']:5s} ({m['anchor_symbol']}) ↔ "
                f"{m['target_exchange']:15s}: {m['target_symbol']:15s} "
                f"(배율: {mult_str:5s}, 오차: {m['diff_pct']:4.1f}%, 사유: {m['match_type']})"
            )
        if len(discovered_matches) > 50:
            print(f"... 외 {len(discovered_matches) - 50}건 추가 발견됨 (전체 목록은 웹 뷰어에서 확인 가능)")

    # 8. 대화형 확인 및 적용
    if discovered_matches and not apply:
        print("\n" + "=" * 50)
        if non_interactive or not sys.stdin.isatty():
            print("ℹ️ 비대화형(Non-interactive) 환경이므로 Dry-Run 리포트만 출력하고 저장을 종료합니다.")
            print("💡 웹 뷰어(http://localhost:8000/matcher)에서 시각적으로 확인 및 선택 저장이 가능합니다.")
        else:
            try:
                user_input = input("❓ 발견된 매칭 후보를 mapping.json에 영구 추가하시겠습니까? (y/N): ").strip().lower()
                if user_input in ("y", "yes"):
                    apply = True
                else:
                    print("🚫 사용자 요청으로 저장을 취소했습니다. (웹 뷰어에서 선택 저장을 진행하세요)")
            except (EOFError, KeyboardInterrupt):
                print("\n🚫 대화형 입력이 중단되었습니다.")

    if apply and discovered_matches:
        apply_matches_to_mapping(discovered_matches)


def apply_matches_to_mapping(matches_to_apply: list) -> int:
    """선택된 매칭 리스트를 mapping.json의 DUPLICATED_LIST에 원자적으로 안전하게 반영합니다."""
    mapping = config_manager.load_mapping_data()
    duplicated_list = mapping.get("DUPLICATED_LIST", {})
    ticker_data = mapping.get("TICKER_DATA", {})

    added_count = 0
    for m in matches_to_apply:
        uid_str = str(m.get("uid", "")).strip()
        if not uid_str:
            continue
        ex_target = m.get("target_exchange", "")
        # 타겟 심볼 (예: BTC-USDT-SWAP -> BTC 또는 cand_base)
        target_sym = m.get("target_base") or m.get("target_symbol", "")
        anchor_sym = m.get("anchor_symbol", "")
        anchor_name = m.get("anchor_name", "")
        anchor_chain = m.get("anchor_chain") or (ticker_data.get(uid_str, ["", ""])[1] if uid_str in ticker_data else "")

        alias_key = f"{anchor_sym}({anchor_name})_{ex_target.lower()}"
        if alias_key not in duplicated_list:
            duplicated_list[alias_key] = [uid_str, anchor_chain, target_sym, ex_target.lower()]
            added_count += 1

    if added_count > 0:
        mapping["DUPLICATED_LIST"] = duplicated_list
        config_manager.save_mapping_data(mapping)
        print(f"🎉 성공: mapping.json의 DUPLICATED_LIST에 {added_count}개 매칭이 안전하게 추가되었습니다!")
    else:
        print("ℹ️ 이미 등록되어 있는 항목들이라 추가된 내역이 없습니다.")
    return added_count


def main():
    parser = argparse.ArgumentParser(description="Sellnance 지능형 8대 거래소 티커/배수 매칭 유틸리티")
    parser.add_argument("--refresh", action="store_true", help="디스크 캐시를 강제 갱신하고 최신 API 수집")
    parser.add_argument("--apply", action="store_true", help="추천 매칭을 확인 절차 없이 즉시 mapping.json에 반영")
    parser.add_argument("--non-interactive", action="store_true", help="대화형 확인 입력 없이 리포트 출력 및 JSON 저장 후 종료")
    args = parser.parse_args()

    run_full_scan_matching(
        force_refresh=args.refresh,
        apply=args.apply,
        non_interactive=args.non_interactive,
    )


if __name__ == "__main__":
    main()

