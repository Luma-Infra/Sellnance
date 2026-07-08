# builder_upbit.py
import re
from modules import utils, config_manager

def build_upbit_row(
    base,
    up_info,
    binance_data,
    market_data_map,
    asset_to_lookup_key,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
    REVERSE_LOOKUP,
    processed_uids,
    krw_usd_rate,
    mapping,
    bybit_data,
    upbit_data,
    bithumb_data,
):
    (
        NOTE_MAP,
        TICKER_DATA,
        CHAIN_LOGO_MAP,
        EXCLUSION_LIST,
        DUPLICATED_LIST,
        SYMBOL_TO_ID_MAP,
        MANUAL_SUPPLY_MAP,
        SPECIAL_SYMBOL_MAP,
        HARDCODE_VERIFY_SKIP_LIST,
    ) = config_manager.get_mapping_parts(mapping)

    # --- 💡 초기값 세팅 (에러 방어막) ---
    current_p = 0.0
    utc0_open = 0.0
    up_price_krw = 0.0
    up_change_24h = 0.0
    change_today = 0.0
    # -------------------------------

    is_updated = False
    if up_info is None:
        return None, False

    # CMC 데이터 매칭
    lookup_id = asset_to_lookup_key.get(f"{base.upper()}_UPBIT")
    info = market_data_map.get(lookup_id)
    raw_key = str(REVERSE_LOOKUP.get(f"{base}_UPBIT", base) or base)
    display_name = re.sub(
        r"_(binance|upbit|bithumb)$", "", raw_key, flags=re.IGNORECASE
    )

    # 🚀 [추가] 괄호 안의 이름 추출 (예: EDGE(Definitive) -> Definitive)
    explicit_name = ""
    name_match = re.search(r"\((.*?)\)", display_name)
    if name_match:
        explicit_name = name_match.group(1)

    # 가격 데이터 추출 (여기서 변수들이 태어납니다)
    up_price_krw = float(up_info.get("price") or 0.0)
    up_open_krw = float(up_info.get("utc0_open") or 0.0)
    up_change_24h = float(up_info.get("change_24h") or 0.0)

    if up_price_krw > 0:
        current_p = up_price_krw / krw_usd_rate
    if up_open_krw > 0:
        utc0_open = up_open_krw / krw_usd_rate

    if utc0_open > 0:
        change_today = utils.js_round(((current_p - utc0_open) / utc0_open * 100), 2)

    # 🚀 [정리 완료] 업비트용 만능 열쇠 및 지문 확정
    ticker_info = TICKER_DATA.get(display_name)
    saved_chain = ticker_info[1] if isinstance(ticker_info, list) else ticker_info
    existing_uid = (
        ticker_info[0] if isinstance(ticker_info, list) and len(ticker_info) > 0 else ""
    )
    hardcoded_id = str(SYMBOL_TO_ID_MAP.get(base, ""))

    final_ucid = (
        existing_uid or hardcoded_id or str(SYMBOL_TO_ID_MAP.get(display_name, ""))
    )

    lookup_id = asset_to_lookup_key.get(f"{base.upper()}_UPBIT")
    # 3중 타격으로 업비트 코인 시총/볼륨 확보!
    # TO-BE: 👇 final_ucid를 가장 먼저 찔러야 EDGE 두 놈이 자기 장부를 찾아갑니다!
    info = market_data_map.get(str(final_ucid)) or market_data_map.get(lookup_id)

    # 🚀 CMC에서 새로운 ucid를 찾았다면 최종 업데이트
    if (not final_ucid or not final_ucid.isdigit()) and info:
        new_ucid = info.get("ucid", "")
        if new_ucid and new_ucid.isdigit():
            final_ucid = new_ucid
    if not final_ucid:
        final_ucid = base
        
    # 중복 UID 체크 및 방어
    if final_ucid and final_ucid in processed_uids and raw_key not in DUPLICATED_LIST:
        return None, False
    if final_ucid:
        processed_uids.add(final_ucid)

    # 로고 및 체인 설정
    ch_sym = (
        saved_chain
        or CHAIN_LOGO_MAP.get(display_name)
        or (info.get("chain_symbol") if info else "")
    )
    chain = (
        utils.create_image_tag(CHAIN_LOGO_MAP.get(ch_sym, ""))
        if ch_sym in CHAIN_LOGO_MAP
        else ch_sym
    )
    logo = utils.create_image_tag(
        f"https://s2.coinmarketcap.com/static/img/coins/64x64/{final_ucid}.png"
        if final_ucid
        else ""
    )

    # 🚀 [수정] 괄호 안의 이름이 있으면 최우선으로 사용, 그다음 족보(mapping.json) 이름, 마지막이 CMC 이름 사용
    coin_name = (
        explicit_name
        if explicit_name
        else (
            ticker_info[2] if ticker_info and len(ticker_info) >= 3 and ticker_info[2]
            else (info.get("name", base) if info else base)
        )
    )

    # 🚀 [신규 상장 캐치 & 족보 세탁기]
    if not ticker_info or (
        isinstance(ticker_info, list)
        and (
            len(ticker_info) < 5
            or not ticker_info[0]
            or ticker_info[0] != final_ucid
            or ticker_info[4] != "COIN"
        )
    ):
        TICKER_DATA[display_name] = [
            final_ucid,
            ch_sym,
            coin_name,  # 🚀 괄호에서 추출한 이름 우선 반영
            base,
            "COIN",  # 🚀 업비트는 무조건 COIN 고정
        ]
        is_updated = True
        print(f"✅ [족보 세탁] {display_name} UID 및 타입 복구 완료: {final_ucid} (COIN)")

    # 가격 및 정밀도
    p = current_p
    up_precision = (
        0 if p >= 100 else 1 if p >= 10 else 2 if p >= 1 else 3 if p >= 0.1 else 4
    )
    
    # 🚀 중복 티커 베이스 감지
    duplicated_bases = set()
    for k, v in DUPLICATED_LIST.items():
        if len(v) >= 4:
            duplicated_bases.add(v[2].upper())
            duplicated_bases.add(k.split('(')[0].upper())

    # 🚀 바이빗이 비교군인 경우, 바이빗 선물 정밀도를 우선 사용 (USD 가격 소수점)
    by_raw = {}
    if base in duplicated_bases:
        bybit_alias = None
        for k, v in DUPLICATED_LIST.items():
            if len(v) >= 4 and v[0] == final_ucid and v[3].upper() == "BYBIT":
                bybit_alias = v[2]
                break
        if bybit_alias:
            by_raw = bybit_data.get(bybit_alias, {})
    else:
        by_raw = bybit_data.get(base, {})

    by_prec = by_raw.get("precision")
    by_futures_for_prec = by_raw.get("futures_price", 0.0)
    if by_prec is not None and by_futures_for_prec > 0:
        up_precision = int(by_prec)
    else:
        # 🚀 바이낸스가 비교군인 경우 바이낸스 precision 사용
        for b_tick, b_inf_data in binance_data.items():
            b_base = b_tick.replace("USDT", "").upper()
            if b_base == base.upper() and b_inf_data.get("is_futures"):
                bn_prec = b_inf_data.get("precision")
                if bn_prec is not None:
                    up_precision = int(bn_prec)
                break

    # 상장 거래소 목록 조립
    listed_on = set()
    if base not in duplicated_bases:
        listed_on = set(global_listings.get(base, set()))
    else:
        # 중복 코인이면 DUPLICATED_LIST에서 명시적으로 매핑된 거래소만 연동
        for k, v in DUPLICATED_LIST.items():
            if len(v) >= 4 and v[0] == final_ucid:
                ex_name = v[3].upper()
                if ex_name == "BYBIT":
                    listed_on.add("BYBIT")
                elif ex_name == "BINANCE":
                    listed_on.add("BINANCE")

    exact_spot_ticker = ""
    exact_futures_ticker = ""
    binance_spot_price = 0.0
    binance_futures_price = 0.0
    binance_spot_change_24h = 0.0
    binance_futures_change_24h = 0.0
    binance_spot_change_today = 0.0
    binance_futures_change_today = 0.0

    for b_tick, b_inf in binance_data.items():
        b_base = utils.get_pure_base_asset(b_tick.replace("USDT", "")).upper()
        if b_base == base:
            # 🚀 [수정] 바이낸스 티커가 실제로 같은 코인인지 검증 (EDGE 등 중복 티커 충돌 방어)
            alias_binance_raw = str(
                REVERSE_LOOKUP.get(f"{b_base}_BINANCE", b_base) or b_base
            )
            alias_binance_clean = re.sub(
                r"_(binance|upbit|bithumb)$", "", alias_binance_raw, flags=re.IGNORECASE
            )
            if alias_binance_clean == display_name:
                if b_inf.get("is_spot"):
                    listed_on.add("BINANCE")
                    exact_spot_ticker = b_tick.replace("USDT", "")
                    binance_spot_price = float(b_inf.get("price") or 0.0)
                    binance_spot_change_24h = float(b_inf.get("change_24h") or 0.0)
                    spot_utc0 = b_inf.get("utc0_open") or 0.0
                    if spot_utc0 > 0:
                        binance_spot_change_today = utils.js_round(((binance_spot_price - spot_utc0) / spot_utc0 * 100), 2)
                if b_inf.get("is_futures"):
                    listed_on.add("BINANCE_FUTURES")
                    exact_futures_ticker = b_tick.replace("USDT", "")
                    binance_futures_price = float(b_inf.get("price") or 0.0)
                    binance_futures_change_24h = float(b_inf.get("change_24h") or 0.0)
                    futures_utc0 = b_inf.get("utc0_open") or 0.0
                    if futures_utc0 > 0:
                        binance_futures_change_today = utils.js_round(((binance_futures_price - futures_utc0) / futures_utc0 * 100), 2)
    if base in upbit_krw_set:
        listed_on.add("UPBIT")

    # 🚀 [수정] 업비트 코인도 빗썸에 다른 이름(예: EDGEX)으로 상장되어 있는지 뱃지 검증
    bithumb_aliases = [
        v[2]
        for v in DUPLICATED_LIST.values()
        if len(v) >= 4 and v[0] == final_ucid and v[3].upper() == "BITHUMB"
    ]
    if base in bithumb_krw_set or any(a in bithumb_krw_set for a in bithumb_aliases):
        listed_on.add("BITHUMB")

    # 🚀 [수정] 바낸은 선물만, 선물 없으면 현물만 사용
    binance_futures_vol = 0.0
    binance_spot_vol = 0.0
    has_binance_futures = False
    for b_tick, b_inf in binance_data.items():
        b_base = utils.get_pure_base_asset(b_tick.replace("USDT", "")).upper()
        if b_base == base:
            # 🚀 [수정] 바이낸스 티커가 실제로 같은 코인인지 검증 (EDGE 등 중복 티커 충돌 방어)
            alias_binance_raw = str(
                REVERSE_LOOKUP.get(f"{b_base}_BINANCE", b_base) or b_base
            )
            alias_binance_clean = re.sub(
                r"_(binance|upbit|bithumb)$", "", alias_binance_raw, flags=re.IGNORECASE
            )
            if alias_binance_clean == display_name:
                if b_inf.get("is_futures"):
                    has_binance_futures = True
                    binance_futures_vol += (b_inf.get("vol_futures") or 0.0)
                if b_inf.get("is_spot"):
                    binance_spot_vol += (b_inf.get("vol_spot") or 0.0)

    if has_binance_futures:
        binance_vol = binance_futures_vol
    else:
        binance_vol = binance_spot_vol

    # 🚀 업비트는 업비트 기준 거래대금만 환율 고려 (acc_trade_price_24h / krw_usd_rate)
    up_vol_24h = (
        float(upbit_data[base].get("volume_24h") or 0.0) / krw_usd_rate
        if base in upbit_data and krw_usd_rate > 0
        else 0.0
    )
    by_vol_24h = by_raw.get("volume_24h", 0.0)

    vol_24h = binance_vol + up_vol_24h + by_vol_24h
    mcap_val = info.get("market_cap") if info else None
    mcap = mcap_val if mcap_val is not None else 0
    vmc_raw = (vol_24h / mcap * 100) if (mcap is not None and mcap > 0) else 0.0

    # 🚀 [추가] 업비트 전용 코인 김프 라벨 (바이비트 등 Fallback 비교군이 있을 때만)
    by_spot_p = by_raw.get("spot_price", 0.0)
    by_futures_p = by_raw.get("futures_price", 0.0)
    
    kimchi_label = "-"
    if up_price_krw > 0:
        if binance_futures_price > 0:
            kimchi_label = "UPBIT <> BIN FUT"
        elif binance_spot_price > 0:
            kimchi_label = "UPBIT <> BIN SPOT"
        elif by_futures_p > 0:
            kimchi_label = "UPBIT <> BYB FUT"
        elif by_spot_p > 0:
            kimchi_label = "UPBIT <> BYB SPOT"

    # 업비트는 펀비 없음
    funding_f = "-"

    bithumb_price = bithumb_data.get(base, {}).get("price", 0.0)
    bithumb_open = bithumb_data.get(base, {}).get("utc0_open", 0.0) or 0.0
    for a in bithumb_aliases:
        if bithumb_price == 0:
            bithumb_price = bithumb_data.get(a.upper(), {}).get("price", 0.0)
        if bithumb_open == 0:
            bithumb_open = bithumb_data.get(a.upper(), {}).get("utc0_open", 0.0) or 0.0

    # 🚀 Bithumb 심볼 명확화 (중복 티커 처리)
    bithumb_symbol = base
    if bithumb_aliases:
        bithumb_symbol = bithumb_aliases[0]

    final_open_krw = up_open_krw if up_open_krw > 0 else (bithumb_open if bithumb_open > 0 else 0.0)

    row = {
        # ==========================================
        # 🟢 [COMMON / 공통 파트 지표]
        # ==========================================
        "UID": final_ucid,
        "Symbol": base,
        "DisplayTicker": display_name,
        "Ticker": f"{base}KRW",
        "Logo": logo,
        "Name": coin_name,
        "Chain": chain,
        "precision": up_precision,

        # 공통 거래소 상장 여부 정보
        "Upbit": "O",
        "Upbit_Symbol": base,
        "Bithumb_Symbol": bithumb_symbol,
        "Note": NOTE_MAP.get(base, "Upbit Only"),

        # 공통 화면 표시용 가공 가격 및 김프 연산 데이터
        "Price": utils.format_dynamic_price(p, up_precision),
        "Price_KRW": up_price_krw if up_price_krw > 0 else None,
        "Binance_Price": (binance_spot_price or binance_futures_price) if (binance_spot_price > 0 or binance_futures_price > 0) else None,
        "Bybit_Price": (by_futures_p or by_spot_p) if (by_futures_p > 0 or by_spot_p > 0) else None,
        "Upbit_Price": up_price_krw if up_price_krw > 0 else None,
        "Bithumb_Price": bithumb_price if bithumb_price > 0 else None,

        "Change_24h": utils.format_change(up_change_24h),
        "Change_Today": utils.format_change(change_today),
        "Volume_Formatted": utils.format_volume_string(vol_24h),
        "Kimchi_Formatted": "-",
        "Kimchi_Label": kimchi_label,
        "MarketCap_Formatted": utils.format_market_cap_string(mcap),
        "VMC_Formatted": f"{vmc_raw:.2f}%",

        # 공통 정렬 연산용 순수 숫자 데이터 (Raw)
        "Price_Raw": current_p,
        "Change_24h_Raw": up_change_24h,
        "Change_Today_Raw": change_today,
        "Volume_Raw": vol_24h,
        "MarketCap_Raw": mcap,
        "VMC_Raw": vmc_raw,
        "Kimchi_Raw": None,
        "utc0_open_Raw": utc0_open,
        "utc0_open_KRW": final_open_krw if final_open_krw > 0 else None,

        # 공통 기타 메타 정보
        "Listed_Exchanges": list(listed_on),


        # ==========================================
        # 🔵 [SPOT / 현물 파트 전용 지표]
        # ==========================================
        "Binance_Price_Spot": binance_spot_price if binance_spot_price > 0 else None,
        "Bybit_Price_Spot": by_spot_p if by_spot_p > 0 else None,

        "Change_24h_Binance": binance_spot_change_24h,
        "Change_24h_Bybit": float(by_raw.get("change_24h", 0.0)),
        "Change_Today_Binance": binance_spot_change_today,
        "Change_Today_Bybit": float(by_raw.get("change_today", 0.0)),

        "Binance_Vol_Spot": binance_spot_vol,
        "Exact_Spot": exact_spot_ticker,

        "Upbit_Vol_Formatted": (
            utils.format_volume_string(
                up_info.get("acc_trade_price_24h", 0.0) / krw_usd_rate
            )
            if krw_usd_rate > 0
            else "-"
        ),
        "Upbit_Vol": up_info.get("acc_trade_price_24h", 0.0),


        # ==========================================
        # 🟡 [FUTURES / 선물 파트 전용 지표]
        # ==========================================
        "Binance_Price_Futures": binance_futures_price if binance_futures_price > 0 else None,
        "Bybit_Price_Futures": by_futures_p if by_futures_p > 0 else None,

        "Change_24h_Futures_Ex": binance_futures_change_24h,
        "Change_Today_Futures": binance_futures_change_today,

        "Funding_Raw": 0.0,
        "Funding_Formatted": funding_f,
        "Binance_Vol_Futures": binance_futures_vol,
        "Exact_Futures": exact_futures_ticker,
    }
    return row, is_updated
