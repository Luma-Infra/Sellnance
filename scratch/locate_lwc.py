import os

for root, dirs, files in os.walk(r'C:\Users\78831\Sellnance'):
    for f in files:
        if 'lightweight-charts' in f:
            print(os.path.join(root, f))
