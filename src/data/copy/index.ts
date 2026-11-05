/**
 * Varied, friendly-silly messages. Pools live in `weather.ts` / `activities.ts`; this module picks from them.
 *
 * - Same conditions → same pool; the line is picked by hash(category, island, date, hour), so it stays put
 *   while you look and varies across hours, days and islands.
 * - Safety first: storms, alerts, strong gusts and safety-related "skip"s use calm pools only. The factual
 *   sub-lines, the forecast alert and the safety tips are never replaced.
 */
import type { Factor } from '../types';
import type { WxKey } from '../weather';
import { CAUTION, DANGER_FACTORS, GO, GO_ACT, IDEAL, MAYBE, MAYBE_FACTOR, SKIP, SKIP_FUN, SKIP_SAFE, WAIT } from './activities';
import { fill, pickLine } from './pick';
import { BREEZY, HEAD, HOT, HOUR, HOUR_DANGER, ISLAND, MORNING, STORM, WARN } from './weather';

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
}

const DAY_KEYS: WxKey[] = ['sunny', 'partly', 'windy', 'overcast'];
const MILD_KEYS: WxKey[] = ['sunny', 'partly', 'overcast'];

/** Candidate lines for the current-weather headline (exported for tests). */
export function headPool(a: HeadArgs, hour: number): { cat: string; lines: string[] } {
  if (a.key === 'stormy') return { cat: 'storm', lines: STORM };
  if (a.warning) return { cat: 'warn', lines: WARN };
  const lines = [...HEAD[a.key]];
  if (a.feels >= 36 && DAY_KEYS.includes(a.key)) lines.push(...HOT);
  if (a.wind >= 20 && MILD_KEYS.includes(a.key)) lines.push(...BREEZY);
  if (hour >= 5 && hour < 10 && MILD_KEYS.includes(a.key)) lines.push(...MORNING);
  lines.push(...ISLAND);
  return { cat: 'head:' + a.key, lines };
}

/** Current-weather headline ("Glorious out there."). */
export function weatherHead(a: HeadArgs, k: CopyKey): string {
  const { cat, lines } = headPool(a, k.hour);
  return fill(pickLine(lines, cat, k.island, k.day, k.hour), { temp: a.temp, feels: a.feels, wind: a.wind, island: a.island });
}

export type HourWord = keyof typeof HOUR;

/** Scrubbed-hour headline ("3 PM looks good."). `danger` = thunder or gusts ≥ 50 km/h at that hour. */
export function hourHead(word: HourWord, danger: boolean, hourLabel: string, k: CopyKey): string {
  const lines = danger ? HOUR_DANGER : HOUR[word];
  return fill(pickLine(lines, danger ? 'hour:danger' : 'hour:' + word, k.island, k.day, k.hour), { hour: hourLabel });
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
  if (a.verdict === 'maybe') return { cat: 'maybe:' + (lim || ''), lines: [...MAYBE, ...((lim && MAYBE_FACTOR[lim]) || [])], safe: false };
  const acts = GO_ACT[a.act] || [];
  return a.ideal ? { cat: 'ideal:' + a.act, lines: [...IDEAL, ...acts], safe: false } : { cat: 'go:' + a.act, lines: [...GO, ...acts], safe: false };
}

/** Verdict sentence that leads the activity detail line. */
export function actLead(a: LeadArgs, k: CopyKey): string {
  const { cat, lines } = leadPool(a);
  return fill(pickLine(lines, cat, k.island, k.day, k.hour), { activity: a.activity });
}

/** Island sheet "now" chip about the beach: a tide fact, never a rating of the island. `n` = tide level 0–1. */
export function beachNow(n: number): string {
  return n > 0.72 ? 'Tide’s in · cosy beach' : n < 0.3 ? 'Tide’s out · bonus beach' : 'Mid tide · towel room';
}

/** Surf / snorkel tag on a beach or reef: right-now conditions, not a judgement of the spot. */
export function spotTag(what: 'Surf' | 'Snorkel', verdict: 'go' | 'maybe' | 'skip' | 'wait'): { t: string; tone: 'go' | 'maybe' | 'later' } {
  if (verdict === 'go') return { t: what === 'Surf' ? 'Surf’s on now' : 'Snorkel now', tone: 'go' };
  if (verdict === 'maybe') return { t: what === 'Surf' ? 'Surfable now' : 'OK to snorkel', tone: 'maybe' };
  if (verdict === 'wait') return { t: `${what} after sunrise`, tone: 'later' };
  return { t: `${what} later`, tone: 'later' };
}
