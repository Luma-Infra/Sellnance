import json
import re

log_path = r"C:\Users\kmj\.gemini\antigravity-ide\brain\424cfff8-f436-46e8-86a7-e404cfa546ee\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        entry = json.loads(line)
        content = entry.get("content", "")
        if "File Path: `file:///c:/Users/kmj/Sellnance/static/table_render.js`" in content:
            print("Found log entry!")
            print("Length of content:", len(content))
            # Print first 20 lines of content
            lines = content.splitlines()
            print("First 20 lines:")
            for l in lines[:20]:
                print("  ", l)
            print("Last 20 lines:")
            for l in lines[-20:]:
                print("  ", l)
            break
