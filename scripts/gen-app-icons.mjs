// Generates the app icons from the Naiboli shell mark (src/ui/shell-paths.ts, the "o" of the wordmark).
// Run: node scripts/gen-app-icons.mjs
//
// - assets/images/icon.png                     1024², opaque: shell on the brand cream (iOS + fallback)
// - assets/images/android-icon-foreground.png  1024², transparent: shell inside the adaptive-icon safe zone
// - assets/images/android-icon-monochrome.png  1024², transparent: white silhouette (Android 13+ themed icons)
// - assets/images/favicon.png                  48², transparent: shell (like the prototype's favicon)
// The adaptive icon background is a colour in app.json (android.adaptiveIcon.backgroundColor).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const CK = await CanvasKitInit({ locateFile: (f) => join(root, 'node_modules/canvaskit-wasm/bin', f) });

const CREAM = '#FBF6EC';
const src = readFileSync(join(root, 'src/ui/shell-paths.ts'), 'utf8');
const SHELL = [...src.matchAll(/\{ d: '([^']+)', c: '(#[0-9A-Fa-f]{6})' \}/g)].map((m) => ({ d: m[1], c: m[2] }));
if (SHELL.length !== 10) throw new Error(`expected 10 shell paths, found ${SHELL.length}`);

// Tight bounds of the mark (paths + the 0.6 stroke) in viewBox units, to centre it optically on its ink.
let [bx0, by0, bx1, by1] = [Infinity, Infinity, -Infinity, -Infinity];
for (const p of SHELL) {
  const [x0, y0, x1, y1] = CK.Path.MakeFromSVGString(p.d).computeTightBounds();
  [bx0, by0, bx1, by1] = [Math.min(bx0, x0), Math.min(by0, y0), Math.max(bx1, x1), Math.max(by1, y1)];
}
const B = { x: bx0 - 0.3, y: by0 - 0.3, w: bx1 - bx0 + 0.6, h: by1 - by0 + 0.6 };

/** Draw the shell so its larger side is `frac` of the canvas, centred. */
function render(size, { frac, bg, mono }) {
  const surf = CK.MakeSurface(size, size);
  const c = surf.getCanvas();
  c.clear(bg ? CK.parseColorString(bg) : CK.TRANSPARENT);
  const scale = (frac * size) / Math.max(B.w, B.h);
  c.translate(size / 2, size / 2);
  c.scale(scale, scale);
  c.translate(-(B.x + B.w / 2), -(B.y + B.h / 2));
  let maxR = 0;
  for (const p of SHELL) {
    const path = CK.Path.MakeFromSVGString(p.d);
    const paint = new CK.Paint();
    paint.setAntiAlias(true);
    paint.setColor(CK.parseColorString(mono ? '#FFFFFF' : p.c));
    paint.setStyle(CK.PaintStyle.Fill);
    c.drawPath(path, paint);
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(0.6);
    paint.setStrokeJoin(CK.StrokeJoin.Round);
    c.drawPath(path, paint);
    // farthest ink from the centre, in canvas fractions (adaptive-icon safe zone check)
    const pts = p.d.match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const dx = (pts[i] - (B.x + B.w / 2)) * scale;
      const dy = (pts[i + 1] - (B.y + B.h / 2)) * scale;
      maxR = Math.max(maxR, Math.hypot(dx, dy) / size);
    }
  }
  surf.flush();
  const png = surf.makeImageSnapshot().encodeToBytes();
  surf.delete();
  return { png: Buffer.from(png), maxR };
}

const out = (name, r) => {
  writeFileSync(join(root, 'assets/images', name), r.png);
  console.log(`${name}: ${r.png.length} bytes, farthest ink ${(r.maxR * 100).toFixed(1)}% of the canvas from centre`);
};

// iOS / fallback: full-bleed cream square, the OS applies the mask. Saved without an alpha channel
// (the App Store rejects icons that have one, even when every pixel is opaque).
const ios = render(1024, { frac: 0.62, bg: CREAM });
const { PNG } = require('pngjs');
ios.png = PNG.sync.write(PNG.sync.read(ios.png), { colorType: 2 });
out('icon.png', ios);

// Android adaptive (108 dp canvas): only the central 66 dp circle (radius 30.6 %) is guaranteed visible.
const fg = render(1024, { frac: 0.5, bg: null });
if (fg.maxR > 0.306) throw new Error(`foreground leaves the safe zone (${fg.maxR})`);
out('android-icon-foreground.png', fg);
out('android-icon-monochrome.png', render(1024, { frac: 0.5, bg: null, mono: true }));

out('favicon.png', render(48, { frac: 0.92, bg: null }));
