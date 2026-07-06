# builder_binance.py
import re
from modules import utils, config_manager


def build_binance_row(
    ticker,
    b_info,
    binance_data,
    upbit_data,
    market_data_map,
    asset_to_lookup_key,
    global_listings,
    upbit_krw_set,
    bithumb_krw_set,
    REVERSE_LOOKUP,
    processed_uids,
    mapping,
    krw_usd_rate,
    bybit_data,
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

    # 0. 주식 토큰 여부 조기 판별
    u_type = str(b_info.get("underlying_type", "")) if isinstance(b_info, dict) else ""
    c_type = str(b_info.get("contract_type", "")) if isinstance(b_info, dict) else ""
    is_stock = ("EQUITY" in u_type) or (c_type == "TRADIFI_PERPETUAL")

    raw_symbol = ticker.replace("USDT", "")
    base = utils.get_pure_base_asset(ticker).upper()

    # 🚀 [추가] 현물 토큰화 주식 식별 (예: MSTRB) - 상응하는 선물 계약이 주식인 경우
    if not is_stock and base.endswith("B") and len(base) > 2:
        cand_futures = f"{base[:-1]}USDT"
        if cand_futures in binance_data:
            fut_info = binance_data[cand_futures]
            fut_u_type = (
                str(fut_info.get("underlying_type", ""))
                if isinstance(fut_info, dict)
                else ""
            )
            fut_c_type = (
                str(fut_info.get("contract_type", ""))
                if isinstance(fut_info, dict)
                else ""
            )
            if ("EQUITY" in fut_u_type) or (fut_c_type == "TRADIFI_PERPETUAL"):
                is_stock = True

    # 🚀 [주식 현선물 병합] 선물 MSTR을 현물 MSTRB 기준으로 병합 처리
    if is_stock:
        # 선물 기호가 MSTR인 경우 MSTRB로 매핑 전환
        if not base.endswith("B"):
            spot_cand = f"{base}BUSDT"
            if spot_cand in binance_data:
                base = f"{base}B"
                raw_symbol = f"{raw_symbol}B"

    is_updated = False

    # 1. 이름표 및 기본 정보
    suffix = "BINANCE_STOCK" if is_stock else "BINANCE"
    raw_key = str(REVERSE_LOOKUP.get(f"{raw_symbol.upper()}_{suffix}", base) or base)
    display_name = re.sub(
        r"_(binance|upbit|bithumb|bybit|binance_stock)$",
        "",
        raw_key,
        flags=re.IGNORECASE,
    )
    if is_stock and (raw_key == base or raw_key == raw_symbol):
        display_name = f"{raw_symbol}(STOCK)"

    # 🚀 [추가] 괄호 안의 이름 추출 (예: EDGE(edgeX) -> edgeX, 단 STOCK/DERIVATIVES 등 무의미한 분류명 제외)
    explicit_name = ""
    name_match = re.search(r"\((.*?)\)", display_name)
    if name_match:
        cand = name_match.group(1)
        if cand.upper() not in ["STOCK", "DERIVATIVES"]:
            explicit_name = cand

    # 2. 족보에서 체인 정보 먼저 확정 (구조적 순서 선점)
    ticker_info = TICKER_DATA.get(display_name)
    if (
        isinstance(ticker_info, list)
        and len(ticker_info) >= 5
        and ticker_info[4] == "STOCK"
    ):
        is_stock = True

    existing_uid = (
        ticker_info[0] if isinstance(ticker_info, list) and len(ticker_info) > 0 else ""
    )
    hardcoded_id = str(SYMBOL_TO_ID_MAP.get(base, ""))

    # 🚀 [지문 확정] 1순위: 족보 / 2순위: 하드코딩(base) / 3순위: CMC 결과 / 4순위: 주식 가상 ID
    final_ucid = (
        existing_uid or hardcoded_id or str(SYMBOL_TO_ID_MAP.get(display_name, ""))
    )

    lookup_id = asset_to_lookup_key.get(
        f"{raw_symbol.upper()}_{suffix}"
    ) or asset_to_lookup_key.get(f"{base.upper()}_{suffix}")

    # 🚀 f"{raw_symbol}_BINANCE" / f"{base}_BINANCE" 등으로 조회할 수 있도록 코인 기준 키 백업 시도
    coin_lookup_id = asset_to_lookup_key.get(
        f"{raw_symbol.upper()}_BINANCE"
    ) or asset_to_lookup_key.get(f"{base.upper()}_BINANCE")

    # 🚀 주식/코인 분기 우선 조회
    resolved_info = None
    if is_stock:
        resolved_info = market_data_map.get(
            f"{raw_symbol.upper()}_STOCK"
        ) or market_data_map.get(f"{base.upper()}_STOCK")
    else:
        resolved_info = market_data_map.get(
            f"{raw_symbol.upper()}_COIN"
        ) or market_data_map.get(f"{base.upper()}_COIN")

    info = (
        market_data_map.get(str(final_ucid))
        or resolved_info
        or market_data_map.get(lookup_id)
        or market_data_map.get(coin_lookup_id)
        or market_data_map.get(raw_symbol.upper())
        or market_data_map.get(base.upper())
    )

    # 🚀 [추가] 주식 자산인데 현재 resolved된 info가 코인 정보(이름에 derivatives/stock 없음)인 경우, 강제로 주식 정보로 대체
    if (
        is_stock
        and info
        and "derivatives" not in info.get("name", "").lower()
        and "stock" not in info.get("name", "").lower()
    ):
        stock_info = market_data_map.get(
            f"{raw_symbol.upper()}_STOCK"
        ) or market_data_map.get(f"{base.upper()}_STOCK")
        if stock_info:
            info = stock_info
            final_ucid = stock_info.get("ucid", "")

    # CMC에서 새로운 ucid를 찾았다면 최종 업데이트
    if (not final_ucid or not final_ucid.isdigit()) and info:
        new_ucid = info.get("ucid", "")
        if new_ucid and new_ucid.isdigit():
            final_ucid = new_ucid

    # 주식이고 여전히 올바른 숫자 UID가 없다면 최종 수단으로 가상 UID 부여
    if is_stock and (not final_ucid or not final_ucid.isdigit()):
        final_ucid = f"STOCK_{raw_symbol.upper()}"

    if not final_ucid:
        final_ucid = base
    if final_ucid:
        processed_uids.add(final_ucid)

    # 4. 재료 가공 (무조건 final_ucid로 로고 생성!)
    ticker_info_list = (
        ticker_info if isinstance(ticker_info, list) else [None, None, None]
    )
    saved_chain = (
        ticker_info_list[1]
        if len(ticker_info_list) > 1
        else (CHAIN_LOGO_MAP.get(base) or (info.get("chain_symbol") if info else ""))
    )
    ch_sym = saved_chain
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

    # 족보에 적어둔 이름(ticker_info_list[2])이 있으면 그것을 우선 사용
    coin_name = (
        explicit_name
        if explicit_name
        else (
            ticker_info_list[2]
            if len(ticker_info_list) >= 3 and ticker_info_list[2]
            else (
                f"{raw_symbol} (Derivatives)"
                if is_stock
                else (info.get("name", base) if info else base)
            )
        )
    )

    # 5. 족보 업데이트 (세탁기)
    asset_type = "STOCK" if is_stock else "COIN"
    # 🚀 [추가] final_ucid가 임시 가상 ID("STOCK_...")인 경우, 족보(mapping.json)에 직접 기입하지 않음 (임시 비교용으로만 유지)
    if not final_ucid.startswith("STOCK_") and (
        not ticker_info
        or (
            isinstance(ticker_info, list)
            and (
                len(ticker_info) < 5
                or not ticker_info[0]
                or ticker_info[0] != final_ucid
                or ticker_info[4] != asset_type
            )
        )
    ):
        TICKER_DATA[display_name] = [
            final_ucid,  # 🚀 믿음의 최종 UID
            ch_sym,
            coin_name,  # 🚀 괄호에서 추출한 이름 우선 반영
            base,
            asset_type,  # 🚀 5번째 인자에 stock/coin 구분 삽입
        ]
        is_updated = True
        print(
            f"✅ [족보 세탁] {display_name} UID 및 타입 복구 완료: {final_ucid} ({asset_type})"
        )

    # 시총 계산
    price = b_info["price"]
    mcap = info.get("market_cap", 0) if info else 0

    # 6. 상장 거래소 목록 및 볼륨 통합
    listed_on = set(global_listings.get(base, set()))
    total_vol_futures = 0.0
    total_vol_spot = 0.0
    binance_spot_price = 0.0
    binance_futures_price = 0.0
    binance_spot_change_24h = 0.0
    binance_futures_change_24h = 0.0
    binance_spot_change_today = 0.0
    binance_futures_change_today = 0.0
    exact_spot_ticker = ""
    exact_futures_ticker = ""
    spot_utc0 = 0.0
    futures_utc0 = 0.0

    for b_tick, b_inf in binance_data.items():
        b_base = utils.get_pure_base_asset(b_tick.replace("USDT", "")).upper()

        # 🚀 [추가] 주식 자산인 경우 현선물 병합을 위해 b_base 기호도 동일하게 MSTRB 등으로 규격화
        if is_stock:
            # underlying_type 또는 contract_type으로 주식 여부 검사
            b_u_type = (
                str(b_inf.get("underlying_type", "")) if isinstance(b_inf, dict) else ""
            )
            b_c_type = (
                str(b_inf.get("contract_type", "")) if isinstance(b_inf, dict) else ""
            )
            b_is_stock = ("EQUITY" in b_u_type) or (b_c_type == "TRADIFI_PERPETUAL")

            # spot tokenized stock detection (e.g. MSTRB)
            if not b_is_stock and b_base.endswith("B") and len(b_base) > 2:
                b_cand_futures = f"{b_base[:-1]}USDT"
                if b_cand_futures in binance_data:
                    b_fut_info = binance_data[b_cand_futures]
                    b_fut_u_type = (
                        str(b_fut_info.get("underlying_type", ""))
                        if isinstance(b_fut_info, dict)
                        else ""
                    )
                    b_fut_c_type = (
                        str(b_fut_info.get("contract_type", ""))
                        if isinstance(b_fut_info, dict)
                        else ""
                    )
                    if ("EQUITY" in b_fut_u_type) or (
                        b_fut_c_type == "TRADIFI_PERPETUAL"
                    ):
                        b_is_stock = True

            if b_is_stock:
                if not b_base.endswith("B"):
                    b_spot_cand = f"{b_base}BUSDT"
                    if b_spot_cand in binance_data:
                        b_base = f"{b_base}B"

        if b_base == base:
            # 🚀 [추가] 주식 여부가 일치하는 자산만 가격/볼륨에 통합하여 동명이인(CAT 코인 vs CAT 주식) 오염 방지!
            b_u_type = (
                str(b_inf.get("underlying_type", "")) if isinstance(b_inf, dict) else ""
            )
            b_c_type = (
                str(b_inf.get("contract_type", "")) if isinstance(b_inf, dict) else ""
            )
            b_is_stock = ("EQUITY" in b_u_type) or (b_c_type == "TRADIFI_PERPETUAL")

            # spot tokenized stock detection (e.g. MSTRB)
            if not b_is_stock and b_base.endswith("B") and len(b_base) > 2:
                b_cand_futures = f"{b_base[:-1]}USDT"
                if b_cand_futures in binance_data:
                    b_fut_info = binance_data[b_cand_futures]
                    b_fut_u_type = (
                        str(b_fut_info.get("underlying_type", ""))
                        if isinstance(b_fut_info, dict)
                        else ""
                    )
                    b_fut_c_type = (
                        str(b_fut_info.get("contract_type", ""))
                        if isinstance(b_fut_info, dict)
                        else ""
                    )
                    if ("EQUITY" in b_fut_u_type) or (
                        b_fut_c_type == "TRADIFI_PERPETUAL"
                    ):
                        b_is_stock = True

            if b_is_stock != is_stock:
                continue

            if b_inf.get("is_spot"):
                listed_on.add("BINANCE")
                binance_spot_price = b_inf.get("spot_price") or b_inf.get("price", 0.0)
                binance_spot_change_24h = b_inf.get("spot_change_24h") or b_inf.get(
                    "change_24h", 0.0
                )
                exact_spot_ticker = b_tick.replace("USDT", "")
                spot_utc0 = b_inf.get("spot_utc0_open") or b_inf.get("utc0_open") or 0.0
                if spot_utc0 > 0:
                    binance_spot_change_today = utils.js_round(
                        ((binance_spot_price - spot_utc0) / spot_utc0 * 100), 2
                    )
            if b_inf.get("is_futures"):
                listed_on.add("BINANCE_FUTURES")
                binance_futures_price = b_inf.get("futures_price") or b_inf.get(
                    "price", 0.0
                )
                binance_futures_change_24h = b_inf.get(
                    "futures_change_24h"
                ) or b_inf.get("change_24h", 0.0)
                exact_futures_ticker = b_tick.replace("USDT", "")
                futures_utc0 = (
                    b_inf.get("futures_utc0_open") or b_inf.get("utc0_open") or 0.0
                )
                if futures_utc0 > 0:
                    binance_futures_change_today = utils.js_round(
                        ((binance_futures_price - futures_utc0) / futures_utc0 * 100), 2
                    )
            total_vol_futures += b_inf.get("vol_futures", 0.0)
            total_vol_spot += b_inf.get("vol_spot", 0.0)

    # 업비트 연동 (김프용)
    upbit_aliases = [
        v[2]
        for v in DUPLICATED_LIST.values()
        if len(v) >= 4
        and (v[0] == final_ucid or v[0] == base)
        and v[3].upper() == "UPBIT"
    ]

    # 🚀 [수정] Upbit에 동일한 base 심볼이 있더라도, DUPLICATED_LIST 상의 UID가 서로 다르면 동명이인(META 등)으로 간주하여 분리
    upbit_direct_match = False
    if base in upbit_krw_set:
        upbit_direct_match = True
        alias_up_key = REVERSE_LOOKUP.get(f"{base}_UPBIT")
        if alias_up_key in DUPLICATED_LIST:
            if DUPLICATED_LIST[alias_up_key][0] != final_ucid:
                upbit_direct_match = False

    target_up_base = (
        base
        if upbit_direct_match
        else (
            upbit_aliases[0]
            if upbit_aliases and upbit_aliases[0] in upbit_krw_set
            else None
        )
    )

    up_price_krw = 0.0
    up_open_krw = 0.0
    if target_up_base and target_up_base in upbit_data:
        up_price_krw = upbit_data[target_up_base].get("price", 0.0)
        up_open_krw = upbit_data[target_up_base].get("utc0_open", 0.0)
        listed_on.add("UPBIT")

    # 🚀 [지문 완화 1] Bybit Fallback (단, 주식인 경우 바이비트 매칭 제외하여 코인 가격 침투 방지!)
    by_spot_p = 0.0
    by_futures_p = 0.0
    by_vol_24h = 0.0
    if not is_stock:
        by_spot_p = bybit_data.get(raw_symbol, {}).get(
            "spot_price", 0.0
        ) or bybit_data.get(base, {}).get("spot_price", 0.0)
        by_futures_p = bybit_data.get(raw_symbol, {}).get(
            "futures_price", 0.0
        ) or bybit_data.get(base, {}).get("futures_price", 0.0)
        by_vol_24h = bybit_data.get(raw_symbol, {}).get(
            "volume_24h", 0.0
        ) or bybit_data.get(base, {}).get("volume_24h", 0.0)

    if (
        (by_spot_p == 0 and by_futures_p == 0)
        and target_up_base
        and target_up_base in bybit_data
    ):
        by_spot_p = bybit_data.get(target_up_base, {}).get("spot_price", 0.0)
        by_futures_p = bybit_data.get(target_up_base, {}).get("futures_price", 0.0)
        by_vol_24h = bybit_data.get(target_up_base, {}).get("volume_24h", 0.0)

    if by_futures_p > 0:
        listed_on.add("BYBIT_FUTURES")
    if by_spot_p > 0:
        listed_on.add("BYBIT")

    target_spot_p = binance_spot_price or by_spot_p
    target_futures_p = binance_futures_price

    # 🚀 [지문 완화 2] Bithumb 쌀먹 확장 (바낸 티커 base 또는 업비트 티커 target_up_base 둘 중 하나라도 빗썸에 있다면 무조건 쌀먹 도킹!)
    bithumb_direct_match = False
    target_bi_base = None

    if base in bithumb_krw_set:
        bithumb_direct_match = True
        target_bi_base = base
        alias_bi_key = REVERSE_LOOKUP.get(f"{base}_BITHUMB")
        if alias_bi_key in DUPLICATED_LIST:
            if DUPLICATED_LIST[alias_bi_key][0] != final_ucid:
                bithumb_direct_match = False
    elif target_up_base and target_up_base in bithumb_krw_set:
        bithumb_direct_match = True
        target_bi_base = target_up_base
        alias_bi_key = REVERSE_LOOKUP.get(f"{target_up_base}_BITHUMB")
        if alias_bi_key in DUPLICATED_LIST:
            if DUPLICATED_LIST[alias_bi_key][0] != final_ucid:
                bithumb_direct_match = False

    bithumb_aliases = [
        v[2]
        for v in DUPLICATED_LIST.values()
        if len(v) >= 4 and v[0] == final_ucid and v[3].upper() == "BITHUMB"
    ]
    if bithumb_direct_match or any(a in bithumb_krw_set for a in bithumb_aliases):
        listed_on.add("BITHUMB")

    # 🚀 [수정] 바낸은 선물만, 선물 없으면 현물만 사용
    if total_vol_futures > 0:
        binance_vol = total_vol_futures
    else:
        binance_vol = total_vol_spot

    # 🚀 업비트는 업비트 기준 거래대금만 환율 고려 (acc_trade_price_24h / krw_usd_rate)
    up_vol_24h_krw = (
        upbit_data[target_up_base].get("volume_24h", 0.0)
        if target_up_base and target_up_base in upbit_data
        else (upbit_data[base].get("volume_24h", 0.0) if base in upbit_data else 0.0)
    )
    up_vol_24h_usd = up_vol_24h_krw / krw_usd_rate if krw_usd_rate > 0 else 0.0
    vol_24h = binance_vol + up_vol_24h_usd + by_vol_24h
    change_24h = b_info.get("change_24h", 0.0)
    precision = b_info.get("precision", 2)
    utc0_open = (
        utils.js_round(b_info.get("utc0_open", 0), 8)
        if b_info.get("utc0_open")
        else 0.0
    )
    change_today = (
        utils.js_round(((price - utc0_open) / utc0_open * 100), 2)
        if utc0_open > 0
        else 0.0
    )

    # 🚀 Bithumb 심볼 명확화 (중복 티커 처리)
    bithumb_symbol = None
    bithumb_price = 0.0
    bithumb_open = 0.0

    if bithumb_direct_match:
        bithumb_symbol = target_bi_base
        bithumb_price = bithumb_data.get(target_bi_base, {}).get("price", 0.0)
        bithumb_open = bithumb_data.get(target_bi_base, {}).get("utc0_open", 0.0)

    if bithumb_price == 0 and bithumb_aliases:
        bithumb_symbol = bithumb_aliases[0]
        bithumb_price = bithumb_data.get(bithumb_aliases[0].upper(), {}).get(
            "price", 0.0
        )
        bithumb_open = bithumb_data.get(bithumb_aliases[0].upper(), {}).get(
            "utc0_open", 0.0
        )

    # 🚀 [핵심] 김프(현현갭) & 현선갭 연산 (라벨 추가)
    kimchi_raw = None
    kimchi_label = "-"

    # 1. 국내 거래소 결정 (업비트 -> 빗썸)
    dom_p = 0.0
    dom_name = ""
    dom_base = ""
    if up_price_krw > 0:
        dom_p = up_price_krw
        dom_name = "UPBIT"
        dom_base = target_up_base
    elif bithumb_price > 0:
        dom_p = bithumb_price
        dom_name = "BITHUMB"
        dom_base = bithumb_symbol

    # 2. 해외 거래소 결정 (바낸 선물 -> 바낸 현물 -> 바이빗 선물 -> 바이빗 현물)
    ovs_p = 0.0
    ovs_name = ""
    ovs_base = ""
    if binance_futures_price > 0:
        ovs_p = binance_futures_price
        ovs_name = "BIN FUT"
        ovs_base = exact_futures_ticker or ticker or raw_symbol
    elif binance_spot_price > 0:
        ovs_p = binance_spot_price
        ovs_name = "BIN SPOT"
        ovs_base = exact_spot_ticker or base
    elif by_futures_p > 0:
        ovs_p = by_futures_p
        ovs_name = "BYB FUT"
        ovs_base = raw_symbol or ticker or base
    elif by_spot_p > 0:
        ovs_p = by_spot_p
        ovs_name = "BYB SPOT"
        ovs_base = base

    if dom_p > 0 and ovs_p > 0 and krw_usd_rate > 0:
        dom_mult = utils.get_multiplier(dom_base)
        ovs_mult = utils.get_multiplier(ovs_base)

        dom_unit_price = dom_p / dom_mult
        ovs_unit_price = ovs_p / ovs_mult

        overseas_krw = ovs_unit_price * krw_usd_rate
        kimchi_raw = ((dom_unit_price / overseas_krw) - 1) * 100
        kimchi_label = f"{dom_name} <> {ovs_name}"

    basis_raw = 0.0
    if binance_spot_price > 0 and binance_futures_price > 0:
        basis_raw = ((binance_futures_price / binance_spot_price) - 1) * 100

    # 🚀 VMC 계산 시 화면에 표기되는 바이낸스 단일 거래대금(binance_vol)을 기준으로 계산하여 100% 완벽 일치!
    vmc_raw = (binance_vol / mcap * 100) if (mcap is not None and mcap > 0) else 0.0
    funding_rate = b_info.get("funding_rate", 0.0)
    # 선물 거래소가 없거나 펀비가 0이면 - 처리
    funding_f = (
        f"{funding_rate*100:.4f}%"
        if "FUTURES" in str(listed_on) and funding_rate != 0
        else "-"
    )

    dom_open_krw = (
        up_open_krw if up_open_krw > 0 else (bithumb_open if bithumb_open > 0 else 0.0)
    )

    # 7. 데이터 조립
    row = {
        # ==========================================
        # 🟢 [COMMON / 공통 파트 지표]
        # ==========================================
        "UID": final_ucid,
        "Symbol": raw_symbol,
        "DisplayTicker": display_name,
        "Ticker": ticker,
        "Logo": logo,
        "Name": coin_name,
        "Chain": chain,
        "Is_Stock": is_stock,
        "precision": precision,
        # 공통 거래소 상장 여부 정보
        "Upbit": "O" if target_up_base else "X",
        "Upbit_Symbol": target_up_base,
        "Binance": "O" if binance_spot_price > 0 else "X",
        "Binance_Futures": "O" if binance_futures_price > 0 else "X",
        "Bithumb_Symbol": bithumb_symbol,
        # 공통 화면 표시용 가공 가격 및 김프 연산 데이터
        "Price": utils.format_dynamic_price(b_info["price"], precision),
        "Price_KRW": up_price_krw if up_price_krw > 0 else None,
        "Binance_Price": (
            (binance_futures_price or binance_spot_price)
            if (binance_futures_price > 0 or binance_spot_price > 0)
            else None
        ),
        "Bybit_Price": (
            (by_futures_p or by_spot_p) if (by_futures_p > 0 or by_spot_p > 0) else None
        ),
        "Upbit_Price": up_price_krw if up_price_krw > 0 else None,
        "Bithumb_Price": bithumb_price if bithumb_price > 0 else None,
        "Change_24h": utils.format_change(change_24h),
        "Change_Today": utils.format_change(change_today),
        "Kimchi_Formatted": f"{kimchi_raw:+.2f}%" if kimchi_raw is not None else "-",
        "Kimchi_Label": kimchi_label,
        "Basis_Formatted": f"{basis_raw:+.2f}%" if basis_raw != 0 else "0.00%",
        "Volume_Formatted": utils.format_volume_string(binance_vol),
        "MarketCap_Formatted": utils.format_market_cap_string(mcap),
        "VMC_Formatted": f"{vmc_raw:.2f}%",
        "Binance_Vol_Formatted": utils.format_volume_string(binance_vol),
        # 공통 정렬 연산용 순수 숫자 데이터 (Raw)
        "Price_Raw": price,
        "Change_24h_Raw": change_24h,
        "Change_Today_Raw": change_today,
        "Volume_Raw": binance_vol,
        "MarketCap_Raw": mcap,
        "VMC_Raw": vmc_raw,
        "Basis_Raw": basis_raw,
        "Kimchi_Raw": kimchi_raw,
        "utc0_open_Raw": utc0_open,
        "utc0_open_KRW": dom_open_krw if dom_open_krw > 0 else None,
        # 공통 기타 메타 정보
        "Spot_Only": "O" if b_info.get("is_spot_only") else "X",
        "Tags": info.get("tags", "") if info else "",
        "Listed_Exchanges": list(listed_on),
        # ==========================================
        # 🔵 [SPOT / 현물 파트 전용 지표]
        # ==========================================
        "Binance_Price_Spot": binance_spot_price if binance_spot_price > 0 else None,
        "Bybit_Price_Spot": by_spot_p if by_spot_p > 0 else None,
        "Change_24h_Binance": binance_spot_change_24h,
        "Change_24h_Bybit": float(
            bybit_data.get(raw_symbol, {}).get("change_24h", 0.0)
            or bybit_data.get(base, {}).get("change_24h", 0.0)
        ),
        "Change_Today_Binance": binance_spot_change_today,
        "Change_Today_Bybit": float(
            bybit_data.get(raw_symbol, {}).get("change_today", 0.0)
            or bybit_data.get(base, {}).get("change_today", 0.0)
        ),
        "spot_utc0_open_Raw": spot_utc0 if spot_utc0 > 0 else None,
        "Binance_Vol_Spot": total_vol_spot,
        "Exact_Spot": exact_spot_ticker,
        "Upbit_Vol_Formatted": (
            utils.format_volume_string(up_vol_24h_usd) if up_vol_24h_usd > 0 else "-"
        ),
        "Upbit_Vol_KRW_Formatted": (
            utils.format_volume_krw_string(up_vol_24h_krw)
            if up_vol_24h_krw > 0
            else "-"
        ),
        "Upbit_Vol": up_vol_24h_krw,
        # ==========================================
        # 🟡 [FUTURES / 선물 파트 전용 지표]
        # ==========================================
        "Binance_Price_Futures": (
            binance_futures_price if binance_futures_price > 0 else None
        ),
        "Bybit_Price_Futures": by_futures_p if by_futures_p > 0 else None,
        "Change_24h_Futures_Ex": binance_futures_change_24h,
        "Change_Today_Futures": binance_futures_change_today,
        "Funding_Raw": funding_rate,
        "Funding_Formatted": funding_f,
        "futures_utc0_open_Raw": futures_utc0 if futures_utc0 > 0 else None,
        "Binance_Vol_Futures": total_vol_futures,
        "Exact_Futures": exact_futures_ticker,
    }
    return row, is_updated
