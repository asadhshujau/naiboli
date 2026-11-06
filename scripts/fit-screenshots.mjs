// Turns raw phone screenshots into Google Play phone screenshots: 1080×1920 (9:16), opaque PNG.
// Run: npm run store:screenshots            (store/play/screenshots/raw → store/play/screenshots/play)
//      node scripts/fit-screenshots.mjs [--crop] [--in <dir>] [--out <dir>]
//
// Why: Play rejects screenshots whose long side is more than 2× the short side, and most phones capture at ~20:9
// (e.g. 1080×2400). 9:16 at 1080 px is the safe size that also qualifies for Play's larger placements.
// - Default (fit): the whole screenshot, scaled down with rounded corners and a soft shadow, on a blurred and
//   enlarged copy of itself, so the background is the scene's own colours and nothing (HUD, panel) is cut off.
// - --crop: centre crop to 9:16 instead, filling the frame (cuts the top and bottom edges).
// Input: .png / .jpg / .jpeg / .webp, processed in file-name order; output 01.png, 02.png, … (old outputs removed).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const { PNG } = require('pngjs');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : dflt;
};
const CROP = args.includes('--crop');
const IN = opt('--in', join(root, 'store/play/screenshots/raw'));
const OUT = opt('--out', join(root, 'store/play/screenshots/play'));

const W = 1080;
const H = 1920;
const PAD_Y = 56; // fit mode: space above and below the screenshot
const RADIUS = 36; // fit mode: corner radius at output scale
const MAX_BYTES = 8 * 1024 * 1024; // Play's per-screenshot limit
const MAX_COUNT = 8; // Play's phone screenshot limit

const files = (() => {
  try {
    return readdirSync(IN)
      .filter((f) => /^\.(png|jpe?g|webp)$/i.test(extname(f)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
})();
if (!files.length) {
  mkdirSync(IN, { recursive: true });
  console.error(`No screenshots in ${IN} (png / jpg / webp). Put the phone screenshots there and run again.`);
  process.exit(1);
}

const CK = await CanvasKitInit({ locateFile: (f) => join(root, 'node_modules/canvaskit-wasm/bin', f) });
const rect = (x, y, w, h) => CK.XYWHRect(x, y, w, h);

function render(img) {
  const iw = img.width();
  const ih = img.height();
  const surf = CK.MakeSurface(W, H);
  const c = surf.getCanvas();
  c.clear(CK.BLACK);
  const all = rect(0, 0, iw, ih);

  // Cover: scale so the image fills the frame, centred.
  const cover = Math.max(W / iw, H / ih);
  const coverDst = rect((W - iw * cover) / 2, (H - ih * cover) / 2, iw * cover, ih * cover);

  if (CROP) {
    c.drawImageRectCubic(img, all, coverDst, 1 / 3, 1 / 3, null);
    return surf;
  }

  // Backdrop: the same screenshot, enlarged further, blurred and slightly darkened.
  const bg = new CK.Paint();
  bg.setImageFilter(CK.ImageFilter.MakeBlur(48, 48, CK.TileMode.Clamp, null));
  const z = cover * 1.15;
  c.drawImageRectOptions(img, all, rect((W - iw * z) / 2, (H - ih * z) / 2, iw * z, ih * z), CK.FilterMode.Linear, CK.MipmapMode.Linear, bg);
  const dim = new CK.Paint();
  dim.setColor(CK.Color(0, 0, 0, 0.1));
  c.drawRect(rect(0, 0, W, H), dim);

  // Foreground: the whole screenshot, contained within the frame minus padding.
  const s = Math.min((W - 2 * PAD_Y * (W / H)) / iw, (H - 2 * PAD_Y) / ih);
  const fw = iw * s;
  const fh = ih * s;
  const dst = rect((W - fw) / 2, (H - fh) / 2, fw, fh);
  const rr = CK.RRectXY(dst, RADIUS, RADIUS);

  const shadow = new CK.Paint();
  shadow.setAntiAlias(true);
  shadow.setColor(CK.Color(0, 0, 0, 0.35));
  shadow.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 18, true));
  c.save();
  c.translate(0, 14);
  c.drawRRect(rr, shadow);
  c.restore();

  c.save();
  c.clipRRect(rr, CK.ClipOp.Intersect, true);
  c.drawImageRectCubic(img, all, dst, 1 / 3, 1 / 3, null);
  c.restore();
  return surf;
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/^\d+\.png$/.test(f)) rmSync(join(OUT, f));

let n = 0;
for (const f of files) {
  const img = CK.MakeImageFromEncoded(readFileSync(join(IN, f)));
  if (!img) {
    console.warn(`skip ${f}: can't decode (HEIC isn't supported; export as PNG or JPEG)`);
    continue;
  }
  const size = `${img.width()}×${img.height()}`;
  const surf = render(img);
  surf.flush();
  const png = Buffer.from(surf.makeImageSnapshot().encodeToBytes());
  surf.delete();
  img.delete();
  // Re-encode as RGB (no alpha channel).
  const rgb = PNG.sync.write(PNG.sync.read(png), { colorType: 2 });
  const name = `${String(++n).padStart(2, '0')}.png`;
  writeFileSync(join(OUT, name), rgb);
  const mb = (rgb.length / 1024 / 1024).toFixed(1);
  console.log(`${name} ← ${f} (${size} → ${W}×${H}, ${mb} MB)${rgb.length > MAX_BYTES ? '  ⚠️ over 8 MB' : ''}`);
}
console.log(`${n} screenshot(s) in ${OUT}${n > MAX_COUNT ? `  ⚠️ Play takes at most ${MAX_COUNT} phone screenshots` : ''}`);
if (n < 2) console.log('⚠️ Play needs at least 2 phone screenshots');
