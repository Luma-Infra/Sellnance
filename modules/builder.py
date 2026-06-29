# builder.py
# ==========================================
# 🧱 모듈 3: 데이터 조립 및 변동률 계산기
# ==========================================
import re
import requests
from modules import utils, config_manager


from modules.builder_binance import build_binance_row
from modules.builder_upbit import build_upbit_row


def clean_stale_tickers(binance_data, upbit_krw_set, mapping):
    # global MAPPING_DATA
    is_updated = False

    live_bases = (
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

    live_bases = {
        utils.get_pure_base_asset(t).upper() for t in binance_data.keys()
    } | upbit_krw_set
    dup_names = set(DUPLICATED_LIST.keys())

    keys_to_delete = [
        k
        for k in TICKER_DATA.keys()
        if k not in live_bases
        and k not in SPECIAL_SYMBOL_MAP
        and k not in SYMBOL_TO_ID_MAP
        and k not in dup_names
    ]

    for k in keys_to_delete:
        del TICKER_DATA[k]
        is_updated = True
        print(f"🧹 [안내] {k} 삭제 완료")

    return is_updated


# 위 함수들을 호출해서 최종 final_results 리스트를 완성.
def assemble_final_dashboard(
    global_listings,
    binance_data,
    upbit_data,
    market_data_map,
    asset_to_lookup_key,
    upbit_krw_set,
    bithumb_krw_set,
    upbit_only_assets,
    mapping,
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

    final_results = {}
    any_update = False
    processed_uids = set()

    # 역방향 족보 생성 (실제 티커명 및 매핑명 모두 대응)
    REVERSE_LOOKUP = {}
    duplicated_bases = set()
    for k, v in DUPLICATED_LIST.items():
        if len(v) >= 4:
            ex = v[3].upper()
            REVERSE_LOOKUP[f"{v[2].upper()}_{ex}"] = k
            REVERSE_LOOKUP[f"{k.split('(')[0].upper()}_{ex}"] = k
            duplicated_bases.add(v[2].upper())
            duplicated_bases.add(k.split("(")[0].upper())

    # 🚀 법정 환율 (USD/KRW) 실시간 수집 (tvDatafeed 단일 연동)
    krw_usd_rate = float(mapping.get("DEFAULT_KRW_USD_RATE", 0.0))
    try:
        from tvDatafeed import TvDatafeed, Interval

        tv = TvDatafeed()
        df = tv.get_hist(
            symbol="USDKRW", exchange="FX_IDC", interval=Interval.in_1_minute, n_bars=1
        )
        if df is not None and not df.empty:
            new_rate = float(df["close"].iloc[-1])
            if new_rate > 0:
                krw_usd_rate = new_rate
                if mapping.get("DEFAULT_KRW_USD_RATE") != krw_usd_rate:
                    mapping["DEFAULT_KRW_USD_RATE"] = krw_usd_rate
                    any_update = True
                    print(
                        f"🔄 [실시간 환율 갱신] TradingView USD/KRW ({krw_usd_rate}원) mapping.json 족보에 갱신 완료!"
                    )
    except Exception as e:
        print(
            f"⚠️ TradingView 실시간 환율 수집 실패, 족보 기본값 {krw_usd_rate}원 사용 ({e})"
        )

    # 1. 바이낸스 투입
    for ticker, b_info in binance_data.items():
        base = utils.get_pure_base_asset(ticker).upper()
        if base in EXCLUSION_LIST:
            continue

        row, is_updated = build_binance_row(
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
        )
        if is_updated:
            any_update = True

        if row:
            row["krw_usd_rate"] = krw_usd_rate  # 🚀 모든 행에 테더 환율 공급
            uid = str(row.get("UID") or row.get("DisplayTicker") or ticker)
            final_results[uid] = row

    # 2. 업비트 투입
    binance_base_set = {t.replace("USDT", "") for t in binance_data.keys()}
    for base in upbit_krw_set:
        alias_upbit_raw = str(REVERSE_LOOKUP.get(f"{base}_UPBIT", base) or base)
        alias_upbit = re.sub(
            r"_(binance|upbit|bithumb)$", "", alias_upbit_raw, flags=re.IGNORECASE
        )

        # 🚀 [수정] 바이낸스 처리 여부 확인 시 alias 비교 (단, 동명이인 META 등은 UID까지 일치해야 동일 코인으로 인정)
        up_key_check = REVERSE_LOOKUP.get(f"{base}_UPBIT")
        up_expected_uid = (
            DUPLICATED_LIST[up_key_check][0]
            if up_key_check in DUPLICATED_LIST
            else None
        )

        already_processed = False
        for r in final_results.values():
            # 1. DisplayTicker가 일치하면 무조건 동일 코인 (UP 등)
            if r.get("DisplayTicker") == alias_upbit:
                already_processed = True
                break
            # 2. Symbol이 일치할 때, 만약 족보에 기대 UID가 명시되어 있다면 UID까지 같아야 인정
            if r.get("Symbol") == base:
                if up_expected_uid and r.get("UID") != up_expected_uid:
                    continue
                already_processed = True
                break

        if already_processed:
            continue
        if base in EXCLUSION_LIST:
            continue

        row, updated = build_upbit_row(
            base,
            upbit_data.get(base),
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
        )
        if row:
            uid = str(row.get("UID") or base)
            if uid in final_results:
                final_results[uid]["Upbit"] = "O"
                final_results[uid]["Listed_Exchanges"] = list(
                    set(
                        final_results[uid].get("Listed_Exchanges", [])
                        + row.get("Listed_Exchanges", [])
                    )
                )
                if row.get("Price_KRW"):
                    final_results[uid]["Price_KRW"] = row["Price_KRW"]

                    b_price = final_results[uid].get("Price_Raw", 0)
                    by_spot_p = (
                        bybit_data.get(base, {}).get("spot_price", 0.0)
                        if base not in duplicated_bases
                        else 0.0
                    )
                    by_futures_p = (
                        bybit_data.get(base, {}).get("futures_price", 0.0)
                        if base not in duplicated_bases
                        else 0.0
                    )
                    target_overseas_p = b_price or by_futures_p or by_spot_p

                    if target_overseas_p > 0 and krw_usd_rate > 0:
                        dom_mult = utils.get_multiplier(row.get("Upbit_Symbol") or base)
                        ovs_mult = utils.get_multiplier(
                            final_results[uid].get("Symbol") or base
                        )

                        dom_unit_price = row["Price_KRW"] / dom_mult
                        ovs_unit_price = target_overseas_p / ovs_mult

                        overseas_krw = ovs_unit_price * krw_usd_rate
                        kimchi = ((dom_unit_price / overseas_krw) - 1) * 100
                        final_results[uid]["Kimchi_Raw"] = kimchi
                        final_results[uid]["Kimchi_Formatted"] = f"{kimchi:+.2f}%"

                final_results[uid]["Upbit_Symbol"] = base
            else:
                # Bybit Fallback for Upbit only coins
                # 🚀 [오류 방어] 동명이인(DUPLICATED_LIST)인 경우 Bybit 가격 오염 차단
                by_spot_p = (
                    bybit_data.get(base, {}).get("spot_price", 0.0)
                    if base not in duplicated_bases
                    else 0.0
                )
                by_futures_p = (
                    bybit_data.get(base, {}).get("futures_price", 0.0)
                    if base not in duplicated_bases
                    else 0.0
                )
                target_by_p = by_futures_p or by_spot_p
                if target_by_p > 0 and row.get("Price_KRW"):
                    dom_mult = utils.get_multiplier(row.get("Upbit_Symbol") or base)
                    ovs_mult = utils.get_multiplier(base)

                    dom_unit_price = row["Price_KRW"] / dom_mult
                    ovs_unit_price = target_by_p / ovs_mult

                    overseas_krw = ovs_unit_price * krw_usd_rate
                    kimchi = ((dom_unit_price / overseas_krw) - 1) * 100
                    row["Kimchi_Raw"] = kimchi
                    row["Kimchi_Formatted"] = f"{kimchi:+.2f}%"
                    if by_futures_p > 0:
                        row.setdefault("Listed_Exchanges", []).append("BYBIT_FUTURES")
                    if by_spot_p > 0:
                        row.setdefault("Listed_Exchanges", []).append("BYBIT")
                    row["Listed_Exchanges"] = list(set(row.get("Listed_Exchanges", [])))
                row["krw_usd_rate"] = krw_usd_rate  # 🚀 모든 행에 테더 환율 공급
                final_results[uid] = row
        if updated:
            any_update = True

    # 🚀 [임시 중단] 3단계: 바이비트 단독 코인 투입 (바이비트 단독 선물 잡코인 제외, 현물 비교군으로만 활용)
    # if False:
    #     for base, b_inf in bybit_data.items():
    #         if b_inf.get("futures_price", 0) > 0:
    #             already_processed = False
    #             for r in final_results.values():
    #                 if r.get("Symbol") == base or r.get("DisplayTicker") == base:
    #                     already_processed = True
    #                     break
    #             if not already_processed and base not in EXCLUSION_LIST:
    #                 if b_inf:
    #                     precision = b_inf.get("precision", 0)
    #                 elif base in bybit_data and "precision" in bybit_data[base]:
    #                     precision = bybit_data[base]["precision"]
    #                 else:
    #                     precision = 0  # 기본 정밀도
    #                 row, updated = build_bybit_row(
    #                     base,
    #                     b_inf,
    #                     market_data_map,
    #                     asset_to_lookup_key,
    #                     global_listings,
    #                     processed_uids,
    #                     krw_usd_rate,
    #                     mapping,
    #                 )
    #                 if row:
    #                     uid = str(row.get("UID") or base)
    #                     final_results[uid] = row
    #                     if updated:
    #                         any_update = True

    # 3. 청소기 가동
    # if clean_stale_tickers(binance_data, upbit_krw_set, mapping):
    #     any_update = True

    # AS-IS: return final_results, any_update
    # TO-BE: 👇 딕셔너리의 값들만 리스트로 뽑아서 리턴!
    return list(final_results.values()), any_update
