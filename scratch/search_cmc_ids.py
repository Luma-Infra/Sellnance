import sys

sys.path.append(".")
import requests
import json
import config

headers = {"Accepts": "application/json", "X-CMC_PRO_API_KEY": config.CMC_API_KEY}

try:
    print("Searching CoinMarketCap cryptocurrency map...")
    url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map"

    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("data", [])

    targets = ["SAMSUNG", "HYUNDAI", "SKHYNIX", "BBX"]
    results = {t: [] for t in targets}

    for item in data:
        symbol = str(item.get("symbol", "")).upper()
        name = str(item.get("name", "")).upper()
        for t in targets:
            if t in symbol or t in name:
                results[t].append(
                    {
                        "id": item.get("id"),
                        "name": item.get("name"),
                        "symbol": item.get("symbol"),
                        "rank": item.get("rank"),
                        "is_active": item.get("is_active"),
                    }
                )

    print("\n--- Search Results ---")
    for t, res in results.items():
        print(f"\nTarget: {t}")
        if not res:
            print("  No matches found.")
        for r in res:
            print(
                f"  ID: {r['id']:<8} | Symbol: {r['symbol']:<10} | Name: {r['name']:<35} | Active: {r['is_active']}"
            )

except Exception as e:
    print("Error querying CMC Map API:", e)
