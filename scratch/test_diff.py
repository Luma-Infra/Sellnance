import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules import api_manager

def run():
    print("Loading data...")
    data, _ = api_manager.get_cached_data(force_reload=True)
    with open("scratch/before.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Done. Wrote {len(data)} records.")

if __name__ == "__main__":
    run()
