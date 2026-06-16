import os

appdata = os.environ.get("APPDATA")
if not appdata:
    print("APPDATA env var not found.")
    sys.exit(1)

backup_dirs = [
    os.path.join(appdata, "Code", "Backups"),
    os.path.join(appdata, "Code - Insiders", "Backups"),
    os.path.join(appdata, "Cursor", "Backups"), # In case they use Cursor editor
]

found_any = False
for b_dir in backup_dirs:
    if os.path.exists(b_dir):
        print(f"Scanning backup directory: {b_dir}...")
        for root, dirs, files in os.walk(b_dir):
            for file in files:
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if "initInfiniteScroll" in content or "tablePoolInitialized" in content or "row-counter" in content:
                            print(f"MATCH: {path} (size {len(content)})")
                            found_any = True
                except:
                    pass
                    
if not found_any:
    print("No matches found in VS Code / Cursor Backups.")
