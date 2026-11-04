"""
Make static Bricolage Grotesque instances from the variable font.

The web prototype uses the variable font with automatic optical sizing (opsz = font size in px),
which changes the letterforms a lot between 16 px labels and 92 px verdicts. React Native can't
set variation axes reliably, so we ship one static instance per size bucket, at default width.

Usage (fontTools required):
  python3 -P scripts/instance-bricolage.py "BricolageGrotesque[opsz,wdth,wght].ttf" assets/fonts

Source: https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque (OFL-1.1)
"""
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# file name -> (weight, optical size). Keep in sync with src/ui/fonts.ts.
INSTANCES = {
    "Bricolage-700": (700, 18),   # 16–22 px
    "Bricolage-800-S": (800, 22),  # 17–28 px
    "Bricolage-800-M": (800, 36),  # 32–40 px
    "Bricolage-800-L": (800, 80),  # 66–92 px
}


def main(src: str, out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    for name, (wght, opsz) in INSTANCES.items():
        font = TTFont(src)
        static = instancer.instantiateVariableFont(font, {"wght": wght, "opsz": opsz, "wdth": 100}, updateFontNames=False)
        # Unique family names so iOS/Android don't merge the instances.
        for rec in static["name"].names:
            if rec.nameID in (1, 4, 16):
                rec.string = name.replace("-", " ")
            elif rec.nameID == 6:
                rec.string = name
            elif rec.nameID in (2, 17):
                rec.string = "Regular"
        path = os.path.join(out_dir, f"{name}.ttf")
        static.save(path)
        print(path, os.path.getsize(path))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
