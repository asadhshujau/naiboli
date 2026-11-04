/**
 * Parity: the native port must produce exactly what the HTML prototype's logic produces
 * for the same inputs.
 */
import { actAt, actDefs, ACTS, apiAt, liveScore, makeScorer, procActs, sampleScore, windowOf } from '../activities';
import { matches } from '../islands';
import { liveMood, MOODS, resolveMood } from '../mood';
import { DEFAULT_SUN, sunOf, sunState } from '../sun';
import { extrema, procTide, tideAt, tideSrc, tideView } from '../tide';
import { fmt } from '../time';
import type { Tide } from '../types';
import { cloudNOf, gloomOf, keyOf, moonDataFor, moonInfo, owmCond, owmIcon, phrasesOf, procWx, rainAmtOf, sample, weekDays } from '../weather';
import { acts1069, DAY0, islandsQuarter, islandsSmall, NOW_MS, stormyWeather, synthTide, tideHead1069, weather1069 } from './fixtures';
import { loadPrototype, type Proto } from './prototype';

let P: Proto;
const strip = <T extends { fetched?: number }>(x: T) => {
  const { fetched, ...rest } = x;
  return rest;
};

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  P = loadPrototype();
  P.setDay0(DAY0);
});
afterAll(() => jest.restoreAllMocks());

const HOURS = Array.from({ length: 4 * 50 }, (_, i) => -2 + i * 0.25 + 0.03);

describe('weather', () => {
  it('procWx matches on the real payload', () => {
    const c = P.make();
    const mine = procWx(weather1069, DAY0, NOW_MS)!;
    expect(strip(mine)).toEqual(strip(c.procWx(weather1069)));
    expect(mine.fetched).toBe(NOW_MS);
  });

  it('procWx matches on the stormy payload', () => {
    const j = stormyWeather();
    expect(strip(procWx(j, DAY0, NOW_MS)!)).toEqual(strip(P.make().procWx(j)));
  });

  it('sample, keyOf, phrasesOf and the scene drivers match across 50 h', () => {
    const c = P.make();
    for (const j of [weather1069, stormyWeather()]) {
      const W = procWx(j, DAY0, NOW_MS)!;
      const sun = sunOf(W);
      P.setSun(sun.rise, sun.set);
      for (const h of HOURS) {
        const s = sample(W.hrs, h);
        expect(s).toEqual(c.sample(W, h));
        expect(keyOf(s, h, sun)).toBe(c.keyOf(s, h));
        expect(phrasesOf(s)).toEqual(c.phrasesOf(s));
        expect(gloomOf(s)).toBe(P.gloomOf(s));
        expect(rainAmtOf(s)).toBe(P.rainAmtOf(s));
        expect(cloudNOf(s.clouds)).toBe(P.cloudNOf(s.clouds));
        expect(sunState(h, sun)).toEqual(P.sunState(h));
      }
    }
  });

  it('keyOf / phrasesOf / scene drivers match across a grid of conditions', () => {
    const c = P.make();
    P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
    const base = sample(procWx(weather1069, DAY0, NOW_MS)!.hrs, 14);
    for (const id of [200, 211, 300, 500, 501, 502, 520, 600, 701, 800, 801, 802, 803, 804]) {
      for (let clouds = 0; clouds <= 100; clouds += 1) {
        for (const wind of [0, 5, 11.6, 12, 19.6, 20, 29.5, 30, 39.9, 40, 60]) {
          for (const h of [3, 6.2, 9, 12.5, 16.9, 17.5, 19]) {
            const s = { ...base, id, clouds, wind, pop: clouds * 0.8, vis: 3 + (clouds % 9), mm: id >= 500 && id < 600 ? clouds / 30 : 0 };
            expect(keyOf(s, h, DEFAULT_SUN)).toBe(c.keyOf(s, h));
            expect(phrasesOf(s)).toEqual(c.phrasesOf(s));
          }
          const s = { ...base, id, clouds, wind, mm: id >= 500 && id < 600 ? clouds / 30 : 0 };
          expect(gloomOf(s)).toBe(P.gloomOf(s));
          expect(rainAmtOf(s)).toBe(P.rainAmtOf(s));
          expect(cloudNOf(clouds)).toBe(P.cloudNOf(clouds));
        }
      }
    }
  });

  it('owmIcon / owmCond match for every condition id', () => {
    for (let id = 199; id <= 805; id++) {
      for (const day of [true, false]) {
        expect(owmIcon(id, day)).toBe(P.owmIcon(id, day));
        expect(owmCond(id, day)).toBe(P.owmCond(id, day));
      }
    }
  });

  it('liveMood matches (incl. warnings and RISE/SET side effect)', () => {
    for (const j of [weather1069, stormyWeather()]) {
      P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
      const c = P.make();
      const W = procWx(j, DAY0, NOW_MS)!;
      const theirs = c.liveMood(W);
      const sun = sunOf(W);
      expect([sun.rise, sun.set]).toEqual(P.getSun());
      const mine = liveMood(W, (NOW_MS / 1000 - DAY0) / 3600, sun);
      const { loading, offline, ...rest } = mine;
      expect(rest).toEqual(theirs);
    }
    // across 40 h of "now" values (prototype reads the clock)
    for (const j of [weather1069, stormyWeather()]) {
      const W = procWx(j, DAY0, NOW_MS)!;
      const sun = sunOf(W);
      for (let k = -6; k < 160; k++) {
        const t = NOW_MS + k * 15 * 60000;
        (Date.now as jest.Mock).mockReturnValue(t);
        P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
        const theirs = P.make().liveMood(W);
        const { loading, offline, ...rest } = liveMood(W, (t / 1000 - DAY0) / 3600, sun);
        expect(rest).toEqual(theirs);
      }
    }
    (Date.now as jest.Mock).mockReturnValue(NOW_MS);
    // the injected storm produces a warning
    const W = procWx(stormyWeather(), DAY0, NOW_MS)!;
    expect(liveMood(W, (NOW_MS / 1000 - DAY0) / 3600, sunOf(W)).warning).not.toBeNull();
  });

  it('resolveMood mirrors mood(): live, last-good bridge, sample', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const h = (NOW_MS / 1000 - DAY0) / 3600;
    expect(resolveMood({ W, lastW: null, label: 'K. Malé', nowH: h, prevSun: DEFAULT_SUN }).mood).toMatchObject({ live: true, loading: false });
    expect(resolveMood({ W: 'loading', lastW: W, label: 'K. Malé', nowH: h, prevSun: DEFAULT_SUN }).mood).toMatchObject({ live: true, loading: true });
    // a failed fetch for this island does not fall back to another island's weather
    const off = resolveMood({ W: 'err', lastW: W, label: 'K. Malé', nowH: h, prevSun: DEFAULT_SUN }).mood;
    expect(off).toMatchObject({ live: false, offline: true, loading: false, key: 'partly' });

    const c = P.make();
    c.state.wx = { 27: 'loading' };
    const theirs = c.mood();
    const mine = resolveMood({ W: 'loading', lastW: null, label: 'K. Malé', nowH: h, prevSun: DEFAULT_SUN }).mood;
    const { warning, flash, updated, ...rest } = mine as any;
    expect(rest).toEqual({ ...theirs, hour: theirs.hour });
    expect(MOODS.partly.headEn).toBe(theirs.headEn);
  });

  it('moon info matches (live data)', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const sun = sunOf(W);
    P.setSun(sun.rise, sun.set);
    const c = P.make();
    const m = { live: true, W };
    const M = moonDataFor(W, DAY0, sun);
    for (const h of HOURS) expect(moonInfo(M, h, DAY0)).toEqual(c.moonInfo(m, h));
  });

  it('moon info matches (fallback)', () => {
    P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
    const c = P.make();
    const M = moonDataFor(null, DAY0, DEFAULT_SUN);
    for (const h of HOURS) expect(moonInfo(M, h, DAY0)).toEqual(c.moonInfo({ live: false }, h));
  });

  it('weekDays matches', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    expect(weekDays(W, DAY0)).toEqual(P.make().weekDays({ live: true, W }));
  });
});

describe('tide', () => {
  const cases: [string, any][] = [
    ['real head (180 rows)', tideHead1069],
    ['synthetic 48 h', synthTide()],
    ['synthetic starting yesterday', synthTide({ startDate: '2026-11-03' })],
    ['synthetic flat', synthTide({ flat: true })],
    ['synthetic, 4.6 km away', synthTide({ sameIsland: false, distanceKm: '4.63' })],
    ['synthetic, 23 km away', synthTide({ sameIsland: false, distanceKm: '23.2' })],
  ];

  it.each(cases)('procTide matches: %s', (_, j) => {
    const theirs = P.make().procTide(j);
    const mine = procTide(j, DAY0)!;
    expect(mine.v).toEqual(Array.from(theirs.v));
    const { v, ...rest } = mine;
    const { v: tv, ...trest } = theirs;
    expect(rest).toEqual(trest);
  });

  it.each(cases)('tideAt, tide(), extrema and tideSrc match: %s', (_, j) => {
    const c = P.make();
    const T = procTide(j, DAY0)!;
    P.setTide(c.procTide(j));
    for (const h of HOURS) {
      expect(tideAt(h, T)).toBeCloseTo(P.tideAt(h), 12);
      expect(tideView(h, T)).toEqual(c.tide(h));
    }
    expect(extrema(T)).toEqual(c.extrema());
    c.state.loc = 1069;
    c.state.tides = { 1069: c.procTide(j) };
    expect(tideSrc(T)).toBe(c.tideSrc());
    P.setTide(null);
  });

  it('synthetic tide (no feed) matches', () => {
    const c = P.make();
    P.setTide(null);
    for (const h of HOURS) expect(tideView(h, null)).toEqual(c.tide(h));
    expect(extrema(null)).toEqual(c.extrema());
    for (const st of [undefined, 'loading', 'err'] as const) {
      c.state.loc = 1069;
      c.state.tides = st ? { 1069: st } : {};
      expect(tideSrc(st)).toBe(c.tideSrc());
    }
  });
});

describe('activities', () => {
  it('procActs matches on the real payload', () => {
    const mine = procActs(acts1069, DAY0, NOW_MS)!;
    const theirs = P.make().procActs(acts1069);
    expect(strip(mine)).toEqual(strip(theirs));
  });

  it.each([0, 25, 50, 80])('apiAt, actDefs and actAt match (scores fetched +%i min)', (mins) => {
    (Date.now as jest.Mock).mockReturnValue(NOW_MS + mins * 60000);
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const sun = sunOf(W);
    P.setSun(sun.rise, sun.set);
    const c = P.make();
    const AD = procActs(acts1069, DAY0, NOW_MS + mins * 60000)!;
    expect(strip(AD)).toEqual(strip(c.procActs(acts1069)));
    const m = liveMood(W, (NOW_MS / 1000 - DAY0) / 3600, sun);
    c.state.loc = 1069;
    c.state.acts = { 1069: AD };
    const defs = actDefs(AD);
    expect(defs).toEqual(c.actDefs(AD));
    expect(actDefs(null)).toEqual(c.actDefs(null));
    const score = makeScorer(m, sun, null);
    for (const a of defs) {
      for (const h of HOURS) {
        expect(apiAt(AD, a.api!, h)).toEqual(c.apiAt(AD, a.api, h));
        expect(actAt(AD, a, h, score)).toEqual(c.actAt(m, AD, a, h));
      }
    }
    (Date.now as jest.Mock).mockReturnValue(NOW_MS);
  });

  it('liveScore matches for all 14 built-ins, with and without a tide feed', () => {
    const W = procWx(stormyWeather(), DAY0, NOW_MS)!;
    const sun = sunOf(W);
    P.setSun(sun.rise, sun.set);
    for (const tj of [null, synthTide()]) {
      const c = P.make();
      const T: Tide | null = tj ? procTide(tj, DAY0) : null;
      P.setTide(tj ? c.procTide(tj) : null);
      const m = { live: true, W };
      for (let i = 0; i < ACTS.length; i++) {
        // quarter-hour points so the prototype's quarter-hour cache can't skew the comparison
        for (let q = -8; q < 200; q++) expect(liveScore(W.hrs, i, q / 4, sun, T)).toBeCloseTo(c.liveScore(m, i, q / 4), 12);
      }
    }
    P.setTide(null);
  });

  it('sample-mood scores match for every mood', () => {
    P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
    const c = P.make();
    for (const key of Object.keys(MOODS) as (keyof typeof MOODS)[]) {
      const m = { ...P.MOODS[key], hour: 13.3 };
      for (let i = 0; i < ACTS.length; i++) for (const h of HOURS) expect(sampleScore(MOODS[key].scores, 13.3, i, h, DEFAULT_SUN)).toBeCloseTo(c.scoreAt(m, i, h), 12);
    }
  });

  it('windowOf matches', () => {
    const c = P.make();
    const fns = [
      (h: number) => ({ s: 6 + 3 * Math.sin(h / 3), k: 'go' as const }),
      (h: number) => ({ s: 2 + Math.cos(h), k: 'skip' as const }),
      (h: number) => ({ s: h > 30 ? 9 : 4, k: 'go' as const }),
    ];
    for (const fn of fns) for (const h0 of [0.2, 13.27, 22.9]) expect(windowOf(fn, h0)).toEqual(c.windowOf(fn, h0));
  });
});

describe('islands', () => {
  it('matches() ranks like the prototype', () => {
    const c = P.make();
    c.state.islands = islandsSmall;
    for (const q of ['', 'm', 'ma', 'fun', 'dhoo', 'kaafu', 'baa', 'aa', 'gn', 'zzz', 'hulhu', 'é']) {
      expect(matches(q, islandsSmall).map((i) => i.id)).toEqual(c.matches(q).map((i: any) => i.id));
    }
    c.state.islands = islandsQuarter;
    const qs = ['a', 'b', 'f', 'h', 'k', 'm', 'ma', 'mu', 'hu', 'fu', 'dh', 'dhoo', 'fushi', 'gaa', 'vil', 'kaafu', 'raa', 'resort', 'l', 'th'];
    for (const q of qs) expect(matches(q, islandsQuarter).map((i) => i.id)).toEqual(c.matches(q).map((i: any) => i.id));
    c.state.islands = null;
    expect(matches('ma', null)).toEqual(c.matches('ma'));
  });
});

describe('time', () => {
  it('fmt matches', () => {
    for (let h = -3; h < 50; h += 0.013) expect(fmt(h)).toBe(P.fmt(h));
  });
});

