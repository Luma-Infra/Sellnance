# builder_bybit.py
from modules import utils, config_manager

def build_bybit_row(
    base_asset,
    b_inf,
    market_data_map,
    asset_to_lookup_key,
    global_listings,
    processed_uids,
    krw_usd_rate,
    mapping,
):
    is_updated = False
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

    lookup_key = asset_to_lookup_key.get(base_asset, base_asset)
    cmc_info = market_data_map.get(lookup_key, {})

    uid = cmc_info.get("id")
    if not uid:
        uid = SYMBOL_TO_ID_MAP.get(base_asset)
    if not uid and base_asset in SPECIAL_SYMBOL_MAP:
        uid = SPECIAL_SYMBOL_MAP[base_asset]
    if not uid:
        uid = base_asset

    uid_str = str(uid)
    processed_uids.add(uid_str)

    current_p = b_inf.get("futures_price", b_inf.get("spot_price", 0.0))
    change_24h = b_inf.get("change_24h", 0.0)
    vol_24h = b_inf.get("volume_24h", 0.0)
    funding_rate = b_inf.get("funding_rate", 0.0)
    
    # 🚀 바이비트 instruments-info에서 수집된 정밀도 사용 (없으면 자동 계산)
    bybit_prec = b_inf.get("precision")
    if bybit_prec is not None:
        precision = int(bybit_prec)
    # elif current_p >= 1000:
    #     precision = 1
    # elif current_p >= 100:
    #     precision = 2
    # elif current_p >= 1:
    #     precision = 3
    # elif current_p >= 0.01:
    #     precision = 4
    # else:
    #     precision = 6

    mcap = cmc_info.get("quote", {}).get("USD", {}).get("market_cap", 0.0)
    if not mcap and uid_str in TICKER_DATA:
        mcap = TICKER_DATA[uid_str].get("MarketCap_Raw", 0.0)

    vmc_raw = (vol_24h / mcap * 100) if mcap > 0 else 0.0

    row = {
        "UID": uid_str,
        "Name": cmc_info.get("name", base_asset),
        "Symbol": base_asset,
        "DisplayTicker": base_asset,
        "Note": NOTE_MAP.get(base_asset, ""),
        "ChainLogo": CHAIN_LOGO_MAP.get(base_asset, ""),
        "Binance": "O",
        "Upbit": "X",
        "Bithumb": "X",
        "Binance_Futures": "O" if b_inf.get("futures_price", 0) > 0 else "X",
        "Binance_Spot": "O" if b_inf.get("spot_price", 0) > 0 else "X",
        "Price_Raw": current_p,
        "Price": utils.format_dynamic_price(current_p, precision),
        "precision": precision,
        "Change_24h_Raw": change_24h,
        "Change_24h": utils.format_change(change_24h),
        "Volume_Raw": vol_24h,
        "Volume_Formatted": utils.format_volume_string(vol_24h),
        "MarketCap_Raw": mcap,
        "MarketCap_Formatted": (
            utils.format_market_cap_string(mcap) if mcap > 0 else "-"
        ),
        "VMC_Raw": vmc_raw,
        "VMC_Formatted": f"{vmc_raw:.2f}%" if vmc_raw > 0 else "-",
        "Funding_Raw": funding_rate,
        "Funding_Formatted": (
            f"{funding_rate:+.4f}%" if funding_rate != 0 else "0.0000%"
        ),
        "Listed_Exchanges": ["BYBIT"],
        "krw_usd_rate": krw_usd_rate,
    }
    return row, is_updated
