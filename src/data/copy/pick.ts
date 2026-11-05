/**
 * Deterministic line picking and slot filling for the playful copy.
 *
 * The pick is a hash of (category, island, date, hour), so a message stays put while you look at it
 * (re-renders and the 60 s clock don't change it) and varies across hours, days and islands.
 */

/** Slots a template may use. Every slot a line uses must be given (tests check this). */
export interface Slots {
  temp?: number;
  feels?: number;
  wind?: number;
  gust?: number;
  hour?: string;
  island?: string;
  activity?: string;
}

/** FNV-1a, 32-bit. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One line from `pool`, chosen by the seed parts. */
export function pickLine(pool: readonly string[], ...seed: (string | number)[]): string {
  if (!pool.length) return '';
  return pool[hash(seed.join('|')) % pool.length];
}

/** `{slot}` → value. Unknown or missing slots are left as they are (tests catch them). */
export function fill(line: string, slots: Slots): string {
  return line.replace(/\{(\w+)\}/g, (all, k: string) => {
    const v = slots[k as keyof Slots];
    return v == null ? all : String(v);
  });
}

/** Slot names a line uses. */
export function slotsOf(line: string): string[] {
  return [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}
