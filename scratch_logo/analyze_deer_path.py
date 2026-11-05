import re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

# Let's rasterize the outer silhouette of the Luma Deer at high resolution or inspect its polygon
# Even better: in SVG, why is the deer hollow?
# Let's check the path in luma-deer-svg-dark.svg!
svg_text = Path(r"c:\Users\78831\Sellnance\static\luma-deer-svg-dark.svg").read_text(encoding="utf-8")
m = re.search(r'd="([^"]+)"', svg_text)
d = m.group(1)
print("Subpaths count (M/m):", len(re.findall(r'[Mm]', d)))
print("Z count:", len(re.findall(r'[Zz]', d)))
