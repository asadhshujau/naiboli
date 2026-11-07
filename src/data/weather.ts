import { sunState } from './sun';
import { clamp, dateOf, dayLabel, dirOf, fmt, hOfUnix, md24, TAU } from './time';
import type { ApiWeatherResponse, ApiWxPoint, MoonData, Sun, Weather, WxAlert, WxDay, WxSample } from './types';

// ───────────────────────── Condition ids ─────────────────────────

export function isThunder(id: number): boolean {
  'worklet';
  return id >= 200 && id < 300;
}
export function isWet(id: number): boolean {
  'worklet';
  return id >= 200 && id < 600;
}

export function owmIcon(id: number, day: boolean): string {
  return isThunder(id)
    ? 'thunderstorm'
    : isWet(id)
      ? 'rainy'
      : id >= 600 && id < 700
        ? 'weather_snowy'
        : id >= 700 && id < 800
          ? 'foggy'
          : id === 800
            ? day
              ? 'sunny'
              : 'bedtime'
            : id <= 802
              ? day
                ? 'partly_cloudy_day'
                : 'partly_cloudy_night'
              : 'cloud';
}

export function owmCond(id: number, day: boolean): string {
  return isThunder(id)
    ? 'Thunderstorms'
    : id >= 300 && id < 400
      ? 'Drizzle'
      : id === 500
        ? 'Light rain'
        : id === 501
          ? 'Rain'
          : id >= 502 && id < 520
            ? 'Heavy rain'
            : id >= 520 && id < 600
              ? 'Showers'
              : id >= 700 && id < 800
                ? 'Hazy'
                : id === 800
                  ? day
                    ? 'Sunny'
                    : 'Clear'
                  : id === 801
                    ? day
                      ? 'Mostly sunny'
                      : 'Mostly clear'
                    : id === 802
                      ? 'Partly cloudy'
                      : id === 803
                        ? 'Mostly cloudy'
                        : 'Overcast';
}

// ───────────────────────── Scene drivers ─────────────────────────

/**
 * Rain amount (mm/h) → scene rain 0.2–1. Steep at the low end, where Maldivian rain usually sits, so a
 * 0.2 mm/h drizzle and a 1.2 mm/h shower look different: 0.1 → 0.31, 0.5 → 0.45, 1 → 0.56, 2.5 → 0.77, 5+ → 1.
 */
export function rainAmtOfMm(mm: number): number {
  'worklet';
  return 0.2 + 0.8 * Math.sqrt(clamp(mm / 5, 0, 1));
}

export function rainAmtOf(s: { id: number; mm: number }): number {
  'worklet';
  return isThunder(s.id)
    ? 1
    : !isWet(s.id)
      ? 0
      : s.mm
        ? rainAmtOfMm(s.mm)
        : s.id < 400
          ? 0.25
          : s.id === 500
            ? 0.35
            : s.id === 501
              ? 0.6
              : s.id < 520
                ? 0.9
                : 0.55;
}

export function gloomOf(s: { clouds: number; id: number; mm: number }): number {
  'worklet';
  return clamp(
    Math.pow(s.clouds / 100, 1.6) * 0.64 +
      (isWet(s.id) ? 0.12 + rainAmtOf(s) * 0.14 : 0) +
      (isThunder(s.id) ? 0.3 : 0),
    0,
    1,
  );
}

export function cloudNOf(c: number): number {
  'worklet';
  return c <= 3 ? c / 3 : clamp(1 + (c / 100) * 8, 0, 9);
}

// ───────────────────────── Parsing ─────────────────────────

function S(x: ApiWxPoint, h: number): WxSample {
  const w = (x.weather && x.weather[0]) || {};
  return {
    h,
    temp: x.temp,
    feels: x.feels_like ?? x.temp,
    hum: x.humidity ?? 70,
    clouds: x.clouds ?? 0,
    vis: (x.visibility ?? 10000) / 1000,
    wind: (x.wind_speed ?? 0) * 3.6,
    gust: (x.wind_gust ?? x.wind_speed ?? 0) * 3.6,
    deg: x.wind_deg ?? 0,
    uvi: x.uvi ?? 0,
    pop: (x.pop ?? 0) * 100,
    id: w.id ?? 800,
    mm: (x.rain && x.rain['1h']) || 0,
  };
}

/** `procWx()` — One Call payload → hour-axis samples. `hrs[0]` is "current". */
export function procWx(j: ApiWeatherResponse | null | undefined, day0: number, nowMs: number): Weather | null {
  const d = j && j.data;
  if (!d || !d.current || !Array.isArray(d.hourly)) return null;
  const cur = S(d.current, hOfUnix(d.current.dt, day0));
  cur.pop = ((d.hourly[0] && d.hourly[0].pop) || 0) * 100;
  const hrs = [cur].concat(d.hourly.map((x) => S(x, hOfUnix(x.dt, day0))).filter((s) => s.h > cur.h + 0.05));
  const days: WxDay[] = (d.daily || []).map((x) => ({
    h: hOfUnix(x.dt, day0),
    rise: hOfUnix(x.sunrise, day0),
    set: hOfUnix(x.sunset, day0),
    lo: x.temp && x.temp.min,
    hi: x.temp && x.temp.max,
    uvi: x.uvi,
    id: (x.weather && x.weather[0] && x.weather[0].id) ?? 800,
    pop: (x.pop ?? 0) * 100,
    wind: (x.wind_speed ?? 0) * 3.6,
    clouds: x.clouds ?? 0,
    mr: x.moonrise ? hOfUnix(x.moonrise, day0) : null,
    ms: x.moonset ? hOfUnix(x.moonset, day0) : null,
    mp: x.moon_phase ?? null,
    mm: typeof x.rain === 'number' && isFinite(x.rain) ? x.rain : null,
  }));
  const at = Date.parse(j.observed_at || j.updated_at || '') / 1000;
  return { hrs, days, moon: moonOf(days), at: isNaN(at) ? null : hOfUnix(at, day0), fetched: nowMs, min: minutesOf(d.minutely, day0), alerts: alertsOf(d.alerts, day0) };
}

/** The optional `alerts` block → hour-axis alerts, or `null` when there are none usable. */
function alertsOf(a: unknown, day0: number): WxAlert[] | null {
  if (!Array.isArray(a)) return null;
  const out = a
    .filter((x) => x && typeof x.start === 'number' && typeof x.end === 'number' && x.end > x.start)
    .map((x) => ({
      start: hOfUnix(x.start, day0),
      end: hOfUnix(x.end, day0),
      event: typeof x.event === 'string' ? x.event.trim() : '',
      desc: typeof x.description === 'string' ? x.description.trim().replace(/\s+/g, ' ') : '',
      sender: typeof x.sender_name === 'string' ? x.sender_name : '',
      tags: Array.isArray(x.tags) ? x.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    }))
    .sort((p, q) => p.start - q.start);
  return out.length ? out : null;
}

/** The optional `minutely` block → hour-axis minutes, or `null` when it's missing or unusable. */
function minutesOf(a: unknown, day0: number): { h: number; mm: number }[] | null {
  if (!Array.isArray(a)) return null;
  const out = a
    .filter((x) => x && typeof x.dt === 'number' && typeof x.precipitation === 'number' && isFinite(x.precipitation))
    .map((x) => ({ h: hOfUnix(x.dt, day0), mm: Math.max(0, x.precipitation) }))
    .sort((p, q) => p.h - q.h);
  return out.length ? out : null;
}

/** `sample()` — linear interpolation between hourly samples; `deg`/`id` from the nearer one. */
export function sample(a: WxSample[], h: number): WxSample {
  'worklet';
  if (a.length < 2 || h <= a[0].h) return a[0];
  let i = 1;
  while (i < a.length && a[i].h <= h) i++;
  if (i >= a.length) return a[a.length - 1];
  const p = a[i - 1];
  const q = a[i];
  const f = (h - p.h) / (q.h - p.h);
  const nr = f < 0.5 ? p : q;
  return {
    h,
    temp: p.temp + (q.temp - p.temp) * f,
    feels: p.feels + (q.feels - p.feels) * f,
    hum: p.hum + (q.hum - p.hum) * f,
    clouds: p.clouds + (q.clouds - p.clouds) * f,
    vis: p.vis + (q.vis - p.vis) * f,
    wind: p.wind + (q.wind - p.wind) * f,
    gust: p.gust + (q.gust - p.gust) * f,
    uvi: p.uvi + (q.uvi - p.uvi) * f,
    pop: p.pop + (q.pop - p.pop) * f,
    mm: p.mm + (q.mm - p.mm) * f,
    deg: nr.deg,
    id: nr.id,
  };
}

export interface SceneWx {
  gloom: number;
  cloudN: number;
  rainAmt: number;
  flash: boolean;
  wind: number;
  deg: number;
}

/** `wxAt()` — what the scene needs at a (fractional) hour. */
export function wxAt(hrs: WxSample[], h: number): SceneWx {
  'worklet';
  const s = sample(hrs, h);
  return { gloom: gloomOf(s), cloudN: cloudNOf(s.clouds), rainAmt: rainAmtOf(s), flash: isThunder(s.id), wind: Math.max(1, s.wind), deg: s.deg };
}

export type WxKey = 'sunny' | 'partly' | 'windy' | 'overcast' | 'rainy' | 'stormy' | 'night' | 'golden';

export function keyOf(s: WxSample, h: number, sun: Sun): WxKey {
  const el = sunState(h, sun).el;
  return isThunder(s.id)
    ? 'stormy'
    : isWet(s.id)
      ? 'rainy'
      : s.wind >= 30
        ? 'windy'
        : el <= 0
          ? 'night'
          : el < 0.3 && md24(h) > 12 && s.clouds < 70
            ? 'golden'
            : s.clouds >= 75
              ? 'overcast'
              : s.clouds >= 30
                ? 'partly'
                : 'sunny';
}

export interface Phrases {
  wind: string;
  rain: string;
  vis: string;
  uv: string;
  cloud: string;
}

export const uvWordOf = (u: number): string =>
  u <= 2 ? 'Low' : u <= 5 ? 'Moderate' : u <= 7 ? 'High' : u <= 10 ? 'Very high' : 'Extreme';
export const windWordOf = (w: number): string =>
  w < 12 ? 'Light breeze' : w < 20 ? 'Gentle breeze' : w < 30 ? 'Moderate winds' : w < 40 ? 'Fresh winds' : 'Strong winds';
export const palmWordOf = (w: number): string =>
  w < 12 ? 'Fronds barely stirring' : w < 20 ? 'Palms swaying gently' : w < 35 ? 'Palms bending and rustling' : 'Hold on to your hat';

export function phrasesOf(s: WxSample): Phrases {
  const w = Math.round(s.wind);
  const c = s.clouds;
  const v = Math.round(s.vis);
  const p = Math.round(s.pop / 5) * 5;
  return {
    wind: `${windWordOf(w)}, ${w} km/h ${dirOf(s.deg)}`,
    rain: isThunder(s.id)
      ? 'Thunder and heavy rain'
      : isWet(s.id)
        ? 'Raining now'
        : p >= 60
          ? `${p}% chance. Showers likely`
          : p >= 30
            ? `${p}% chance of a shower`
            : p >= 10
              ? `${p}% chance, mostly dry`
              : 'Dry for now',
    vis: v >= 10 ? 'Clear, 10 km visibility' : v >= 6 ? `Decent, ${v} km visibility` : `Poor, ${v} km visibility`,
    uv: '',
    cloud: c < 10 ? 'Barely a cloud' : c < 35 ? 'A few puffy clouds' : c < 70 ? 'Sun between clouds' : c < 90 ? 'Mostly cloudy' : 'Full cloud cover',
  };
}

// ───────────────────────── Moon ─────────────────────────

export function moonOf(days: WxDay[]): MoonData {
  const ev: MoonData['ev'] = [];
  days.forEach((d) => {
    if (d.mr != null) ev.push({ h: d.mr, rise: true });
    if (d.ms != null) ev.push({ h: d.ms, rise: false });
  });
  ev.sort((a, b) => a.h - b.h);
  const iv: [number, number][] = [];
  let open: number | null = null;
  for (const e of ev) {
    if (e.rise) open = e.h;
    else {
      iv.push([open ?? e.h - 12.4, e.h]);
      open = null;
    }
  }
  if (open != null) iv.push([open, open + 12.4]);
  return { iv, ev, days: days.filter((d) => d.mp != null).map((d) => ({ h: d.h, mp: d.mp as number })) };
}

/** Synodic-month estimate used when there's no live moon data. */
export function moonFallback(day0: number, sun: Sun): MoonData {
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 1000;
  const p0 = ((((day0 + 43200 - ref) / (29.530588853 * 86400)) % 1) + 1) % 1;
  const iv: [number, number][] = [];
  for (let k = -1; k < 3; k++) {
    const r = sun.rise + p0 * 24.84 + k * 24.84;
    iv.push([r, r + 12.4]);
  }
  return { iv, ev: iv.flatMap(([a, b]) => [{ h: a, rise: true }, { h: b, rise: false }]), days: [{ h: 12, mp: p0 }] };
}

/** Live moon data when available, else the fallback (prototype `moonAt` source selection). */
export function moonDataFor(W: Weather | null, day0: number, sun: Sun): MoonData {
  return W && W.moon && W.moon.days.length ? W.moon : moonFallback(day0, sun);
}

export interface MoonState {
  up: boolean;
  f: number;
  el: number;
  /** phase 0–1 (0 new, .5 full) */
  p: number;
  illum: number;
}

export function moonAt(M: MoonData, h: number): MoonState {
  'worklet';
  let best = M.days[0];
  for (const d of M.days) if (Math.abs(d.h - h) < Math.abs(best.h - h)) best = d;
  const p = (((best.mp + (h - best.h) / 708.73) % 1) + 1) % 1;
  const illum = (1 - Math.cos(TAU * p)) / 2;
  let it: [number, number] | null = null;
  for (const x of M.iv) {
    if (h >= x[0] && h <= x[1]) {
      it = x;
      break;
    }
  }
  if (!it) return { up: false, f: 0, el: 0, p, illum };
  const f = (h - it[0]) / (it[1] - it[0]);
  return { up: true, f, el: Math.sin(Math.PI * f), p, illum };
}

/** SVG path of the lit part of a 100×100 moon disk (r 40, centre 50,50). */
export function moonSvg(p: number): string {
  const c = Math.cos(TAU * p);
  const right = p < 0.5;
  const bulgeR = right === c > 0;
  return `M50 10 A40 40 0 0 ${right ? 1 : 0} 50 90 A${(40 * Math.abs(c)).toFixed(2)} 40 0 0 ${bulgeR ? 0 : 1} 50 10 Z`;
}

export interface MoonInfo {
  up: boolean;
  illum: number;
  name: string;
  rise: string;
  set: string;
  nextTxt: string;
  svg: string;
}

export function moonInfo(M: MoonData, h: number, day0: number): MoonInfo {
  const s = moonAt(M, h);
  const p = s.p;
  const near = (x: number) => Math.abs(((p - x + 1.5) % 1) - 0.5) < 0.025;
  const name = near(0)
    ? 'New moon'
    : near(0.25)
      ? 'First quarter'
      : near(0.5)
        ? 'Full moon'
        : near(0.75)
          ? 'Last quarter'
          : p < 0.25
            ? 'Waxing crescent'
            : p < 0.5
              ? 'Waxing gibbous'
              : p < 0.75
                ? 'Waning gibbous'
                : 'Waning crescent';
  const nextOf = (rise: boolean) => {
    const e = M.ev.find((x) => x.rise === rise && x.h > h);
    return e ? fmt(e.h) + (Math.floor(e.h / 24) > Math.floor(h / 24) ? ' ' + dateOf(e.h, day0).dow : '') : '—';
  };
  const toFull = (((0.5 - p) % 1) + 1) % 1;
  const toNew = (((1 - p) % 1) + 1) % 1;
  const isFull = toFull <= toNew;
  const d = Math.round((isFull ? toFull : toNew) * 29.53);
  const label = isFull ? 'Full moon' : 'New moon';
  const nextTxt =
    name === label
      ? `${label} now`
      : d <= 0
        ? `${label} tonight`
        : d === 1
          ? `${label} tomorrow`
          : `${label} on ${dayLabel(h + d * 24, day0)}`;
  return { up: s.up, illum: Math.round(s.illum * 100), name, rise: nextOf(true), set: nextOf(false), nextTxt, svg: moonSvg(p) };
}

// ───────────────────────── Week ─────────────────────────

export interface WeekDay {
  di: number;
  label: string;
  key: WxKey;
  icon: string;
  lo: number;
  hi: number;
  pop: number;
  wind: number;
  wet: boolean;
  /** rain mm for the day, when the feed has it */
  mm: number | null;
}

export function weekDays(W: Weather, day0: number): WeekDay[] {
  return W.days
    .filter((d) => Math.floor(d.h / 24) >= 0)
    .slice(0, 8)
    .map((d) => {
      const di = Math.floor(d.h / 24);
      const x = dateOf(di * 24 + 12, day0);
      const id = d.id ?? 800;
      const key: WxKey = isThunder(id)
        ? 'stormy'
        : isWet(id)
          ? 'rainy'
          : d.wind >= 30
            ? 'windy'
            : d.clouds >= 75
              ? 'overcast'
              : d.clouds >= 30
                ? 'partly'
                : 'sunny';
      return {
        di,
        label: `${x.dow} ${x.d}`,
        key,
        icon: owmIcon(id, true),
        lo: Math.round(d.lo as number),
        hi: Math.round(d.hi as number),
        pop: Math.round((d.pop || 0) / 5) * 5,
        wind: Math.round(d.wind || 0),
        wet: isWet(id) && (d.pop || 0) >= 40,
        mm: d.mm ?? null,
      };
    });
}

export const WX_HERO: Record<WxKey, string> = {
  sunny: '#FFF0C6',
  partly: '#FFF3D6',
  windy: '#D3F1EE',
  overcast: '#E4EAEC',
  rainy: '#DAEFFB',
  stormy: '#E3E6EE',
  night: '#DDE3F6',
  golden: '#FFE3CF',
};
export const WX_TINT: Record<WxKey, string> = {
  sunny: '#E9A100',
  partly: '#D99A1A',
  windy: '#0F9C98',
  overcast: '#7C8F98',
  rainy: '#2F86C2',
  stormy: '#E2522F',
  night: '#5866A8',
  golden: '#E8813A',
};
