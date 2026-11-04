import { clamp, fmt, fmtLvl, hOfUnix, TZ } from './time';
import type { ApiTideResponse, Entry, Tide, TideExtreme } from './types';

/** Synthetic semi-diurnal tide used until (or instead of) the live feed. */
export function tideSyn(h: number): number {
  'worklet';
  return 0.09 + 0.36 * Math.cos((2 * Math.PI * (h - 1)) / 12.42);
}

/** Level at hour `h`, linear between 10-minute samples; synthetic when `T` is null. */
export function tideAt(h: number, T: { v: number[] } | null): number {
  'worklet';
  if (!T) return tideSyn(h);
  const v = T.v;
  const i = h * 6;
  const n = v.length;
  if (i <= 0) return v[0];
  if (i >= n - 1) return v[n - 1];
  const k = Math.floor(i);
  const f = i - k;
  return v[k] + (v[k + 1] - v[k]) * f;
}

/** `procTide()` — per-minute rows → 10-minute samples for 48 h from local midnight + local extrema. */
export function procTide(j: ApiTideResponse | null | undefined, day0: number): Tide | null {
  if (!j) return null;
  const a = j.data;
  if (!Array.isArray(a) || a.length < 120) return null;
  // `time_utc_plus5` is local wall-clock time tagged "Z", so parse as UTC then shift back by TZ.
  const t0 = Date.parse(a[0].time_utc_plus5) / 1000 - TZ;
  if (isNaN(t0)) return null;
  const startH = hOfUnix(t0, day0);
  const N = 48 * 6 + 1;
  // Float32 like the prototype's Float32Array, so levels/extrema match bit-for-bit.
  const v: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const idx = clamp(Math.round((i / 6 - startH) * 60), 0, a.length - 1);
    v[i] = Math.fround(a[idx].tide_m);
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  const ex: TideExtreme[] = [];
  for (let i = 1; i < N - 1; i++) {
    if (v[i] > v[i - 1] && v[i] >= v[i + 1]) ex.push({ h: i / 6, high: true, lvl: v[i] });
    else if (v[i] < v[i - 1] && v[i] <= v[i + 1]) ex.push({ h: i / 6, high: false, lvl: v[i] });
  }
  return {
    v,
    lo,
    hi: hi - lo < 0.05 ? lo + 0.05 : hi,
    ex,
    src: j.source_island_name || '',
    km: parseFloat(String(j.distance_km)) || 0,
    same: j.source_island_id === j.island_id,
  };
}

/** Highs/lows; synthetic ones every 6.21 h when there's no feed. */
export function extrema(T: Tide | null): TideExtreme[] {
  if (T) return T.ex;
  const ex: TideExtreme[] = [];
  for (let k = -4; k < 12; k++) {
    const h = 1 + k * 6.21;
    ex.push({ h, high: ((k % 2) + 2) % 2 === 0, lvl: tideSyn(h) });
  }
  return ex;
}

export interface TideView {
  level: number;
  /** 0–1 normalised level */
  n: number;
  rising: boolean;
  levelText: string;
  dirText: 'Rising' | 'Falling';
  until: string;
  /** "4:12 PM · +0.41 m" */
  nh: string;
  nl: string;
}

export function tideView(h: number, T: Tide | null): TideView {
  const level = tideAt(h, T);
  const rising = tideAt(h + 0.05, T) > tideAt(h - 0.05, T);
  const next = extrema(T).filter((e) => e.h > h + 0.01);
  const nh = next.find((e) => e.high);
  const nl = next.find((e) => !e.high);
  const lo = T ? T.lo : -0.27;
  const hi = T ? T.hi : 0.45;
  const n = clamp((level - lo) / (hi - lo), 0, 1);
  const f = (e: TideExtreme | undefined) => (e ? `${fmt(e.h)} · ${fmtLvl(e.lvl)} m` : 'Beyond the forecast');
  return {
    level,
    n,
    rising,
    levelText: fmtLvl(level),
    dirText: rising ? 'Rising' : 'Falling',
    until: next[0] ? fmt(next[0].h) : 'later',
    nh: f(nh),
    nl: f(nl),
  };
}

/** Scene water level target (−.27….45 range) — `lvT` in `paint()`. */
export function sceneTideLevel(h: number, T: Pick<Tide, 'v' | 'lo' | 'hi'> | null): number {
  'worklet';
  return T ? -0.27 + (0.72 * (tideAt(h, T) - T.lo)) / (T.hi - T.lo) : tideAt(h, null);
}

/** Footer line under the tide hero. */
export function tideSrc(T: Entry<Tide> | undefined): string {
  if (!T || T === 'loading') return 'Loading tide feed…';
  if (T === 'err' || !T.v) return 'Tide feed unavailable. Showing a typical cycle.';
  return T.same || !T.km
    ? `Predicted for ${T.src}`
    : `Estimated from ${T.src}, ${T.km < 10 ? T.km.toFixed(1) : Math.round(T.km)} km away`;
}
