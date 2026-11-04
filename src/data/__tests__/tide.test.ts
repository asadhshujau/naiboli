import { extrema, procTide, sceneTideLevel, tideAt, tideSrc, tideSyn, tideView } from '../tide';
import { DAY0, synthTide, tideHead1069 } from './fixtures';

describe('procTide', () => {
  it('rejects unusable payloads', () => {
    expect(procTide(null, DAY0)).toBeNull();
    expect(procTide({}, DAY0)).toBeNull();
    expect(procTide({ data: synthTide().data!.slice(0, 119) }, DAY0)).toBeNull();
    const bad = synthTide();
    bad.data![0].time_utc_plus5 = 'not a date';
    expect(procTide(bad, DAY0)).toBeNull();
  });

  it('resamples to 10-minute steps over 48 h from local midnight', () => {
    const j = synthTide();
    const T = procTide(j, DAY0)!;
    expect(T.v).toHaveLength(289);
    expect(T.v[0]).toBe(Math.fround(j.data![0].tide_m));
    expect(T.v[6]).toBe(Math.fround(j.data![60].tide_m)); // 1:00
    expect(T.v[288]).toBe(Math.fround(j.data![2879].tide_m)); // clamped to the last row
  });

  it('treats time_utc_plus5 as Maldives wall-clock time', () => {
    // Feed that starts at 06:00 local: the first 6 h clamp to the first row.
    const j = synthTide();
    j.data = j.data!.slice(360);
    const T = procTide(j, DAY0)!;
    expect(T.v[0]).toBe(Math.fround(j.data[0].tide_m));
    expect(T.v[36]).toBe(Math.fround(j.data[0].tide_m)); // 6:00
    expect(T.v[37]).toBe(Math.fround(j.data[10].tide_m)); // 6:10
  });

  it('finds alternating highs and lows', () => {
    const T = procTide(synthTide(), DAY0)!;
    expect(T.ex.length).toBeGreaterThanOrEqual(6);
    T.ex.forEach((e, i) => i && expect(e.high).toBe(!T.ex[i - 1].high));
    const hi = T.ex.filter((e) => e.high);
    expect(Math.abs(hi[1].h - hi[0].h - 12.42)).toBeLessThan(0.5);
  });

  it('keeps at least a 5 cm range', () => {
    const T = procTide(synthTide({ flat: true }), DAY0)!;
    expect(T.hi - T.lo).toBeCloseTo(0.05, 6);
  });

  it('reads source details', () => {
    expect(procTide(synthTide(), DAY0)).toMatchObject({ src: 'Malé', km: 0, same: true });
    expect(procTide(synthTide({ sameIsland: false, distanceKm: '4.63' }), DAY0)).toMatchObject({ src: 'Hulhumalé', km: 4.63, same: false });
    expect(procTide(tideHead1069, DAY0)).toMatchObject({ src: 'Malé', same: true });
  });
});

describe('tide helpers', () => {
  it('interpolates and clamps', () => {
    const T = { v: [0, 1, 3] };
    expect(tideAt(-1, T)).toBe(0);
    expect(tideAt(1 / 12, T)).toBeCloseTo(0.5);
    expect(tideAt(0.25, T)).toBeCloseTo(2);
    expect(tideAt(10, T)).toBe(3);
    expect(tideAt(5, null)).toBe(tideSyn(5));
  });

  it('describes the tide at an hour', () => {
    const T = procTide(synthTide(), DAY0)!;
    const first = T.ex[0];
    const v = tideView(first.h - 1, T);
    expect(v.rising).toBe(first.high);
    expect(v.dirText).toBe(first.high ? 'Rising' : 'Falling');
    expect(v.levelText).toMatch(/^[+−]\d\.\d\d$/);
    expect(v.n).toBeGreaterThanOrEqual(0);
    expect(v.n).toBeLessThanOrEqual(1);
    expect(tideView(47.9, T).nh).toBe('Beyond the forecast');
  });

  it('synthesises extrema without a feed', () => {
    const ex = extrema(null);
    expect(ex).toHaveLength(16);
    expect(ex[4]).toMatchObject({ h: 1, high: true });
  });

  it('maps the level into the scene range', () => {
    const T = procTide(synthTide(), DAY0)!;
    const levels = T.ex.map((e) => sceneTideLevel(e.h, T));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(-0.27 - 1e-6);
    expect(Math.max(...levels)).toBeLessThanOrEqual(0.45 + 1e-6);
  });

  it('writes the source line', () => {
    expect(tideSrc(undefined)).toBe('Loading tide feed…');
    expect(tideSrc('loading')).toBe('Loading tide feed…');
    expect(tideSrc('err')).toBe('Tide feed unavailable. Showing a typical cycle.');
    expect(tideSrc(procTide(synthTide(), DAY0)!)).toBe('Predicted for Malé');
    expect(tideSrc(procTide(synthTide({ sameIsland: false, distanceKm: '4.63' }), DAY0)!)).toBe('Estimated from Hulhumalé, 4.6 km away');
    expect(tideSrc(procTide(synthTide({ sameIsland: false, distanceKm: '23.5' }), DAY0)!)).toBe('Estimated from Hulhumalé, 24 km away');
  });
});
