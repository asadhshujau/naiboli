import { md24 } from './time';
import type { Sun, Weather } from './types';

/** Prototype defaults (Malé, early November) until weather provides real times. */
export const DEFAULT_SUN: Sun = { rise: 5 + 50 / 60, set: 17 + 49 / 60 };

export interface SunState {
  day: boolean;
  /** 0→1 progress through the day (or night) */
  f: number;
  /** elevation proxy, −1…1 */
  el: number;
}

export function sunState(h: number, sun: Sun): SunState {
  'worklet';
  h = md24(h);
  const RISE = sun.rise;
  const SET = sun.set;
  if (h >= RISE && h <= SET) {
    const f = (h - RISE) / (SET - RISE);
    return { day: true, f, el: Math.sin(Math.PI * f) };
  }
  const len = 24 - (SET - RISE);
  const fn = md24(h - SET) / len;
  return { day: false, f: fn, el: -Math.sin(Math.PI * fn) };
}

/** Today's sunrise/sunset from the daily forecast (`liveMood` side effect in the prototype). */
export function sunOf(W: Weather, fallback: Sun = DEFAULT_SUN): Sun {
  const D = W.days.find((x) => x.h >= 0 && x.h < 24) || W.days[0];
  if (D && D.rise != null) return { rise: md24(D.rise), set: md24(D.set) };
  return fallback;
}
