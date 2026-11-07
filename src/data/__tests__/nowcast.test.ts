import { rainNow } from '../copy';
import { alertDangerAt, alertsAhead, liveMood, warningOf } from '../mood';
import { DRY_BELOW, nowcastLine, nowcastOf, nowcastReason, nowcastTail, rainWord } from '../nowcast';
import { sunOf } from '../sun';
import type { ApiWeatherResponse, ApiWxPoint, Weather } from '../types';
import { procWx, rainAmtOf, rainAmtOfMm, weekDays } from '../weather';
import { mmText } from '../../state/sheets';

/** Local midnight 2026-11-07 (MVT); 17:00 = 1794052800. */
const DAY0 = 1794052800 - 17 * 3600;
const at = (hh: number, mm = 0) => DAY0 + hh * 3600 + mm * 60;
const H = (hh: number, mm = 0) => hh + mm / 60;

/** Minute forecast of the real Sh. atoll snapshot, 2026-11-07 16:48 (island 890): rain building all hour. */
const MIN_890 = [
  0.2038, 0.2204, 0.237, 0.2528, 0.2686, 0.2844, 0.3002, 0.316, 0.337, 0.358, 0.379, 0.4, 0.421, 0.4492, 0.4774, 0.5056, 0.5338, 0.562,
  0.5994, 0.6368, 0.6742, 0.7116, 0.749, 0.7722, 0.7954, 0.8186, 0.8418, 0.865, 0.8918, 0.9186, 0.9454, 0.9722, 0.999, 1.0298, 1.0606,
  1.0914, 1.1222, 1.153, ...Array(10).fill(1.153), 1.1222, 1.0914, 1.0606, 1.0298, 0.999, ...Array(5).fill(0.999), 0.949, 0.899,
];

const pt = (dt: number, id: number, o: Partial<ApiWxPoint> = {}): ApiWxPoint => ({
  dt,
  temp: 26.3,
  feels_like: 26.3,
  humidity: 85,
  clouds: 100,
  visibility: 10000,
  wind_speed: 2.5,
  wind_gust: 2.9,
  wind_deg: 122,
  uvi: 0,
  pop: 1,
  weather: [{ id }],
  ...o,
});

/** The 890 snapshot, trimmed: current, minutely, a few hours, two days, the official alert. */
function payload890(o: { minutely?: number[] | null; currentId?: number; alerts?: unknown[] } = {}): ApiWeatherResponse {
  const minutely = o.minutely === null ? undefined : (o.minutely ?? MIN_890).map((precipitation, i) => ({ dt: at(16, 48) + i * 60, precipitation }));
  return {
    observed_at: '2026-11-07T16:48:31+05:00',
    data: {
      current: pt(at(16, 47) + 18, o.currentId ?? 500, { rain: { '1h': 0.19 } }),
      minutely,
      hourly: [
        pt(at(16), 501, { rain: { '1h': 1.19 } }),
        pt(at(17), 500, { rain: { '1h': 0.42 } }),
        pt(at(18), 500, { rain: { '1h': 0.42 } }),
        pt(at(19), 804, { pop: 0.8 }),
        pt(at(20), 501, { rain: { '1h': 1.32 } }),
        pt(at(21), 500, { rain: { '1h': 0.87 } }),
      ],
      daily: [
        { dt: at(12), sunrise: at(5, 54), sunset: at(17, 47), temp: { min: 25.6, max: 28.3 }, pop: 1, rain: 15.22, weather: [{ id: 501 }] },
        { dt: at(36), sunrise: at(29, 55), sunset: at(41, 47), temp: { min: 26, max: 27.7 }, pop: 1, rain: 11.32, weather: [{ id: 501 }] },
      ],
      alerts: (o.alerts ?? [
        {
          sender_name: 'alert@meteorology.gov.mv',
          event: 'Thunderstorms, Gust, Heavy rain',
          start: at(16),
          end: at(22),
          description: 'Heavy rain and thunderstorms with gusts of 35 mph expected.',
          tags: ['Wind', 'Rain', 'Thunderstorm'],
        },
      ]) as never,
    },
  };
}

const wx = (o?: Parameters<typeof payload890>[0]) => procWx(payload890(o), DAY0, at(17, 5) * 1000)!;

/** A Weather with just a synthetic minute forecast starting at `from` (hour axis). */
function withMinutes(mm: number[], from = H(17)): Weather {
  return { ...wx({ minutely: null }), min: mm.map((x, i) => ({ h: from + i / 60, mm: x })) };
}

describe('parsing', () => {
  it('reads minutely, daily rain and alerts when present', () => {
    const W = wx();
    expect(W.min).toHaveLength(60);
    expect(W.min![0]).toEqual({ h: H(16, 48), mm: 0.2038 });
    expect(W.days.map((d) => d.mm)).toEqual([15.22, 11.32]);
    expect(W.alerts).toEqual([
      { start: 16, end: 22, event: 'Thunderstorms, Gust, Heavy rain', desc: 'Heavy rain and thunderstorms with gusts of 35 mph expected.', sender: 'alert@meteorology.gov.mv', tags: ['Wind', 'Rain', 'Thunderstorm'] },
    ]);
    expect(weekDays(W, DAY0)[0].mm).toBe(15.22);
  });

  it('treats them as optional: missing or junk → null, nothing else changes', () => {
    const j = payload890({ minutely: null, alerts: [] });
    delete (j.data as any).alerts;
    (j.data as any).daily.forEach((d: any) => delete d.rain);
    const W = procWx(j, DAY0, 0)!;
    expect(W.min).toBeNull();
    expect(W.alerts).toBeNull();
    expect(W.days.every((d) => d.mm === null)).toBe(true);
    const junk = payload890();
    (junk.data as any).minutely = [{ dt: 'x' }, null, { dt: at(17), precipitation: NaN }];
    (junk.data as any).alerts = [{ event: 'no times' }, { start: at(18), end: at(17) }];
    const J = procWx(junk, DAY0, 0)!;
    expect(J.min).toBeNull();
    expect(J.alerts).toBeNull();
  });
});

describe('nowcast (careful reading of the minute forecast)', () => {
  it('the 890 snapshot at 5:05 PM: light rain, picking up', () => {
    const c = nowcastOf(wx(), H(17, 5))!;
    expect(c).toMatchObject({ wetNow: true, kind: 'rain', trend: 'heavier', at: null });
    expect(c.mm).toBeCloseTo((0.562 + 0.5994 + 0.6368 + 0.6742 + 0.7116) / 5, 4);
    expect(nowcastLine(c, true)).toBe('Light rain, picking up');
    expect(nowcastReason(c)).toBe('rain, picking up');
  });

  it('needs 10+ minutes still ahead: an old snapshot says nothing', () => {
    expect(nowcastOf(wx(), H(17, 37))).not.toBeNull(); // 11 minutes left
    expect(nowcastOf(wx(), H(17, 40))).toBeNull(); // 8 left
    expect(nowcastOf(wx(), H(19))).toBeNull();
    expect(nowcastOf(wx({ minutely: null }), H(17, 5))).toBeNull();
    expect(nowcastOf(null, H(17))).toBeNull();
  });

  it('only the next 30 minutes count', () => {
    // dry for 30 minutes, then a downpour: still "dry"
    const c = nowcastOf(withMinutes([...Array(30).fill(0), ...Array(30).fill(5)]), H(17))!;
    expect(c.kind).toBe('dry');
    expect(nowcastLine(c, false)).toBe('Looks dry for the next half hour');
    expect(nowcastLine(c, true)).toBe('Easing off. Looks dry for now');
    expect(nowcastReason(c)).toBeNull();
  });

  it('calls a start or stop only when it then holds, at a rounded time, hedged', () => {
    const start = nowcastOf(withMinutes([...Array(17).fill(0), ...Array(43).fill(0.6)]), H(17))!;
    expect(start).toMatchObject({ kind: 'starting', wetNow: false, at: H(17, 15), inMin: 15 });
    expect(nowcastLine(start, false)).toBe('Rain likely from around 5:15 PM');
    expect(nowcastReason(start)).toBe('rain from around 5:15 PM');

    const soon = nowcastOf(withMinutes([...Array(6).fill(0), ...Array(54).fill(0.6)]), H(17))!;
    expect(soon.kind).toBe('starting');
    expect(nowcastLine(soon, false)).toBe('Rain likely any minute');

    const stop = nowcastOf(withMinutes([...Array(12).fill(1.5), ...Array(48).fill(0)]), H(17))!;
    expect(stop).toMatchObject({ kind: 'stopping', wetNow: true, at: H(17, 10) });
    expect(nowcastLine(stop, true)).toBe('Steady rain, should ease around 5:10 PM');

    // a stop in the last few minutes of the window doesn't hold long enough: just rain
    const late = nowcastOf(withMinutes([...Array(26).fill(0.5), ...Array(34).fill(0)]), H(17))!;
    expect(late.kind).toBe('patchy');
  });

  it('on and off is said as on and off', () => {
    const flip = Array.from({ length: 60 }, (_, i) => (Math.floor(i / 4) % 2 ? 0 : 0.4));
    const c = nowcastOf(withMinutes(flip), H(17))!;
    expect(c.kind).toBe('patchy');
    expect(nowcastLine(c, true)).toBe('Rain on and off for now');
    expect(nowcastReason(c)).toBe('rain on and off');
  });

  it('"now" is a 5-minute mean: one wet minute is not rain', () => {
    const c = nowcastOf(withMinutes([0.3, ...Array(59).fill(0)]), H(17))!;
    expect(c.wetNow).toBe(false);
    expect(c.mm).toBeLessThan(DRY_BELOW);
  });

  it('the follow-on under the headline never repeats the rain word', () => {
    const W = withMinutes([...Array(12).fill(1.5), ...Array(48).fill(0)]);
    expect(nowcastTail(nowcastOf(W, H(17))!, true)).toBe('Should ease around 5:10 PM.');
    expect(nowcastTail(nowcastOf(wx(), H(17, 5))!, true)).toBe('Picking up for now.');
    expect(nowcastTail(nowcastOf(withMinutes(Array(60).fill(0)), H(17))!, true)).toBe('Easing off. Looks dry for now.');
  });

  it('rain words follow OpenWeather (light under 1 mm/h, heavy from 4)', () => {
    expect([0.2, 0.99, 1, 3.9, 4, 12].map(rainWord)).toEqual(['Light', 'Light', 'Steady', 'Steady', 'Heavy', 'Heavy']);
  });
});

describe('now follows the minutes', () => {
  it('890 at 5:05 PM: rain from the minutes, line under the headline, Weather line', () => {
    const W = wx();
    const m = liveMood(W, H(17, 5), sunOf(W));
    expect(m.nc?.kind).toBe('rain');
    expect(m.key).toBe('rainy');
    expect(m.phrases.rain).toBe('Light rain, picking up');
    expect(m.sub).toBe('Light rain, feels like 26°. Picking up for now.');
    expect(m.rainAmt).toBeCloseTo(rainAmtOfMm(m.nc!.mm), 6);
  });

  it('a dry code turns to rain when the minutes say it is raining now', () => {
    const W = { ...wx({ currentId: 804 }), min: Array.from({ length: 60 }, (_, i) => ({ h: H(16, 48) + i / 60, mm: 0.6 })) };
    W.hrs = W.hrs.map((s) => ({ ...s, id: 804, mm: 0 }));
    const m = liveMood(W, H(17, 5), sunOf(W));
    expect(m.key).toBe('rainy');
    expect(m.cond).toBe('Light rain');
    expect(m.rainAmt).toBeGreaterThan(0.4);
  });

  it('rain turns dry only when the whole half hour is dry; otherwise the observed code stays', () => {
    const base = wx({ minutely: null });
    const dry = { ...base, min: Array.from({ length: 60 }, (_, i) => ({ h: H(16, 48) + i / 60, mm: 0 })) };
    const m = liveMood(dry, H(17, 5), sunOf(dry));
    expect(m.key).not.toBe('rainy');
    expect(m.phrases.rain).toBe('Easing off. Looks dry for now');
    const starting = { ...base, min: Array.from({ length: 60 }, (_, i) => ({ h: H(16, 48) + i / 60, mm: i > 35 ? 0.5 : 0 })) };
    expect(liveMood(starting, H(17, 5), sunOf(starting)).key).toBe('rainy');
  });

  it('no minutes → exactly as before; thunder ignores the minutes', () => {
    const W = wx({ minutely: null });
    const m = liveMood(W, H(17, 5), sunOf(W));
    expect(m.nc).toBeNull();
    expect(m.phrases.rain).toBe('Raining now');
    const T = { ...wx(), hrs: wx().hrs.map((s) => ({ ...s, id: 211 })) };
    expect(liveMood(T, H(17, 5), sunOf(T)).nc).toBeNull();
  });

  it('rain flag for the copy, from the minutes', () => {
    expect(rainNow({ wetNow: true, kind: 'rain' }, 100)).toBe('wet');
    expect(rainNow({ wetNow: false, kind: 'starting' }, 10)).toBe('damp');
    expect(rainNow({ wetNow: false, kind: 'dry' }, 80)).toBe('damp');
    expect(rainNow({ wetNow: false, kind: 'dry' }, 30)).toBeNull();
  });
});

describe('official alerts', () => {
  it('the MMS alert drives the warning chip, bubble and Weather card', () => {
    const W = wx({ minutely: null });
    const w = warningOf(W, H(17, 5))!;
    expect(w).toEqual({
      short: 'Thunderstorms, Gust, Heavy rain',
      title: 'Weather alert',
      until: '10:00 PM',
      body: 'Heavy rain and thunderstorms with gusts of 35 mph expected. From the Maldives Meteorological Service. Stay ashore while it’s on.',
    });
    expect(liveMood(W, H(17, 5), sunOf(W)).warning).toEqual(w);
  });

  it('an alert starting later says when; ended alerts are dropped', () => {
    const W = wx({ alerts: [{ event: 'Strong wind', start: at(19), end: at(23), description: 'Strong winds expected', tags: ['Wind'] }] });
    expect(warningOf(W, H(17, 5))!.body).toBe('From 7:00 PM. Strong winds expected. Stay ashore while it’s on.');
    expect(alertsAhead(W, H(23, 30))).toEqual([]);
    expect(warningOf(W, H(23, 30))).toBeNull();
  });

  it('long events get a short chip from the tags; long descriptions are cut', () => {
    const W = wx({ alerts: [{ event: 'Advisory for heavy rainfall and possible localized flooding', start: at(16), end: at(20), description: 'word '.repeat(60), tags: ['Rain'] }] });
    const w = warningOf(W, H(17))!;
    expect(w.short).toBe('Heavy rain alert');
    expect(w.body.length).toBeLessThan(240);
    expect(w.body).toMatch(/… Stay ashore/);
  });

  it('thunder / wind alerts make their hours "danger" (calm copy); a rain-only alert does not', () => {
    const W = wx();
    expect(alertDangerAt(W, H(18))).toBe(true);
    expect(alertDangerAt(W, H(22, 30))).toBe(false);
    const R = wx({ alerts: [{ event: 'Heavy rain', start: at(16), end: at(22), tags: ['Rain'] }] });
    expect(alertDangerAt(R, H(18))).toBe(false);
  });
});

describe('rain amounts', () => {
  it('scene rain is steeper at the low end and still tops out at 1', () => {
    expect(rainAmtOfMm(0.2)).toBeLessThan(rainAmtOfMm(1.15) - 0.15);
    expect(rainAmtOfMm(5)).toBe(1);
    expect(rainAmtOfMm(50)).toBe(1);
    expect(rainAmtOf({ id: 500, mm: 0.19 })).toBeCloseTo(rainAmtOfMm(0.19), 6);
    expect(rainAmtOf({ id: 211, mm: 0 })).toBe(1);
    expect(rainAmtOf({ id: 804, mm: 2 })).toBe(0);
  });

  it('Weather sheet amounts', () => {
    expect([0, 0.09, 0.42, 1.32, 9.96, 15.22, 26.49].map(mmText)).toEqual(['', '', '0.4mm', '1.3mm', '10mm', '15mm', '26mm']);
  });
});
