import os

lost_found_dir = r"c:\Users\kmj\Sellnance\.git\lost-found\other"
if not os.path.exists(lost_found_dir):
    print("lost-found/other directory does not exist.")
else:
    print("Scanning lost-found/other...")
    for filename in os.listdir(lost_found_dir):
        path = os.path.join(lost_found_dir, filename)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "initInfiniteScroll" in content or "tablePoolInitialized" in content or "row-counter" in content:
                    print(f"Found match: {filename} (size {len(content)} characters)")
                    # Show first 20 lines
                    lines = content.splitlines()
                    for l in lines[:20]:
                        print("  ", l)
        except Exception as e:
            pass
