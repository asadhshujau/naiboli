import type { ApiIsland, ApiIslandDetail, IslandDetail } from './types';

export const ATOLLS: Record<string, string> = {
  K: 'Kaafu Atoll', B: 'Baa Atoll', GA: 'Gaafu Alif Atoll', Sh: 'Shaviyani Atoll', AA: 'Alif Alif Atoll', ADh: 'Alif Dhaalu Atoll',
  Lh: 'Lhaviyani Atoll', HDh: 'Haa Dhaalu Atoll', HA: 'Haa Alif Atoll', Gn: 'Gnaviyani Atoll', S: 'Addu Atoll', Th: 'Thaa Atoll',
  L: 'Laamu Atoll', F: 'Faafu Atoll', V: 'Vaavu Atoll', M: 'Meemu Atoll', R: 'Raa Atoll', N: 'Noonu Atoll', Dh: 'Dhaalu Atoll',
  D: 'Dhaalu Atoll', T: 'Thaa Atoll', GDh: 'Gaafu Dhaalu Atoll',
};

export const CAT: Record<string, string> = {
  'Tourism Island': 'Resort',
  'Uninhabited Island': 'Uninhabited',
  'Industrial Island': 'Industrial',
  'Institutional Island': 'Institutional',
};

export const MALE_ID = 1069;

/** Popular islands shown for an empty search; `POP[0]` (Malé) is the default island. */
export const POP: ApiIsland[] = [
  { id: 1069, english_name: 'Malé', dhivehi_name: '', atoll_code_english: 'K', category: 'Residential Island', weather_anchor_id: 27 },
  { id: 1068, english_name: 'Hulhumalé', dhivehi_name: '', atoll_code_english: 'K', category: 'Residential Island', weather_anchor_id: 27 },
  { id: 1060, english_name: 'Maafushi', dhivehi_name: '', atoll_code_english: 'K', category: 'Residential Island', weather_anchor_id: 27 },
  { id: 1017, english_name: 'Thulusdhoo', dhivehi_name: '', atoll_code_english: 'K', category: 'Residential Island', weather_anchor_id: 28 },
  { id: 25, english_name: 'Ukulhas', dhivehi_name: '', atoll_code_english: 'AA', category: 'Residential Island', weather_anchor_id: 1 },
  { id: 1002, english_name: 'Fuvahmulah', dhivehi_name: '', atoll_code_english: 'Gn', category: 'Residential Island', weather_anchor_id: 26 },
];

export const DEFAULT_ISLAND = POP[0];

/** A stored or returned island is usable if it has an id and an English name. */
export function isIsland(I: unknown): I is ApiIsland {
  return !!I && typeof I === 'object' && (I as ApiIsland).id != null && !!(I as ApiIsland).english_name;
}

/** `/islands` response → entries with an English name. */
export function cleanIslands(list: unknown): ApiIsland[] | null {
  if (!Array.isArray(list)) return null;
  return list.filter((i) => i && i.english_name);
}

/** Weather cache key: many islands share a weather anchor. */
export function wxKey(I: ApiIsland): string {
  return String(I.weather_anchor_id ?? 'i' + I.id);
}

/** "K. Malé" */
export function labelOf(I: ApiIsland): string {
  return `${I.atoll_code_english}. ${I.english_name}`;
}

/** "Kaafu Atoll · Resort"; long form adds "Capital"/"Residential". */
export function atollLine(I: ApiIsland, long = false): string {
  const a = ATOLLS[I.atoll_code_english] || (I.atoll_name_english ? I.atoll_name_english + ' Atoll' : 'Maldives');
  const c = I.category ? CAT[I.category] : undefined;
  if (long) return I.id === MALE_ID ? `${a} · Capital` : `${a} · ${c || 'Residential'}`;
  return c ? `${a} · ${c}` : a;
}

const CAT_WEIGHT: Record<string, number> = { 'Residential Island': 0, 'Tourism Island': 0.3 };

/**
 * `matches()` — island search. Empty query → popular islands (fresh copies from the list when loaded).
 * Rank: name prefix / Dhivehi prefix 0, word prefix 1, substring 2, atoll match 3, plus category weight.
 * `q` must already be trimmed and lower-cased.
 */
export function matches(q: string, L: ApiIsland[] | null): ApiIsland[] {
  const pop = POP.map((p) => (L && L.find((i) => i.id === p.id)) || p);
  if (!q) return pop;
  return (L || pop)
    .map((I) => {
      const n = I.english_name.toLowerCase();
      const a = (I.atoll_code_english + ' ' + (ATOLLS[I.atoll_code_english] || I.atoll_name_english || '')).toLowerCase();
      const r =
        n.startsWith(q) || (I.dhivehi_name || '').startsWith(q)
          ? 0
          : n.split(/[\s'-]+/).some((w) => w.startsWith(q))
            ? 1
            : n.includes(q)
              ? 2
              : a.includes(q)
                ? 3
                : -1;
      return { I, r: r < 0 ? -1 : r + (CAT_WEIGHT[I.category ?? ''] ?? 0.6) };
    })
    .filter((x) => x.r >= 0)
    .sort((x, y) => x.r - y.r || x.I.english_name.localeCompare(y.I.english_name))
    .slice(0, 12)
    .map((x) => x.I);
}

/** `/islands/{id}` → details. */
export function procIsle(j: ApiIslandDetail): IslandDetail {
  return {
    description: j.description || '',
    beaches: (j.beaches || []).map((b) => ({ name: b.name, type: b.type })),
    reefs: (j.reefs || []).map((r) => ({ name: r.name, type: r.type, distance: r.distance })),
    access: (j.accessibilities || []).map((a) => a.method).filter((m): m is string => !!m),
    dv: j.dhivehi_name || '',
    lat: parseFloat(String(j.latitude_decimal)),
    lon: parseFloat(String(j.longitude_decimal)),
  };
}

/** Icon for a "Getting there" method. */
export function accIcon(s: unknown): string {
  const t = String(s || '').toLowerCase();
  return /ferry/.test(t)
    ? 'directions_boat_filled'
    : /sea ?plane/.test(t)
      ? 'flight_takeoff'
      : /aero|plane|flight|air/.test(t)
        ? 'flight'
        : /speed/.test(t)
          ? 'directions_boat'
          : /boat|dhoni/.test(t)
            ? 'sailing'
            : /bus/.test(t)
              ? 'directions_bus'
              : /taxi|car|road|bridge/.test(t)
                ? 'local_taxi'
                : /walk/.test(t)
                  ? 'directions_walk'
                  : 'route';
}
