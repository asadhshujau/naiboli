/**
 * Scene drawing — line-for-line port of the prototype's `tick()`, `paint()`, `palm()`, `cloud()`
 * and `moonPath()`. Runs on the UI thread every frame. All coordinates are artboard units
 * (402 wide); the caller scales the canvas.
 */
import { sceneTideLevel } from '@/data/tide';
import { clamp } from '@/data/time';
import type { MoonData, Sun, WxSample } from '@/data/types';
import { moonAt, sample, wxAt } from '@/data/weather';
import type { SkFont } from '@shopify/react-native-skia';

import { rgb, type Ctx2D } from './ctx2d';
import { GOLD_T, GREY_T, hex, lightOf, mix, NIGHT_T, OBJ_KEYS, OBJC, type ObjColors, type RGB } from './palette';

// NOTE: worklet functions are not hoisted once the worklets Babel plugin has transformed them —
// a worklet captures the functions it calls when the module loads, so define callees first.

export const ARTBOARD_W = 402;
export const HZ = 444;
export const ICX = 196;
export const WL = 572;
export const DY = -40;
const TAU = Math.PI * 2;
const FRONDS = [-1.55, -1.15, -0.78, -0.42, -0.1, 0.22, 0.55, 0.9, 1.28, 1.6];
const WHITE: RGB = [255, 255, 255];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hits {
  palms: Box[];
  clouds: Box[];
  sun: { x: number; y: number; r: number } | null;
  moon: { x: number; y: number; r: number } | null;
  dhoni: Box | null;
  sign: Box | null;
  island: Box | null;
}

/** What the scene needs from React; replaced whenever data or the clock changes. */
export interface SceneInput {
  live: boolean;
  /** live hourly samples ([] for sample moods) */
  hrs: WxSample[];
  /** mood values at "now" (used directly for sample moods) */
  gloom: number;
  rainAmt: number;
  wind: number;
  cloudN: number;
  deg: number;
  flash: boolean;
  /** hour-axis "now" (`m.hour`) */
  hour0: number;
  /** live rain / gloom at now from the minute forecast, when the feed has one (blended out over the next hour) */
  now?: { rainAmt: number; gloom: number } | null;
  sun: Sun;
  tide: { v: number[]; lo: number; hi: number } | null;
  moon: MoonData;
  /** sailing score at hour0 + k/4 (k = 0…) — dhoni shows at ≥5 */
  sail: number[];
  signName: string;
  animate: boolean;
}

export interface Ripple {
  x: number;
  y: number;
  a: number;
  sea: boolean;
}

/** Mutable per-frame state (prototype instance fields `_t`, `_hDisp`, `_sm`, …). */
export interface SimState {
  t: number;
  hDisp: number | null;
  sm: { gloom: number; rain: number; wind: number; cn: number } | null;
  wS: number | null;
  wsx: number | null;
  lv: number | null;
  flash: number;
  flashT: number;
  re: number;
  bolt: number[][] | null;
  ripples: Ripple[];
  rain: { x: number; y: number; l: number; v: number }[];
  stars: { x: number; y: number; r: number; p: number }[];
  hits: Hits | null;
  /** Canvas line cap persists across frames in the prototype (set by the birds, never reset). */
  cap: 'butt' | 'round';
}

const CLOUDS = [
  { x: 0.05, y: 0.1, s: 1, v: 7 },
  { x: 0.58, y: 0.42, s: 0.8, v: 5 },
  { x: 0.32, y: 0.7, s: 1.15, v: 9 },
  { x: 0.8, y: 0.2, s: 0.9, v: 6 },
  { x: 0.18, y: 0.48, s: 1.3, v: 8 },
  { x: 0.68, y: 0.78, s: 1.05, v: 10 },
  { x: 0.42, y: 0.04, s: 1.25, v: 6 },
  { x: 0.9, y: 0.58, s: 0.85, v: 7 },
  { x: 0, y: 0.86, s: 1.1, v: 9 },
];

/** Initial sim state (randomised rain and stars, like `componentDidMount`). */
export function initialSim(): SimState {
  const R = (a: number, b: number) => a + Math.random() * (b - a);
  return {
    t: 0,
    hDisp: null,
    sm: null,
    wS: null,
    wsx: null,
    lv: null,
    flash: 0,
    flashT: 2.5,
    re: 0,
    bolt: null,
    ripples: [],
    rain: Array.from({ length: 190 }, () => ({ x: Math.random() * 1.2 - 0.1, y: R(0, 900), l: R(10, 20), v: R(640, 1000) })),
    stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.9, r: R(0.5, 1.7), p: R(0, 6.28) })),
    hits: null,
    cap: 'butt',
  };
}

/** Smoothed mood fed to `paint()` (exported for the scene-compare harness). */
export interface FrameMood {
  live: boolean;
  hrs: WxSample[];
  hour: number;
  gloom: number;
  rainAmt: number;
  wind: number;
  cloudN: number;
  deg: number;
  flash: boolean;
}

function windAt(m: FrameMood, h: number): number {
  'worklet';
  if (m.live) return Math.max(1, Math.round(sample(m.hrs, h).wind));
  return Math.max(2, Math.round(m.wind * (1 + 0.22 * (Math.sin(((h - 9) / 24) * TAU) - Math.sin(((m.hour - 9) / 24) * TAU)))));
}

function palm(ctx: Ctx2D, bx: number, by: number, Hh: number, lean: number, wind: number, t: number, seed: number, C: ObjColors, store: Box[]) {
  'worklet';
  const aw = Math.abs(wind);
  const n = 16;
  const seg = Hh / n;
  const sway = Math.sin(t * (1 + aw * 1.8) + seed) * (0.012 + aw * 0.05) + Math.sin(t * 2.9 + seed * 2) * aw * 0.018;
  const bend = wind * 0.3 + sway;
  const pts: number[][] = [[bx, by]];
  let x = bx;
  let y = by;
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    const ang = -Math.PI / 2 + lean * (0.4 + 0.6 * s) + bend * Math.pow(s, 1.7);
    x += Math.cos(ang) * seg;
    y += Math.sin(ang) * seg;
    pts.push([x, y]);
  }
  const wB = Hh * 0.062;
  const wT = Hh * 0.03;
  const L: number[][] = [];
  const Rr: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const ww = (wB + (wT - wB) * (i / n)) / 2;
    L.push([p[0] - dy * ww, p[1] + dx * ww]);
    Rr.push([p[0] + dy * ww, p[1] - dx * ww]);
  }
  ctx.fillStyle = rgb(C.trunk);
  ctx.beginPath();
  for (let i = 0; i < L.length; i++) (i ? ctx.lineTo : ctx.moveTo)(L[i][0], L[i][1]);
  for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(C.trunkSh);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) (i ? ctx.lineTo : ctx.moveTo)(pts[i][0], pts[i][1]);
  for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath();
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgb(C.ring);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    ctx.moveTo(L[i][0], L[i][1]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1] + 2.2, Rr[i][0], Rr[i][1]);
  }
  ctx.stroke();
  const cx = pts[n][0];
  const cy = pts[n][1];
  const top = Math.atan2(pts[n][1] - pts[n - 2][1], pts[n][0] - pts[n - 2][0]);
  const frond = (off: number, f: number, dark: boolean): number[][] => {
    const len = Hh * (0.4 + 0.1 * (((f * 37) % 5) / 4));
    const steps = 14;
    const ds = 1 / steps;
    const flutter = Math.sin(t * (2 + aw * 5) + f * 1.3 + seed) * (0.06 + aw * 0.3) + Math.sin(t * (5 + aw * 8) + f * 2.1) * aw * 0.1;
    const push = wind * 1.5 + flutter;
    let dx = Math.cos(top + off);
    let dy = Math.sin(top + off);
    let px = cx;
    let py = cy;
    const sp: number[][] = [[px, py]];
    for (let k = 1; k <= steps; k++) {
      dx += push * ds * 0.9;
      dy += (1.2 + Math.abs(Math.cos(top + off)) * 0.5) * ds * (0.3 + k / steps);
      const d = Math.hypot(dx, dy);
      dx /= d;
      dy /= d;
      px += dx * len * ds;
      py += dy * len * ds;
      sp.push([px, py]);
    }
    const up: number[][] = [];
    const dn: number[][] = [];
    const wmax = Hh * 0.062;
    for (let k = 0; k < sp.length; k++) {
      const p = sp[k];
      const a = sp[Math.max(0, k - 1)];
      const b = sp[Math.min(steps, k + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const d = Math.hypot(tx, ty) || 1;
      tx /= d;
      ty /= d;
      const s = k / steps;
      const ww = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.7);
      const z = k % 2 ? 1.3 : 0.7;
      up.push([p[0] - ty * ww * z, p[1] + tx * ww * z + ww * 0.3]);
      dn.push([p[0] + ty * ww * (2 - z), p[1] - tx * ww * (2 - z) + ww * 0.75]);
    }
    ctx.fillStyle = rgb(dark ? C.frondDk : C.frond);
    ctx.beginPath();
    for (let i = 0; i < up.length; i++) (i ? ctx.lineTo : ctx.moveTo)(up[i][0], up[i][1]);
    for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
    ctx.closePath();
    ctx.fill();
    if (!dark) {
      ctx.fillStyle = rgb(C.frondHi);
      ctx.beginPath();
      for (let i = 0; i < sp.length; i++) (i ? ctx.lineTo : ctx.moveTo)(sp[i][0], sp[i][1]);
      for (let i = up.length - 1; i >= 0; i--) ctx.lineTo((up[i][0] + sp[i][0]) / 2, (up[i][1] + sp[i][1]) / 2);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = rgb(C.spine);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < sp.length; i++) (i ? ctx.lineTo : ctx.moveTo)(sp[i][0], sp[i][1]);
    ctx.stroke();
    return sp;
  };
  let ext: number[][] = [[cx, cy]];
  for (let f = 0; f < FRONDS.length; f++) if (f % 2 === 0) ext = ext.concat(frond(FRONDS[f] * 1.05, f, true));
  ctx.fillStyle = rgb(C.nut);
  ctx.beginPath();
  const nuts = [[-4, 4], [4, 5], [0, 9]];
  for (let i = 0; i < nuts.length; i++) {
    ctx.moveTo(cx + nuts[i][0] + 5, cy + nuts[i][1]);
    ctx.arc(cx + nuts[i][0], cy + nuts[i][1], 5, 0, TAU);
  }
  ctx.fill();
  for (let f = 0; f < FRONDS.length; f++) if (f % 2 === 1) ext = ext.concat(frond(FRONDS[f], f, false));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const all = ext.concat(pts);
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  store.push({ x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 });
}

function cloud(ctx: Ctx2D, x: number, y: number, s: number, col: RGB) {
  'worklet';
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  const parts = [[0, 0, 18], [24, -12, 24], [50, -5, 20], [68, 3, 14]];
  for (let i = 0; i < parts.length; i++) {
    const cx = parts[i][0];
    const cy = parts[i][1];
    const r = parts[i][2];
    ctx.moveTo(x + (cx + r) * s, y + cy * s);
    ctx.arc(x + cx * s, y + cy * s, r * s, 0, TAU);
  }
  const bx = x - 18 * s;
  const by = y - 2 * s;
  const bw = 100 * s;
  const bh = 22 * s;
  const br = 11 * s;
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.arc(bx + bw - br, by + br, br, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(bx + br, by + bh);
  ctx.arc(bx + br, by + br, br, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();
}

function moonPath(ctx: Ctx2D, x: number, y: number, r: number, p: number) {
  'worklet';
  const c = Math.cos(TAU * p);
  const right = p < 0.5;
  const bulgeR = right === c > 0;
  const rx = r * Math.abs(c);
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !right);
  if (bulgeR) ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
  else ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
  ctx.closePath();
}

export function paint(ctx: Ctx2D, S: SimState, I: SceneInput, W: number, H: number, dt: number, m: FrameMood, hour: number, rdt: number, signFont: SkFont | null) {
  'worklet';
  const t = S.t;
  const Lt = lightOf(hour, m.gloom, I.sun);
  const pal = Lt.pal;
  const gl = m.gloom;
  const wT = windAt(m, hour);
  S.wS = S.wS == null ? wT : S.wS + (wT - S.wS) * Math.min(1, (rdt || 0) * 1.6);
  const wind = S.wS;
  const wn = clamp(wind / 50, 0, 1);
  const toward = ((m.deg + 180) * Math.PI) / 180;
  const wsign = Math.sin(toward) >= 0 ? 1 : -1;
  const wsx0 = wsign * (0.15 + 0.85 * wn);
  S.wsx = S.wsx == null ? wsx0 : S.wsx + (wsx0 - S.wsx) * Math.min(1, (rdt || 0) * 1.5);
  const wsx = S.wsx;
  const tint = (c: RGB) => mix(mix(mix(c, NIGHT_T, Lt.N * 0.64), GOLD_T, Lt.G * 0.2), GREY_T, gl * 0.3);
  const C = {} as ObjColors;
  for (let i = 0; i < OBJ_KEYS.length; i++) C[OBJ_KEYS[i]] = tint(OBJC[OBJ_KEYS[i]]);
  const lvT = sceneTideLevel(hour, I.tide);
  S.lv = S.lv == null ? lvT : S.lv + (lvT - S.lv) * Math.min(1, (rdt || 0) * 2);
  const lvl = S.lv;
  const tideOff = -lvl * 30;
  const breath = Math.sin(t * 0.35) * 2;
  const seaL = WL + tideOff + breath;
  const hits: Hits = { palms: [], clouds: [], sun: null, moon: null, dhoni: null, sign: null, island: null };
  ctx.lineCap = S.cap;

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, rgb(pal.sky[0]));
  g.addColorStop(Lt.G > 0.4 ? 0.66 : 0.6, rgb(pal.sky[1]));
  g.addColorStop(1, rgb(pal.sky[2]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HZ + 2);
  const MS = moonAt(I.moon, hour);
  const starA = Lt.N * (1 - gl) * (MS.up ? 1 - 0.45 * MS.illum : 1);
  if (starA > 0.02) {
    ctx.fillStyle = rgb(WHITE);
    for (let i = 0; i < S.stars.length; i++) {
      const s = S.stars[i];
      ctx.globalAlpha = starA * (0.3 + 0.7 * Math.abs(Math.sin(t * 0.9 + s.p)));
      ctx.beginPath();
      ctx.arc(s.x * W, 50 + s.y * (HZ - 90), s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // sun / moon
  const arc = 200;
  const bodyX = W * (0.08 + 0.84 * Lt.f);
  const bodyY = HZ - Math.sin(Math.PI * Lt.f) * arc;
  if (Lt.day) {
    const a = clamp(1 - gl * 0.85, 0, 1);
    const r = 30 + Lt.G * 8;
    const col = mix(hex('#FFD54A'), hex('#FFB04A'), Lt.G);
    if (a > 0.05) {
      const gr = r * 4.6 * (1 + 0.05 * Math.sin(t * 1.4));
      const rg = ctx.createRadialGradient(bodyX, bodyY, r * 0.5, bodyX, bodyY, gr);
      rg.addColorStop(0, rgb(mix(col, WHITE, 0.3), 0.55 * a));
      rg.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bodyX, bodyY, gr, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = rgb(col);
      ctx.beginPath();
      ctx.arc(bodyX, bodyY, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      hits.sun = { x: bodyX, y: bodyY, r: Math.max(40, r * 1.8) };
    }
  }
  let moonX = bodyX;
  let moonGlit = 0;
  if (MS.up) {
    const r = 20;
    const k = MS.illum;
    const mx = W * (0.08 + 0.84 * MS.f);
    const my = HZ - Math.sin(Math.PI * MS.f) * arc;
    const a = clamp(MS.el * 6, 0, 1) * (1 - gl * 0.85) * (1 - Lt.D * 0.5);
    if (a > 0.05 && k > 0.02) {
      moonX = mx;
      moonGlit = Lt.day ? 0 : a * (0.2 + 0.8 * k);
      const gA = 0.35 * a * k * (1 - Lt.D);
      if (gA > 0.01) {
        const rg = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 4);
        rg.addColorStop(0, rgb([210, 222, 255], gA));
        rg.addColorStop(1, rgb([210, 222, 255], 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(mx, my, r * 4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = rgb([246, 239, 216]);
      ctx.globalAlpha = a * 0.13 * (1 - Lt.D);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a;
      moonPath(ctx, mx, my, r, MS.p);
      ctx.fill();
      ctx.save();
      moonPath(ctx, mx, my, r, MS.p);
      ctx.clip();
      ctx.fillStyle = rgb([60, 70, 110], 0.13);
      ctx.beginPath();
      ctx.arc(mx - 6, my - 4, 4.5, 0, TAU);
      ctx.arc(mx + 7, my + 5, 3, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      hits.moon = { x: mx, y: my, r: 40 };
    }
  }

  // clouds
  const ccol = mix(mix(pal.cloud, WHITE, (1 - gl) * Lt.D * 0.4), pal.cloud, 0);
  const cshade = mix(ccol, [20, 30, 50], 0.14);
  const csc = 0.85 + gl * 0.85;
  const span = W + 300;
  const csp = 0.5 + wind / 15;
  const nCl = Math.min(CLOUDS.length, Math.ceil(m.cloudN - 0.02));
  for (let i = 0; i < nCl; i++) {
    const c = CLOUDS[i];
    const s = csc * c.s;
    const x = ((c.x * span + ((t * c.v * csp * (wsign > 0 ? 1 : -1)) % span) + span) % span) - 150;
    const y = 110 + c.y * (HZ - 220);
    const ca = 0.96 * clamp(m.cloudN - i, 0, 1);
    ctx.globalAlpha = ca;
    cloud(ctx, x, y + 5 * s, s, cshade);
    cloud(ctx, x, y, s, ccol);
    ctx.globalAlpha = 1;
    if (ca > 0.3) hits.clouds.push({ x: x - 20 * s, y: y - 38 * s, w: 104 * s, h: 66 * s });
  }

  // birds
  if (Lt.D > 0.4 && gl < 0.5) {
    ctx.strokeStyle = rgb(C.bird, 0.75);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const bx = ((t * (12 + i * 3) + i * 120) % (W + 80)) - 40;
      const by = 300 + i * 22 + Math.sin(t * 0.7 + i * 2) * 10;
      const fl = -3 + 5 * Math.sin(t * 8 + i * 1.7);
      const s = 1 - i * 0.18;
      ctx.moveTo(bx - 9 * s, by + fl * s);
      ctx.quadraticCurveTo(bx - 4 * s, by - 4 * s, bx, by);
      ctx.quadraticCurveTo(bx + 4 * s, by - 4 * s, bx + 9 * s, by + fl * s);
    }
    ctx.stroke();
  }

  // sea base
  const sg = ctx.createLinearGradient(0, HZ, 0, H);
  sg.addColorStop(0, rgb(pal.sea[0]));
  sg.addColorStop(0.3, rgb(pal.sea[1]));
  sg.addColorStop(1, rgb(pal.sea[2]));
  ctx.fillStyle = sg;
  ctx.fillRect(0, HZ, W, H - HZ);
  ctx.fillStyle = rgb(WHITE, 0.25);
  ctx.fillRect(0, HZ, W, 1);

  // far island
  ctx.fillStyle = rgb(C.farSand);
  ctx.beginPath();
  ctx.ellipse(W * 0.84, HZ + 2, 46, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgb(C.far);
  ctx.beginPath();
  ctx.ellipse(W * 0.84, HZ, 36, 6, 0, Math.PI, TAU);
  ctx.fill();
  const farPalms = [[-14, 14], [-2, 18], [12, 12]];
  for (let i = 0; i < farPalms.length; i++) {
    const px = W * 0.84 + farPalms[i][0];
    const hh = farPalms[i][1];
    ctx.strokeStyle = rgb(C.far);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, HZ - 2);
    ctx.lineTo(px + wsx * 2, HZ - hh);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px + wsx * 2, HZ - hh, 5, 2.2, 0, 0, TAU);
    ctx.fill();
  }
  const amp = clamp(0.55 + wind / 22, 0.5, 2.6);
  const wave = (base: number, A: number, k: number, w: number, ph: number, col: RGB) => {
    const wg = ctx.createLinearGradient(0, base - 10, 0, H);
    wg.addColorStop(0, rgb(col));
    wg.addColorStop(1, rgb(pal.sea[2]));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const yAt = (x: number) => base + A * amp * Math.sin(x * k + t * w + ph) + A * amp * 0.35 * Math.sin(x * k * 2.7 - t * w * 1.6 + ph);
    for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, yAt(x));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgb(WHITE, 0.16);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= W + 4; x += 4) (x ? ctx.lineTo : ctx.moveTo)(x, yAt(x));
    ctx.stroke();
  };
  const sea0 = pal.sea[0];
  const sea1 = pal.sea[1];
  const sea2 = pal.sea[2];
  wave(HZ + 8 + tideOff * 0.2, 1.2, 0.045, 0.8, 0, mix(sea0, WHITE, 0.08));
  wave(HZ + 30 + tideOff * 0.35, 2, 0.034, 1, 1.3, mix(sea0, sea1, 0.3));

  // dhoni
  const si = clamp(Math.round((hour - I.hour0) * 4), 0, Math.max(0, I.sail.length - 1));
  const sailOk = (I.sail.length ? I.sail[si] : 0) >= 5 && gl < 0.9;
  if (sailOk) {
    const dsp = 7 + wind * 0.35;
    const dxp = ((((t * dsp * wsign + 80) % (W + 160)) + (W + 160)) % (W + 160)) - 80;
    const dyp = HZ + 44 + tideOff * 0.4 + Math.sin(t * 1.6) * 1.4;
    ctx.save();
    ctx.translate(dxp, dyp);
    ctx.rotate(Math.sin(t * 1.3) * 0.04);
    ctx.scale(wsign * 0.9, 0.9);
    ctx.fillStyle = rgb(C.sail);
    ctx.beginPath();
    ctx.moveTo(-2, -46);
    ctx.quadraticCurveTo(14, -30, 18, -9);
    ctx.lineTo(-16, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgb(C.hull);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, -48);
    ctx.lineTo(-2, -4);
    ctx.stroke();
    ctx.fillStyle = rgb(C.hull);
    ctx.beginPath();
    ctx.moveTo(-26, -6);
    ctx.quadraticCurveTo(-22, 5, -6, 5);
    ctx.lineTo(16, 5);
    ctx.quadraticCurveTo(27, 2, 33, -15);
    ctx.lineTo(25, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgb(C.hullHi);
    ctx.fillRect(-20, -5, 40, 2);
    if (Lt.N > 0.5) {
      ctx.fillStyle = rgb([255, 214, 120], 0.95);
      ctx.beginPath();
      ctx.arc(-2, -14, 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgb([255, 214, 120], 0.25);
      ctx.beginPath();
      ctx.arc(-2, -14, 8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    hits.dhoni = { x: dxp - 36, y: dyp - 54, w: 72, h: 64 };
  }
  wave(HZ + 64 + tideOff * 0.55, 3, 0.026, 1.15, 2.4, mix(sea0, sea1, 0.55));

  // glitter
  const glitA = Lt.day ? clamp(1 - gl * 1.3, 0, 1) : moonGlit * (1 - gl);
  if (glitA > 0.05) {
    const gc: RGB = Lt.day ? mix(WHITE, [255, 220, 170], Lt.G) : [215, 228, 255];
    for (let i = 0; i < 14; i++) {
      const yy = HZ + 6 + i * 8;
      const ww = (16 + ((i * 7) % 18)) * (1 - i / 18);
      const xx = (Lt.day ? bodyX : moonX) + Math.sin(t * 1.5 + i * 1.7) * (5 + i * 2.2) - ww / 2;
      if (yy > WL - 20 && Math.abs(xx - ICX) < 140) continue;
      ctx.fillStyle = rgb(gc, glitA * (0.2 + 0.4 * Math.abs(Math.sin(t * 2.2 + i))));
      ctx.fillRect(xx, yy, ww, 2);
    }
  }

  // island
  ctx.save();
  ctx.translate(0, DY);
  const bush = (bx: number, by: number, r: number) => {
    ctx.moveTo(bx + r, by);
    ctx.arc(bx, by, r, 0, TAU);
  };
  ctx.fillStyle = rgb(C.bush);
  ctx.beginPath();
  const bushes = [[-78, 590, 12], [-58, 582, 16], [-34, 578, 14], [6, 576, 13], [30, 579, 16], [56, 585, 12], [78, 593, 9]];
  for (let i = 0; i < bushes.length; i++) bush(ICX + bushes[i][0], bushes[i][1], bushes[i][2]);
  ctx.fill();
  ctx.fillStyle = rgb(C.bushHi);
  ctx.beginPath();
  const bushHi = [[-60, 574, 8], [-36, 571, 7], [28, 572, 8], [6, 570, 6]];
  for (let i = 0; i < bushHi.length; i++) bush(ICX + bushHi[i][0], bushHi[i][1], bushHi[i][2]);
  ctx.fill();
  const ig = ctx.createLinearGradient(0, 576, 0, 640);
  ig.addColorStop(0, rgb(C.sand));
  ig.addColorStop(1, rgb(C.sandLo));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.moveTo(ICX - 250, 690);
  ctx.quadraticCurveTo(ICX - 205, 652, ICX - 162, 636);
  ctx.bezierCurveTo(ICX - 132, 616, ICX - 94, 586, ICX - 26, 583);
  ctx.bezierCurveTo(ICX + 44, 580, ICX + 114, 598, ICX + 164, 636);
  ctx.quadraticCurveTo(ICX + 207, 652, ICX + 252, 690);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(C.sandLo, 0.35);
  ctx.beginPath();
  ctx.ellipse(ICX - 28, 592, 18, 3, 0, 0, TAU);
  ctx.ellipse(ICX + 50, 594, 12, 2.4, 0, 0, TAU);
  ctx.fill();
  palm(ctx, ICX + 46, 592, 132, 0.32, wsx, t, 2.1, C, hits.palms);
  palm(ctx, ICX - 28, 590, 214, -0.2, wsx, t, 0, C, hits.palms);
  {
    const sx = ICX - 108;
    const sy = 604;
    const rot = 0.07 + Math.sin(t * 1.1) * 0.012 * (0.3 + wn);
    ctx.save();
    ctx.font = signFont;
    let nm = I.signName || '';
    while (nm.length > 3 && ctx.measureText(nm).width > 118) nm = nm.slice(0, -2) + '…';
    const bw = Math.max(46, ctx.measureText(nm).width + 22);
    const bh = 24;
    const top = -42 - bh;
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.fillStyle = rgb(C.signDk);
    ctx.fillRect(-2.5, top + 6, 5, -top - 4);
    const rr = (x: number, y: number, w: number, hh: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, hh, 4);
      ctx.fill();
    };
    ctx.fillStyle = rgb(C.signDk);
    rr(-bw / 2, top + 2.5, bw, bh);
    ctx.fillStyle = rgb(C.sign);
    rr(-bw / 2, top, bw, bh);
    ctx.fillStyle = rgb(C.signDk, 0.35);
    ctx.fillRect(-bw / 2 + 3, top + bh / 2, bw - 6, 1);
    ctx.beginPath();
    ctx.arc(-bw / 2 + 5, top + 5, 1.3, 0, TAU);
    ctx.arc(bw / 2 - 5, top + 5, 1.3, 0, TAU);
    ctx.arc(-bw / 2 + 5, top + bh - 5, 1.3, 0, TAU);
    ctx.arc(bw / 2 - 5, top + bh - 5, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(C.signInk);
    ctx.fillText(nm, 0, top + bh / 2 + 0.5);
    ctx.restore();
    hits.sign = { x: sx - bw / 2 - 10, y: sy + DY + top - 10, w: bw + 20, h: -top + 18 };
  }
  ctx.restore();
  for (let i = 0; i < hits.palms.length; i++) hits.palms[i].y += DY;

  // lagoon water over island base
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, H);
  const lw = (x: number) => seaL + 1.4 * Math.sin(x * 0.05 + t * 1.2);
  for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, lw(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.clip();
  ctx.translate(ICX, seaL + 8);
  ctx.scale(1, 0.22);
  const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 230);
  lg.addColorStop(0, rgb(pal.lagoon, 0.66));
  lg.addColorStop(0.5, rgb(pal.lagoon, 0.72));
  lg.addColorStop(0.8, rgb(mix(pal.lagoon, sea1, 0.4), 0.5));
  lg.addColorStop(1, rgb(sea1, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(-240, -240, 480, 480);
  ctx.restore();
  const hw = 128 + tideOff * 2.4;
  ctx.save();
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -t * 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgb(WHITE, 0.55 + 0.25 * Math.sin(t * 1.6));
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = ICX - hw; x <= ICX + hw + 8; x += 3) {
    const y = lw(x) + 1;
    if (x === ICX - hw) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = rgb(WHITE, 0.28);
  ctx.lineWidth = 1.5;
  ctx.lineDashOffset = t * 10;
  ctx.beginPath();
  for (let x = ICX - hw - 18; x <= ICX + hw + 26; x += 3) {
    const y = lw(x) + 7 + Math.sin(t * 1.3) * 1.5;
    if (x === ICX - hw - 18) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  hits.island = { x: ICX - hw, y: 564 + DY, w: hw * 2 + 10, h: seaL - 560 - DY };

  // front waves
  wave(612 + tideOff, 5, 0.019, 1.3, 3.1, mix(sea1, sea2, 0.25));
  wave(672 + tideOff, 7, 0.016, 1.45, 4.2, mix(sea1, sea2, 0.45));
  wave(750 + tideOff, 9, 0.013, 1.6, 5.3, mix(sea1, sea2, 0.7));

  // rain
  if (m.rainAmt > 0.01) {
    const n = Math.round(S.rain.length * m.rainAmt);
    const sl = clamp(wind / 90, 0, 0.5) * wsign;
    ctx.strokeStyle = gl > 0.9 ? rgb([210, 225, 240], 0.5) : rgb([225, 238, 245], 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = S.rain[i];
      d.y += d.v * dt;
      d.x += (sl * d.v * dt) / W * 0.6;
      if (d.y > H) {
        d.y = -20;
        d.x = Math.random() * 1.2 - 0.1;
      }
      const px = ((((d.x + 0.1) % 1.2) + 1.2) % 1.2 - 0.1) * W;
      ctx.moveTo(px, d.y);
      ctx.lineTo(px - sl * d.l, d.y - d.l);
    }
    ctx.stroke();
  }
  if (m.flash) {
    S.flashT -= dt;
    if (S.flashT <= 0) {
      S.flash = 1;
      S.flashT = 3.5 + Math.random() * 4;
      S.re = 0.16;
      let bx = W * (0.2 + Math.random() * 0.6);
      let by = 110;
      const pts: number[][] = [[bx, by]];
      while (by < HZ) {
        by += 30 + Math.random() * 30;
        bx += (Math.random() - 0.5) * 40;
        pts.push([bx, Math.min(by, HZ)]);
      }
      S.bolt = pts;
    }
    if (S.re > 0) {
      S.re -= dt;
      if (S.re <= 0) S.flash = 0.8;
    }
    if (S.flash > 0) {
      if (S.bolt && S.flash > 0.35) {
        ctx.strokeStyle = rgb([255, 255, 240], S.flash);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let j = 0; j < S.bolt.length; j++) (j ? ctx.lineTo : ctx.moveTo)(S.bolt[j][0], S.bolt[j][1]);
        ctx.stroke();
      }
      ctx.fillStyle = rgb([230, 236, 255], S.flash * 0.4);
      ctx.fillRect(0, 0, W, H);
      S.flash = Math.max(0, S.flash - dt * 3.2);
    }
  }
  if (S.ripples.length) {
    S.ripples = S.ripples.filter((rp) => (rp.a += dt || 0.016) < 0.7);
    for (let i = 0; i < S.ripples.length; i++) {
      const rp = S.ripples[i];
      const rr = 8 + rp.a * 100;
      ctx.strokeStyle = rgb(WHITE, (1 - rp.a / 0.7) * 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rr, rp.sea ? rr * 0.3 : rr, 0, 0, TAU);
      ctx.stroke();
    }
  }
  S.hits = hits;
  S.cap = ctx.lineCap;
}

/** `tick()` — ease weather toward the displayed hour, ease the hour toward the scrubber, paint. */
export function tick(ctx: Ctx2D, S: SimState, I: SceneInput, offset: number, rawDt: number, W: number, H: number, signFont: SkFont | null) {
  'worklet';
  const dt = Math.min(0.05, rawDt);
  if (I.animate) S.t += dt;
  let m0: { gloom: number; rainAmt: number; wind: number; cloudN: number; deg: number; flash: boolean };
  if (I.live && I.hrs.length) {
    const hD = S.hDisp ?? I.hour0 + offset;
    const x = wxAt(I.hrs, hD);
    // Near now, the minute forecast (if any) wins, fading to the hourly data an hour out.
    const nw = I.now ? Math.max(0, Math.min(1, 1 - Math.abs(hD - I.hour0))) : 0;
    const rainAmt = I.now ? x.rainAmt + (I.now.rainAmt - x.rainAmt) * nw : x.rainAmt;
    const gloom = I.now ? x.gloom + (I.now.gloom - x.gloom) * nw : x.gloom;
    m0 = { gloom, rainAmt, wind: x.wind, cloudN: x.cloudN, deg: x.deg, flash: x.flash };
  } else {
    m0 = { gloom: I.gloom, rainAmt: I.rainAmt, wind: I.wind, cloudN: I.cloudN, deg: I.deg, flash: I.flash };
  }
  if (!S.sm) S.sm = { gloom: m0.gloom, rain: m0.rainAmt, wind: m0.wind, cn: m0.cloudN };
  const sm = S.sm;
  const kk = Math.min(1, (dt || 0) * 1.6);
  sm.gloom += (m0.gloom - sm.gloom) * kk;
  sm.rain += (m0.rainAmt - sm.rain) * kk;
  sm.wind += (m0.wind - sm.wind) * kk;
  sm.cn += (m0.cloudN - sm.cn) * kk;
  const m: FrameMood = {
    live: I.live && I.hrs.length > 0,
    hrs: I.hrs,
    hour: I.hour0,
    gloom: sm.gloom,
    rainAmt: sm.rain,
    wind: sm.wind,
    cloudN: sm.cn,
    deg: m0.deg,
    flash: m0.flash,
  };
  const target = I.hour0 + offset;
  if (S.hDisp == null || Math.abs(S.hDisp - target) > 30) S.hDisp = target;
  S.hDisp += (target - S.hDisp) * Math.min(1, (dt || 0) * 7);
  paint(ctx, S, I, W, H, I.animate ? dt : 0, m, S.hDisp, dt, signFont);
}

export type SceneKind = 'dhoni' | 'island' | 'palm' | 'sun' | 'moon' | 'cloud' | 'sea' | 'sky';

/** `onSceneClick` hit order. `cloud`/`sky` are resolved to rain/sky by the caller. */
export function hitTest(H: Hits | null, x: number, y: number): SceneKind {
  'worklet';
  const inB = (b: Box | null) => !!b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
  if (!H) return y > HZ ? 'sea' : 'sky';
  if (inB(H.dhoni)) return 'dhoni';
  if (inB(H.sign)) return 'island';
  for (let i = 0; i < H.palms.length; i++) if (inB(H.palms[i])) return 'palm';
  if (H.sun && Math.hypot(x - H.sun.x, y - H.sun.y) < H.sun.r) return 'sun';
  if (H.moon && Math.hypot(x - H.moon.x, y - H.moon.y) < H.moon.r) return 'moon';
  if (inB(H.island)) return 'island';
  for (let i = 0; i < H.clouds.length; i++) if (inB(H.clouds[i])) return 'cloud';
  if (y > HZ) return 'sea';
  return 'sky';
}

