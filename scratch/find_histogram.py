import re

with open(r'c:\Users\78831\Sellnance\static\lightweight-charts.standalone.production.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's search for "Histogram"
# We want to find references to "Histogram" and "Mh" or similar in the same class/prototype
matches = [m.start() for m in re.finditer("Histogram", code)]
print("Histogram matches:", len(matches))
for m in matches[:10]:
    print("Context around:", m)
    print(code[max(0, m - 100):m + 150])
    print("-" * 40)
