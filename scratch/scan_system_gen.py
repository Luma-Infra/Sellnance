import os

system_gen_dir = r"C:\Users\kmj\.gemini\antigravity-ide\brain\424cfff8-f436-46e8-86a7-e404cfa546ee\.system_generated"

print("Scanning .system_generated recursively...")
matches = []
for root, dirs, files in os.walk(system_gen_dir):
    for file in files:
        path = os.path.join(root, file)
        try:
            # Check size first to avoid huge files if any
            size = os.path.getsize(path)
            if size > 1000000:
                continue
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "Showing lines 426 to 1225" in content:
                    print(f"FOUND MATCH: {path} (size {size} bytes)")
                    matches.append(path)
        except Exception as e:
            pass

print("Scan completed. Found matches:", len(matches))
