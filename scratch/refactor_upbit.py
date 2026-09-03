import os

NEW_CONTENT = """# builder_upbit.py
from modules import utils, config_manager
import re

def _resolve_names_and_ucid(base, REVERSE_LOOKUP, TICKER_DATA, SYMBOL_TO_ID_MAP, market_data_map, asset_to_lookup_key):
    lookup_id = asset_to_lookup_key.get(f"{base.upper()}_UPBIT")
    info = market_data_map.get(lookup_id)
    raw_key = str(REVERSE_LOOKUP.get(f"{base}_UPBIT", base) or base)
    display_name = re.sub(
        r"_(binance|upbit|bithumb)$", "", raw_key, flags=re.IGNORECASE
    )

    explicit_name = ""
    name_match = re.search(r"\((.*?)\)", display_name)
    if name_match:
        explicit_name = name_match.group(1)

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
    info = market_data_map.get(str(final_ucid)) or market_data_map.get(lookup_id)

    if (not final_ucid or not final_ucid.isdigit()) and info:
        new_ucid = info.get("ucid", "")
        if new_ucid and new_ucid.isdigit():
            final_ucid = new_ucid
    if not final_ucid:
        final_ucid = base

    return raw_key, display_name, explicit_name, ticker_info, saved_chain, final_ucid, info

def _calculate_upbit_prices(up_info, krw_usd_rate):
    up_price_krw = float(up_info.get("price") or 0.0)
    up_open_krw = float(up_info.get("utc0_open") or 0.0)
    up_change_24h = float(up_info.get("change_24h") or 0.0)

    current_p = 0.0
    utc0_open = 0.0
    change_today = 0.0

    if up_price_krw > 0:
        current_p = up_price_krw / krw_usd_rate
    if up_open_krw > 0:
        utc0_open = up_open_krw / krw_usd_rate

    if utc0_open > 0:
        change_today = utils.js_round(((current_p - utc0_open) / utc0_open * 100), 2)
        
    return up_price_krw, up_open_krw, up_change_24h, current_p, utc0_open, change_today

def _determine_precision(base, p, final_ucid, DUPLICATED_LIST, bybit_data, binance_data):
    up_precision = (
        0 if p >= 100 else 1 if p >= 10 else 2 if p >= 1 else 3 if p >= 0.1 else 4
    )

    duplicated_bases = set()
    for k, v in DUPLICATED_LIST.items():
        if len(v) >= 4:
            duplicated_bases.add(v[2].upper())
            duplicated_bases.add(k.split("(")[0].upper())

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
        for b_tick, b_inf_data in binance_data.items():
            b_base = b_tick.replace("USDT", "").upper()
            if b_base == base.upper() and b_inf_data.get("is_futures"):
                bn_prec = b_inf_data.get("precision")
                if bn_prec is not None:
                    up_precision = int(bn_prec)
                break
                
    return up_precision, by_raw, duplicated_bases

def _aggregate_binance_for_upbit(base, display_name, binance_data, REVERSE_LOOKUP, listed_on):
    exact_spot_ticker = ""
    exact_futures_ticker = ""
    binance_spot_price = 0.0
    binance_futures_price = 0.0
    binance_spot_change_24h = 0.0
    binance_futures_change_24h = 0.0
    binance_spot_change_today = 0.0
    binance_futures_change_today = 0.0
    binance_futures_vol = 0.0
    binance_spot_vol = 0.0
    has_binance_futures = False

    for b_tick, b_inf in binance_data.items():
        b_base = utils.get_pure_base_asset(b_tick.replace("USDT", "")).upper()
        if b_base == base:
            alias_binance_raw = str(
                REVERSE_LOOKUP.get(f"{b_base}_BINANCE", b_base) or b_base
            )
            alias_binance_clean = re.sub(
                r"_(binance|upbit|bithumb)$", "", alias_binance_raw, flags=re.IGNORECASE
            )
            if alias_binance_clean == display_name:
                if b_inf.get("is_spot"):
                    listed_on.add("BINANCE_SPOT")
                    exact_spot_ticker = b_tick.replace("USDT", "")
                    binance_spot_price = float(b_inf.get("price") or 0.0)
                    binance_spot_change_24h = float(b_inf.get("change_24h") or 0.0)
                    spot_utc0 = b_inf.get("utc0_open") or 0.0
                    if spot_utc0 > 0:
                        binance_spot_change_today = utils.js_round(
                            ((binance_spot_price - spot_utc0) / spot_utc0 * 100), 2
                        )
                    binance_spot_vol += b_inf.get("vol_spot") or 0.0
                if b_inf.get("is_futures"):
                    listed_on.add("BINANCE_FUTURES")
                    has_binance_futures = True
                    exact_futures_ticker = b_tick.replace("USDT", "")
                    binance_futures_price = float(b_inf.get("price") or 0.0)
                    binance_futures_change_24h = float(b_inf.get("change_24h") or 0.0)
                    futures_utc0 = b_inf.get("utc0_open") or 0.0
                    if futures_utc0 > 0:
                        binance_futures_change_today = utils.js_round(
                            (
                                (binance_futures_price - futures_utc0)
                                / futures_utc0
                                * 100
                            ),
                            2,
                        )
                    binance_futures_vol += b_inf.get("vol_futures") or 0.0

    return {
        "exact_spot_ticker": exact_spot_ticker,
        "exact_futures_ticker": exact_futures_ticker,
        "binance_spot_price": binance_spot_price,
        "binance_futures_price": binance_futures_price,
        "binance_spot_change_24h": binance_spot_change_24h,
        "binance_futures_change_24h": binance_futures_change_24h,
        "binance_spot_change_today": binance_spot_change_today,
        "binance_futures_change_today": binance_futures_change_today,
        "binance_futures_vol": binance_futures_vol,
        "binance_spot_vol": binance_spot_vol,
        "has_binance_futures": has_binance_futures
    }

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

    is_updated = False
    if up_info is None:
        return None, False

    raw_key, display_name, explicit_name, ticker_info, saved_chain, final_ucid, info = _resolve_names_and_ucid(
        base, REVERSE_LOOKUP, TICKER_DATA, SYMBOL_TO_ID_MAP, market_data_map, asset_to_lookup_key
    )

    up_price_krw, up_open_krw, up_change_24h, current_p, utc0_open, change_today = _calculate_upbit_prices(up_info, krw_usd_rate)

    if final_ucid and final_ucid in processed_uids and raw_key not in DUPLICATED_LIST:
        return None, False
    if final_ucid:
        processed_uids.add(final_ucid)

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

    coin_name = (
        explicit_name
        if explicit_name
        else (
            ticker_info[2]
            if ticker_info and len(ticker_info) >= 3 and ticker_info[2]
            else (info.get("name", base) if info else base)
        )
    )

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
            coin_name,
            base,
            "COIN",
        ]
        is_updated = True
        print(
            f"✅ [족보 세탁] {display_name} UID 및 타입 복구 완료: {final_ucid} (COIN)"
        )

    up_precision, by_raw, duplicated_bases = _determine_precision(base, current_p, final_ucid, DUPLICATED_LIST, bybit_data, binance_data)

    listed_on = set()
    if base not in duplicated_bases:
        listed_on = set(global_listings.get(base, set()))
    else:
        for k, v in DUPLICATED_LIST.items():
            if len(v) >= 4 and v[0] == final_ucid:
                ex_name = v[3].upper()
                if ex_name in ("BYBIT", "BYBIT_SPOT"):
                    listed_on.add("BYBIT_SPOT")
                elif ex_name == "BYBIT_FUTURES":
                    listed_on.add("BYBIT_FUTURES")
                elif ex_name in ("BINANCE", "BINANCE_SPOT"):
                    listed_on.add("BINANCE_SPOT")
                elif ex_name == "BINANCE_FUTURES":
                    listed_on.add("BINANCE_FUTURES")

    bin_agg = _aggregate_binance_for_upbit(base, display_name, binance_data, REVERSE_LOOKUP, listed_on)
    
    if base in upbit_krw_set:
        listed_on.add("UPBIT")

    bithumb_aliases = [
        v[2]
        for v in DUPLICATED_LIST.values()
        if len(v) >= 4 and v[0] == final_ucid and v[3].upper() == "BITHUMB"
    ]
    if base in bithumb_krw_set or any(a in bithumb_krw_set for a in bithumb_aliases):
        listed_on.add("BITHUMB")

    binance_vol = bin_agg["binance_futures_vol"] if bin_agg["has_binance_futures"] else bin_agg["binance_spot_vol"]

    up_vol_24h = (
        float(upbit_data[base].get("volume_24h") or 0.0) / krw_usd_rate
        if base in upbit_data and krw_usd_rate > 0
        else 0.0
    )
    by_vol_24h = by_raw.get("volume_24h", 0.0)

    total_vol = binance_vol + up_vol_24h + by_vol_24h
    mcap_val = info.get("market_cap") if info else None
    mcap = mcap_val if mcap_val is not None else 0
    vmc_raw = (total_vol / mcap * 100) if (mcap is not None and mcap > 0) else 0.0

    by_spot_p = by_raw.get("spot_price", 0.0)
    by_futures_p = by_raw.get("futures_price", 0.0)

    kimchi_label = "-"
    if up_price_krw > 0:
        if bin_agg["binance_spot_price"] > 0:
            kimchi_label = "UPBIT <> BIN SPOT"
        elif bin_agg["binance_futures_price"] > 0:
            kimchi_label = "UPBIT <> BIN FUT"
        elif by_spot_p > 0:
            kimchi_label = "UPBIT <> BYB SPOT"
        elif by_futures_p > 0:
            kimchi_label = "UPBIT <> BYB FUT"

    funding_f = "-"

    bithumb_price = bithumb_data.get(base, {}).get("price", 0.0)
    bithumb_open = bithumb_data.get(base, {}).get("utc0_open", 0.0) or 0.0
    for a in bithumb_aliases:
        if bithumb_price == 0:
            bithumb_price = bithumb_data.get(a.upper(), {}).get("price", 0.0)
        if bithumb_open == 0:
            bithumb_open = bithumb_data.get(a.upper(), {}).get("utc0_open", 0.0) or 0.0

    bithumb_symbol = base
    if bithumb_aliases:
        bithumb_symbol = bithumb_aliases[0]

    final_open_krw = (
        up_open_krw if up_open_krw > 0 else (bithumb_open if bithumb_open > 0 else 0.0)
    )
    has_binance_listing = (
        bin_agg["binance_spot_price"] > 0 or bin_agg["binance_futures_price"] > 0 or binance_vol > 0
    )

    row = {
        "UID": final_ucid,
        "Symbol": base,
        "DisplayTicker": display_name,
        "Ticker": f"{base}KRW",
        "Logo": logo,
        "Name": coin_name,
        "Chain": chain,
        "precision": up_precision,
        "Upbit": "O",
        "Upbit_Symbol": base,
        "Bithumb_Symbol": bithumb_symbol,
        "Note": NOTE_MAP.get(base, "Upbit Only"),
        "Price": utils.format_dynamic_price(current_p, up_precision),
        "Price_KRW": up_price_krw if up_price_krw > 0 else None,
        "Binance_Price": (
            (bin_agg["binance_spot_price"] or bin_agg["binance_futures_price"])
            if (bin_agg["binance_spot_price"] > 0 or bin_agg["binance_futures_price"] > 0)
            else None
        ),
        "Bybit_Price": (
            (by_futures_p or by_spot_p) if (by_futures_p > 0 or by_spot_p > 0) else None
        ),
        "Upbit_Price": up_price_krw if up_price_krw > 0 else None,
        "Bithumb_Price": bithumb_price if bithumb_price > 0 else None,
        "Change_24h": utils.format_change(up_change_24h),
        "Change_Today": utils.format_change(change_today),
        "Volume_Formatted": (
            utils.format_volume_string(binance_vol)
            if (has_binance_listing and binance_vol > 0)
            else "-"
        ),
        "Kimchi_Formatted": "-",
        "Kimchi_Label": kimchi_label,
        "MarketCap_Formatted": utils.format_market_cap_string(mcap),
        "VMC_Formatted": f"{vmc_raw:.2f}%",
        "Price_Raw": current_p,
        "Change_24h_Raw": up_change_24h,
        "Change_Today_Raw": change_today,
        "Volume_Raw": binance_vol if has_binance_listing else 0.0,
        "MarketCap_Raw": mcap,
        "VMC_Raw": vmc_raw,
        "Kimchi_Raw": None,
        "utc0_open_Raw": utc0_open,
        "utc0_open_KRW": final_open_krw if final_open_krw > 0 else None,
        "Listed_Exchanges": list(listed_on),
        "Binance_Price_Spot": bin_agg["binance_spot_price"] if bin_agg["binance_spot_price"] > 0 else None,
        "Bybit_Price_Spot": by_spot_p if by_spot_p > 0 else None,
        "Change_24h_Binance": bin_agg["binance_spot_change_24h"],
        "Change_24h_Bybit": float(by_raw.get("change_24h", 0.0)),
        "Change_Today_Binance": bin_agg["binance_spot_change_today"],
        "Change_Today_Bybit": float(by_raw.get("change_today", 0.0)),
        "Binance_Vol_Spot": bin_agg["binance_spot_vol"],
        "Exact_Spot": bin_agg["exact_spot_ticker"],
        "Upbit_Vol_Formatted": (
            utils.format_volume_string(
                up_info.get("acc_trade_price_24h", 0.0) / krw_usd_rate
            )
            if krw_usd_rate > 0
            else "-"
        ),
        "Upbit_Vol": up_info.get("acc_trade_price_24h", 0.0),
        "Binance_Price_Futures": (
            bin_agg["binance_futures_price"] if bin_agg["binance_futures_price"] > 0 else None
        ),
        "Bybit_Price_Futures": by_futures_p if by_futures_p > 0 else None,
        "Change_24h_Futures": bin_agg["binance_futures_change_24h"],
        "Change_Today_Futures": bin_agg["binance_futures_change_today"],
        "Funding_Raw": 0.0,
        "Funding_Formatted": funding_f,
        "Binance_Vol_Futures": bin_agg["binance_futures_vol"],
        "Exact_Futures": bin_agg["exact_futures_ticker"],
    }
    return row, is_updated
"""

with open("c:\\Users\\78831\\Sellnance\\modules\\builder_upbit.py", "w", encoding="utf-8") as f:
    f.write(NEW_CONTENT)
