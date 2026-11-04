# Scene compare

Renders the native Skia scene port (`src/scene/paint.ts`) and the HTML prototype's own `paint()`
with identical inputs (weather fixture, synthetic tide, seeded stars/rain/lightning), then diffs them.

```bash
npm run scene:compare -- /tmp/scene     # any output dir
```

Steps (what the npm script runs):

1. `SCENE_OUT=<dir> npx jest -c scripts/scene-compare/jest.config.js` — native render via CanvasKit,
   writes `<name>.native.png` and `<name>.json` per scenario (`SCENARIOS` in `native.render.ts`).
2. `node scripts/scene-compare/proto.mjs <dir>` — prototype render in headless Chrome
   (`CHROME=/path/to/chrome` to override), writes `<name>.proto.png`.
3. `node scripts/scene-compare/compare.mjs <dir>` — prints mean Δ and % of pixels differing by
   more than 8/32/96 (of 255), writes `<name>.compare.png` (prototype | native | diff ×4).

Requires Google Chrome (macOS or Linux paths are found automatically; `CHROME=...` overrides).
