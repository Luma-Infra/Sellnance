import sys
import json
from modules import exchange_api, utils

with open('static/market_data_cache.json', 'r', encoding='utf-8') as f:
    cache = json.load(f)

with open('mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

dup_list = mapping.get('DUPLICATED_LIST', {})
rows = cache.get('data', [])

print("=== 1. DUPLICATED_LIST 기반 상장 오염 전수 조사 ===")
# 동명이인으로 분리 관리되는 코인들 중, 자신의 UID에 해당하는 거래소 외의 해외 거래소 태그가 불법 유입된 건 조사
mismatches_dup = []

for row in rows:
    disp = row.get('DisplayTicker') or row.get('Symbol') or ''
    sym = row.get('Symbol') or ''
    uid = str(row.get('UID') or '')
    name = row.get('Name') or ''
    listed = set(row.get('Listed_Exchanges') or [])
    
    # 이 UID에 대해 DUPLICATED_LIST에 공식 등록된 허용 거래소 목록
    allowed_exchanges = set()
    is_in_dup_list = False
    
    for k, v in dup_list.items():
        if len(v) >= 4 and str(v[0]) == uid:
            is_in_dup_list = True
            ex_tag = v[3].upper()
            if 'UPBIT' in ex_tag:
                allowed_exchanges.update(['UPBIT', 'UPBIT_SPOT'])
            elif 'BITHUMB' in ex_tag:
                allowed_exchanges.update(['BITHUMB', 'BITHUMB_SPOT'])
            elif 'BINANCE_STOCK' in ex_tag:
                allowed_exchanges.update(['BINANCE_STOCK'])
            elif 'BINANCE_FUTURES' in ex_tag:
                allowed_exchanges.update(['BINANCE_FUTURES'])
            elif 'BINANCE' in ex_tag:
                allowed_exchanges.update(['BINANCE', 'BINANCE_SPOT'])
            elif 'BYBIT_FUTURES' in ex_tag:
                allowed_exchanges.update(['BYBIT_FUTURES'])
            elif 'BYBIT' in ex_tag:
                allowed_exchanges.update(['BYBIT', 'BYBIT_SPOT'])
            else:
                allowed_exchanges.add(ex_tag)

    if is_in_dup_list:
        # 허용되지 않은 해외 거래소가 들어있는지 검사
        illegal_tags = [t for t in listed if t not in allowed_exchanges]
        if illegal_tags:
            mismatches_dup.append({
                'disp': disp,
                'name': name,
                'sym': sym,
                'uid': uid,
                'allowed': list(allowed_exchanges),
                'illegal': illegal_tags,
                'listed': list(listed)
            })

print(f"동명이인 족보 등록 코인 중 해외 상장 오염 건수: {len(mismatches_dup)}")
for m in mismatches_dup:
    print(f"\n[{m['disp']}] ({m['name']}, UID: {m['uid']})")
    print(f"  -> 족보상 허용 거래소: {m['allowed']}")
    print(f"  -> 불법 오염된 거래소 태그: {m['illegal']}")
