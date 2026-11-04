import { DEFAULT_SUN, sunOf, sunState } from '../sun';
import type { ApiWeatherResponse } from '../types';
import { moonAt, moonDataFor, moonSvg, procWx, sample, wxAt } from '../weather';
import { DAY0, NOW_MS, weather1069 } from './fixtures';

describe('procWx', () => {
  it('rejects unusable payloads', () => {
    expect(procWx(null, DAY0, NOW_MS)).toBeNull();
    expect(procWx({}, DAY0, NOW_MS)).toBeNull();
    expect(procWx({ data: { hourly: [] } } as ApiWeatherResponse, DAY0, NOW_MS)).toBeNull();
    expect(procWx({ data: { current: weather1069.data!.current } } as ApiWeatherResponse, DAY0, NOW_MS)).toBeNull();
  });

  it('puts "current" first on the Maldives hour axis and converts units', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    const c = weather1069.data!.current!;
    expect(W.hrs[0].h).toBeCloseTo((c.dt - DAY0) / 3600, 9);
    expect(W.hrs[0].h).toBeGreaterThan(14);
    expect(W.hrs[0].h).toBeLessThan(14.1);
    expect(W.hrs[0].wind).toBeCloseTo(c.wind_speed! * 3.6, 9);
    expect(W.hrs[0].vis).toBe(10);
    // current has no pop: it's taken from the first hourly entry
    expect(W.hrs[0].pop).toBe((weather1069.data!.hourly![0].pop ?? 0) * 100);
  });

  it('drops hourly entries at or before "current"', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    // hourly[0] is 14:00, current is 14:00:15 → dropped
    expect(W.hrs).toHaveLength(weather1069.data!.hourly!.length);
    expect(W.hrs[1].h).toBe(15);
    for (let i = 2; i < W.hrs.length; i++) expect(W.hrs[i].h - W.hrs[i - 1].h).toBe(1);
  });

  it('defaults missing fields', () => {
    const W = procWx({ data: { current: { dt: DAY0 + 3600, temp: 28 }, hourly: [] } }, DAY0, NOW_MS)!;
    expect(W.hrs[0]).toEqual({ h: 1, temp: 28, feels: 28, hum: 70, clouds: 0, vis: 10, wind: 0, gust: 0, deg: 0, uvi: 0, pop: 0, id: 800, mm: 0 });
    expect(W.at).toBeNull();
    expect(W.days).toEqual([]);
  });

  it('reads observed_at, falling back to updated_at', () => {
    expect(procWx(weather1069, DAY0, NOW_MS)!.at).toBeCloseTo(14.004, 3);
    const j = { ...weather1069, observed_at: null, updated_at: '2026-11-04T13:30:00+05:00' };
    expect(procWx(j, DAY0, NOW_MS)!.at).toBe(13.5);
  });

  it('parses days with sun and moon times', () => {
    const W = procWx(weather1069, DAY0, NOW_MS)!;
    expect(W.days).toHaveLength(8);
    const sun = sunOf(W);
    expect(sun.rise).toBeCloseTo(5 + 50 / 60, 1);
    expect(sun.set).toBeCloseTo(17 + 48 / 60, 1);
    expect(W.moon.days[0].mp).toBe(0.84);
    expect(W.moon.iv.length).toBeGreaterThan(5);
  });
});

describe('sample', () => {
  const W = procWx(weather1069, DAY0, NOW_MS)!;
  it('clamps outside the data', () => {
    expect(sample(W.hrs, -5)).toBe(W.hrs[0]);
    expect(sample(W.hrs, 999)).toBe(W.hrs[W.hrs.length - 1]);
  });
  it('interpolates numbers and takes deg/id from the nearer hour', () => {
    const [p, q] = [W.hrs[3], W.hrs[4]];
    const s = sample(W.hrs, p.h + 0.25);
    expect(s.temp).toBeCloseTo(p.temp + (q.temp - p.temp) * 0.25, 9);
    expect(s.deg).toBe(p.deg);
    expect(sample(W.hrs, p.h + 0.75).id).toBe(q.id);
  });
  it('feeds the scene', () => {
    const x = wxAt(W.hrs, 15);
    expect(x.wind).toBeGreaterThanOrEqual(1);
    expect(x.gloom).toBeGreaterThanOrEqual(0);
    expect(x.gloom).toBeLessThanOrEqual(1);
  });
});

describe('sun and moon', () => {
  it('sunState runs 0→1 through the day and night', () => {
    // (exactly at RISE, md24's float drift makes it night — same as the prototype)
    expect(sunState(DEFAULT_SUN.rise + 1e-9, DEFAULT_SUN)).toMatchObject({ day: true });
    expect(sunState(DEFAULT_SUN.rise + 1e-9, DEFAULT_SUN).f).toBeCloseTo(0, 6);
    expect(sunState(11.82, DEFAULT_SUN).el).toBeCloseTo(1, 3);
    expect(sunState(23.82, DEFAULT_SUN)).toMatchObject({ day: false });
    expect(sunState(23.82, DEFAULT_SUN).el).toBeCloseTo(-1, 2);
    expect(sunState(24 + 12, DEFAULT_SUN).el).toBeCloseTo(sunState(12, DEFAULT_SUN).el, 12);
  });
  it('moon fallback and svg', () => {
    const M = moonDataFor(null, DAY0, DEFAULT_SUN);
    expect(M.iv).toHaveLength(4);
    const s = moonAt(M, 12);
    expect(s.illum).toBeGreaterThanOrEqual(0);
    expect(s.illum).toBeLessThanOrEqual(1);
    expect(moonSvg(0.5)).toBe('M50 10 A40 40 0 0 0 50 90 A40.00 40 0 0 0 50 10 Z');
  });
});
