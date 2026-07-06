import os
import sys

# Add root dir to sys.path
sys.path.append(os.getcwd())

from modules import api_manager

print("Running fetch and process data...")
try:
    results = api_manager._fetch_and_process_data(silent_mode=False)
    print(f"Completed! Resolved {len(results)} assets.")
except Exception as e:
    import traceback
    traceback.print_exc()
