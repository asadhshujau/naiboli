import { ACTS } from '../activities';
import { actLead, beachNow, beachStat, headPool, initCopyMemory, type CopyMemory, hourHead, leadPool, spotTag, weatherHead, type HeadArgs, type LeadArgs } from '../copy';
import * as A from '../copy/activities';
import { fill, hash, pickLine, slotsOf } from '../copy/pick';
import * as W from '../copy/weather';
import type { WxKey } from '../weather';

const KEY = { island: 1069, day: 20397, hour: 14 };
const SLOTS = { temp: 30, feels: 36, wind: 34, gust: 50, hour: '3 PM', island: 'Funadhooviligillaa', activity: 'Snorkeling' };
const all = (o: Record<string, string[] | undefined>) => Object.values(o).flatMap((x) => x ?? []);

const headlines = [...all(W.HEAD), ...W.STORM, ...W.WARN, ...W.HOT, ...W.BREEZY, ...W.MORNING, ...W.ISLAND];
const hourLines = [...all(W.HOUR), ...W.HOUR_DANGER];
const leads = [...A.GO, ...all(A.GO_ACT), ...A.IDEAL, ...A.MAYBE, ...all(A.MAYBE_FACTOR), ...A.SKIP, ...all(A.SKIP_FUN), ...all(A.SKIP_SAFE), ...A.CAUTION, ...A.WAIT];

/** Calm pools: shown for storms, alerts, strong gusts and safety-related skips. */
const SAFE = [...W.STORM, ...W.WARN, ...W.HOUR_DANGER, ...all(A.SKIP_SAFE), ...A.CAUTION];
/** Words and marks that would make light of danger. */
const JOKEY = /!|\?|nap|fun|lol|haha|party|sofa|snack|netflix|break a leg|drama|spicy|wild|thrill|exciting|o’clock|lizard|chef|meh|vibes|yay/i;

describe('copy pools', () => {
  it('every category has enough lines', () => {
    for (const k of Object.keys(W.HEAD) as (keyof typeof W.HEAD)[]) expect(W.HEAD[k].length).toBeGreaterThanOrEqual(6);
    for (const k of Object.keys(W.HOUR) as (keyof typeof W.HOUR)[]) expect(W.HOUR[k].length).toBeGreaterThanOrEqual(5);
    expect(W.STORM.length).toBeGreaterThanOrEqual(5);
    expect(W.WARN.length).toBeGreaterThanOrEqual(4);
    expect(W.HOUR_DANGER.length).toBeGreaterThanOrEqual(3);
    for (const p of [A.GO, A.MAYBE, A.SKIP]) expect(p.length).toBeGreaterThanOrEqual(5);
    expect(A.IDEAL.length).toBeGreaterThanOrEqual(4);
    expect(A.WAIT.length).toBeGreaterThanOrEqual(3);
    // every built-in activity has its own "go" lines
    for (const a of ACTS) expect(A.GO_ACT[a.id]?.length).toBeGreaterThanOrEqual(2);
  });

  it('the prototype lines are kept as the first of each pool', () => {
    expect(W.HEAD.sunny[0]).toBe('Glorious out there.');
    expect(W.STORM[0]).toBe('Stay ashore.');
    expect(W.HOUR.good[0]).toBe('{hour} looks good.');
    expect(A.GO[0]).toBe('Yes! Conditions line up nicely.');
    expect(A.SKIP[0]).toBe('Not this time. Another hour will treat you better.');
    expect(A.IDEAL[0]).toBe('Couldn’t ask for better.');
  });

  it('all slots are known and resolve', () => {
    const known = Object.keys(SLOTS);
    for (const l of [...headlines, ...hourLines, ...leads]) {
      for (const k of slotsOf(l)) expect(known).toContain(k);
      expect(fill(l, SLOTS)).not.toMatch(/[{}]/);
    }
    // headlines only use what weatherHead fills; hour lines always say which hour
    for (const l of headlines) for (const k of slotsOf(l)) expect(['temp', 'feels', 'wind', 'island']).toContain(k);
    for (const l of hourLines) expect(slotsOf(l)).toEqual(['hour']);
    for (const l of leads) for (const k of slotsOf(l)) expect(k).toBe('activity');
  });

  it('headlines stay short enough for the 40 pt headline', () => {
    for (const l of [...headlines, ...hourLines]) expect(fill(l, { ...SLOTS, hour: '12 PM' }).length).toBeLessThanOrEqual(36);
  });

  it('lines are unique within a pool and end with punctuation', () => {
    for (const p of [...Object.values(W.HEAD), ...Object.values(W.HOUR), W.STORM, W.WARN, A.GO, A.SKIP, A.MAYBE, ...Object.values(A.GO_ACT)]) {
      expect(new Set(p).size).toBe(p.length);
    }
    for (const l of [...headlines, ...hourLines, ...leads]) expect(l).toMatch(/[.!?]$/);
  });
});

describe('safety first', () => {
  it('calm pools: no jokes, no exclamations', () => {
    for (const l of SAFE) expect(l).not.toMatch(JOKEY);
  });

  it('storm, alert and dangerous-hour headlines always keep "stay ashore"', () => {
    for (const l of [...W.STORM, ...W.WARN, ...W.HOUR_DANGER, ...A.SKIP_SAFE.storm]) expect(l.toLowerCase()).toContain('ashore');
  });

  it('storms and alerts use only the calm pools, whatever the other conditions', () => {
    for (const hour of [6, 14, 22]) {
      expect(headPool(head({ key: 'stormy', feels: 40, wind: 30 }), hour).lines).toBe(W.STORM);
      for (const key of ['sunny', 'partly', 'windy', 'rainy', 'night', 'golden'] as WxKey[]) {
        expect(headPool(head({ key, warning: true, feels: 40 }), hour).lines).toBe(W.WARN);
      }
    }
  });

  it('the scrubbed hour uses the calm pool when it has thunder or strong gusts', () => {
    for (let h = 0; h < 24; h++) {
      const line = hourHead('brilliant', true, '3 PM', { ...KEY, hour: h });
      expect(W.HOUR_DANGER.map((l) => fill(l, { hour: '3 PM' }))).toContain(line);
    }
  });

  it('activity lines: danger and safety-related skips are calm, harmless skips can be playful', () => {
    expect(leadPool(lead({ verdict: 'skip', danger: true, lim: 'uv' })).lines).toBe(A.SKIP_SAFE.storm);
    expect(leadPool(lead({ verdict: 'go', danger: true })).lines).toBe(A.CAUTION);
    expect(leadPool(lead({ verdict: 'maybe', danger: true })).lines).toBe(A.CAUTION);
    expect(leadPool(lead({ verdict: 'go', ideal: true, danger: true })).lines).toBe(A.CAUTION);
    for (const f of A.DANGER_FACTORS) {
      const p = leadPool(lead({ verdict: 'skip', lim: f }));
      expect(p.safe).toBe(true);
      expect(p.lines).toBe(A.SKIP_SAFE[f as keyof typeof A.SKIP_SAFE]);
    }
    expect(leadPool(lead({ verdict: 'skip', lim: 'uv' })).lines).toEqual([...A.SKIP, ...A.SKIP_FUN.uv!]);
    expect(leadPool(lead({ verdict: 'wait' })).lines).toBe(A.WAIT);
    expect(leadPool(lead({ verdict: 'go', ideal: true })).lines).toEqual([...A.IDEAL, ...A.GO_ACT.snorkel]);
  });

  it('wind, haze and darkness "maybe" lines stay plain too', () => {
    for (const f of A.DANGER_FACTORS) for (const l of A.MAYBE_FACTOR[f] ?? []) expect(l).not.toMatch(JOKEY);
  });
});

describe('picking', () => {
  it('is deterministic and stable while you look', () => {
    const a = head();
    expect(weatherHead(a, KEY)).toBe(weatherHead(a, { ...KEY }));
    expect(pickLine(['a', 'b', 'c'], 'x', 1, 2)).toBe(pickLine(['a', 'b', 'c'], 'x', 1, 2));
    expect(hash('naiboli')).toBe(hash('naiboli'));
  });

  it('varies across hours, days and islands', () => {
    const a = head({ key: 'partly' });
    const byHour = new Set(Array.from({ length: 24 }, (_, h) => weatherHead(a, { ...KEY, hour: h })));
    const byDay = new Set(Array.from({ length: 14 }, (_, d) => weatherHead(a, { ...KEY, day: KEY.day + d })));
    const byIsland = new Set([1069, 1068, 1060, 1017, 25, 1002, 90, 129].map((island) => weatherHead(a, { ...KEY, island })));
    expect(byHour.size).toBeGreaterThanOrEqual(5);
    expect(byDay.size).toBeGreaterThanOrEqual(4);
    expect(byIsland.size).toBeGreaterThanOrEqual(3);
  });

  it('fills the slots from the numbers', () => {
    const lines = new Set(Array.from({ length: 200 }, (_, h) => weatherHead(head({ key: 'windy', wind: 34 }), { ...KEY, day: h })));
    expect([...lines].some((l) => l === '34 km/h of fresh air.')).toBe(true);
    expect([...lines].every((l) => !l.includes('{'))).toBe(true);
    expect(actLead(lead({ verdict: 'skip', lim: 'wind' }), KEY)).not.toMatch(/[{}]/);
  });

  it('every island gets the same pools (no island ranked over another)', () => {
    const p1 = headPool(head({ island: 'Malé' }), 14).lines;
    const p2 = headPool(head({ island: 'Ukulhas' }), 14).lines;
    expect(p1).toEqual(p2);
  });
});

describe('no repeats', () => {
  beforeEach(() => initCopyMemory(null, null));
  afterAll(() => initCopyMemory(null, null));

  it('same moment → same line; the next moment never repeats the last line of that category', () => {
    const a = head({ key: 'partly' });
    let last = weatherHead(a, KEY);
    expect(weatherHead(a, KEY)).toBe(last);
    for (let i = 1; i < 200; i++) {
      const k = { ...KEY, hour: i % 24, day: KEY.day + Math.floor(i / 24) };
      const line = weatherHead(a, k);
      expect(line).not.toBe(last);
      expect(weatherHead(a, k)).toBe(line); // asked again (re-render, clock tick): unchanged
      last = line;
    }
  });

  it('works for scrubbed hours and activity lines too, per category', () => {
    let last = '';
    for (let h = 0; h < 48; h++) {
      const line = hourHead('good', false, 'H', { ...KEY, hour: h % 24, day: KEY.day + Math.floor(h / 24) });
      expect(line).not.toBe(last);
      last = line;
    }
    const go = actLead(lead({ act: 'surf' }), KEY);
    const goNext = actLead(lead({ act: 'surf' }), { ...KEY, hour: 15 });
    expect(goNext).not.toBe(go);
    // a different activity is its own category
    expect(typeof actLead(lead({ act: 'swim' }), { ...KEY, hour: 15 })).toBe('string');
  });

  it('remembers across launches and reports changes for saving', () => {
    const saved: CopyMemory[] = [];
    initCopyMemory(null, (m) => saved.push(JSON.parse(JSON.stringify(m))));
    const first = weatherHead(head(), KEY);
    expect(saved.at(-1)!['head:sunny'].line).toBeDefined();
    weatherHead(head(), KEY); // same moment: nothing new to save
    expect(saved).toHaveLength(1);
    // relaunch with the saved memory: the same moment shows the same line, the next one a different line
    initCopyMemory(saved.at(-1)!, null);
    expect(weatherHead(head(), KEY)).toBe(first);
    expect(weatherHead(head(), { ...KEY, hour: KEY.hour + 1 })).not.toBe(first);
    // junk from storage is ignored
    initCopyMemory('junk' as unknown as CopyMemory, null);
    expect(typeof weatherHead(head(), KEY)).toBe('string');
  });
});

describe('island sheet wording', () => {
  it('beach chip is a tide fact, never "average"', () => {
    for (const n of [0, 0.2, 0.5, 0.8, 1]) expect(beachNow(n)).toMatch(/^(Tide’s in|Tide’s out|Mid tide)/);
    expect([0, 0.5, 1].map(beachNow).join()).not.toMatch(/average|narrow|wide/i);
  });

  it('tide sheet Beach stat is a tide fact too', () => {
    expect([0.9, 0.1, 0.5].map((n) => beachStat(n).value)).toEqual(['Cosy', 'Extra sand', 'Towel room']);
    for (const n of [0, 0.5, 1]) expect(Object.values(beachStat(n)).join()).not.toMatch(/average|narrow|wide/i);
  });

  it('surf / snorkel tags describe right now, never "Skip"', () => {
    expect(spotTag('Surf', 'skip')).toEqual({ t: 'Surf later', tone: 'later' });
    expect(spotTag('Snorkel', 'wait')).toEqual({ t: 'Snorkel after sunrise', tone: 'later' });
    expect(spotTag('Snorkel', 'go').t).toBe('Snorkel now');
    for (const v of ['go', 'maybe', 'skip', 'wait'] as const) expect(spotTag('Surf', v).t).not.toMatch(/skip/i);
  });
});

function head(o: Partial<HeadArgs> = {}): HeadArgs {
  return { key: 'sunny', temp: 30, feels: 33, wind: 10, warning: false, island: 'Malé', ...o };
}
function lead(o: Partial<LeadArgs> = {}): LeadArgs {
  return { verdict: 'go', ideal: false, act: 'snorkel', activity: 'Snorkeling', lim: null, danger: false, ...o };
}
