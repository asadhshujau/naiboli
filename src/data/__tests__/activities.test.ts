import { ACT_ALIAS, actAt, actDefs, ACTS, apiAt, makeScorer, procActs, UNKNOWN_ACT_TIP, windowOf } from '../activities';
import { liveMood, sampleMood } from '../mood';
import { DEFAULT_SUN, sunOf } from '../sun';
import { procWx } from '../weather';
import { acts1069, DAY0, NOW_MS, weather1069 } from './fixtures';

const entry = (o: object = {}) => ({ overall_score: 6, recommendation: 'caution', breakdown: { wind: 5 }, limiting_factors: ['wind'], ...o });

describe('procActs', () => {
  it('rejects unusable payloads', () => {
    expect(procActs(null, DAY0, NOW_MS)).toBeNull();
    expect(procActs({}, DAY0, NOW_MS)).toBeNull();
    expect(procActs({ scores: [] }, DAY0, NOW_MS)).toBeNull();
    expect(procActs({ scores: [{ label: 'No id' } as never] }, DAY0, NOW_MS)).toBeNull();
  });

  it('normalises every activity id the route sends today', () => {
    const ids = ['swimming', 'snorkeling', 'diving', 'surfing', 'fishing', 'kayaking', 'sailing', 'beach_leisure', 'paddleboarding', 'jet_skiing', 'dolphin_watching', 'sandbank_visit', 'rain_walk'];
    const A = procActs({ scores: ids.map((activity) => ({ activity, ...entry() })) }, DAY0, NOW_MS)!;
    expect(A.list.map((x) => x.id)).toEqual(['swim', 'snorkel', 'dive', 'surf', 'fish', 'kayak', 'sail', 'beach', 'sup', 'jet', 'dolphin', 'sandbank', 'rainwalk']);
    for (const x of A.list) expect(ACTS.some((a) => a.id === x.id)).toBe(true);
    expect(Object.values(ACT_ALIAS).every((id) => ACTS.some((a) => a.id === id))).toBe(true);
  });

  it('keeps unknown activities under an x-prefixed id, and dedupes', () => {
    const A = procActs(
      { scores: [{ activity: 'kite_surfing', ...entry() }, { activity: 'Swimming', ...entry({ overall_score: 9 }) }, { activity: 'swimming', ...entry({ overall_score: 1 }) }, { activity: 'mystery', label: 'Sailing', ...entry() }] },
      DAY0,
      NOW_MS,
    )!;
    expect(A.list.map((x) => [x.id, x.label])).toEqual([['xkitesurfing', 'Kite surfing'], ['swim', 'Swimming'], ['sail', 'Sailing']]);
    expect(A.byId.swim.now.s).toBe(9);
    const d = actDefs(A).find((x) => x.id === 'xkitesurfing')!;
    expect(d).toMatchObject({ name: 'Kite surfing', icon: 'kitesurfing', i: -1, tip: UNKNOWN_ACT_TIP });
  });

  it('parses entries defensively', () => {
    const A = procActs(
      { scores: [{ activity: 'surfing', overall_score: '12', conditions_score: null, breakdown: null, limiting_factors: null, tide_available: false, hours: [{ dt: DAY0 + 16 * 3600, overall_score: 3 }, { dt: 0 as never }, { dt: DAY0 + 15 * 3600, overall_score: -2 }], days: [{ date: '2026-11-05', overall_score: 7 }, { date: 'bogus' }] }] },
      DAY0,
      NOW_MS,
    )!;
    const x = A.byId.surf;
    expect(x.now).toEqual({ s: 10, c: null, rec: '', br: {}, lim: [], tideOk: false });
    expect(x.hours.map((y) => [y.h, y.s])).toEqual([[15, 0], [16, 3]]);
    expect(x.days.map((y) => [y.di, y.s])).toEqual([[1, 7]]);
    expect(A.at).toBeCloseTo(14 + 20 / 60, 9);
  });

  it('parses the real payload', () => {
    const A = procActs(acts1069, DAY0, NOW_MS)!;
    expect(A.list.map((x) => x.id)).toEqual(['swim', 'sail', 'jet', 'rainwalk']);
    expect(A.byId.swim.hours[0].h).toBe(14);
    expect(A.byId.swim.days[0].di).toBe(0);
    expect(A.byId.swim.days).toHaveLength(7);
  });
});

describe('apiAt / actAt', () => {
  const A = procActs(acts1069, DAY0, NOW_MS)!;
  const swim = A.byId.swim;
  it('uses "now" for the fetch hour and earlier, hourly after, null beyond', () => {
    expect(apiAt(A, swim, 14.9)).toBe(swim.now);
    expect(apiAt(A, swim, 13)).toBe(swim.now);
    expect(apiAt(A, swim, 15.3)).toBe(swim.hours[1]);
    expect(apiAt(A, swim, 14 + swim.hours.length + 0.5)).toBeNull();
  });

  it('falls back to the local estimate beyond the route data', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const sun = sunOf(W);
    const score = makeScorer(liveMood(W, 14.33, sun), sun, null);
    const def = actDefs(A).find((x) => x.id === 'swim')!;
    expect(actAt(A, def, 15.3, score).e).toBe(swim.hours[1]);
    const far = actAt(A, def, 60, score);
    expect(far.e).toBeNull();
    expect(far.s).toBe(score(def.i, 60));
  });

  it('shows the 14 built-ins before scores load, scored locally', () => {
    const defs = actDefs(null);
    expect(defs.map((d) => d.id)).toEqual(ACTS.map((a) => a.id));
    const m = sampleMood('K. Malé', 13, 'loading');
    const r = actAt(null, defs[0], 13, makeScorer(m, DEFAULT_SUN, null));
    expect(r.e).toBeNull();
    expect(r.s).toBe(m.scores[0]);
  });
});

describe('makeScorer', () => {
  it('memoises live scores per quarter hour like the prototype', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const sun = sunOf(W);
    const score = makeScorer(liveMood(W, 14.33, sun), sun, null);
    expect(score(1, 15.01)).toBe(score(1, 14.99));
  });
});

describe('windowOf', () => {
  it('reports no window under 5', () => {
    expect(windowOf(() => ({ s: 4.9, k: 'skip' }), 13).text).toBe('No great window today');
  });
  it('spans hours within 0.6 of the best and labels tomorrow', () => {
    const at = (h: number) => ({ s: Math.floor(h) >= 15 && Math.floor(h) <= 17 ? 8 : Math.floor(h) === 18 ? 7.5 : 3, k: 'go' as const });
    expect(windowOf(at, 13.2).text).toBe('3 PM–7 PM');
    const late = (h: number) => ({ s: Math.floor(h) === 31 ? 9 : 2, k: 'go' as const });
    expect(windowOf(late, 13.2).text).toBe('Tomorrow 7 AM–8 AM');
  });
});
