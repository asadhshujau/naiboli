/**
 * Maldives-time hour axis. `h` = hours since local midnight (UTC+5) of `day0`.
 * `day0` is the unix time (s) of local midnight today; it advances at local midnight.
 */

export const TZ = 5 * 3600;
export const TAU = Math.PI * 2;

export function clamp(v: number, a: number, b: number): number {
  'worklet';
  return Math.max(a, Math.min(b, v));
}

export function md24(h: number): number {
  'worklet';
  return ((h % 24) + 24) % 24;
}

/** Unix seconds of local (UTC+5) midnight for the day containing `nowMs`. */
export function day0Of(nowMs: number): number {
  return Math.floor((nowMs / 1000 + TZ) / 86400) * 86400 - TZ;
}

export function hOfUnix(u: number, day0: number): number {
  'worklet';
  return (u - day0) / 3600;
}

export function nowH(day0: number, nowMs: number = Date.now()): number {
  return hOfUnix(nowMs / 1000, day0);
}

/** "1:15 PM" */
export function fmt(h: number): string {
  h = md24(h);
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    hh = (hh + 1) % 24;
    mm = 0;
  }
  return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + ' ' + (hh < 12 ? 'AM' : 'PM');
}

/** "7p" */
export function fmtHr(h: number): string {
  h = Math.round(md24(h)) % 24;
  return (h % 12 || 12) + (h < 12 ? 'a' : 'p');
}

/** "+0.23" / "−0.05" (U+2212 minus) */
export function fmtLvl(v: number): string {
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
}

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function dateOf(h: number, day0: number): { dow: string; d: number; mon: string } {
  const d = new Date((day0 + TZ + Math.floor(h / 24) * 86400) * 1000);
  return { dow: DOW[d.getUTCDay()], d: d.getUTCDate(), mon: MON[d.getUTCMonth()] };
}

/** "Wed 4 Nov" */
export function dayLabel(h: number, day0: number): string {
  const x = dateOf(h, day0);
  return `${x.dow} ${x.d} ${x.mon}`;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function dirOf(d: number | null | undefined): string {
  return DIRS[Math.round(((((d || 0) % 360) + 360) % 360) / 22.5) % 16];
}

/** Duration, minutes not padded: "4h 34m", "0h 5m" */
export function dur(x: number): string {
  return `${Math.floor(x)}h ${Math.round((x % 1) * 60)}m`;
}

export const capF = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
