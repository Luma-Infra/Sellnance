import json

def compare_data():
    with open("c:/Users/78831/Sellnance/scratch/before_now.json", "r", encoding="utf-8") as f:
        before = {item["UID"]: item for item in json.load(f)}
    with open("c:/Users/78831/Sellnance/scratch/after.json", "r", encoding="utf-8") as f:
        after = {item["UID"]: item for item in json.load(f)}

    print(f"Before items: {len(before)}")
    print(f"After items: {len(after)}")

    before_uids = set(before.keys())
    after_uids = set(after.keys())

    missing = before_uids - after_uids
    extra = after_uids - before_uids

    if missing: print(f"Missing UIDs: {missing}")
    if extra: print(f"Extra UIDs: {extra}")

    diffs = 0
    important_keys = ["Symbol", "DisplayTicker", "Name", "Is_Stock", "Upbit", "Binance", "Binance_Futures", "Upbit_Symbol", "Bithumb_Symbol", "Listed_Exchanges"]

    for uid in before_uids.intersection(after_uids):
        b = before[uid]
        a = after[uid]
        for key in important_keys:
            v_b = b.get(key)
            v_a = a.get(key)
            if isinstance(v_b, list): v_b = sorted(v_b)
            if isinstance(v_a, list): v_a = sorted(v_a)
            if v_b != v_a:
                print(f"Diff in {uid} [{key}]: {v_b} != {v_a}")
                diffs += 1
                if diffs > 20:
                    print("Too many diffs, stopping.")
                    return
    print(f"Total diffs in important keys: {diffs}")

if __name__ == "__main__":
    compare_data()
