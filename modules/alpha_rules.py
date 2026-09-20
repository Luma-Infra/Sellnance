# modules/alpha_rules.py
"""
💎 [Custom Alpha Gems Rule Engine]
바이낸스 알파(Binance Alpha) 전용 커스텀 규칙 및 동적 자동 선별 엔진
- 기존 바이낸스 현물/선물과 완전 격리
"""

from datetime import datetime, timezone
from modules import utils
import requests
import time

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }
)

_ALPHA_API_CACHE = {"timestamp": 0.0, "data": {}}
_CACHE_TTL_SECONDS = 3.0  # 바이낸스 알파 API 과도 호출 방지 쿨다운 (3초)


def fetch_binance_alpha_raw():
    """바이낸스 알파 API 전체 토큰 목록 및 실시간 시세/메타 수집 (3초 TTL 캐시 및 다중 후보 보관)"""
    global _ALPHA_API_CACHE
    now = time.time()
    if (
        now - _ALPHA_API_CACHE["timestamp"] < _CACHE_TTL_SECONDS
        and _ALPHA_API_CACHE["data"]
    ):
        return _ALPHA_API_CACHE["data"]

    alpha_map = {}
    try:
        url = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
        res = SESSION.get(url, timeout=5).json()
        items = res.get("data", []) if isinstance(res, dict) else []
        for item in items:
            sym = (item.get("symbol") or "").upper().strip()
            if not sym:
                continue
            if sym not in alpha_map:
                alpha_map[sym] = item
                alpha_map[sym]["_candidates"] = [item]
            else:
                alpha_map[sym]["_candidates"].append(item)
        if alpha_map:
            _ALPHA_API_CACHE["timestamp"] = now
            _ALPHA_API_CACHE["data"] = alpha_map
    except Exception as e:
        print(f"[Alpha Engine Error] Binance alpha fetch failed: {e}")
        if _ALPHA_API_CACHE["data"]:
            return _ALPHA_API_CACHE["data"]
    return alpha_map


def is_valid_price_ratio(alpha_price, ref_price):
    """
    [상방 2배, 하방 50% 하락(0.5배) 안전 마진 검증: utils 공통 함수 위임]
    """
    return utils.is_valid_price_ratio(alpha_price, ref_price)


def get_reference_price_usd(sym, bithumb_data=None, krw_usd_rate=None, bybit_data=None):
    """
    기존 CEX(빗썸/바이비트 등)의 신뢰할 수 있는 기준 시세(USD) 추출
    """
    sym_u = sym.upper()
    # 1. 빗썸 원화 시세 -> USD 환산
    if bithumb_data and krw_usd_rate and krw_usd_rate > 0:
        bi_item = bithumb_data.get(sym_u)
        if isinstance(bi_item, dict):
            p_krw = float(bi_item.get("price") or 0.0)
            if p_krw > 0:
                return p_krw / krw_usd_rate

    # 2. 바이비트 시세 (USD)
    if bybit_data:
        by_item = bybit_data.get(sym_u) or bybit_data.get(f"{sym_u}USDT")
        if isinstance(by_item, dict):
            p_usd = float(by_item.get("price") or by_item.get("spot_price") or 0.0)
            if p_usd > 0:
                return p_usd

    return None


def evaluate_gem_rules(sym, exch_tags):
    """
    🎯 [커스텀 규칙 알고리즘 판정기]
    - 규칙을 바꾸고 싶을 때 이 함수 내부의 조건식만 수정하면 됩니다.
    - True 반환 시 선별되어 바이낸스 현물 파이프라인으로 주입됩니다.
    """
    # [공통 제외 규칙] 업비트 상장, 바이낸스 선물 상장, 바이낸스 진짜 현물 상장, 주식(STOCK) 토큰 원천 배제
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
    bithumb_data=None,
    krw_usd_rate=None,
    bybit_data=None,
    duplicated_list=None,
):
    """
    전체 알파 코인 중 족보(DUPLICATED_LIST) 우선 확정 및 2배수 가격 검증 통과 검증
    """
    if binance_futures_set is None:
        binance_futures_set = set()
    if binance_stock_set is None:
        binance_stock_set = set()
    if binance_spot_set is None:
        binance_spot_set = set()

    # 0. 족보(DUPLICATED_LIST)에 "binance_alpha"로 사전 등록된 알파 코인 추출 (1순위 우선권)
    fixed_alpha_entries = {}
    if duplicated_list and isinstance(duplicated_list, dict):
        for k, v in duplicated_list.items():
            if len(v) >= 4 and "binance_alpha" in str(v[3]).lower():
                sym_k = str(v[2]).upper().strip()
                uid_k = str(v[0]).strip()
                fb_k = str(v[5]).upper().strip() if len(v) >= 6 and v[5] else "BITGET"
                fixed_alpha_entries[sym_k] = {
                    "uid": uid_k,
                    "fallback_exchange": fb_k,
                    "key": k,
                }

    matched_gems = {}

    # 1. 족보(mapping.json)에 등록된 알파 코인 우선 즉시 확정
    for sym, fix_meta in fixed_alpha_entries.items():
        ref_p = get_reference_price_usd(sym, bithumb_data, krw_usd_rate, bybit_data)
        alpha_item = alpha_map.get(sym)
        chosen = None

        if alpha_item:
            candidates = alpha_item.get("_candidates", [alpha_item])
            if ref_p and ref_p > 0:
                valid_cands = []
                for cand in candidates:
                    try:
                        c_p = float(cand.get("price") or 0.0)
                    except:
                        c_p = 0.0
                    if is_valid_price_ratio(c_p, ref_p):
                        valid_cands.append((abs(c_p - ref_p), cand))
                if valid_cands:
                    valid_cands.sort(key=lambda x: x[0])
                    chosen = dict(valid_cands[0][1])
                else:
                    # 바낸 알파 API에 동명이인 잡코인만 존재할 경우: 시세 오염을 막기 위해 기준시세(폴백 거래소)로 안전 대체
                    prices_str = ", ".join(
                        [f"${float(c.get('price') or 0.0):.4f}" for c in candidates]
                    )
                    print(
                        f"[Alpha Guard] {sym} 족보 등록 코인이나 바낸알파 동명이인 감지 ([{prices_str}] != 기준가 ${ref_p:.4f}) -> 정상 기준시세로 폴백 연결"
                    )
                    chosen = {
                        "symbol": sym,
                        "price": ref_p,
                        "percentChange24h": 0.0,
                        "volume24h": 0.0,
                    }
            else:
                chosen = dict(candidates[0])
        else:
            # 바낸 알파 API 목록에 아예 없는 경우에도 족보에 있으면 기준시세로 엔트리 생성
            chosen = {
                "symbol": sym,
                "price": ref_p or 0.0,
                "percentChange24h": 0.0,
                "volume24h": 0.0,
            }

        if chosen:
            chosen["fallback_exchange"] = fix_meta["fallback_exchange"]
            chosen["_from_mapping"] = True
            matched_gems[sym] = chosen

    # 2. 족보에 없는 일반 알파 코인들은 동적 규칙 및 2배수 가격 검증으로 선별
    for sym, alpha_item in alpha_map.items():
        if sym in matched_gems:
            continue  # 이미 족보로 확정된 코인은 스킵

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
            # [2배수 안전 마진 검증]: 기존 거래소 시세와 비교해 동명이인 사칭/잡코인 자동 차단
            ref_p = get_reference_price_usd(sym, bithumb_data, krw_usd_rate, bybit_data)
            candidates = alpha_item.get("_candidates", [alpha_item])

            chosen_item = None
            if ref_p and ref_p > 0:
                valid_cands = []
                for cand in candidates:
                    try:
                        c_p = float(cand.get("price") or 0.0)
                    except:
                        c_p = 0.0
                    if is_valid_price_ratio(c_p, ref_p):
                        valid_cands.append((abs(c_p - ref_p), cand))

                if valid_cands:
                    valid_cands.sort(key=lambda x: x[0])
                    chosen_item = valid_cands[0][1]
                else:
                    prices_str = ", ".join(
                        [f"${float(c.get('price') or 0.0):.4f}" for c in candidates]
                    )
                    print(
                        f"[Alpha Guard] {sym} 동명이인 차단! (바낸알파 후보가: [{prices_str}] vs 기준시세: ${ref_p:.4f})"
                    )
                    continue
            else:
                chosen_item = candidates[0]

            if chosen_item:
                matched_gems[sym] = chosen_item

    return matched_gems


def inject_alpha_gems_into_pipeline(
    binance_data,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
    bithumb_data=None,
    krw_usd_rate=None,
    bybit_data=None,
    duplicated_list=None,
):
    """
    [파이프라인 원클릭 주입 함수]
    선별된 보석 코인들을 바이낸스 현물(Spot) 파이프라인과 글로벌 상장 태그에 직접 주입
    (족보 우선 체크, 2배수 가격 검증, 3초 API 캐시 자동 가동)
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
                        binance_fut_set.add(clean[len(prefix) :])
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
            bithumb_data=bithumb_data,
            krw_usd_rate=krw_usd_rate,
            bybit_data=bybit_data,
            duplicated_list=duplicated_list,
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

            # [A to B 폴백 거래소 결정: 족보(DUPLICATED_LIST) 지정 거래소 최우선, 없으면 자동 결정]
            fallback_ex = alpha_item.get("fallback_exchange") or "BITGET"
            if not alpha_item.get("fallback_exchange"):
                exch_tags = set(global_listings.get(sym, set()))
                if sym in bithumb_krw_set:
                    exch_tags.add("BITHUMB")

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
