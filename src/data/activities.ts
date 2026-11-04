import type { Mood } from './mood';
import { sunState } from './sun';
import { tideAt } from './tide';
import { capF, clamp, fmt, hOfUnix, md24 } from './time';
import type { ActEntry, ActItem, Acts, ApiActivityScoresResponse, ApiScoreEntry, Factor, Sun, Tide, WxSample } from './types';
import { REC, vKey, type VerdictKey } from './verdict';
import { isThunder, isWet, sample } from './weather';

export type ActKeyCond = 'wind' | 'tide' | 'vis' | 'rain' | 'cloud' | 'uv';

export interface ActDef {
  id: string;
  name: string;
  icon: string;
  /** which condition phrase describes it */
  key: ActKeyCond;
  /** hour of best conditions (sample moods only) */
  peak: number;
  /** fine after dark */
  night?: boolean;
  tip: string;
}

/** The 14 built-in activities (prototype `ACTS`). Order matters: sample-mood score arrays index into it. */
export const ACTS: ActDef[] = [
  { id: 'surf', name: 'Surfing', icon: 'surfing', key: 'wind', peak: 7, tip: 'Reef breaks are shallow. Wear booties and know your channel out.' },
  { id: 'sail', name: 'Sailing', icon: 'sailing', key: 'wind', peak: 14, tip: 'Watch the horizon for squalls and tell someone your route.' },
  { id: 'jet', name: 'Jet Skiing', icon: 'speed', key: 'wind', peak: 10, tip: 'Keep well clear of swimmers and snorkel spots. Life vest on.' },
  { id: 'swim', name: 'Swimming', icon: 'pool', key: 'tide', peak: 10, tip: 'Currents run hard near channels. Swim where others can see you.' },
  { id: 'snorkel', name: 'Snorkeling', icon: 'scuba_diving', key: 'vis', peak: 10, tip: 'Never snorkel alone, and never stand on coral.' },
  { id: 'dive', name: 'Diving', icon: 'scuba_diving', key: 'vis', peak: 9, tip: 'Dive with a certified buddy and plan around channel currents.' },
  { id: 'fish', name: 'Fishing', icon: 'phishing', key: 'tide', peak: 6, night: true, tip: 'Mind the reef edge at low tide. Bring a torch after dark.' },
  { id: 'dolphin', name: 'Dolphin Watching', icon: 'visibility', key: 'wind', peak: 17, tip: 'Keep your distance and let the dolphins come to you.' },
  { id: 'rainwalk', name: 'Rain Walk', icon: 'umbrella', key: 'rain', peak: 16, night: true, tip: 'Head indoors at the first rumble of thunder.' },
  { id: 'ocswim', name: 'Overcast Swimming', icon: 'cloud', key: 'cloud', peak: 15, tip: 'Clouds don’t block all UV. Sunscreen still.' },
  { id: 'kayak', name: 'Kayaking', icon: 'kayaking', key: 'wind', peak: 8, tip: 'Paddle out into the wind so it carries you home.' },
  { id: 'beach', name: 'Beach Leisure', icon: 'beach_access', key: 'uv', peak: 16, night: true, tip: 'Find shade from 11 to 3 and drink more water than you think.' },
  { id: 'sup', name: 'Paddleboarding', icon: 'rowing', key: 'wind', peak: 8, tip: 'Leash on. Offshore wind can carry you out fast.' },
  { id: 'sandbank', name: 'Sandbank Visit', icon: 'footprint', key: 'tide', peak: 11, tip: 'Check the tide first. Sandbanks shrink fast at high water.' },
];

export const SAIL_INDEX = 1;

/** Normalised route activity id → built-in id. */
export const ACT_ALIAS: Record<string, string> = {
  surfing: 'surf', surf: 'surf', sailing: 'sail', jetskiing: 'jet', jetski: 'jet', swimming: 'swim', snorkeling: 'snorkel', snorkelling: 'snorkel',
  diving: 'dive', scubadiving: 'dive', fishing: 'fish', dolphinwatching: 'dolphin', dolphins: 'dolphin', rainwalk: 'rainwalk', rainwalking: 'rainwalk',
  overcastswimming: 'ocswim', kayaking: 'kayak', beachleisure: 'beach', beach: 'beach', sunbathing: 'beach', paddleboarding: 'sup',
  standuppaddleboarding: 'sup', sup: 'sup', sandbankvisit: 'sandbank', sandbank: 'sandbank', sandbanking: 'sandbank', sandbankvisiting: 'sandbank',
};

/** Icon for an activity id we don't know. */
export function actIcon(n: string): string {
  return /snork|div/.test(n)
    ? 'scuba_diving'
    : /fish/.test(n)
      ? 'phishing'
      : /sail|boat|cruise/.test(n)
        ? 'sailing'
        : /kite/.test(n)
          ? 'kitesurfing'
          : /surf/.test(n)
            ? 'surfing'
            : /kayak|canoe/.test(n)
              ? 'kayaking'
              : /walk|hike/.test(n)
                ? 'directions_walk'
                : /beach|sun/.test(n)
                  ? 'beach_access'
                  : 'waves';
}

export const UNKNOWN_ACT_TIP = 'Check the spot with locals before you head out.';

/** [factor, label, icon] in display order. */
export const FACTORS: [Factor, string, string][] = [
  ['wind', 'Wind', 'air'],
  ['rain', 'Rain', 'rainy'],
  ['temp', 'Heat', 'thermostat'],
  ['uv', 'UV', 'wb_sunny'],
  ['visibility', 'Visibility', 'visibility'],
  ['tide', 'Tide', 'waves'],
  ['daylight', 'Daylight', 'light_mode'],
];

export const FWORD: Record<string, string> = { wind: 'wind', rain: 'rain', uv: 'strong sun', visibility: 'haze', tide: 'tide', temp: 'heat', daylight: 'daylight' };

export const FTIP: Record<string, string> = {
  uv: 'Strong sun. Rash guard, hat and reef-safe sunscreen.',
  rain: 'Showers about. Keep an eye on the sky and have a plan B.',
  wind: 'Wind is the deciding factor. Stay inside the lagoon if it picks up.',
  visibility: 'Hazy out there. Stay close to shore and to your buddy.',
  tide: 'Tide timing matters here. Check the tide before you head out.',
  temp: 'It’s a hot one. Go early or late and drink lots of water.',
};

// ───────────────────────── Route parsing ─────────────────────────

const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function P(x: ApiScoreEntry): ActEntry {
  return {
    s: clamp(+(x.overall_score ?? 0) || 0, 0, 10),
    c: x.conditions_score != null ? +x.conditions_score : null,
    rec: x.recommendation || '',
    br: x.breakdown || {},
    lim: Array.isArray(x.limiting_factors) ? x.limiting_factors : [],
    tideOk: x.tide_available !== false,
  };
}

/** `procActs()` — activity-scores payload → list keyed by normalised id. Null if unusable. */
export function procActs(j: ApiActivityScoresResponse | null | undefined, day0: number, nowMs: number): Acts | null {
  if (!j || !Array.isArray(j.scores)) return null;
  const dayOf = (ds: string) => {
    const u = Date.parse(ds + 'T12:00:00+05:00') / 1000;
    return isNaN(u) ? null : Math.floor(hOfUnix(u, day0) / 24);
  };
  const seen: Record<string, boolean> = {};
  const list: ActItem[] = j.scores
    .filter((x) => x && x.activity)
    .map((x) => {
      const n = norm(x.activity);
      const id = ACT_ALIAS[n] || ACT_ALIAS[norm(x.label)] || 'x' + n;
      return {
        id,
        label: x.label || capF(String(x.activity).replace(/_/g, ' ')),
        now: P(x),
        hours: (x.hours || [])
          .filter((y) => y && y.dt)
          .map((y) => ({ ...P(y), h: hOfUnix(y.dt, day0) }))
          .sort((a, b) => a.h - b.h),
        days: (x.days || [])
          .map((y) => ({ ...P(y), di: dayOf(y.date) }))
          .filter((y): y is ActEntry & { di: number } => y.di != null),
      };
    })
    .filter((x) => !seen[x.id] && (seen[x.id] = true));
  if (!list.length) return null;
  return { list, byId: Object.fromEntries(list.map((x) => [x.id, x])), at: hOfUnix(nowMs / 1000, day0), fetched: nowMs };
}

/** Route entry for hour `h`: `now` for the fetch hour, else the hourly entry, else null (beyond range). */
export function apiAt(AD: Acts, x: ActItem, h: number): ActEntry | null {
  if (Math.floor(h + 1e-6) === Math.floor(AD.at)) return x.now;
  const H = x.hours;
  if (!H.length) return null;
  const i = Math.floor(h - H[0].h + 1e-6);
  return i < 0 ? x.now : i < H.length ? H[i] : null;
}

export interface ActDefLive extends Omit<ActDef, 'peak'> {
  peak?: number;
  /** index into ACTS, −1 for route-only activities */
  i: number;
  api: ActItem | null;
}

/** Activities to show: the route's list once loaded, else the 14 built-ins. */
export function actDefs(AD: Acts | null): ActDefLive[] {
  if (!AD) return ACTS.map((a, i) => ({ ...a, i, api: null }));
  return AD.list.map((x) => {
    const i = ACTS.findIndex((a) => a.id === x.id);
    return i >= 0
      ? { ...ACTS[i], i, api: x }
      : { id: x.id, name: x.label, icon: actIcon(x.id), key: 'wind' as const, tip: UNKNOWN_ACT_TIP, i: -1, api: x };
  });
}

// ───────────────────────── Fallback scoring ─────────────────────────

/** `liveScore()` — local estimate from live weather + tide. */
export function liveScore(hrs: WxSample[], i: number, h: number, sun: Sun, T: Tide | null): number {
  const s = sample(hrs, h);
  const a = ACTS[i];
  const el = sunState(h, sun).el;
  const w = s.wind;
  const pop = s.pop / 100;
  const cl = s.clouds / 100;
  const th = isThunder(s.id);
  const wet = isWet(s.id);
  const lo = T ? T.lo : -0.27;
  const hi = T ? T.hi : 0.45;
  const tn = clamp((tideAt(h, T) - lo) / (hi - lo), 0, 1);
  const rate = (Math.abs(tideAt(h + 0.25, T) - tideAt(h - 0.25, T)) * 2) / Math.max(0.1, hi - lo);
  const bell = (x: number, c: number, d: number) => Math.exp(-((x - c) / d) * ((x - c) / d));
  const calm = clamp(1 - w / 28, 0, 1);
  const dry = clamp(1 - pop * 0.7 - (wet ? 0.3 : 0), 0, 1);
  const vis = clamp(s.vis / 10, 0, 1);
  const F: Record<string, () => number> = {
    surf: () => 2 + 7.5 * bell(w, 30, 13),
    sail: () => 1.5 + 8 * bell(w, 20, 10) * (1 - pop * 0.4),
    jet: () => 1.5 + 8 * calm * dry,
    swim: () => 2 + 5.5 * calm * dry + 2 * tn,
    snorkel: () => 1 + 6.5 * calm * dry * vis + 2 * (1 - cl),
    dive: () => 1.5 + 7.5 * clamp(1 - w / 35, 0, 1) * vis * (1 - pop * 0.4),
    fish: () => 2.5 + 5 * clamp(rate / 0.2, 0, 1) + 2 * calm * dry,
    dolphin: () => 1.5 + 6 * calm * dry + 2 * bell(md24(h), 17, 2.5),
    rainwalk: () => 1 + 8.5 * Math.max(pop, wet ? 0.8 : 0),
    ocswim: () => 1.5 + 6 * clamp((cl - 0.4) / 0.5, 0, 1) * dry + 2 * calm,
    kayak: () => 1.5 + 8 * clamp(1 - w / 22, 0, 1) * dry,
    beach: () => 2 + 6 * dry + 1.8 * (1 - clamp(s.uvi / 11, 0, 1)),
    sup: () => 1.5 + 8 * clamp(1 - w / 18, 0, 1) * dry,
    sandbank: () => 1.5 + 5.5 * (1 - tn) + 2.5 * calm * dry,
  };
  let v = (F[a.id] || (() => 5))();
  if (!a.night && el < -0.05) v -= 4;
  if (th) v = a.id === 'rainwalk' ? 1 : Math.min(v, 2);
  return clamp(v, 0.3, 9.9);
}

/** Sample-mood score: base score shaped by time of day and darkness. */
export function sampleScore(scores: number[], moodHour: number, i: number, h: number, sun: Sun): number {
  const a = ACTS[i];
  const base = scores[i];
  const shape = 1.3 * (Math.cos(((md24(h) - a.peak) / 12) * Math.PI) - Math.cos(((md24(moodHour) - a.peak) / 12) * Math.PI));
  const dl = (x: number) => (sunState(x, sun).el > -0.05 ? 1 : 0);
  const night = a.night ? 0 : (dl(h) - dl(moodHour)) * 3.6;
  return clamp(base + shape + night, 0.3, 9.9);
}

export type Scorer = (i: number, h: number) => number;

/**
 * `scoreAt()` with the prototype's live-score cache: results are memoised per activity and
 * quarter hour (first value computed in a bucket wins), and the cache lives as long as this
 * scorer — create a new one when weather or tide changes.
 */
export function makeScorer(m: Mood, sun: Sun, T: Tide | null): Scorer {
  if (!m.live) return (i, h) => sampleScore(m.scores, m.hour, i, h, sun);
  const cache = new Map<number, number>();
  const hrs = m.W.hrs;
  return (i, h) => {
    const ck = i * 100000 + Math.round(h * 4);
    const hit = cache.get(ck);
    if (hit != null) return hit;
    const v = liveScore(hrs, i, h, sun, T);
    cache.set(ck, v);
    return v;
  };
}

export interface ActAt {
  s: number;
  k: VerdictKey;
  /** route entry, or null when using the local estimate */
  e: ActEntry | null;
}

/** `actAt()` — route entry for the hour if any, else local estimate (unknown activities score 5). */
export function actAt(AD: Acts | null, a: ActDefLive, h: number, score: Scorer): ActAt {
  const e = a.api && AD ? apiAt(AD, a.api, h) : null;
  if (e) return { s: e.s, k: REC[e.rec] || vKey(e.s), e };
  const s = a.i >= 0 ? score(a.i, h) : 5;
  return { s, k: vKey(s), e: null };
}

export interface ActWindow {
  hrs: { h: number; s: number; k: VerdictKey }[];
  text: string;
}

/** `windowOf()` — best stretch in the next 24 h: within 0.6 of the peak, contiguous. */
export function windowOf(at: (h: number) => { s: number; k: VerdictKey }, h0: number): ActWindow {
  const hrs: ActWindow['hrs'] = [];
  for (let o = 0; o < 24; o++) {
    const r = at(h0 + o);
    hrs.push({ h: h0 + o, s: r.s, k: r.k });
  }
  const mx = Math.max(...hrs.map((x) => x.s));
  if (mx < 5) return { hrs, text: 'No great window today' };
  const k = hrs.findIndex((x) => x.s === mx);
  let a = k;
  let b = k;
  while (a > 0 && hrs[a - 1].s >= mx - 0.6) a--;
  while (b < hrs.length - 1 && hrs[b + 1].s >= mx - 0.6) b++;
  const t = `${fmt(Math.floor(hrs[a].h)).replace(':00', '')}–${fmt(Math.floor(hrs[b].h) + 1).replace(':00', '')}`;
  return { hrs, text: Math.floor(hrs[a].h / 24) > Math.floor(h0 / 24) ? `Tomorrow ${t}` : t };
}
