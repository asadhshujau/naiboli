// Generates the Google Play store graphics from the Naiboli shell mark and wordmark (like the splash).
// Run: node scripts/gen-store-assets.mjs
//
// - store/play/icon-512.png             512², opaque: shell on the brand cream (Play listing icon)
// - store/play/feature-graphic.png      1024×500, opaque: "naib" + shell + "li" wordmark and "FORECAST FOR FUN"
// Both are saved without an alpha channel (the feature graphic must not have one).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const { PNG } = require('pngjs');
const CK = await CanvasKitInit({ locateFile: (f) => join(root, 'node_modules/canvaskit-wasm/bin', f) });

const CREAM = '#FBF6EC';
const INK = '#0A3346';
const SECONDARY = '#4F6F79';
const outDir = join(root, 'store/play');
mkdirSync(outDir, { recursive: true });

const src = readFileSync(join(root, 'src/ui/shell-paths.ts'), 'utf8');
const SHELL = [...src.matchAll(/\{ d: '([^']+)', c: '(#[0-9A-Fa-f]{6})' \}/g)].map((m) => ({ d: m[1], c: m[2] }));
if (SHELL.length !== 10) throw new Error(`expected 10 shell paths, found ${SHELL.length}`);
const VIEWBOX = 100; // src/ui/ShellLogo.tsx draws the paths in a 100-unit square

/** Tight bounds of the mark (paths + the 0.6 stroke) in viewBox units. */
let [bx0, by0, bx1, by1] = [Infinity, Infinity, -Infinity, -Infinity];
for (const p of SHELL) {
  const [x0, y0, x1, y1] = CK.Path.MakeFromSVGString(p.d).computeTightBounds();
  [bx0, by0, bx1, by1] = [Math.min(bx0, x0), Math.min(by0, y0), Math.max(bx1, x1), Math.max(by1, y1)];
}
const B = { x: bx0 - 0.3, y: by0 - 0.3, w: bx1 - bx0 + 0.6, h: by1 - by0 + 0.6 };

function drawShell(c) {
  for (const p of SHELL) {
    const path = CK.Path.MakeFromSVGString(p.d);
    const paint = new CK.Paint();
    paint.setAntiAlias(true);
    paint.setColor(CK.parseColorString(p.c));
    paint.setStyle(CK.PaintStyle.Fill);
    c.drawPath(path, paint);
    paint.setStyle(CK.PaintStyle.Stroke);
    paint.setStrokeWidth(0.6);
    paint.setStrokeJoin(CK.StrokeJoin.Round);
    c.drawPath(path, paint);
  }
}

function save(surf, name) {
  surf.flush();
  const png = Buffer.from(surf.makeImageSnapshot().encodeToBytes());
  surf.delete();
  const rgb = PNG.sync.write(PNG.sync.read(png), { colorType: 2 });
  writeFileSync(join(outDir, name), rgb);
  console.log(`store/play/${name}: ${rgb.length} bytes`);
}

// ── icon: same composition as assets/images/icon.png ──
{
  const size = 512;
  const surf = CK.MakeSurface(size, size);
  const c = surf.getCanvas();
  c.clear(CK.parseColorString(CREAM));
  const scale = (0.62 * size) / Math.max(B.w, B.h);
  c.translate(size / 2, size / 2);
  c.scale(scale, scale);
  c.translate(-(B.x + B.w / 2), -(B.y + B.h / 2));
  drawShell(c);
  save(surf, 'icon-512.png');
}

// ── feature graphic: the splash layout (src/ui/Splash.tsx, Wordmark.tsx) scaled up ──
{
  const W = 1024;
  const H = 500;
  const SIZE = 150; // wordmark font size; the app's splash uses 72
  const k = SIZE / 72;
  const fonts = CK.FontMgr.FromData(
    readFileSync(join(root, 'assets/fonts/Bricolage-800-L.ttf')),
    readFileSync(join(root, 'node_modules/@expo-google-fonts/dm-mono/500Medium/DMMono_500Medium.ttf')),
  );
  const para = (family, size, ls, color, build) => {
    const style = new CK.ParagraphStyle({
      textStyle: { color: CK.parseColorString(color), fontFamilies: [family], fontSize: size, letterSpacing: ls },
      textAlign: CK.TextAlign.Left,
    });
    const b = CK.ParagraphBuilder.Make(style, fonts);
    build(b);
    const p = b.build();
    p.layout(10000);
    return p;
  };

  // Wordmark: shell .6em square with .03em side margins, its bottom on the baseline.
  const shell = SIZE * 0.6;
  const mx = SIZE * 0.03;
  const word = para('Bricolage Grotesque', SIZE, -0.045 * SIZE, INK, (b) => {
    b.addText('naib');
    b.addPlaceholder(shell + 2 * mx, shell, CK.PlaceholderAlignment.Baseline, CK.TextBaseline.Alphabetic, shell);
    b.addText('li');
  });
  const tag = para('DM Mono', 11 * k, 0.3 * 11 * k, SECONDARY, (b) => b.addText('FORECAST FOR FUN'));

  const wordW = word.getMaxIntrinsicWidth();
  const tagW = tag.getMaxIntrinsicWidth();
  const gap = 16 * k;
  const total = word.getHeight() + gap + tag.getHeight();
  const top = (H - total) / 2;

  const surf = CK.MakeSurface(W, H);
  const c = surf.getCanvas();
  c.clear(CK.parseColorString(CREAM));
  const wx = (W - wordW) / 2;
  c.drawParagraph(word, wx, top);
  // letter spacing adds trailing space after the last letter: centre on the ink, not the advance
  c.drawParagraph(tag, (W - tagW + 0.3 * 11 * k) / 2, top + word.getHeight() + gap);

  const [slot] = word.getRectsForPlaceholders();
  const r = slot.rect;
  c.save();
  c.translate(wx + r[0] + mx, top + r[1]);
  c.scale(shell / VIEWBOX, shell / VIEWBOX);
  drawShell(c);
  c.restore();
  save(surf, 'feature-graphic.png');
}
