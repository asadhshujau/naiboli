/**
 * Rain in the next half hour, from OpenWeather's optional minute forecast (`Weather.min`).
 *
 * Read it carefully. The server refreshes weather about once an hour, the minutes only cover the hour after
 * that snapshot, and island rain comes and goes fast. So:
 * - Only the next 30 minutes count (the server's own scoring window), and only with 10+ minutes still ahead;
 *   otherwise there's no nowcast and the hourly data decides, as before.
 * - "Now" is the mean of the next 5 minutes, not a single reading.
 * - A start / stop is only called when it then holds for the rest of the window (8+ minutes); anything else
 *   is "on and off". Times are rounded to 5 minutes and always said as "around".
 * - Words hedge ("likely", "for now", "should"). Thunderstorms ignore all this (the caller checks).
 * When the minutes are missing, nothing here changes what the app shows.
 */
import { fmt } from './time';
import type { Weather } from './types';

/** mm/h below this counts as dry (same as the server). */
export const DRY_BELOW = 0.1;
/** minutes of the forecast that count */
export const WINDOW = 30;
/** fewer minutes than this still ahead → no nowcast */
export const MIN_AHEAD = 10;
/** a change must then hold for this many minutes */
const HOLD = 8;

export interface Nowcast {
  /** mm/h now: mean of the next 5 minutes */
  mm: number;
  wetNow: boolean;
  /** mean mm/h over the window */
  mean: number;
  kind: 'dry' | 'rain' | 'starting' | 'stopping' | 'patchy';
  /** hour-axis time of the start / stop, rounded to 5 minutes */
  at: number | null;
  /** for 'rain': how it's going over the window */
  trend: 'heavier' | 'lighter' | 'steady';
  /** minutes until `at` */
  inMin: number | null;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** The nowcast at hour `nowH`, or `null` when there are no (or too few) minutes ahead. */
export function nowcastOf(W: Weather | null | undefined, nowH: number): Nowcast | null {
  const all = W?.min;
  if (!all || !all.length) return null;
  const from = nowH - 0.5 / 60;
  const ahead = all.filter((x) => x.h >= from);
  if (ahead.length < MIN_AHEAD) return null;
  const win = ahead.slice(0, WINDOW);
  const mm = win.map((x) => x.mm);
  const wet = mm.map((x) => x >= DRY_BELOW);
  const now = mean(mm.slice(0, 5));
  const wetNow = now >= DRY_BELOW;
  const n = win.length;
  /** first index from which every minute to the end is `want`, holding HOLD+ minutes */
  const holdsFrom = (want: boolean) => {
    let i = n;
    while (i > 0 && wet[i - 1] === want) i--;
    return i < n && n - i >= HOLD ? i : -1;
  };
  let kind: Nowcast['kind'];
  let at: number | null = null;
  if (wet.every((x) => !x)) kind = 'dry';
  else if (wet.every((x) => x)) kind = 'rain';
  else {
    const i = holdsFrom(!wetNow);
    // the rain before a stop (or the dry before a start) must be the only switch
    const clean = i > 0 && wet.slice(0, i).every((x) => x === wetNow);
    if (clean) {
      kind = wetNow ? 'stopping' : 'starting';
      at = Math.round(win[i].h * 12) / 12;
    } else kind = 'patchy';
  }
  const k = Math.min(10, Math.floor(n / 3));
  const first = mean(mm.slice(0, k));
  const last = mean(mm.slice(n - k));
  const trend: Nowcast['trend'] =
    last >= first * 1.5 && last - first >= 0.3 ? 'heavier' : first >= last * 1.5 && first - last >= 0.3 ? 'lighter' : 'steady';
  return { mm: now, wetNow, mean: mean(mm), kind, at, trend, inMin: at == null ? null : Math.max(0, Math.round((at - nowH) * 60)) };
}

/** Rain amount (mm/h) in words: OpenWeather calls under ~1 mm/h light, then moderate, heavy from ~4. */
export function rainWord(mm: number): 'Light' | 'Steady' | 'Heavy' {
  return mm >= 4 ? 'Heavy' : mm >= 1 ? 'Steady' : 'Light';
}

const when = (c: Nowcast) => (c.inMin != null && c.inMin < 10 ? 'soon' : `around ${fmt(c.at as number)}`);

/** The rain line for now (rain bubble, Weather sheet), e.g. "Light rain, picking up". */
export function nowcastLine(c: Nowcast, codeWet: boolean): string {
  const w = rainWord(c.mm);
  switch (c.kind) {
    case 'rain':
      return c.trend === 'heavier' ? `${w} rain, picking up` : c.trend === 'lighter' ? `${w} rain, easing off` : `${w} rain for the next half hour`;
    case 'stopping':
      return `${w} rain, should ease ${when(c)}`;
    case 'starting':
      return c.inMin != null && c.inMin < 10 ? 'Rain likely any minute' : `Rain likely from ${when(c)}`;
    case 'patchy':
      return c.wetNow ? 'Rain on and off for now' : 'A passing shower is possible';
    default:
      return codeWet ? 'Easing off. Looks dry for now' : 'Looks dry for the next half hour';
  }
}

/** Follow-on for the line under the headline, after "Light rain, feels like 26°." (so the rain word isn't repeated). */
export function nowcastTail(c: Nowcast, codeWet: boolean): string {
  switch (c.kind) {
    case 'rain':
      return c.trend === 'heavier' ? 'Picking up for now.' : c.trend === 'lighter' ? 'Easing off for now.' : 'Likely for the next half hour.';
    case 'stopping':
      return `Should ease ${when(c)}.`;
    case 'patchy':
      return c.wetNow ? 'On and off for now.' : `${nowcastLine(c, codeWet)}.`;
    default:
      return `${nowcastLine(c, codeWet)}.`;
  }
}

/** Short form for activity reasons ("Held back by rain, picking up"). `null` when the minutes say dry. */
export function nowcastReason(c: Nowcast): string | null {
  switch (c.kind) {
    case 'rain':
      return c.trend === 'heavier' ? 'rain, picking up' : c.trend === 'lighter' ? 'rain, easing off' : `${rainWord(c.mm).toLowerCase()} rain for now`;
    case 'stopping':
      return `rain, easing ${when(c)}`;
    case 'starting':
      return c.inMin != null && c.inMin < 10 ? 'rain, any minute now' : `rain from ${when(c)}`;
    case 'patchy':
      return 'rain on and off';
    default:
      return null;
  }
}
