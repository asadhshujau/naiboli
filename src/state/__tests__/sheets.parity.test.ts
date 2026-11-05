/**
 * Parity: bubble and sheet view models vs. the prototype's own `renderVals()`, across live / sample
 * weather, route / fallback activity scores, tide feed / no feed, island-detail states and scrub offsets.
 */
import { procActs } from '@/data/activities';
import { acts1069, DAY0, islandsSmall, NOW_MS, stormyWeather, synthTide, weather1069 } from '@/data/__tests__/fixtures';
import { loadPrototype, type Proto } from '@/data/__tests__/prototype';
import { procIsle, wxKey } from '@/data/islands';
import type { GeoStatus } from '@/data/location';
import { DEFAULT_SUN, sunOf } from '@/data/sun';
import { procTide } from '@/data/tide';
import type { ApiActivityScoresResponse, ApiIsland, ApiIslandDetail, ApiWeatherResponse, Entry, IslandDetail } from '@/data/types';
import { procWx } from '@/data/weather';

import {
  bubbleContent,
  bubblePos,
  buildDetail,
  buildGroups,
  buildIsle,
  buildIslandList,
  buildTide,
  buildWx,
  geoRowOf,
  SEP_CSS,
  welcomeOf,
  type BubbleKind,
  type Perm,
  type SheetTarget,
  type IsleView,
} from '../sheets';
import { beachNow, beachStat, spotTag } from '@/data/copy';
import { VC } from '@/data/verdict';
import type { DataState } from '../store';
import { buildBase, buildView } from '../view';

let P: Proto;
beforeAll(() => {
  jest.useFakeTimers({ now: NOW_MS });
  P = loadPrototype();
  P.setDay0(DAY0);
});
afterAll(() => jest.useRealTimers());

const male = islandsSmall.find((i) => i.id === 1069) as ApiIsland;

const DETAIL: ApiIslandDetail = {
  description: 'The capital. Busy, compact and fun.',
  dhivehi_name: 'މާލެ',
  latitude_decimal: '4.1755',
  longitude_decimal: '73.5093',
  beaches: [
    { name: 'Raalhugandu Surf Point', type: 'Rocky' },
    { name: 'Artificial Beach', type: 'Sandy' },
    { name: 'Villingili Finolhu', type: 'sand' },
    { name: null, type: null },
  ],
  reefs: [
    { name: 'Banana Reef', type: 'house_reef', distance: '2 km' },
    { name: null, type: null, distance: null },
  ],
  accessibilities: [{ method: 'Ferry' }, { method: 'Seaplane' }, { method: 'Speedboat' }, { method: null }],
} as unknown as ApiIslandDetail;

/**
 * Scores payload pushed to the edges: waits with limiting daylight, tiny / missing breakdown values,
 * no tide data, conditions that differ from overall, unknown factors and an unknown activity.
 */
function wildActs(): ApiActivityScoresResponse {
  const j = JSON.parse(JSON.stringify(acts1069)) as any;
  const recs = ['ideal', 'go', 'caution', 'avoid', 'wait_for_daylight', 'mystery'];
  const lims = [[], ['daylight', 'wind'], ['tide'], ['visibility', 'rain'], ['sea_state'], ['uv'], ['temp']];
  const tweak = (x: any, i: number) => {
    x.recommendation = recs[i % recs.length];
    x.limiting_factors = lims[i % lims.length];
    x.conditions_score = i % 3 ? +(x.overall_score - 0.2 - (i % 4) * 0.3).toFixed(1) : null;
    x.tide_available = i % 4 !== 1;
    for (const [n, f] of Object.keys(x.breakdown || {}).entries()) x.breakdown[f] = ((i + n) % 9) * 0.37;
    if (i % 5 === 0 && x.breakdown) delete x.breakdown.tide;
  };
  j.scores.forEach((x: any, a: number) => {
    tweak(x, a);
    x.hours.forEach((y: any, i: number) => tweak(y, i + a));
    x.days.forEach((y: any, i: number) => tweak(y, i * 2 + a));
  });
  const kite = JSON.parse(JSON.stringify(j.scores[1]));
  kite.activity = 'kite_foiling';
  kite.label = 'Kite foiling';
  j.scores.push(kite);
  return j;
}

/** Weather whose week has wet, dry and windy days (for the week summary line). */
function wetWeek(): ApiWeatherResponse {
  const j = JSON.parse(JSON.stringify(weather1069)) as any;
  const ids = [804, 501, 800, 802, 502, 801, 211, 803];
  const pops = [0.1, 0.8, 0, 0.3, 0.6, 0.15, 0.9, 0.2];
  const wind = [3, 9.5, 2, 4, 8.6, 1, 12, 2.5];
  j.data.daily.forEach((d: any, i: number) => {
    d.weather = [{ id: ids[i % 8] }];
    d.pop = pops[i % 8];
    d.wind_speed = wind[i % 8];
    d.temp.max += i % 3;
    d.temp.min -= i % 2;
  });
  return j;
}

interface Scenario {
  name: string;
  wx: 'live' | 'storm' | 'wet' | 'loading' | 'err';
  acts: 'route' | 'wild' | 'loading' | 'err';
  tide: 'feed' | 'none';
  isle: 'data' | 'empty' | 'loading' | 'err' | 'missing';
}

const SCENARIOS: Scenario[] = [
  { name: 'live, route scores, tide feed, details', wx: 'live', acts: 'route', tide: 'feed', isle: 'data' },
  { name: 'storm, route scores, no tide, empty details', wx: 'storm', acts: 'route', tide: 'none', isle: 'empty' },
  { name: 'live, fallback scores (loading), tide feed, loading details', wx: 'live', acts: 'loading', tide: 'feed', isle: 'loading' },
  { name: 'live, fallback scores (error), no tide, details error', wx: 'live', acts: 'err', tide: 'none', isle: 'err' },
  { name: 'sample mood (weather loading), fallback scores', wx: 'loading', acts: 'loading', tide: 'none', isle: 'missing' },
  { name: 'sample mood (weather error), route scores, tide feed', wx: 'err', acts: 'route', tide: 'feed', isle: 'data' },
  { name: 'wet week, edge-case scores, tide feed, details', wx: 'wet', acts: 'wild', tide: 'feed', isle: 'data' },
  { name: 'storm, edge-case scores, no tide, details', wx: 'storm', acts: 'wild', tide: 'none', isle: 'data' },
];

/** Build both the prototype component and our DataState for a scenario. */
function setup(sc: Scenario) {
  P.setSun(DEFAULT_SUN.rise, DEFAULT_SUN.set);
  P.setTide(null);
  const c = P.make();
  const wj: ApiWeatherResponse | null = sc.wx === 'live' ? weather1069 : sc.wx === 'storm' ? stormyWeather() : sc.wx === 'wet' ? wetWeek() : null;
  const aj = sc.acts === 'route' ? acts1069 : sc.acts === 'wild' ? wildActs() : null;
  const tj = sc.tide === 'feed' ? synthTide() : null;
  const W = wj ? procWx(wj, DAY0, NOW_MS)! : null;
  const T = tj ? procTide(tj, DAY0)! : null;
  const AD = aj ? procActs(aj, DAY0, NOW_MS)! : null;
  const D: Entry<IslandDetail> | undefined =
    sc.isle === 'data'
      ? procIsle(DETAIL)
      : sc.isle === 'empty'
        ? procIsle({} as ApiIslandDetail)
        : sc.isle === 'missing'
          ? undefined
          : sc.isle;
  const wxEntry: Entry<ReturnType<typeof procWx> & object> | undefined = W ?? (sc.wx === 'err' ? 'err' : 'loading');
  const k = wxKey(male);

  c.state = {
    ...c.state,
    sp: 3,
    loc: 1069,
    locObj: male,
    firstRun: false,
    islands: islandsSmall,
    wx: { [k]: wj ? c.procWx(wj) : wxEntry, 28: 'err' },
    tides: tj ? { 1069: c.procTide(tj) } : {},
    acts: { 1069: aj ? c.procActs(aj) : sc.acts },
    isle: D === undefined ? {} : { 1069: D },
  };
  const d: DataState = {
    day0: DAY0,
    island: male,
    firstRun: false,
    islands: islandsSmall,
    recents: [],
    wx: { [k]: wxEntry, 28: 'err' },
    tides: T ? { 1069: T } : {},
    isle: D === undefined ? {} : { 1069: D },
    acts: { 1069: AD ?? (sc.acts as 'loading' | 'err') },
    lastW: W,
    lastTide: T,
    sun: W ? sunOf(W) : DEFAULT_SUN,
    refreshing: false,
    clock: NOW_MS,
  };
  const base = buildBase(d, NOW_MS);
  return { c, d, base };
}

/** Prototype render with extra state. */
function render(c: ReturnType<Proto['make']>, st: Record<string, unknown>) {
  c.state = { ...c.state, ...st };
  return c.renderVals();
}

const css = (sep: boolean) => (sep ? SEP_CSS : 'none');
const noFns = (o: unknown): unknown =>
  Array.isArray(o)
    ? o.map(noFns)
    : o && typeof o === 'object' && !(o instanceof Float32Array)
      ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, noFns(v)]))
      : o;

const OFFSETS = [0, 3, 9, 17, 23];
const KINDS: BubbleKind[] = ['sun', 'moon', 'sky', 'rain', 'palm', 'island', 'sea', 'dhoni', 'temp', 'warning'];
const TAPS = [
  { x: 30, y: 80 },
  { x: 200, y: 359 },
  { x: 380, y: 361 },
  { x: 196, y: 600 },
  { x: 340, y: 90 },
];

/** Which sheet the prototype opens when its bubble action runs. */
function protoTarget(c: ReturnType<Proto['make']>): SheetTarget {
  const s = c.state;
  if (s.sheet === 'wx') return { sheet: 'wx', focus: s.focus };
  if (s.sheet === 'act') return { sheet: 'act', actId: s.actId };
  return { sheet: s.sheet } as SheetTarget;
}

describe.each(SCENARIOS)('$name', (sc) => {
  it.each(OFFSETS)('bubbles match at +%ih', (o) => {
    const { c, d, base } = setup(sc);
    const v = buildView(base, d, o);
    for (const kind of KINDS) {
      for (const tap of TAPS) {
        const theirs = render(c, { offset: o, bubble: { kind, ...tap }, bubbleOpen: true, sheet: null });
        const mine = bubbleContent(kind, base, v, d);
        const pos = bubblePos(mine, tap, { w: 402, scale: 1, top: 112, bottom: 874 - 210 });
        const b = theirs.bub;
        expect({ icon: mine.icon, tileBg: mine.tile, title: mine.title, big: mine.big, bigColor: mine.bigColor, lines: mine.lines }).toEqual({
          icon: b.icon,
          tileBg: b.tileBg,
          title: b.title,
          big: b.big,
          bigColor: b.bigColor,
          lines: b.lines,
        });
        expect([pos.x, pos.y, `${pos.ox}px ${pos.below ? '0px' : '100%'}`]).toEqual([b.x, b.y, b.origin]);
        expect(!!mine.action).toBe(b.hasAction);
        expect(mine.action?.label).toBe(b.actionLabel);
      }
      // where the action goes (skip the island action when details aren't loaded: it would fetch)
      if (kind === 'island' && sc.isle !== 'data') continue;
      const theirs = render(c, { offset: o, bubble: { kind, x: 200, y: 300 }, bubbleOpen: true, sheet: null, focus: null, actId: null });
      theirs.bub.action();
      expect(bubbleContent(kind, base, v, d).action?.go).toEqual(protoTarget(c));
    }
  });

  it.each(OFFSETS)('All activities and every activity detail match at +%ih', (o) => {
    const { c, d, base } = setup(sc);
    const v = buildView(base, d, o);
    const theirs = render(c, { offset: o, sheet: 'acts' });
    const groups = buildGroups(v).map((g) => ({
      title: g.title,
      count: g.count,
      dot: g.dot,
      items: g.items.map((a) => ({ ...a, sep: css(a.sep) })),
    }));
    expect(groups).toEqual(noFns(theirs.groups));
    // Expected difference: the score source ("Activity scores from moodhu.dev, …") is never shown.
    expect(v.actsSrc).toBe(/^Activity scores from/.test(theirs.actsSrc) ? '' : theirs.actsSrc);
    expect(v.whenLabel).toBe(theirs.whenLabel);

    for (const a of v.acts) {
      const t = render(c, { offset: o, sheet: 'act', actId: a.id });
      const { lead, ...mine } = buildDetail(base, v, a.id)!;
      // Expected difference: the verdict sentence that leads `line` is varied copy; the factual rest is the prototype's.
      const protoLead = a.k === 'wait' ? VC.wait.line : mine.vBig === 'Ideal.' ? 'Couldn’t ask for better.' : VC[a.k].line;
      const tl = (t.d as { line: string }).line;
      expect(tl.startsWith(protoLead + ' ')).toBe(true);
      expect(mine.line).toBe(lead + tl.slice(protoLead.length));
      const norm = {
        ...mine,
        line: tl,
        hours: mine.hours.map((h) => ({ ...h, ring: h.ring ? '0 0 0 2px #FFFFFF, 0 0 0 3.5px #0A3346' : 'none' })),
        days: mine.days.map(({ sel, sep, ...y }) => ({ ...y, sep: css(sep), bg: sel ? 'rgba(18,181,176,.08)' : 'transparent' })),
      };
      expect(norm).toEqual(noFns(t.d));
    }
    expect(buildDetail(base, v, 'nope')).toBeNull();
  });

  it.each(OFFSETS)('weather and tide sheets match at +%ih', (o) => {
    const { c, d, base } = setup(sc);
    const v = buildView(base, d, o);
    const theirs = render(c, { offset: o, sheet: 'wx', focus: 'uv' });
    const wx = buildWx(base, v, d);
    const { f, r, days, hourly, ...tw } = theirs.wx;
    const { days: md, hourly: mh, ...mw } = wx;
    expect(mw).toEqual(tw);
    expect(mh.map(({ sel, ...h }) => h)).toEqual(hourly);
    expect(md.map(({ sel, sep, ...y }) => ({ ...y, sep: css(sep), bg: sel ? 'rgba(18,181,176,.08)' : 'transparent' }))).toEqual(days);
    expect(f.uv).toBe(true);
    expect(r.uv).toBe('0 0 0 2.5px #0A3346');

    const td = buildTide(base, v, d, wx.eyebrow);
    const tt = theirs.td;
    // Expected difference: the Beach stat is a tide fact ("Cosy" / "Extra sand" / "Towel room"), not Narrow / Wide / Average.
    const bs = beachStat(v.tide.n);
    expect([td.beach, td.beachLine]).toEqual([bs.value, bs.line]);
    expect({ ...td, beach: tt.beach, beachLine: tt.beachLine, next: td.next.map((x) => ({ ...x, sep: css(x.sep) })) }).toEqual(tt);
  });

  it.each(OFFSETS)('about-the-island matches at +%ih', (o) => {
    const { c, d, base } = setup(sc);
    const v = buildView(base, d, o);
    const theirs = noFns(render(c, { offset: o, sheet: 'isle' }).isle) as IsleView;
    const mine = buildIsle(v, d);
    // Expected differences: the beach chip is a tide fact, surf / snorkel tags are right-now conditions.
    const strip = (x: IsleView) => ({
      ...x,
      now: x.now.slice(0, 2),
      beaches: x.beaches.map(({ tag, ...b }) => b),
      reefs: x.reefs.map(({ tag, ...r }) => r),
    });
    expect(strip(mine)).toEqual(strip(theirs));
    expect(mine.now[2]).toEqual({ icon: 'beach_access', t: beachNow(v.tide.n) });
    const k = (id: string) => v.acts.find((x) => x.id === id)!.k;
    mine.beaches.forEach((b, i) => {
      const th = theirs.beaches[i].tag;
      if (th.t.startsWith('Surf: ')) expect(b.tag.t).toBe(spotTag('Surf', k('surf')).t);
      else expect(b.tag).toEqual(th);
    });
    mine.reefs.forEach((r) => r.hasTag && expect(r.tag.t).toBe(spotTag('Snorkel', k('snorkel')).t));
  });
});

describe('varied copy in the view', () => {
  it('headline: storm / alert → calm "stay ashore" lines; live weather varies by hour; sample moods keep their line', () => {
    const storm = setup(SCENARIOS[1]);
    for (const o of OFFSETS) {
      const v = buildView(storm.base, storm.d, o);
      if (o === 0) expect(v.head.toLowerCase()).toContain('ashore');
      if (v.danger) expect(v.head.toLowerCase()).toContain('ashore');
      for (const a of v.acts) {
        const det = buildDetail(storm.base, v, a.id)!;
        if (v.danger) expect(det.lead).not.toMatch(/!|\?/);
      }
    }
    const live = setup(SCENARIOS[0]);
    const v0 = buildView(live.base, live.d, 0);
    expect(buildView(live.base, live.d, 0).head).toBe(v0.head); // stable
    if (!v0.m.warning && v0.m.key !== 'stormy') expect(v0.head).not.toBe('');
    const sampleMood = setup(SCENARIOS[4]);
    const vs = buildView(sampleMood.base, sampleMood.d, 0);
    expect(vs.m.live).toBe(false);
    expect(vs.head).toBe(vs.m.headEn);
  });
});

describe('island picker and welcome', () => {
  it.each(['', 'ma', 'fun', 'zzz', '  Hulhu '])('picker rows match for %p', (query) => {
    for (const sc of [SCENARIOS[0], SCENARIOS[4]]) {
      for (const o of [0, 12]) {
        const { c, d, base } = setup(sc);
        const v = buildView(base, d, o);
        const theirs = render(c, { offset: o, sheet: 'island', query });
        const mine = buildIslandList(base, v, d, query);
        expect(mine.rows.map(({ I, cur, sep, ...r }) => ({ ...r, sep: css(sep) }))).toEqual(noFns(theirs.islandList));
        expect(mine.noResults).toBe(theirs.noResults);
      }
    }
  });

  // Expected difference from the prototype: an empty search lists the current island, then recents,
  // then popular islands as padding (the prototype always lists the popular six).
  it('empty search: current island, then recents, padded with popular islands', () => {
    const { d, base } = setup(SCENARIOS[0]);
    const pick = (id: number) => islandsSmall.find((i) => i.id === id) ?? ({ ...male, id, english_name: 'Isle ' + id } as ApiIsland);
    const cur = pick(1017);
    const recents = [cur, pick(25), pick(1069), pick(1002)];
    const dd: DataState = { ...d, island: cur, recents };
    const v = buildView(base, dd, 0);
    const { rows } = buildIslandList(base, v, dd, '  ');
    expect(rows.map((r) => r.I.id)).toEqual([1017, 25, 1069, 1002, 1068, 1060]);
    expect(rows.map((r) => r.cur)).toEqual([true, false, false, false, false, false]);
    expect(rows[0].icon).toBe('my_location');
    expect(rows.map((r) => r.sep)).toEqual([false, true, true, true, true, true]);
    // a query still searches the whole list
    expect(buildIslandList(base, v, dd, 'hulhu').rows[0].I.id).toBe(1068);
  });

  it('location row and welcome copy match for every state', () => {
    const c = P.make();
    for (const geo of ['idle', 'locating', 'denied', 'far', 'fail'] as GeoStatus[]) {
      for (const perm of ['granted', 'denied', 'unknown'] as Perm[]) {
        c.state = { ...c.state, geo: { st: geo }, perm, sp: 3 };
        const t = c.renderVals();
        const { tap, ...row } = t.geoRow;
        expect(geoRowOf(geo, perm)).toEqual(row);
        const { locate, manual, ...wel } = t.wel;
        expect(welcomeOf(geo, perm)).toEqual(wel);
      }
    }
  });
});
