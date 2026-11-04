// Diff prototype vs native scene renders.
//   node scripts/scene-compare/compare.mjs <SCENE_OUT>
// Writes <name>.compare.png (prototype | native | diff ×4) and prints per-scenario stats:
// mean Δ (0–255) and % of pixels whose max channel differs by more than 8 / 32 / 96.
// Uses pngjs (installed with Expo's tooling).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const out = path.resolve(process.argv[2] ?? '');
const read = (f) => PNG.sync.read(fs.readFileSync(path.join(out, f)));
const names = fs.readdirSync(out).filter((f) => f.endsWith('.native.png')).map((f) => f.slice(0, -'.native.png'.length)).sort();

console.log(`${'scenario'.padEnd(12)} ${'mean Δ'.padStart(7)} ${'>8'.padStart(7)} ${'>32'.padStart(7)} ${'>96'.padStart(7)}`);
for (const n of names) {
  if (!fs.existsSync(path.join(out, `${n}.proto.png`))) continue;
  const a = read(`${n}.proto.png`);
  const b = read(`${n}.native.png`);
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`${n.padEnd(12)} size differs: ${a.width}×${a.height} vs ${b.width}×${b.height}`);
    continue;
  }
  const { width: w, height: h } = a;
  const m = new PNG({ width: w * 3 + 8, height: h });
  m.data.fill(255);
  let sum = 0;
  const over = { 8: 0, 32: 0, 96: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let mx = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a.data[i + c] - b.data[i + c]);
        sum += d;
        mx = Math.max(mx, d);
        const row = y * m.width * 4;
        m.data[row + x * 4 + c] = a.data[i + c];
        m.data[row + (x + w + 4) * 4 + c] = b.data[i + c];
        m.data[row + (x + 2 * w + 8) * 4 + c] = Math.min(255, d * 4);
      }
      for (const t of [8, 32, 96]) if (mx > t) over[t]++;
    }
  }
  const total = w * h;
  const pct = (t) => `${((100 * over[t]) / total).toFixed(2)}%`.padStart(7);
  console.log(`${n.padEnd(12)} ${(sum / (total * 3)).toFixed(2).padStart(7)} ${pct(8)} ${pct(32)} ${pct(96)}`);
  fs.writeFileSync(path.join(out, `${n}.compare.png`), PNG.sync.write(m));
}
