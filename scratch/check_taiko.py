import os
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules import api_manager

try:
    data, _ = api_manager.get_cached_data(force_reload=True)
    taiko_rows = [row for row in data if 'TAIKO' in str(row.get('Symbol')) or 'TAIKO' in str(row.get('Ticker')) or 'TAIKO' in str(row.get('DisplayTicker'))]

    print("Found", len(taiko_rows), "TAIKO rows:")
    for r in taiko_rows:
        print(r)
except Exception as e:
    import traceback
    traceback.print_exc()
