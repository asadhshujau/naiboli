"""
Diff prototype vs native scene renders (Pillow required).
  python3 -P scripts/scene-compare/compare.py <SCENE_OUT>
Writes <name>.compare.png (prototype | native | diff ×4) and prints per-scenario stats.
"""
import os
import sys

from PIL import Image, ImageChops


def main(out: str) -> None:
    names = sorted(f[: -len(".native.png")] for f in os.listdir(out) if f.endswith(".native.png"))
    print(f"{'scenario':<12} {'mean Δ':>7} {'>8':>7} {'>32':>7} {'>96':>7}")
    for n in names:
        a = Image.open(os.path.join(out, f"{n}.proto.png")).convert("RGB")
        b = Image.open(os.path.join(out, f"{n}.native.png")).convert("RGB")
        b = b.resize(a.size) if a.size != b.size else b
        d = ImageChops.difference(a, b)
        px = list(d.get_flattened_data()) if hasattr(d, 'get_flattened_data') else list(d.getdata())
        mx = [max(p) for p in px]
        total = len(mx)
        mean = sum(sum(p) for p in px) / (total * 3)
        frac = lambda t: 100 * sum(1 for v in mx if v > t) / total
        print(f"{n:<12} {mean:7.2f} {frac(8):6.2f}% {frac(32):6.2f}% {frac(96):6.2f}%")
        amp = d.point(lambda v: min(255, v * 4))
        m = Image.new("RGB", (a.width * 3 + 8, a.height), "white")
        m.paste(a, (0, 0))
        m.paste(b, (a.width + 4, 0))
        m.paste(amp, (a.width * 2 + 8, 0))
        m.save(os.path.join(out, f"{n}.compare.png"))


if __name__ == "__main__":
    main(sys.argv[1])
