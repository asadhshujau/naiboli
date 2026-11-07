/**
 * "Mood" = the conditions summary that drives the HUD and scene: either live (from weather)
 * or a canned sample mood shown while weather loads / when the feed is unreachable.
 */
import { nowcastLine, nowcastOf, nowcastTail, type Nowcast } from './nowcast';
import { sunOf, sunState } from './sun';
import { clamp, dateOf, dirOf, fmt, md24, TAU } from './time';
import type { Sun, Weather, WxAlert, WxSample } from './types';
import {
  cloudNOf,
  gloomOf,
  isThunder,
  isWet,
  keyOf,
  owmCond,
  owmIcon,
  phrasesOf,
  rainAmtOf,
  sample,
  type Phrases,
  type WxKey,
} from './weather';

export interface Warning {
  short: string;
  title: string;
  until: string;
  body: string;
}

interface MoodFields {
  key: WxKey;
  /** hour-axis "now" */
  hour: number;
  temp: number;
  feels: number;
  lo: number;
  hi: number;
  cond: string;
  icon: string;
  wind: number;
  dir: string;
  deg: number;
  gust: number;
  uv: number;
  uvMax: number;
  rain: number;
  hum: number;
  clouds: number;
  vis: number;
  gloom: number;
  cloudN: number;
  rainAmt: number;
  flash: boolean;
  tempWord: string;
  headEn: string;
  sub: string;
  phrases: Phrases;
  warning: Warning | null;
  /** showing older data while a fetch is in flight */
  loading: boolean;
  /** rain in the next half hour from the minute forecast (live "now" only, when the feed has it) */
  nc: Nowcast | null;
}

export interface LiveMood extends MoodFields {
  live: true;
  W: Weather;
  updated: string;
  offline: false;
}

export interface SampleMood extends MoodFields {
  live: false;
  /** per-ACTS base scores at `hour` */
  scores: number[];
  updated: '';
  offline: boolean;
}

export type Mood = LiveMood | SampleMood;

type SampleDef = Omit<MoodFields, 'key' | 'hour' | 'loading' | 'flash' | 'warning' | 'nc'> & {
  scores: number[];
  flash?: boolean;
  warning?: Warning;
};

const FAIR = [7.2, 8.4, 7.9, 8.4, 7.8, 8.2, 8.1, 7.6, 3.2, 5.6, 7.1, 8.5, 6.8, 8.2];

/** Canned moods (prototype `MOODS`). `hour` is replaced with the real clock when used. */
export const MOODS: Record<WxKey, SampleDef> = {
  sunny: { temp: 30, feels: 35, lo: 28, hi: 31, cond: 'Sunny', icon: 'sunny', wind: 8, dir: 'NE', deg: 45, gust: 12, uv: 11, uvMax: 11, rain: 5, hum: 66, clouds: 10, vis: 10, gloom: 0, cloudN: 2, rainAmt: 0, tempWord: 'Hot and bright',
    headEn: 'Glorious out there.', sub: 'Big sun, glassy lagoon. Go get wet.', phrases: { wind: 'Light 8 km/h breeze', rain: 'Dry all day', vis: 'Water clarity looks excellent', uv: 'UV 11. Reef-safe sunscreen!', cloud: 'Barely a cloud' },
    scores: [5.8, 7.4, 8.6, 9.1, 9.4, 8.9, 8.0, 8.7, 1.8, 2.6, 9.0, 9.3, 9.2, 9.6] },
  partly: { temp: 31, feels: 36, lo: 28, hi: 31, cond: 'Partly cloudy', icon: 'partly_cloudy_day', wind: 16, dir: 'W', deg: 270, gust: 22, uv: 9, uvMax: 10, rain: 20, hum: 70, clouds: 45, vis: 10, gloom: 0.12, cloudN: 5, rainAmt: 0, tempWord: 'Warm and pleasant',
    headEn: 'Pretty great.', sub: 'Sun with puffy clouds. Breeze builds after 2 PM.', phrases: { wind: 'Steady 16 km/h westerly', rain: '20% chance, late', vis: 'Clear, slight surface chop', uv: 'UV 9. Very high', cloud: 'Sun between puffy clouds' }, scores: FAIR },
  windy: { temp: 30, feels: 33, lo: 28, hi: 31, cond: 'Breezy', icon: 'air', wind: 34, dir: 'W', deg: 270, gust: 46, uv: 10, uvMax: 11, rain: 10, hum: 68, clouds: 30, vis: 10, gloom: 0.08, cloudN: 4, rainAmt: 0, tempWord: 'Hot, but the breeze helps',
    headEn: 'Windy one today.', sub: 'Bright and blowy. Surfers, this one’s yours. Leave the kayak.', phrases: { wind: 'Fresh 34 km/h westerly', rain: 'Dry, a passing cloud or two', vis: 'Choppy on top, clear below', uv: 'UV 10. Very high', cloud: 'Fast-moving clouds' },
    scores: [9.2, 9.0, 4.6, 5.2, 4.4, 5.6, 5.0, 5.8, 1.6, 2.8, 3.0, 7.2, 2.6, 5.4] },
  overcast: { temp: 28, feels: 32, lo: 27, hi: 29, cond: 'Overcast', icon: 'cloud', wind: 14, dir: 'WSW', deg: 250, gust: 20, uv: 3, uvMax: 5, rain: 35, hum: 78, clouds: 92, vis: 8, gloom: 0.6, cloudN: 8, rainAmt: 0, tempWord: 'Mild under cloud',
    headEn: 'Not bad, actually.', sub: 'Soft grey light. Easy on the skin, fine on the water.', phrases: { wind: '14 km/h, gusting 20', rain: '35% chance of a sprinkle', vis: 'Flat light, 8 km visibility', uv: 'UV 3. Gentle', cloud: 'Full cover, zero glare' },
    scores: [6.6, 7.3, 7.0, 6.2, 5.8, 6.9, 7.8, 6.0, 5.4, 8.4, 6.7, 5.0, 6.4, 5.2] },
  rainy: { temp: 29, feels: 36, lo: 28, hi: 29, cond: 'Light rain', icon: 'rainy', wind: 27, dir: 'W', deg: 270, gust: 30, uv: 1, uvMax: 4, rain: 85, hum: 85, clouds: 85, vis: 10, gloom: 0.74, cloudN: 7, rainAmt: 0.55, tempWord: 'Warm and sticky',
    headEn: 'Bring a towel.', sub: 'On-and-off showers all day. Pick your gaps.', phrases: { wind: 'Moderate 27 km/h westerly', rain: 'Showers on and off', vis: 'Still 10 km between showers', uv: 'UV 1. Low', cloud: '85% cloud' },
    scores: [7.4, 7.6, 7.8, 5.4, 5.5, 6.5, 5.4, 5.8, 6.7, 4.6, 3.9, 3.8, 3.6, 3.5] },
  stormy: { temp: 27, feels: 31, lo: 26, hi: 28, cond: 'Thunderstorms', icon: 'thunderstorm', wind: 52, dir: 'W', deg: 270, gust: 64, uv: 0, uvMax: 2, rain: 100, hum: 92, clouds: 100, vis: 3, gloom: 1, cloudN: 9, rainAmt: 1, flash: true, tempWord: 'Cooler in the rain',
    headEn: 'Stay ashore.', sub: 'Thunderstorms and 64 km/h gusts. A good day for a nap.', phrases: { wind: 'Gusts to 64 km/h', rain: 'Heavy rain and thunder', vis: 'Poor, 3 km', uv: 'UV 0', cloud: 'Storm clouds' },
    scores: [3.1, 1.6, 1.4, 2.2, 1.9, 2.0, 1.8, 1.5, 2.4, 1.3, 1.1, 1.7, 1.0, 0.9], warning: { short: 'Thunderstorms, gusts, heavy rain', title: 'Active warning', until: '11 PM', body: 'Heavy rain and thunderstorms with gusts of 64 km/h expected. Stay ashore.' } },
  night: { temp: 28, feels: 32, lo: 27, hi: 30, cond: 'Clear night', icon: 'bedtime', wind: 9, dir: 'NE', deg: 45, gust: 13, uv: 0, uvMax: 11, rain: 5, hum: 74, clouds: 8, vis: 10, gloom: 0, cloudN: 1, rainAmt: 0, tempWord: 'Balmy night',
    headEn: 'Night owls only.', sub: 'Calm and starry. Good night for fishing off the jetty.', phrases: { wind: 'Calm 9 km/h', rain: 'Dry and starry', vis: 'Dark water. Bring a torch', uv: 'No sun till 5:50', cloud: 'Clear skies' },
    scores: [2.8, 2.4, 1.6, 4.4, 2.6, 3.3, 8.2, 1.2, 5.8, 1.8, 2.2, 7.4, 1.9, 2.8] },
  golden: { temp: 29, feels: 33, lo: 28, hi: 31, cond: 'Golden hour', icon: 'wb_twilight', wind: 11, dir: 'NW', deg: 315, gust: 15, uv: 1, uvMax: 11, rain: 10, hum: 70, clouds: 25, vis: 10, gloom: 0.05, cloudN: 3, rainAmt: 0, tempWord: 'Warm evening',
    headEn: 'Golden hour.', sub: 'Sunset at 5:49. Dolphins, a cold drink, done.', phrases: { wind: 'Easing to 11 km/h', rain: 'Dry evening', vis: 'Low sun glare on the water', uv: 'UV 1. Sun is low', cloud: 'A few pink clouds' },
    scores: [6.4, 8.1, 6.2, 7.6, 5.2, 4.6, 8.5, 9.1, 3.1, 4.2, 8.3, 9.4, 8.4, 7.2] },
};

const ISLAND_WX: Record<string, WxKey> = {
  'K. Malé': 'partly',
  'K. Hulhumalé': 'sunny',
  'K. Maafushi': 'rainy',
  'K. Thulusdhoo': 'windy',
  'AA. Ukulhas': 'overcast',
  'Gn. Fuvahmulah': 'stormy',
};
const WX_CYCLE: WxKey[] = ['sunny', 'partly', 'windy', 'overcast', 'rainy', 'stormy'];

/** Deterministic sample mood for an island label ("K. Malé"). */
export function wxOf(label: string): WxKey {
  return ISLAND_WX[label] || WX_CYCLE[[...label].reduce((a, ch) => a + ch.charCodeAt(0), 0) % WX_CYCLE.length];
}

export function sampleMood(label: string, hour: number, wxState: 'loading' | 'err' | undefined): SampleMood {
  const key = wxOf(label);
  const d = MOODS[key];
  return {
    ...d,
    key,
    hour,
    flash: !!d.flash,
    warning: d.warning ?? null,
    nc: null,
    live: false,
    updated: '',
    loading: wxState !== 'err',
    offline: wxState === 'err',
  };
}

/** `liveMood()` — summary at hour `h` from live weather. */
export function liveMood(W: Weather, h: number, sun: Sun): LiveMood {
  const s0 = sample(W.hrs, h);
  // Minute forecast, when there is one (never in thunder): it decides whether it's raining now and how hard.
  const nc = isThunder(s0.id) ? null : nowcastOf(W, h);
  const s = nc ? withNowcast(s0, nc) : s0;
  const D = W.days.find((x) => x.h >= 0 && x.h < 24) || W.days[0];
  const day = sunState(h, sun).el > 0;
  const key = keyOf(s, h, sun);
  const base = MOODS[key];
  const temp = Math.round(s.temp);
  const feels = Math.round(s.feels);
  const wind = Math.max(1, Math.round(s.wind));
  const gust = Math.round(s.gust);
  const cond = owmCond(s.id, day);
  const tail = {
    sunny: wind < 12 ? 'Glassy lagoon. Go get wet.' : 'Big sun. Go get wet.',
    partly: 'Sun between the clouds.',
    windy: `Blowy at ${wind} km/h. Surfers, this one’s yours.`,
    overcast: 'Soft light, easy on the skin.',
    rainy: nc ? nowcastTail(nc, isWet(s0.id)) : 'Showers about. Pick your gaps.',
    stormy: `Thunder and gusts to ${gust} km/h.`,
    night: s.clouds < 40 ? 'Calm and starry.' : 'Warm and quiet.',
    golden: `Sunset at ${fmt(sun.set)}.`,
  }[key];
  return {
    live: true,
    W,
    key,
    hour: h,
    temp,
    feels,
    lo: Math.round(D?.lo ?? s.temp - 2),
    hi: Math.round(D?.hi ?? s.temp + 1),
    cond,
    icon: owmIcon(s.id, day),
    wind,
    dir: dirOf(s.deg),
    deg: s.deg,
    gust,
    uv: Math.round(s.uvi),
    uvMax: Math.round(D?.uvi ?? s.uvi),
    rain: Math.round(s.pop / 5) * 5,
    hum: Math.round(s.hum),
    clouds: Math.round(s.clouds),
    vis: Math.round(s.vis),
    gloom: gloomOf(s),
    cloudN: cloudNOf(s.clouds),
    rainAmt: rainAmtOf(s),
    flash: isThunder(s.id),
    tempWord: feels >= 38 ? 'Hot and sticky' : feels >= 34 ? 'Warm and humid' : feels >= 30 ? 'Warm' : 'Pleasantly mild',
    headEn: base.headEn,
    sub: `${cond}, feels like ${feels}°. ${nc && key !== 'rainy' && (nc.kind === 'starting' || nc.kind === 'patchy') ? `${nowcastLine(nc, false)}.` : tail}`,
    phrases: nc ? { ...phrasesOf(s), rain: nowcastLine(nc, isWet(s0.id)) } : phrasesOf(s),
    warning: warningOf(W, h),
    updated: W.at != null ? fmt(W.at) : '',
    loading: false,
    offline: false,
    nc,
  };
}

/**
 * "Now" as the minute forecast sees it: its rain amount, and rain on / off when the minutes clearly say so —
 * raining now (5-minute mean) flips a dry code to rain; a dry code is only restored when the whole half hour is
 * dry. Anything in between keeps the observed code.
 */
function withNowcast(s: WxSample, nc: Nowcast): WxSample {
  let id = s.id;
  if (nc.wetNow && !isWet(id)) id = nc.mm >= 1 ? 501 : 500;
  else if (nc.kind === 'dry' && isWet(id)) id = s.clouds >= 85 ? 804 : s.clouds >= 50 ? 803 : 802;
  return { ...s, id, mm: nc.mm };
}

/**
 * The warning chip / bubble / Weather card: an official alert (active, or starting within 24 h) first, else
 * our own "Forecast alert" for thunder or ≥50 km/h gusts within the next 24 h.
 */
export function warningOf(W: Weather, h: number): Warning | null {
  return officialWarning(W, h) ?? forecastWarning(W, h);
}

/** Official alerts in effect at `h` or starting within 24 h, earliest first. */
export function alertsAhead(W: Weather, h: number): WxAlert[] {
  return (W.alerts ?? []).filter((a) => a.end > h && a.start < h + 24);
}

/** An official alert about thunder or wind is in effect at hour `h` (playful copy stays out, like gusts). */
export function alertDangerAt(W: Weather, h: number): boolean {
  return (W.alerts ?? []).some(
    (a) => a.start <= h && h < a.end && (a.tags.some((t) => /thunder|wind/i.test(t)) || /thunder|storm|gust|wind/i.test(a.event)),
  );
}

const MAX_DESC = 180;

/** An alert as shown (chip, bubble, Weather and activity sheets): `from` = its start time while not yet in effect. */
export interface ShownAlert extends Warning {
  from: string | null;
}

/**
 * The alert to show for hour `h` (`nowH` = the real now).
 * - Now: any official alert the feed sends that hasn't ended, however far ahead (safety first); `from` = its start
 *   while it isn't in effect yet. Else our own forecast alert for thunder / ≥50 km/h gusts within 24 h.
 * - A scrubbed hour: only an alert whose hours include it (official first, then our own).
 * Times carry the day when it isn't today ("tomorrow 7:00 PM", "Mon 7:00 PM"); `day0` = local midnight (unix s).
 */
export function alertFor(W: Weather, h: number, nowH: number, day0: number): ShownAlert | null {
  const now = h <= nowH + 1e-6;
  const at = (t: number) => {
    const dd = Math.floor(t / 24) - Math.floor(nowH / 24);
    return dd === 0 ? fmt(t) : dd === 1 ? `tomorrow ${fmt(t)}` : `${dateOf(t, day0).dow} ${fmt(t)}`;
  };
  const sameDay = (p: number, q: number) => Math.floor(p / 24) === Math.floor(q / 24);
  const a = (W.alerts ?? []).find((x) => (now ? x.end > h : x.start <= h && h < x.end));
  if (a) {
    const ahead = a.start > h + 0.05;
    const until = ahead && sameDay(a.end, a.start) ? fmt(a.end) : at(a.end);
    return { ...officialOf(a, Math.max(h, a.start)), until, from: ahead ? at(a.start) : null };
  }
  const danger = (x: WxSample) => isThunder(x.id) || x.gust >= 50;
  const start = danger(sample(W.hrs, h)) ? h : now ? W.hrs.find((x) => x.h > h && x.h <= h + 24 && danger(x))?.h : undefined;
  if (start == null) return null;
  const w = forecastWarning(W, start);
  return w ? { ...w, from: start > h + 0.05 ? at(start) : null } : null;
}

function officialWarning(W: Weather, h: number): Warning | null {
  const a = alertsAhead(W, h)[0];
  return a ? officialOf(a, h) : null;
}

function officialOf(a: WxAlert, h: number): Warning {
  const byTag = (re: RegExp) => a.tags.some((t) => re.test(t));
  const short =
    a.event && a.event.length <= 32
      ? a.event
      : byTag(/thunder/i)
        ? 'Thunderstorm alert'
        : byTag(/wind/i)
          ? 'Strong wind alert'
          : byTag(/rain|flood/i)
            ? 'Heavy rain alert'
            : 'Weather alert';
  let desc = a.desc || a.event || 'Official weather alert.';
  if (desc.length > MAX_DESC) desc = desc.slice(0, desc.lastIndexOf(' ', MAX_DESC - 1)) + '…';
  else if (!/[.!?…]$/.test(desc)) desc += '.';
  const from = a.start > h + 0.05 ? `From ${fmt(a.start)}. ` : '';
  const by = /meteorology\.gov\.mv/i.test(a.sender) ? ' From the Maldives Meteorological Service.' : '';
  return { short, title: 'Weather alert', until: fmt(a.end), body: `${from}${desc}${by} Stay ashore while it’s on.` };
}

function forecastWarning(W: Weather, h: number): Warning | null {
  const ahead = W.hrs.filter((x) => x.h >= h - 0.5 && x.h <= h + 24 && (isThunder(x.id) || x.gust >= 50));
  if (!ahead.length) return null;
  const th = ahead.some((x) => isThunder(x.id));
  const g = Math.round(Math.max(...ahead.map((x) => x.gust)));
  let last = ahead[0];
  for (const x of ahead) {
    if (x.h - last.h <= 1.5) last = x;
    else break;
  }
  const later = ahead[0].h > h + 0.5 ? ` from ${fmt(Math.floor(ahead[0].h))}` : '';
  return {
    short: th ? (g >= 40 ? 'Thunderstorms and strong gusts' : 'Thunderstorms in the forecast') : `Gusts to ${g} km/h`,
    title: 'Forecast alert',
    until: fmt(Math.ceil(last.h + 1)),
    body: `${th ? 'Thunderstorms' : 'Strong winds'} in the forecast${later}${g >= 40 ? `, gusts to ${g} km/h` : ''}. Stay ashore while it passes.`,
  };
}

/** `hourView()` — fields overridden on a live mood when the scrubber is ahead of now. */
export function hourView(W: Weather, h: number, sun: Sun) {
  const s = sample(W.hrs, h);
  const day = sunState(h, sun).el > 0;
  return {
    key: keyOf(s, h, sun),
    temp: Math.round(s.temp),
    feels: Math.round(s.feels),
    wind: Math.max(1, Math.round(s.wind)),
    gust: Math.round(s.gust),
    dir: dirOf(s.deg),
    deg: s.deg,
    hum: Math.round(s.hum),
    clouds: Math.round(s.clouds),
    vis: Math.round(s.vis),
    cond: owmCond(s.id, day),
    icon: owmIcon(s.id, day),
    rain: Math.round(s.pop / 5) * 5,
    gloom: gloomOf(s),
    cloudN: cloudNOf(s.clouds),
    rainAmt: rainAmtOf(s),
    flash: isThunder(s.id),
    phrases: phrasesOf(s),
    // the minute forecast is about now only
    nc: null,
  };
}

/**
 * `mood()` — live mood from this island's weather, else the last good weather (marked loading)
 * unless this island's fetch failed, else the sample mood.
 * Also returns the sunrise/sunset in effect (the prototype's RISE/SET globals): taken from the
 * weather used, else `prevSun` (the last known times).
 */
export function resolveMood(args: {
  W: Weather | 'loading' | 'err' | undefined;
  lastW: Weather | null;
  label: string;
  nowH: number;
  prevSun: Sun;
}): { mood: Mood; sun: Sun; good: Weather | null } {
  const { W, lastW, label, nowH, prevSun } = args;
  const good = W && typeof W === 'object' ? W : (W !== 'err' && lastW) || null;
  if (good) {
    const sun = sunOf(good, prevSun);
    const m = liveMood(good, nowH, sun);
    m.loading = good !== W;
    return { mood: m, sun, good };
  }
  return { mood: sampleMood(label, nowH, W as 'loading' | 'err' | undefined), sun: prevSun, good: null };
}

// ───────────────────────── Per-hour helpers ─────────────────────────

export function windAt(m: Mood, h: number): number {
  if (m.live) return Math.max(1, Math.round(sample(m.W.hrs, h).wind));
  return Math.max(2, Math.round(m.wind * (1 + 0.22 * (Math.sin(((h - 9) / 24) * TAU) - Math.sin(((m.hour - 9) / 24) * TAU)))));
}

export function tempAt(m: Mood, h: number): number {
  if (m.live) return Math.round(sample(m.W.hrs, h).temp);
  return Math.round(m.temp + (m.hi - m.lo) * 0.5 * (Math.cos(((h - 14) / 24) * TAU) - Math.cos(((m.hour - 14) / 24) * TAU)));
}

/** Rain chance (%, rounded to 5) at hour `h`. */
export function rainAt(m: Mood, h: number): number {
  if (m.live) return Math.round(sample(m.W.hrs, h).pop / 5) * 5;
  return Math.round(clamp(m.rain * (1 + 0.35 * (Math.sin(((h - 12) / 24) * TAU) - Math.sin(((m.hour - 12) / 24) * TAU))), 0, 100) / 5) * 5;
}

/** Sample-mood icon/condition helpers used by the weather sheet's hourly strip. */
export function iconAt(m: Mood, h: number, sun: Sun): string {
  if (m.live) return owmIcon(sample(m.W.hrs, h).id, sunState(h, sun).el > 0);
  return sunState(h, sun).el > 0
    ? m.key === 'night' || m.key === 'golden'
      ? 'sunny'
      : m.icon
    : m.rainAmt
      ? m.icon
      : m.clouds > 60
        ? 'cloud'
        : m.key === 'partly'
          ? 'partly_cloudy_night'
          : 'bedtime';
}

export function condAt(m: Mood, h: number, sun: Sun): string {
  if (m.live) return owmCond(sample(m.W.hrs, h).id, sunState(h, sun).el > 0);
  return sunState(h, sun).el > 0
    ? m.key === 'night' || (m.key === 'golden' && Math.abs(md24(h) - sun.set) > 1.2)
      ? 'Sunny'
      : m.cond
    : m.rainAmt
      ? m.cond
      : m.clouds > 60
        ? 'Cloudy night'
        : 'Clear night';
}
