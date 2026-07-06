import os

def search_text(root_dir, text):
    results = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or '.git' in dirpath or '.venv' in dirpath or 'dist' in dirpath:
            continue
        for filename in filenames:
            if filename.endswith(('.py', '.js', '.html')):
                filepath = os.path.join(dirpath, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        for line_num, line in enumerate(f, 1):
                            if text in line:
                                results.append((filepath, line_num, line.strip()))
                except Exception as e:
                    pass
    return results

res = search_text(r'C:\Users\78831\Sellnance', 'setVisibleLogicalRange')
for r in res:
    print(f"{r[0]}:{r[1]} -> {r[2]}")
