/**
 * Rough cost of one scene frame in JS (path building + scene logic), with a no-op canvas
 * and with CanvasKit raster. Run: SCENE_PERF=1 npx jest -c scripts/scene-compare/jest.config.js perf
 */
import { Skia, type SkCanvas } from '@shopify/react-native-skia';

import { DAY0, NOW_MS, synthTide, weather1069 } from '@/data/__tests__/fixtures';
import { liveScore } from '@/data/activities';
import { sunOf } from '@/data/sun';
import { procTide } from '@/data/tide';
import { hOfUnix } from '@/data/time';
import { moonDataFor, procWx } from '@/data/weather';
import { makeCtx } from '@/scene/ctx2d';
import { initialSim, tick, type SceneInput } from '@/scene/paint';

import { patchCanvasKitRealm } from './ckRealm';

const d = process.env.SCENE_PERF ? describe : describe.skip;

d('scene frame cost', () => {
  patchCanvasKitRealm();
  const Wx = procWx(weather1069, DAY0, NOW_MS)!;
  const T = procTide(synthTide(), DAY0)!;
  const sun = sunOf(Wx);
  const hour0 = hOfUnix(NOW_MS / 1000, DAY0);
  const I: SceneInput = {
    live: true, hrs: Wx.hrs, gloom: 0, rainAmt: 0, wind: 10, cloudN: 5, deg: 0, flash: false, hour0, sun,
    tide: { v: T.v, lo: T.lo, hi: T.hi }, moon: moonDataFor(Wx, DAY0, sun),
    sail: Array.from({ length: 105 }, (_, k) => liveScore(Wx.hrs, 1, hour0 + k / 4, sun, T)), signName: 'Malé', animate: true,
  };
  const counts: Record<string, number> = {};
  const noop = new Proxy({}, { get: (_, k: string) => (...a: unknown[]) => { counts[k] = (counts[k] || 0) + 1; void a; return undefined; } }) as unknown as SkCanvas;

  it('measures', () => {
    const run = (mk: () => SkCanvas, n: number) => {
      const S = initialSim();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) tick(makeCtx(mk()), S, I, 0, 1 / 60, 402, 874, null);
      return (performance.now() - t0) / n;
    };
    const surface = Skia.Surface.Make(1206, 2622)!;
    run(() => noop, 30);
    for (const k in counts) delete counts[k];
    const tNoop = run(() => noop, 300);
    const per = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round(v / 300)]));
    const tCk = run(() => { const c = surface.getCanvas(); c.save(); c.scale(3, 3); return c; }, 60);
    // Pure JS: stub Skia factories too (path strings still built, never parsed).
    const SK = Skia as unknown as Record<string, unknown>;
    const saved = { Path: SK.Path, Paint: SK.Paint, Color: SK.Color, Shader: SK.Shader, PathEffect: SK.PathEffect, XYWHRect: SK.XYWHRect };
    let svgChars = 0;
    const dummy = new Proxy({}, { get: () => () => undefined });
    SK.Path = { MakeFromSVGString: (str: string) => ((svgChars += str.length), dummy), Make: () => dummy };
    SK.Paint = () => dummy;
    SK.Color = (c: number[]) => c;
    SK.Shader = new Proxy({}, { get: () => () => dummy });
    SK.PathEffect = new Proxy({}, { get: () => () => dummy });
    SK.XYWHRect = () => dummy;
    const tPure = run(() => noop, 300);
    Object.assign(SK, saved);
    console.log(`pure JS (all Skia stubbed): ${tPure.toFixed(2)} ms/frame, SVG path chars/frame ${Math.round(svgChars / 300)}`);
    console.log(`JS only (no-op canvas): ${tNoop.toFixed(2)} ms/frame; canvas calls/frame ${JSON.stringify(per)}\nCanvasKit CPU raster @1206×2622: ${tCk.toFixed(1)} ms/frame`);
  });
});
