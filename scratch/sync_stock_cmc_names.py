import json
import sys

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    with open('mapping.json', 'r', encoding='utf-8') as f:
        mapping_data = json.load(f)
    
    with open('static/cmc_owner_cache.json', 'r', encoding='utf-8') as f:
        cmc_cache = json.load(f).get('map', {})
        
    changed = []
    ticker_data = mapping_data.get('TICKER_DATA', {})
    
    for k, v in ticker_data.items():
        if len(v) > 4 and v[4] == 'STOCK':
            uid = str(v[0]) if v[0] is not None else None
            # UID 기반으로 cmc_cache 매칭
            if uid and uid in cmc_cache and cmc_cache[uid].get('name'):
                cmc_name = cmc_cache[uid]['name']
                if v[2] != cmc_name:
                    changed.append((k, v[2], cmc_name))
                    v[2] = cmc_name
    
    print(f"Total changed: {len(changed)}")
    for item in changed[:15]:
        print(f"  {item[0]}: {item[1]} -> {item[2]}")
        
    # mapping.json 저장
    with open('mapping.json', 'w', encoding='utf-8') as f:
        json.dump(mapping_data, f, ensure_ascii=False, indent=2)
    print("Saved mapping.json successfully.")

    # market_data_cache.json 동기화
    with open('static/market_data_cache.json', 'r', encoding='utf-8') as f:
        market_cache = json.load(f)
        
    data_list = market_cache.get('data', [])
    m_changed_count = 0
    for row in data_list:
        uid = str(row.get('UID', ''))
        disp = str(row.get('DisplayTicker', ''))
        if disp.endswith('(STOCK)') or row.get('Is_Stock'):
            if uid in cmc_cache and cmc_cache[uid].get('name'):
                new_name = cmc_cache[uid]['name']
                if row.get('Name') != new_name:
                    row['Name'] = new_name
                    row['Name_KR'] = new_name
                    row['Korean_Name'] = new_name
                    m_changed_count += 1
                    
    print(f"Updated market_data_cache.json rows: {m_changed_count}")
    with open('static/market_data_cache.json', 'w', encoding='utf-8') as f:
        json.dump(market_cache, f, ensure_ascii=False, indent=2)
    print("Saved static/market_data_cache.json successfully.")

if __name__ == '__main__':
    main()
