# modules/alpha_rules.py
"""
💎 [Custom Alpha Gems Rule Engine]
바이낸스 알파(Binance Alpha) 전용 커스텀 규칙 및 동적 자동 선별 엔진
- 기존 바이낸스 현물/선물과 완전 격리
"""

from datetime import datetime, timezone
import requests

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }
)


def fetch_binance_alpha_raw():
    """바이낸스 알파 API 전체 토큰 목록 및 실시간 시세/메타 수집"""
    alpha_map = {}
    try:
        url = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
        res = SESSION.get(url, timeout=5).json()
        items = res.get("data", []) if isinstance(res, dict) else []
        for item in items:
            sym = (item.get("symbol") or "").upper().strip()
            if sym and sym not in alpha_map:
                alpha_map[sym] = item
    except Exception as e:
        print(f"[Alpha Engine Error] Binance alpha fetch failed: {e}")
    return alpha_map


def evaluate_gem_rules(sym, exch_tags):
    """
    🎯 [커스텀 규칙 알고리즘 판정기]
    - 규칙을 바꾸고 싶을 때 이 함수 내부의 조건식만 수정하면 됩니다.
    - True 반환 시 선별되어 바이낸스 현물 파이프라인으로 주입됩니다.
    """
    # 🚫 [공통 제외 규칙] 업비트 상장, 바이낸스 선물 상장, 바이낸스 진짜 현물 상장, 주식(STOCK) 토큰 원천 배제
    if "UPBIT" in exch_tags:
        return False
    if "BINANCE_FUTURES" in exch_tags:
        return False
    if "BINANCE_SPOT" in exch_tags:
        return False
    if "BINANCE_STOCK" in exch_tags:
        return False

    # 거래소 보유 상태
    has_bithumb = "BITHUMB" in exch_tags
    has_coinbase = "COINBASE_SPOT" in exch_tags or "COINBASE" in exch_tags
    has_gateio = "GATEIO_SPOT" in exch_tags or "GATEIO" in exch_tags
    has_bitget = "BITGET_SPOT" in exch_tags or "BITGET" in exch_tags
    has_bybit = "BYBIT_SPOT" in exch_tags or "BYBIT" in exch_tags

    # 4대 조건식 (하나라도 만족 시 통과)
    # Case 1: 빗썸 상장 알파 보석
    if has_bithumb:
        return True

    # Case 2: 코인베이스 현물 + 게이트아이오 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_coinbase and has_gateio:
        return True

    # Case 3: 비트겟 현물 + 코인베이스 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_bitget and has_coinbase:
        return True

    # Case 4: 비트겟 현물 + 바이비트 현물 상장 (빗썸 제외)
    if (not has_bithumb) and has_bitget and has_bybit:
        return True

    return False


def filter_dynamic_alpha_gems(
    alpha_map,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
    binance_futures_set=None,
    binance_stock_set=None,
    binance_spot_set=None,
):
    """
    전체 알파 코인 중 커스텀 알고리즘을 통과한 보석 코인들만 딕셔너리로 반환
    """
    if binance_futures_set is None:
        binance_futures_set = set()
    if binance_stock_set is None:
        binance_stock_set = set()
    if binance_spot_set is None:
        binance_spot_set = set()

    matched_gems = {}
    for sym, alpha_item in alpha_map.items():
        # 심볼 상장 거래소 목록 종합
        exch_tags = set(global_listings.get(sym, set()))
        if sym in upbit_krw_set:
            exch_tags.add("UPBIT")
        if sym in bithumb_krw_set:
            exch_tags.add("BITHUMB")
        if sym in binance_futures_set or f"{sym}USDT" in binance_futures_set:
            exch_tags.add("BINANCE_FUTURES")
        if sym in binance_spot_set or f"{sym}USDT" in binance_spot_set:
            exch_tags.add("BINANCE_SPOT")
        if sym in binance_stock_set or f"{sym}(STOCK)" in binance_stock_set:
            exch_tags.add("BINANCE_STOCK")

        if evaluate_gem_rules(sym, exch_tags):
            matched_gems[sym] = alpha_item

    return matched_gems


def inject_alpha_gems_into_pipeline(
    binance_data,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
):
    """
    🚀 [파이프라인 원클릭 주입 함수]
    선별된 보석 코인들을 바이낸스 현물(Spot) 파이프라인과 글로벌 상장 태그에 직접 주입
    (기존 선물/현물 코인 오염 0% 차단)
    """
    try:
        alpha_map = fetch_binance_alpha_raw()

        binance_fut_set = set()
        binance_spot_set = set()
        binance_stock_set = set()

        for k, v in binance_data.items():
            clean = k.replace("USDT", "")
            if v.get("is_futures"):
                binance_fut_set.add(clean)
                for prefix in ("1000000", "100000", "10000", "1000"):
                    if clean.startswith(prefix) and len(clean) > len(prefix):
                        binance_fut_set.add(clean[len(prefix):])
            if v.get("is_spot") and not v.get("is_alpha"):
                binance_spot_set.add(clean)
            if "STOCK" in str(v.get("underlying_type", "")).upper() or "(STOCK)" in k:
                binance_stock_set.add(clean)

        dynamic_gems = filter_dynamic_alpha_gems(
            alpha_map,
            global_listings,
            upbit_krw_set,
            bithumb_krw_set,
            binance_fut_set,
            binance_stock_set,
            binance_spot_set,
        )

        injected_count = 0
        for sym, alpha_item in dynamic_gems.items():
            ticker = f"{sym}USDT"

            # 1. 선별된 알파 보석에만 글로벌 리스팅 태그 보강
            if sym not in global_listings:
                global_listings[sym] = set()
            global_listings[sym].add("BINANCE_ALPHA")
            global_listings[sym].add("BINANCE_SPOT")
            global_listings[sym].add("BINANCE")

            # [A to B 폴백 거래소 우선순위 자동 결정] (BITGET -> BITHUMB -> BYBIT -> GATEIO)
            exch_tags = set(global_listings.get(sym, set()))
            if sym in bithumb_krw_set:
                exch_tags.add("BITHUMB")

            fallback_ex = "BITGET"
            if "BITGET_SPOT" in exch_tags or "BITGET" in exch_tags:
                fallback_ex = "BITGET"
            elif "BITHUMB" in exch_tags:
                fallback_ex = "BITHUMB"
            elif "BYBIT_SPOT" in exch_tags or "BYBIT" in exch_tags:
                fallback_ex = "BYBIT"
            elif "GATEIO_SPOT" in exch_tags or "GATEIO" in exch_tags:
                fallback_ex = "GATEIO"

            # 2. 알파 코인은 당일 시가를 억지로 추정하지 않고 None 처리 (등락폭 왜곡 차단)
            try:
                p = float(alpha_item.get("price") or 0.0)
                chg = float(alpha_item.get("percentChange24h") or 0.0)
                vol = float(alpha_item.get("volume24h") or 0.0)
            except:
                p, chg, vol = 0.0, 0.0, 0.0

            binance_data[ticker] = {
                "price": p,
                "spot_price": p,
                "futures_price": 0.0,
                "change_24h": chg,
                "spot_change_24h": chg,
                "futures_change_24h": 0.0,
                "vol_futures": 0.0,
                "vol_spot": vol,
                "precision": 4 if p < 1 else 2,
                "is_spot_only": True,
                "is_futures": False,
                "is_spot": True,  # 바낸 현물(Spot) 체제 흡수
                "is_alpha": True,  # 알파 플래그
                "fallback_exchange": fallback_ex,  # A to B 폴백 거래소
                "spot_utc0_open": None,
                "futures_utc0_open": None,
                "utc0_open": None,
                "funding_rate": 0.0,
                "binance_futures_funding_interval": 8,
                "funding_interval": 8,
                "underlying_type": "",
                "contract_type": "",
                "alpha_meta": alpha_item,
            }
            injected_count += 1

        if injected_count > 0:
            print(
                f"[Alpha Engine] {len(dynamic_gems)} pure gems auto-selected ({injected_count} new injected into Binance Spot)"
            )

        return dynamic_gems
    except Exception as e:
        print(f"[Alpha Engine Error] Injection failed: {e}")
        return {}
