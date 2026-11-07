/**
 * Varied, friendly-silly messages. Pools live in `weather.ts` / `activities.ts`; this module picks from them.
 *
 * - Same conditions → same pool; the line is picked by hash(category, island, date, hour), so it stays put
 *   while you look and varies across hours, days and islands.
 * - Safety first: storms, alerts, strong gusts and safety-related "skip"s use calm pools only. The factual
 *   sub-lines, the forecast alert and the safety tips are never replaced.
 * - Then late night (11:30 PM – 4 AM: "Don’t you sleep?", "Best bet: sleep."), then rain (brutal-funny: rain is
 *   never "looks nice", whatever the activity scores say), then the usual pools.
 */
import type { Factor } from '../types';
import type { WxKey } from '../weather';
import { md24 } from '../time';
import { CAUTION, DANGER_FACTORS, GO, GO_ACT, GO_WET, IDEAL, MAYBE, MAYBE_FACTOR, MAYBE_WET, SKIP, SKIP_FUN, SKIP_SAFE, WAIT } from './activities';
import { fill, hash } from './pick';
import { BET_WET, BREEZY, HEAD, HOT, HOUR, HOUR_DAMP, HOUR_DANGER, HOUR_LATE, HOUR_WET, ISLAND, LATE, LATE_RAIN, MORNING, STORM, WARN } from './weather';

/** Last line shown per category, and for which island / date / hour (`seed`). Persisted by the app. */
export type CopyMemory = Record<string, { seed: string; line: string }>;

let memory: CopyMemory = {};
let onMemory: ((m: CopyMemory) => void) | null = null;

/** Load the remembered lines (at launch) and get told when they change (to save them). */
export function initCopyMemory(m: CopyMemory | null, onChange: ((m: CopyMemory) => void) | null) {
  memory = m && typeof m === 'object' ? { ...m } : {};
  onMemory = onChange;
}

/**
 * Pick a line for a category: stable for the same island / date / hour (asking again returns the same line), and
 * never the line this category showed last time, at another moment, when there's a choice.
 */
function choose(lines: string[], cat: string, k: CopyKey): string {
  if (!lines.length) return '';
  const seed = `${k.island}|${k.day}|${k.hour}`;
  const prev = memory[cat];
  if (prev && prev.seed === seed && lines.includes(prev.line)) return prev.line;
  let i = hash(`${cat}|${seed}`) % lines.length;
  if (prev && lines.length > 1 && lines[i] === prev.line) i = (i + 1) % lines.length;
  memory[cat] = { seed, line: lines[i] };
  onMemory?.(memory);
  return lines[i];
}

/** Where and when a message is shown: the seed. `day` = days since the epoch (local date), `hour` = 0–23. */
export interface CopyKey {
  island: number;
  day: number;
  hour: number;
}

export interface HeadArgs {
  key: WxKey;
  temp: number;
  feels: number;
  wind: number;
  /** a forecast alert is showing */
  warning: boolean;
  island: string;
  /** it's 11:30 PM – 4 AM (`isLate`) */
  late?: boolean;
}

/** 11:30 PM – 4 AM: time for the late-night lines. `h` = hours since local midnight (any day). */
export function isLate(h: number): boolean {
  const t = md24(h);
  return t >= 23.5 || t < 4;
}

const DAY_KEYS: WxKey[] = ['sunny', 'partly', 'windy', 'overcast'];
const MILD_KEYS: WxKey[] = ['sunny', 'partly', 'overcast'];

/** Candidate lines for the current-weather headline (exported for tests). */
export function headPool(a: HeadArgs, hour: number): { cat: string; lines: string[] } {
  if (a.key === 'stormy') return { cat: 'storm', lines: STORM };
  if (a.warning) return { cat: 'warn', lines: WARN };
  if (a.late) return { cat: 'late', lines: a.key === 'rainy' ? [...LATE, ...LATE_RAIN] : LATE };
  const lines = [...HEAD[a.key]];
  if (a.feels >= 36 && DAY_KEYS.includes(a.key)) lines.push(...HOT);
  if (a.wind >= 20 && MILD_KEYS.includes(a.key)) lines.push(...BREEZY);
  if (hour >= 5 && hour < 10 && MILD_KEYS.includes(a.key)) lines.push(...MORNING);
  if (a.key !== 'rainy') lines.push(...ISLAND);
  return { cat: 'head:' + a.key, lines };
}

/** Current-weather headline ("Glorious out there."). */
export function weatherHead(a: HeadArgs, k: CopyKey): string {
  const { cat, lines } = headPool(a, k.hour);
  return fill(choose(lines, cat, k), { temp: a.temp, feels: a.feels, wind: a.wind, island: a.island });
}

export type HourWord = keyof typeof HOUR;

/** What the scrubbed hour is like, beyond the verdict word. */
export interface HourCond {
  /** thunder or gusts ≥ 50 km/h at that hour */
  danger: boolean;
  /** 11:30 PM – 4 AM (`isLate`) */
  late: boolean;
  /** `rainOf`: raining or ≥ 70 % ('wet'), 40–69 % ('damp') */
  rain: Rain;
}

export type Rain = 'wet' | 'damp' | null;

/** Rain at an hour, from its mood key and rain chance (%). */
export function rainOf(key: WxKey, chance: number): Rain {
  return key === 'rainy' || chance >= 70 ? 'wet' : chance >= 40 ? 'damp' : null;
}

/** Candidate lines for the scrubbed-hour headline (exported for tests). Danger, then late night, then rain. */
export function hourPool(word: HourWord, c: HourCond): { cat: string; lines: string[] } {
  if (c.danger) return { cat: 'hour:danger', lines: HOUR_DANGER };
  if (c.late) return { cat: 'hour:late', lines: HOUR_LATE };
  if (c.rain === 'wet') return { cat: 'hour:wet', lines: HOUR_WET };
  if (c.rain === 'damp' && (word === 'brilliant' || word === 'good')) return { cat: 'hour:damp', lines: HOUR_DAMP };
  return { cat: 'hour:' + word, lines: HOUR[word] };
}

/** Scrubbed-hour headline ("3 PM looks good."). */
export function hourHead(word: HourWord, c: HourCond, hourLabel: string, k: CopyKey): string {
  const { cat, lines } = hourPool(word, c);
  return fill(choose(lines, cat, k), { hour: hourLabel });
}

/**
 * "Best bet: Snorkeling." at the start of the scrubbed hour's sub line (the facts follow). Late night: sleep.
 * Rain (not danger: storms keep the plain line): a brutal-funny line from `BET_WET`.
 */
export function bestBet(activity: string, c: HourCond, k: CopyKey): string {
  if (c.late) return 'Best bet: sleep.';
  if (c.rain === 'wet' && !c.danger) return fill(choose(BET_WET, 'bet:wet', k), { activity });
  return `Best bet: ${activity}.`;
}

export interface LeadArgs {
  verdict: 'go' | 'maybe' | 'skip' | 'wait';
  ideal: boolean;
  act: string;
  activity: string;
  /** main limiting factor, if any */
  lim: Factor | string | null | undefined;
  /** thunder or gusts ≥ 50 km/h at that hour */
  danger: boolean;
  /** raining at that hour, or ≥ 70 % chance (`rainOf` = 'wet') */
  wet?: boolean;
}

/** Candidate lines for the activity detail's verdict sentence (exported for tests). */
export function leadPool(a: LeadArgs): { cat: string; lines: string[]; safe: boolean } {
  const lim = a.lim as Factor | null | undefined;
  if (a.verdict === 'wait') return { cat: 'wait', lines: WAIT, safe: true };
  if (a.verdict === 'skip') {
    if (a.danger) return { cat: 'skip:storm', lines: SKIP_SAFE.storm, safe: true };
    if (lim && DANGER_FACTORS.includes(lim)) return { cat: 'skip:' + lim, lines: SKIP_SAFE[lim as keyof typeof SKIP_SAFE], safe: true };
    return { cat: 'skip:' + (lim || ''), lines: [...SKIP, ...((lim && SKIP_FUN[lim]) || [])], safe: false };
  }
  if (a.danger) return { cat: 'caution', lines: CAUTION, safe: true };
  if (a.wet && a.act !== 'rainwalk') return a.verdict === 'maybe' ? { cat: 'wet:maybe', lines: MAYBE_WET, safe: false } : { cat: 'wet:go', lines: GO_WET, safe: false };
  if (a.verdict === 'maybe') return { cat: 'maybe:' + (lim || ''), lines: [...MAYBE, ...((lim && MAYBE_FACTOR[lim]) || [])], safe: false };
  const acts = GO_ACT[a.act] || [];
  return a.ideal ? { cat: 'ideal:' + a.act, lines: [...IDEAL, ...acts], safe: false } : { cat: 'go:' + a.act, lines: [...GO, ...acts], safe: false };
}

/** Verdict sentence that leads the activity detail line. */
export function actLead(a: LeadArgs, k: CopyKey): string {
  const { cat, lines } = leadPool(a);
  return fill(choose(lines, cat, k), { activity: a.activity });
}

/** Island sheet "now" chip about the beach: a tide fact, never a rating of the island. `n` = tide level 0–1. */
export function beachNow(n: number): string {
  return n > 0.72 ? 'Tide’s in · cosy beach' : n < 0.3 ? 'Tide’s out · bonus beach' : 'Mid tide · towel room';
}

/** Tide sheet "Beach" stat: value + line, a tide fact like `beachNow`, never a rating. */
export function beachStat(n: number): { value: string; line: string } {
  return n > 0.72
    ? { value: 'Cosy', line: 'Tide’s in, so less sand to sit on' }
    : n < 0.3
      ? { value: 'Extra sand', line: 'Tide’s out. Reef walk time' }
      : { value: 'Towel room', line: 'Mid tide. Room for a towel or two' };
}

/** Surf / snorkel tag on a beach or reef: right-now conditions, not a judgement of the spot. */
export function spotTag(what: 'Surf' | 'Snorkel', verdict: 'go' | 'maybe' | 'skip' | 'wait'): { t: string; tone: 'go' | 'maybe' | 'later' } {
  if (verdict === 'go') return { t: what === 'Surf' ? 'Surf’s on now' : 'Snorkel now', tone: 'go' };
  if (verdict === 'maybe') return { t: what === 'Surf' ? 'Surfable now' : 'OK to snorkel', tone: 'maybe' };
  if (verdict === 'wait') return { t: `${what} after sunrise`, tone: 'later' };
  return { t: `${what} later`, tone: 'later' };
}
