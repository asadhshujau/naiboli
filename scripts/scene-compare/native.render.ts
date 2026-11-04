/**
 * Renders the native scene port (src/scene/paint.ts) offscreen with CanvasKit and writes
 * PNGs + scenario JSON for the prototype renderer (proto.mjs) to reproduce.
 *
 *   SCENE_OUT=/some/dir npx jest -c scripts/scene-compare/jest.config.js
 */
/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import { Skia } from '@shopify/react-native-skia';

import { DAY0, NOW_MS, synthTide, weather1069 } from '@/data/__tests__/fixtures';
import { liveScore, sampleScore } from '@/data/activities';
import { liveMood, MOODS } from '@/data/mood';
import { DEFAULT_SUN, sunOf } from '@/data/sun';
import { procTide } from '@/data/tide';
import { hOfUnix } from '@/data/time';
import type { WxKey } from '@/data/weather';
import { moonDataFor, procWx, wxAt } from '@/data/weather';
import { makeCtx } from '@/scene/ctx2d';

import { patchCanvasKitRealm } from './ckRealm';
import { initialSim, paint, type FrameMood, type SceneInput } from '@/scene/paint';

const OUT = process.env.SCENE_OUT;
const W = 402;
const H = 874;

export interface Scenario {
  name: string;
  /** sample mood key, or undefined for live weather */
  mood?: WxKey;
  /** sample: mood hour; live: ignored (uses fixture "now") */
  hour0?: number;
  offset: number;
  t: number;
  /** force a lightning flash this frame */
  flash?: boolean;
}

export const SCENARIOS: Scenario[] = [
  { name: 'live-now', offset: 0, t: 5.2 },
  { name: 'live-night', offset: 8, t: 9.1 },
  { name: 'live-dawn', offset: 16, t: 1.7 },
  { name: 'sunny', mood: 'sunny', hour0: 10.5, offset: 0, t: 3.3 },
  { name: 'partly', mood: 'partly', hour0: 13.25, offset: 0, t: 8.4 },
  { name: 'golden', mood: 'golden', hour0: 17.4, offset: 0, t: 7.7 },
  { name: 'night', mood: 'night', hour0: 21.5, offset: 0, t: 11 },
  { name: 'windy', mood: 'windy', hour0: 13, offset: 0, t: 4 },
  { name: 'overcast', mood: 'overcast', hour0: 15, offset: 0, t: 2.2 },
  { name: 'rainy', mood: 'rainy', hour0: 16, offset: 0, t: 6 },
  { name: 'stormy', mood: 'stormy', hour0: 14.5, offset: 0, t: 2, flash: true },
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d = OUT ? describe : describe.skip;

d('native scene render', () => {
  patchCanvasKitRealm();
  const ttf = fs.readFileSync(path.join(__dirname, '../../node_modules/@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'));
  const tf = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(ttf)))!;
  const font = Skia.Font(tf, 12);
  const Wx = procWx(weather1069, DAY0, NOW_MS)!;
  const tideJson = synthTide();
  const T = procTide(tideJson, DAY0)!;
  const nowHour = hOfUnix(NOW_MS / 1000, DAY0);
  fs.mkdirSync(OUT!, { recursive: true });
  fs.writeFileSync(path.join(OUT!, 'fixtures.json'), JSON.stringify({ weather: weather1069, tide: tideJson, day0: DAY0 }));

  it.each(SCENARIOS.map((s, i) => [s.name, s, i] as const))('%s', (_, sc, i) => {
    const live = !sc.mood;
    const sun = live ? sunOf(Wx) : DEFAULT_SUN;
    const hour0 = live ? nowHour : sc.hour0!;
    const hour = hour0 + sc.offset;
    let m: FrameMood;
    if (live) {
      liveMood(Wx, hour0, sun); // (exercises the same path as the app)
      const x = wxAt(Wx.hrs, hour);
      m = { live: true, hrs: Wx.hrs, hour: hour0, gloom: x.gloom, rainAmt: x.rainAmt, wind: x.wind, cloudN: x.cloudN, deg: x.deg, flash: x.flash };
    } else {
      const M = MOODS[sc.mood!];
      m = { live: false, hrs: [], hour: hour0, gloom: M.gloom, rainAmt: M.rainAmt, wind: M.wind, cloudN: M.cloudN, deg: M.deg, flash: !!M.flash };
    }
    const sail: number[] = [];
    for (let k = 0; k <= 26 * 4; k++) {
      const h = hour0 + k / 4;
      sail.push(live ? liveScore(Wx.hrs, 1, h, sun, T) : sampleScore(MOODS[sc.mood!].scores, hour0, 1, h, sun));
    }
    const I: SceneInput = {
      live,
      hrs: live ? Wx.hrs : [],
      gloom: m.gloom,
      rainAmt: m.rainAmt,
      wind: m.wind,
      cloudN: m.cloudN,
      deg: m.deg,
      flash: m.flash,
      hour0,
      sun,
      tide: live ? { v: T.v, lo: T.lo, hi: T.hi } : null,
      moon: moonDataFor(live ? Wx : null, DAY0, sun),
      sail,
      signName: 'Malé',
      animate: true,
    };
    const S = initialSim();
    const rng = mulberry32(1000 + i);
    S.stars = S.stars.map(() => ({ x: rng(), y: rng() * 0.9, r: 0.5 + rng() * 1.2, p: rng() * 6.28 }));
    S.rain = S.rain.map(() => ({ x: rng() * 1.2 - 0.1, y: rng() * 900, l: 10 + rng() * 10, v: 640 + rng() * 360 }));
    S.t = sc.t;
    const dt = sc.flash ? 0.016 : 0;
    if (sc.flash) S.flashT = 0.001;
    const seed = 7000 + i;
    // serialise before painting: paint() moves the rain particles
    const scenario = JSON.stringify({ ...sc, live, hour0, hour, dt, flashT: S.flashT, seed, sun, stars: S.stars, rain: S.rain, m: { ...m, hrs: undefined }, sail, signName: I.signName });

    const surface = Skia.Surface.Make(W, H)!;
    const canvas = surface.getCanvas();
    const ctx = makeCtx(canvas);
    const realRandom = Math.random;
    Math.random = mulberry32(seed);
    try {
      paint(ctx, S, I, W, H, dt, m, hour, dt, font);
    } finally {
      Math.random = realRandom;
    }
    surface.flush();
    const png = surface.makeImageSnapshot().encodeToBytes();
    fs.writeFileSync(path.join(OUT!, `${sc.name}.native.png`), png);
    fs.writeFileSync(path.join(OUT!, `${sc.name}.json`), scenario);
    expect(png.length).toBeGreaterThan(1000);
  });
});
