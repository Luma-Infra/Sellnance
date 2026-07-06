with open(r'c:\Users\78831\Sellnance\static\lightweight-charts.standalone.production.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's search for "Value is null"
target = "Value is null"
idx = code.find(target)
if idx != -1:
    print("Found 'Value is null' at index:", idx)
    print(code[max(0, idx - 300):idx + 300])
else:
    print("Not found")
