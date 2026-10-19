"""Decodes every PNG in a folder with zxing-cpp, an independent ZXing based reader.

Usage: python decode_all.py DIR
Needs: pip install zxing-cpp pillow
"""
import glob
import os
import sys

import zxingcpp
from PIL import Image

EXPECTED = "https://example.com/styles?id=42&name=Zoë"

files = sorted(glob.glob(os.path.join(sys.argv[1], "*.png")))
bad = []
for path in files:
    result = zxingcpp.read_barcodes(Image.open(path).convert("RGB"), formats=zxingcpp.BarcodeFormat.QRCode)
    if not result or result[0].text != EXPECTED:
        bad.append(os.path.basename(path))
print(f"{len(files) - len(bad)}/{len(files)} read by zxing-cpp")
for name in bad:
    print("FAIL", name)
sys.exit(1 if bad else 0)
