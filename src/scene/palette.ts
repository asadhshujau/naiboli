/** Scene palettes, object colours and the light model (`PAL`, `OBJ`, `lightOf` in the prototype). */
import { sunState } from '@/data/sun';
import type { Sun } from '@/data/types';

export type RGB = [number, number, number];

export interface Palette {
  sky: [RGB, RGB, RGB];
  sea: [RGB, RGB, RGB];
  lagoon: RGB;
  cloud: RGB;
}

export function hex(h: string): RGB {
  'worklet';
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: RGB, b: RGB, k: number): RGB {
  'worklet';
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Relative luminance 0–1 (prototype `lum`). */
export function lum(c: RGB): number {
  'worklet';
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

const P = (o: { sky: [string, string, string]; sea: [string, string, string]; lagoon: string; cloud: string }): Palette => ({
  sky: [hex(o.sky[0]), hex(o.sky[1]), hex(o.sky[2])],
  sea: [hex(o.sea[0]), hex(o.sea[1]), hex(o.sea[2])],
  lagoon: hex(o.lagoon),
  cloud: hex(o.cloud),
});

export const PAL = {
  night: P({ sky: ['#081333', '#14265A', '#2D4985'], sea: ['#1E4675', '#153662', '#0B2147'], lagoon: '#2F6C93', cloud: '#2A3E73' }),
  golden: P({ sky: ['#3E4B9C', '#BA70A0', '#FFC68A'], sea: ['#E7A58E', '#4A86AE', '#1B4E79'], lagoon: '#F3C7B0', cloud: '#F6B2A4' }),
  day: P({ sky: ['#2EA8EC', '#74CEF4', '#CDF2F3'], sea: ['#3ED8CB', '#15B0B7', '#08809A'], lagoon: '#8FEFE1', cloud: '#FFFFFF' }),
  over: P({ sky: ['#899FAD', '#AEBFC8', '#D7E0E2'], sea: ['#7DB5B5', '#52969E', '#2F6B78'], lagoon: '#B9DBD7', cloud: '#C7D1D6' }),
  storm: P({ sky: ['#1D2636', '#333D50', '#525D6E'], sea: ['#38606A', '#25484F', '#14303A'], lagoon: '#5D8483', cloud: '#3A4556' }),
};

export function lerpPal(a: Palette, b: Palette, k: number): Palette {
  'worklet';
  return {
    sky: [mix(a.sky[0], b.sky[0], k), mix(a.sky[1], b.sky[1], k), mix(a.sky[2], b.sky[2], k)],
    sea: [mix(a.sea[0], b.sea[0], k), mix(a.sea[1], b.sea[1], k), mix(a.sea[2], b.sea[2], k)],
    lagoon: mix(a.lagoon, b.lagoon, k),
    cloud: mix(a.cloud, b.cloud, k),
  };
}

const OBJ_HEX = {
  sand: '#FBEBC4', sandLo: '#E9C88E', bush: '#2E9A63', bushHi: '#45B97A', trunk: '#A9774A', trunkSh: '#7F5532', ring: '#6A4529',
  frond: '#2FA36B', frondDk: '#1D7A51', frondHi: '#55C786', spine: '#17603F', nut: '#6E4A2A', hull: '#6B4428', hullHi: '#8E5E38',
  sail: '#FFF6E6', far: '#2D7B66', farSand: '#E9D6A8', bird: '#1E3A4A', sign: '#D2A167', signDk: '#8A5A30', signInk: '#4A2C12',
};
export type ObjKey = keyof typeof OBJ_HEX;
export type ObjColors = Record<ObjKey, RGB>;
export const OBJC = Object.fromEntries(Object.entries(OBJ_HEX).map(([k, v]) => [k, hex(v)])) as ObjColors;
export const OBJ_KEYS = Object.keys(OBJ_HEX) as ObjKey[];

export const NIGHT_T = hex('#0E1C3D');
export const GOLD_T = hex('#FF8F5A');
export const GREY_T = hex('#5E6B73');

export interface Light {
  day: boolean;
  f: number;
  el: number;
  /** night / golden / daylight weights */
  N: number;
  G: number;
  D: number;
  pal: Palette;
}

export function lightOf(h: number, gloom: number, sun: Sun): Light {
  'worklet';
  const s = sunState(h, sun);
  let N = 0;
  let G = 0;
  let D = 0;
  let base: Palette;
  if (s.el >= 0.3) {
    D = 1;
    base = PAL.day;
  } else if (s.el >= 0.05) {
    D = (s.el - 0.05) / 0.25;
    G = 1 - D;
    base = lerpPal(PAL.golden, PAL.day, D);
  } else if (s.el >= -0.12) {
    G = (s.el + 0.12) / 0.17;
    N = 1 - G;
    base = lerpPal(PAL.night, PAL.golden, G);
  } else {
    N = 1;
    base = PAL.night;
  }
  let tgt = gloom >= 0.6 ? lerpPal(PAL.over, PAL.storm, (gloom - 0.6) / 0.4) : PAL.over;
  if (N > 0) tgt = lerpPal(tgt, PAL.night, N * 0.6);
  const pal = lerpPal(base, tgt, gloom * (0.9 - 0.45 * N));
  return { day: s.day, f: s.f, el: s.el, N, G, D, pal };
}
