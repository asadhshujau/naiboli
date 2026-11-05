/**
 * Bubble and sheet view models — the rest of the prototype's `renderVals()`:
 * bubble content `B` and placement `bub`, All activities `groups`, activity detail `d`,
 * weather `wx`, tide `td`, about-the-island `isle`, island picker `islandList` / `geoRow`, welcome `wel`.
 *
 * Pure: actions are returned as data (`SheetTarget`), never as closures.
 */
import { ACTS, actAt, FACTORS, FTIP, FWORD, windowOf, type ActDefLive } from '@/data/activities';
import { accIcon, atollLine, pickerIslands, wxKey } from '@/data/islands';
import type { GeoStatus } from '@/data/location';
import { condAt, iconAt, rainAt, tempAt } from '@/data/mood';
import { sunState } from '@/data/sun';
import { extrema, tideAt, tideSrc } from '@/data/tide';
import { capF, clamp, dateOf, dayLabel, dur, fmt, fmtHr, fmtLvl, md24 } from '@/data/time';
import { isData, type ApiIsland, type IslandDetail } from '@/data/types';
import { REC, VC, vKey, vWord, type VerdictKey } from '@/data/verdict';
import {
  keyOf,
  moonDataFor,
  moonInfo,
  owmCond,
  owmIcon,
  palmWordOf,
  sample,
  uvWordOf,
  weekDays,
  windWordOf,
  WX_HERO,
  WX_TINT,
  type MoonInfo,
} from '@/data/weather';

import type { DataState } from './store';
import type { ActRow, View, ViewBase } from './view';

export type SheetName = 'welcome' | 'island' | 'acts' | 'act' | 'wx' | 'tide' | 'isle' | 'menu';
export type BubbleKind = 'sun' | 'moon' | 'sky' | 'rain' | 'palm' | 'island' | 'sea' | 'dhoni' | 'temp' | 'warning';
export const WX_FOCUS = ['temp', 'warning', 'wind', 'uv', 'rain', 'hum', 'sky', 'vis', 'sun', 'moon'] as const;
export type WxFocus = (typeof WX_FOCUS)[number];
/** Location permission as the picker / welcome copy needs it. */
export type Perm = 'granted' | 'denied' | 'unknown';

/** Where a bubble's action button goes. */
export type SheetTarget =
  | { sheet: 'wx'; focus: WxFocus }
  | { sheet: 'tide' }
  | { sheet: 'acts' }
  | { sheet: 'act'; actId: string }
  | { sheet: 'isle' };

const SEP = '1px solid rgba(10,51,70,.07)';
/** separator flag for list rows (CSS `border-top`) */
const sepOf = (j: number) => j > 0;

// ───────────────────────── About the island ─────────────────────────

export interface IsleTag {
  t: string;
  bg: string;
  ink: string;
}
export interface IsleView {
  mapUrl: string;
  eyebrow: string;
  en: string;
  dv: string;
  coords: string;
  desc: string;
  hasDesc: boolean;
  now: { icon: string; t: string }[];
  access: { label: string; icon: string }[];
  hasAccess: boolean;
  beaches: { name: string; type: string; icon: string; tile: string; ic: string; hasTag: boolean; tag: IsleTag }[];
  hasBeaches: boolean;
  beachCount: string;
  sandyN: string;
  rockyN: string;
  sandPct: number;
  reefs: { name: string; meta: string; hasTag: boolean; tag: IsleTag }[];
  hasReefs: boolean;
  reefCount: string;
  countLine: string;
  loading: boolean;
  empty: boolean;
  emptyLine: string;
}

interface IsleArgs {
  en: string;
  dv: string;
  atoll: string;
  lat: number;
  lon: number;
  coords: string;
  D: IslandDetail | null;
  loading: boolean;
  err: boolean;
  acts: ActRow[];
  temp: number;
  cond: string;
  icon: string;
  tideN: number;
  tideRising: boolean;
  beachWord: string;
}

/** `isleView()` */
export function isleView(o: IsleArgs): IsleView {
  const B = o.D?.beaches ?? [];
  const R = o.D?.reefs ?? [];
  const A = o.D?.access ?? [];
  const vd = (id: string) => {
    const a = o.acts.find((x) => x.id === id);
    return a ? { bg: a.lBg, ink: a.lInk, v: a.v } : null;
  };
  const surf = vd('surf');
  const snork = vd('snorkel');
  const none: IsleTag = { t: '', bg: 'transparent', ink: 'transparent' };
  const sandyN = B.filter((b) => /sand/i.test(b.type || '')).length;
  const beaches = B.map((b) => {
    const nm = b.name || 'Unnamed beach';
    const sandy = /sand/i.test(b.type || '');
    const bank = /sandbank|finolhu/i.test(nm);
    const sb = /surf/i.test(nm);
    const tag: IsleTag | null =
      sb && surf
        ? { t: `Surf: ${surf.v}`, bg: surf.bg, ink: surf.ink }
        : bank
          ? o.tideN < 0.35
            ? { t: 'Low tide now', bg: '#D3F4E9', ink: '#0B6B57' }
            : { t: 'Best at low tide', bg: '#F1E9DA', ink: '#5B4A2A' }
          : null;
    return {
      name: nm,
      type: sb ? `${b.type || 'Rocky'} · surf break` : bank ? 'Sandbank' : b.type || 'Shore',
      icon: sb ? 'surfing' : sandy ? 'beach_access' : 'landscape',
      tile: sandy ? '#FFF0C6' : '#E4EAEC',
      ic: sandy ? '#A87000' : '#4F6F79',
      hasTag: !!tag,
      tag: tag || none,
    };
  });
  const reefs = R.map((r) => ({
    name: r.name || 'Reef',
    meta: [capF(String(r.type || 'reef').replace(/_/g, ' ')), r.distance].filter(Boolean).join(' · '),
    hasTag: !!snork,
    tag: snork ? { t: `Snorkel: ${snork.v}`, bg: snork.bg, ink: snork.ink } : none,
  }));
  const any = B.length || R.length || A.length || o.D?.description;
  let la = o.lat;
  let lo = o.lon;
  const cm = String(o.coords || '').match(/([\d.]+)° ([NS]) · ([\d.]+)° ([EW])/);
  if ((la == null || isNaN(la)) && cm) {
    la = parseFloat(cm[1]) * (cm[2] === 'S' ? -1 : 1);
    lo = parseFloat(cm[3]) * (cm[4] === 'W' ? -1 : 1);
  }
  const mapUrl =
    la != null && !isNaN(la)
      ? `https://www.google.com/maps/search/?api=1&query=${la},${lo}`
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.en + ', Maldives');
  return {
    mapUrl,
    eyebrow: o.atoll,
    en: o.en,
    dv: o.dv || '',
    coords: o.coords || '',
    desc: o.D?.description || '',
    hasDesc: !!o.D?.description,
    now: [
      { icon: o.icon, t: `${o.temp}° · ${o.cond}` },
      { icon: o.tideRising ? 'north_east' : 'south_east', t: `Tide ${o.tideRising ? 'rising' : 'falling'}` },
      { icon: 'beach_access', t: `Beach ${o.beachWord}` },
    ],
    access: A.map((x) => ({ label: x, icon: accIcon(x) })),
    hasAccess: !!A.length,
    beaches,
    hasBeaches: !!B.length,
    beachCount: String(B.length),
    sandyN: String(sandyN),
    rockyN: String(B.length - sandyN),
    sandPct: B.length ? (sandyN / B.length) * 100 : 0,
    reefs,
    hasReefs: !!R.length,
    reefCount: String(R.length),
    countLine: B.length || R.length ? `${B.length} beach${B.length === 1 ? '' : 'es'} · ${R.length} reef${R.length === 1 ? '' : 's'}` : '',
    loading: !!o.loading,
    empty: !o.loading && !any,
    emptyLine: o.err
      ? 'Couldn’t load island details right now. Try again in a bit.'
      : `We’re still mapping ${o.en}. Beaches, reefs and ways to get there will show up here.`,
  };
}

/** The current island's `isle` view (also feeds the island bubble). */
export function buildIsle(v: View, d: DataState): IsleView {
  const LI = d.island;
  const IDr = d.isle[LI.id];
  const IDd = isData(IDr) ? IDr : null;
  const iLat = IDd && !isNaN(IDd.lat) ? IDd.lat : parseFloat(String(LI.latitude_decimal));
  const iLon = IDd && !isNaN(IDd.lon) ? IDd.lon : parseFloat(String(LI.longitude_decimal));
  const t = v.tide;
  return isleView({
    en: LI.english_name,
    dv: (IDd && IDd.dv) || LI.dhivehi_name || '',
    atoll: atollLine(LI, true),
    lat: iLat,
    lon: iLon,
    coords: isNaN(iLat) ? '' : `${Math.abs(iLat).toFixed(2)}° ${iLat < 0 ? 'S' : 'N'} · ${iLon.toFixed(2)}° E`,
    D: IDd,
    loading: !IDr || IDr === 'loading',
    err: IDr === 'err',
    acts: v.acts,
    temp: v.temp,
    cond: v.m.cond,
    icon: v.m.icon,
    tideN: t.n,
    tideRising: t.rising,
    beachWord: t.n > 0.72 ? 'narrow' : t.n < 0.3 ? 'wide' : 'average',
  });
}

// ───────────────────────── Bubble ─────────────────────────

export interface BubbleContent {
  icon: string;
  tile: string;
  title: string;
  big: string;
  bigColor: string;
  lines: string[];
  action: { label: string; go: SheetTarget } | null;
}

function sailRow(b: ViewBase, v: View): { def: ActDefLive; inList: boolean; s: number; k: VerdictKey; v: string; score: string; reason: string } {
  const def = b.defs.find((x) => x.id === 'sail') || { ...ACTS[1], i: 1, api: null };
  const row = v.acts.find((a) => a.id === 'sail');
  if (row) return { def, inList: true, s: row.s, k: row.k, v: row.v, score: row.score, reason: row.reason };
  const r = actAt(b.acts, def, v.hSel, b.score);
  return { def, inList: false, s: r.s, k: r.k, v: vWord[r.k], score: r.s.toFixed(1), reason: `${windWordOf(v.wind)}, ${v.wind} km/h` };
}

/** Bubble copy and action per tapped object (`B` in `renderVals()`). */
export function bubbleContent(kind: BubbleKind, b: ViewBase, v: View, d: DataState): BubbleContent {
  const { m, hSel, wind, temp, tide, rainSel, uvNow, ph } = v;
  const sun = b.sun;
  const untilSet = sun.set - md24(hSel);
  const wxGo = (focus: WxFocus) => ({ label: 'Weather details', go: { sheet: 'wx' as const, focus } });
  const LI = d.island;
  const nm = LI.english_name;
  const base = { bigColor: '#0A3346' };
  switch (kind) {
    case 'sun':
      return {
        ...base,
        icon: 'sunny',
        tile: '#FFF0C6',
        title: 'The sun',
        big: `Sets ${fmt(sun.set)}`,
        lines: [`${dur(Math.max(0, untilSet))} of sun left`, `UV ${uvNow} · ${uvWordOf(uvNow)}`, `Sunrise ${fmt(sun.rise)} · ${dur(sun.set - sun.rise)} of daylight`],
        action: wxGo('sun'),
      };
    case 'moon': {
      const mi = moonInfo(moonDataFor(m.live ? m.W : null, b.day0, sun), hSel, b.day0);
      return { ...base, icon: 'bedtime', tile: '#DDE3F6', title: 'The moon', big: mi.name, lines: [`${mi.illum}% lit`, `Moonrise ${mi.rise} · set ${mi.set}`, mi.nextTxt], action: wxGo('moon') };
    }
    case 'sky':
      return { ...base, icon: m.icon, tile: '#DAEFFB', title: 'The sky', big: m.cond, lines: [`Clouds ${m.clouds}% · rain ${rainSel}%`, `Humidity ${m.hum}%`, ph.cloud], action: wxGo('sky') };
    case 'rain':
      return { ...base, icon: 'rainy', tile: '#DAEFFB', title: 'The rain', big: `${rainSel}% chance`, lines: [v.rainLine, `Humidity ${m.hum}% · visibility ${m.vis} km`], action: wxGo('rain') };
    case 'palm':
      return {
        ...base,
        icon: 'air',
        tile: '#D3F1EE',
        title: 'The wind',
        big: `${wind} km/h ${m.dir}`,
        lines: [palmWordOf(wind), `${windWordOf(wind)} · gusts to ${Math.round((m.gust * wind) / m.wind)} km/h`],
        action: wxGo('wind'),
      };
    case 'island': {
      const isle = buildIsle(v, d);
      return {
        ...base,
        icon: 'location_on',
        tile: '#FFF0C6',
        title: 'The island',
        big: nm,
        lines: [atollLine(LI, true), isle.countLine, `Beach ${tide.n > 0.72 ? 'narrow, high tide' : tide.n < 0.3 ? 'wide, low tide' : 'average'}`].filter(Boolean),
        action: { label: `Explore ${nm}`, go: { sheet: 'isle' } },
      };
    }
    case 'sea':
      return {
        ...base,
        icon: 'waves',
        tile: '#D3F1EE',
        title: 'The sea',
        big: `${tide.levelText} m · ${tide.dirText}`,
        lines: [`Until ${tide.until}`, `Next high ${tide.nh}`, `Next low ${tide.nl}`, `Lagoon: ${wind < 10 ? 'glassy' : wind < 20 ? 'rippled' : wind < 35 ? 'choppy' : 'rough'}`],
        action: { label: 'Tide details', go: { sheet: 'tide' } },
      };
    case 'dhoni': {
      const sail = sailRow(b, v);
      return {
        icon: 'sailing',
        tile: '#D3F1EE',
        title: 'Sailing',
        big: `${sail.v} · ${sail.score}`,
        bigColor: VC[sail.k].light.word,
        lines: [sail.reason, `Best window ${windowOf((h) => actAt(b.acts, sail.def, h, b.score), m.hour).text}`],
        action: sail.inList ? { label: 'Sailing details', go: { sheet: 'act', actId: 'sail' } } : { label: 'All activities', go: { sheet: 'acts' } },
      };
    }
    case 'temp':
      return {
        ...base,
        icon: 'thermostat',
        tile: '#FFF0C6',
        title: 'Temperature',
        big: `${temp}°`,
        lines: [`Feels like ${temp + (m.feels - m.temp)}°`, `High ${m.hi}° · low ${m.lo}°`, m.tempWord],
        action: wxGo('temp'),
      };
    case 'warning':
      return {
        icon: 'warning',
        tile: '#FFE0D6',
        title: m.warning?.title || 'Heads up',
        big: 'Stay ashore',
        bigColor: '#E2522F',
        lines: [m.warning?.body || '', `Until ${m.warning?.until || 'later'}`],
        action: wxGo('warning'),
      };
  }
}

export const BUBBLE_W = 268;

export interface BubblePos {
  x: number;
  y: number;
  below: boolean;
  /** transform origin inside the bubble */
  ox: number;
  oy: 'top' | 'bottom';
}

/**
 * `bub` placement. The prototype works in the 402 × 874 frame; here the tap is in artboard units
 * and the result is in screen dp: `scale` = screen width / 402, `top` = lowest y (below the HUD row),
 * `bottom` = highest bubble bottom (above the panel).
 */
export function bubblePos(
  c: Pick<BubbleContent, 'lines' | 'action'>,
  tap: { x: number; y: number },
  frame: { w: number; scale: number; top: number; bottom: number },
): BubblePos {
  const bw = BUBBLE_W;
  const bh = 70 + 30 + c.lines.length * 24 + (c.action ? 56 : 0);
  const tx = tap.x * frame.scale;
  const ty = tap.y * frame.scale;
  const bx = clamp(tx - bw / 2, 12, frame.w - bw - 12);
  const below = tap.y < 360;
  const by = clamp(below ? ty + 22 : ty - bh - 22, frame.top, frame.bottom - bh);
  return { x: bx, y: by, below, ox: clamp(tx - bx, 20, bw - 20), oy: below ? 'top' : 'bottom' };
}

// ───────────────────────── All activities ─────────────────────────

export interface ActGroup {
  key: VerdictKey;
  title: string;
  count: string;
  dot: string;
  items: (ActRow & { sep: boolean })[];
}

export function buildGroups(v: View): ActGroup[] {
  const G: [VerdictKey, string][] = [
    ['go', 'Go'],
    ['maybe', 'Maybe'],
    ['wait', 'After sunrise'],
    ['skip', 'Skip'],
  ];
  return G.map(([k, title]) => {
    const items = v.acts.filter((a) => a.k === k).map((a, j) => ({ ...a, vBg: a.lBg, vInk: a.lInk, sep: sepOf(j) }));
    return { key: k, title, items, count: String(items.length), dot: VC[k].fill };
  }).filter((g) => g.items.length);
}

// ───────────────────────── Activity detail ─────────────────────────

export interface ActDetail extends ActRow {
  headBg: string;
  vBig: string;
  vWord: string;
  vInk: string;
  line: string;
  window: string;
  tip: string;
  hours: { h: number; c: string; ring: boolean; label: string }[];
  hasBr: boolean;
  br: { label: string; icon: string; val: string; w: number; c: string; ink: string; tag: string; tagC: string }[];
  condTxt: string;
  hasDays: boolean;
  days: { label: string; w: number; c: string; note: string; score: string; v: string; vBg: string; vInk: string; sep: boolean; sel: boolean }[];
  weekLine: string;
}

export function buildDetail(b: ViewBase, v: View, actId: string | null): ActDetail | null {
  const A = v.acts.find((a) => a.id === actId);
  if (!A) return null;
  const { m, hSel } = v;
  const AD = b.acts;
  const vc = VC[A.k];
  const def = b.defs.find((x) => x.id === A.id)!;
  const win = windowOf((h) => actAt(AD, def, h, b.score), m.hour);
  const selIdx = v.o0;
  const e = A.e;
  const ideal = !!e && e.rec === 'ideal';
  const lim0 = e ? e.lim.find((f) => !(f === 'daylight' && A.k === 'wait')) : null;
  const br = e
    ? FACTORS.filter((F) => e.br[F[0]] != null).map(([f, label, icon]) => {
        const val = clamp(+(e.br[f] as number) || 0, 0, 10);
        const isLim = e.lim.includes(f);
        const noData = f === 'tide' && e.tideOk === false;
        const kk: VerdictKey = f === 'daylight' && A.k === 'wait' ? 'wait' : val >= 7 ? 'go' : val >= 5 ? 'maybe' : 'skip';
        return {
          label,
          icon,
          val: noData ? '–' : String(Math.round(val * 10) / 10),
          w: noData ? 0 : Math.max(3, val * 10),
          c: VC[kk].fill,
          ink: isLim ? '#B23A1C' : '#0A3346',
          tag: isLim ? 'The catch' : noData ? 'No live data' : '',
          tagC: isLim ? '#B23A1C' : '#4F6F79',
        };
      })
    : [];
  const d0 = Math.floor(m.hour / 24);
  const dSel = Math.floor(hSel / 24);
  const DD = A.api ? A.api.days.filter((y) => y.di >= d0).slice(0, 7) : [];
  const dLab = (di: number) => {
    if (di === d0) return 'Today';
    if (di === d0 + 1) return 'Tomorrow';
    const x = dateOf(di * 24 + 12, b.day0);
    return `${x.dow} ${x.d}`;
  };
  const bestD = DD.reduce<(typeof DD)[number] | null>((bb, y) => (!bb || y.s > bb.s ? y : bb), null);
  const days = DD.map((y, j) => {
    const kk = REC[y.rec] || vKey(y.s);
    const c = VC[kk].light;
    const l = y.lim[0];
    return {
      label: dLab(y.di),
      w: Math.max(3, y.s * 10),
      c: VC[kk].fill,
      note: l ? `${capF(FWORD[l] || String(l).replace(/_/g, ' '))} is the catch` : 'Nothing holding it back',
      score: y.s.toFixed(1),
      v: y.rec === 'ideal' ? 'Ideal' : vWord[kk],
      vBg: c.bg,
      vInk: c.ink,
      sep: sepOf(j),
      sel: y.di === dSel,
    };
  });
  return {
    ...A,
    headBg: vc.head,
    vBig: ideal ? 'Ideal.' : vc.big,
    vWord: vc.light.word,
    vInk: vc.light.ink,
    line:
      A.k === 'wait'
        ? `${vc.line} ${e && e.c != null ? `Conditions otherwise score ${e.c.toFixed(1)}. ` : ''}Sunrise is at ${fmt(b.sun.rise)}.`
        : ideal
          ? `Couldn’t ask for better. ${A.base}.`
          : `${vc.line} ${A.reason}.`,
    window: win.text,
    tip: lim0 && FTIP[lim0] ? `${FTIP[lim0]} ${A.tip}` : A.tip,
    hours: win.hrs.map((x, j) => ({ h: Math.max(6, x.s * 10), c: VC[x.k].fill, ring: j === selIdx, label: j % 6 === 0 ? (j ? fmtHr(x.h) : 'Now') : '' })),
    hasBr: br.length > 0,
    br,
    condTxt: e && e.c != null && Math.abs(e.c - e.s) >= 0.3 ? `Conditions ${e.c.toFixed(1)}` : '',
    hasDays: days.length > 0,
    days,
    weekLine: !bestD
      ? ''
      : bestD.di === d0
        ? `Today is your best shot this week, at ${bestD.s.toFixed(1)}.`
        : `Best day: ${dLab(bestD.di)}, scoring ${bestD.s.toFixed(1)}.`,
  };
}

// ───────────────────────── Weather ─────────────────────────

export interface WxView {
  eyebrow: string;
  heroBg: string;
  tint: string;
  icon: string;
  cond: string;
  temp: number;
  feels: number;
  hi: number;
  lo: number;
  tempWord: string;
  hasWarning: boolean;
  warnTitle: string;
  warnUntil: string;
  warnBody: string;
  rise: string;
  set: string;
  moon: MoonInfo;
  wind: number;
  dir: string;
  gust: number;
  windWord: string;
  arrow: number;
  uv: number;
  uvWord: string;
  uvPct: number;
  uvLine: string;
  rain: number;
  rainLine: string;
  hum: number;
  humWord: string;
  clouds: number;
  cloudLine: string;
  vis: number;
  visLine: string;
  sunX: number;
  sunY: number;
  sunO: number;
  sunLine: string;
  hourly: { label: string; icon: string; temp: number; rain: string; sel: boolean; bg: string; ink: string; sub: string; ic: string; rc: string }[];
  hasWeek: boolean;
  days: { label: string; icon: string; ic: string; rain: string; lo: number; hi: number; w: number; l: number; sep: boolean; sel: boolean }[];
  weekLine: string;
}

export function buildWx(b: ViewBase, v: View, d: DataState): WxView {
  const { m, hSel, isLater, wind, temp, rainSel, uvNow, ph } = v;
  const sun = b.sun;
  const day0 = b.day0;
  const ss = sunState(hSel, sun);
  const untilSet = sun.set - md24(hSel);
  const untilRise = md24(sun.rise - md24(hSel));
  const nm = d.island.english_name;
  const qx = (f: number) => (1 - f) * (1 - f) * 12 + 2 * (1 - f) * f * 150 + f * f * 288;
  const qy = (f: number) => (1 - f) * (1 - f) * 84 + 2 * (1 - f) * f * -36 + f * f * 84;
  const sf = ss.day ? ss.f : 0;
  const tint = WX_TINT[m.key] || '#0A3346';
  const mi = moonInfo(moonDataFor(m.live ? m.W : null, day0, sun), hSel, day0);

  const hourly: WxView['hourly'] = Array.from({ length: 24 }, (_, o) => {
    const h = m.hour + o;
    const sel = o === v.o0;
    const r = rainAt(m, h);
    return {
      label: o ? fmtHr(h) : 'Now',
      icon: iconAt(m, h, sun),
      temp: tempAt(m, h),
      rain: r + '%',
      sel,
      bg: sel ? '#0A3346' : '#F6F1E6',
      ink: sel ? '#FFFFFF' : '#0A3346',
      sub: sel ? 'rgba(255,255,255,.72)' : '#4F6F79',
      ic: sel ? '#FFFFFF' : tint,
      rc: sel ? '#9FD8FF' : r >= 50 ? '#2F86C2' : '#4F6F79',
    };
  });

  const wk = m.live ? weekDays(m.W, day0) : [];
  const wLo = Math.min(...wk.map((x) => x.lo));
  const wHi = Math.max(...wk.map((x) => x.hi));
  const wSpan = Math.max(1, wHi - wLo);
  const selDi = Math.floor(hSel / 24);
  const nm3 = (x: (typeof wk)[number]) => (x.di === 0 ? 'today' : x.label.split(' ')[0]);
  const listOf = (a: string[]) => (a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const days = wk.map((x, j) => {
    const w = Math.max(8, ((x.hi - x.lo) / wSpan) * 100);
    return {
      label: x.di === 0 ? 'Today' : x.label,
      icon: x.icon,
      ic: WX_TINT[x.key] || '#0A3346',
      rain: x.pop >= 20 ? x.pop + '%' : '',
      lo: x.lo,
      hi: x.hi,
      w,
      l: Math.min(100 - w, ((x.lo - wLo) / wSpan) * 100),
      sep: sepOf(j),
      sel: x.di === selDi,
    };
  });
  const wet = wk.filter((x) => x.wet);
  const windy = wk.filter((x) => x.wind >= 30);
  const dry = wk.slice(1).reduce<(typeof wk)[number] | null>((bb, x) => (!bb || x.pop < bb.pop || (x.pop === bb.pop && x.hi < bb.hi) ? x : bb), null);
  let weekLine = !wk.length
    ? ''
    : !wet.length
      ? 'Mostly dry all week.'
      : wet.length >= wk.length - 1
        ? 'Showers about most days. Check the hourly for dry gaps.'
        : `Showers likely ${listOf(wet.map(nm3))}.${dry && !dry.wet ? ` Driest: ${nm3(dry)}.` : ''}`;
  if (windy.length && wk.length) weekLine += ` Windy ${listOf(windy.map(nm3))}.`;

  return {
    eyebrow: `${nm} · ${isLater ? `${dayLabel(hSel, day0)} · ${fmt(Math.floor(hSel))}` : 'Now'}`,
    heroBg: WX_HERO[m.key] || '#FFF0C6',
    tint,
    icon: iconAt(m, hSel, sun),
    cond: condAt(m, hSel, sun),
    temp,
    feels: temp + (m.feels - m.temp),
    hi: m.hi,
    lo: m.lo,
    tempWord: m.tempWord,
    hasWarning: !!m.warning,
    warnTitle: m.warning?.title || 'Heads up',
    warnUntil: m.warning?.until || 'later',
    warnBody: m.warning?.body || '',
    rise: fmt(sun.rise),
    set: fmt(sun.set),
    moon: mi,
    wind,
    dir: m.dir,
    gust: Math.round((m.gust * wind) / m.wind),
    windWord: windWordOf(wind),
    arrow: m.deg + 180,
    uv: uvNow,
    uvWord: uvWordOf(uvNow),
    uvPct: clamp((uvNow / 11) * 100, 3, 97),
    uvLine: uvNow >= 6 ? 'Shade from 11 to 3' : uvNow >= 3 ? 'Sunscreen still' : 'Easy on the skin',
    rain: rainSel,
    rainLine: v.rainLine,
    hum: m.hum,
    humWord: m.hum > 84 ? 'Very humid' : m.hum > 70 ? 'Humid' : 'Comfortable',
    clouds: m.clouds,
    cloudLine: ph.cloud,
    vis: m.vis,
    visLine: ph.vis,
    sunX: qx(sf),
    sunY: qy(sf),
    sunO: ss.day ? 1 : 0,
    sunLine: ss.day ? `${dur(Math.max(0, untilSet))} of sun left` : `Sun's back in ${dur(untilRise)}`,
    hourly,
    hasWeek: wk.length > 1,
    days,
    weekLine,
  };
}

// ───────────────────────── Tide ─────────────────────────

export interface TdView {
  eyebrow: string;
  levelText: string;
  dirIcon: string;
  dirText: string;
  until: string;
  /** chart paths in a 354 × 150 box */
  line: string;
  area: string;
  nowPct: number;
  nowY: number;
  marks: { x: number; y: number; ly: number; c: string; label: string; tx: number }[];
  axis: { x: number; tx: number; label: string }[];
  next: { icon: string; kind: string; time: string; lvl: string; ic: string; icBg: string; sep: boolean }[];
  beach: string;
  beachLine: string;
  src: string;
  lagoon: string;
  lagoonLine: string;
}

export function buildTide(b: ViewBase, v: View, d: DataState, wxEyebrow: string): TdView {
  const { m, hSel, wind, tide } = v;
  const T = b.tide;
  const tLo = T ? T.lo : -0.3;
  const tHi = T ? T.hi : 0.5;
  const yOf = (l: number) => 18 + ((tHi + 0.02 - l) / (tHi - tLo + 0.04)) * 120;
  let tLine = '';
  for (let i = 0; i <= 96; i++) {
    const x = (i / 96) * 354;
    const y = yOf(tideAt(m.hour + i / 4, T));
    tLine += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  const exAll = extrema(T);
  const dTag = (h: number) => (h >= 24 ? ' · ' + dateOf(h, b.day0).dow : '');
  return {
    eyebrow: wxEyebrow,
    levelText: tide.levelText,
    dirIcon: tide.rising ? 'north_east' : 'south_east',
    dirText: tide.dirText,
    until: tide.until,
    line: tLine,
    area: tLine + ' L354 150 L0 150 Z',
    nowPct: (v.o0 / 24) * 100,
    nowY: yOf(tideAt(hSel, T)),
    marks: exAll
      .filter((e) => e.h > m.hour + 0.3 && e.h < m.hour + 23.7)
      .map((e) => {
        const x = ((e.h - m.hour) / 24) * 100;
        const y = yOf(e.lvl);
        return { x, y, ly: e.high ? y - 26 : y + 10, c: e.high ? '#12B5B0' : '#C9A35E', label: fmt(e.h).replace(' AM', 'a').replace(' PM', 'p'), tx: x < 10 ? -15 : x > 90 ? -85 : -50 };
      }),
    axis: [0, 6, 12, 18, 24].map((o, i) => ({ x: (o / 24) * 100, tx: i === 0 ? 0 : i === 4 ? -100 : -50, label: o === 0 ? 'Now' : fmtHr(m.hour + o) })),
    next: exAll
      .filter((e) => e.h > hSel + 0.01)
      .slice(0, 4)
      .map((e, j) => ({
        icon: e.high ? 'water' : 'footprint',
        kind: e.high ? 'High tide' : 'Low tide',
        time: fmt(e.h) + dTag(e.h),
        lvl: fmtLvl(e.lvl) + ' m',
        ic: e.high ? '#087F7A' : '#7A5600',
        icBg: e.high ? '#D3F1EE' : '#FFF0C6',
        sep: sepOf(j),
      })),
    beach: tide.n > 0.72 ? 'Narrow' : tide.n < 0.3 ? 'Wide' : 'Average',
    beachLine: tide.n > 0.72 ? 'High water, less sand to sit on' : tide.n < 0.3 ? 'Lots of sand. Reef walk time' : 'Room for a towel or two',
    src: tideSrc(d.tides[d.island.id]),
    lagoon: wind < 10 ? 'Glassy' : wind < 20 ? 'Rippled' : wind < 35 ? 'Choppy' : 'Rough',
    lagoonLine: `${wind} km/h from the ${m.dir}`,
  };
}

// ───────────────────────── Island picker / welcome ─────────────────────────

export interface IslandRow {
  I: ApiIsland;
  name: string;
  atoll: string;
  cur: boolean;
  icon: string;
  ic: string;
  sep: boolean;
  wxIcon: string;
  wxTint: string;
  wxCond: string;
  wxTemp: number | '–';
  bg: string;
}

/** Picker rows for a query (current + recents + popular when empty, max 12 matches otherwise). */
export function buildIslandList(b: ViewBase, v: View, d: DataState, query: string): { rows: IslandRow[]; noResults: boolean; q: string } {
  const q = query.trim().toLowerCase();
  const list = pickerIslands(q, d.islands, d.island, d.recents);
  const hSel = v.hSel;
  const dayS = sunState(hSel, b.sun).el > 0;
  const rows = list.map((I, j) => {
    const cur = I.id === d.island.id;
    const W = d.wx[wxKey(I)];
    const s = isData(W) ? sample(W.hrs, hSel) : null;
    return {
      I,
      name: I.english_name,
      atoll: atollLine(I),
      cur,
      icon: cur ? 'my_location' : 'location_on',
      ic: cur ? '#087F7A' : '#9AAFB5',
      sep: sepOf(j),
      wxIcon: s ? owmIcon(s.id, dayS) : W === 'err' ? 'cloud_off' : 'more_horiz',
      wxTint: s ? WX_TINT[keyOf(s, hSel, b.sun)] || '#0A3346' : '#9AAFB5',
      wxCond: s ? owmCond(s.id, dayS) : W === 'err' ? 'No data' : 'Loading…',
      wxTemp: s ? Math.round(s.temp) : ('–' as const),
      bg: cur ? 'rgba(18,181,176,.08)' : 'transparent',
    };
  });
  return { rows, noResults: !!q && !list.length, q };
}

const GM: Partial<Record<GeoStatus, [string, string, string]>> = {
  locating: ['radar', 'Finding your island…', 'Hang on a few seconds'],
  denied: ['location_disabled', 'Location is off', 'Allow location for Naiboli in Settings, then tap to try again'],
  far: ['wrong_location', 'You’re not on an island we know', 'Tap to try again, or pick one below'],
  fail: ['location_off', 'Couldn’t find you', 'Tap to try again'],
};

export interface GeoRow {
  icon: string;
  title: string;
  sub: string;
  tile: string;
  ic: string;
}

export function geoRowOf(geo: GeoStatus, perm: Perm): GeoRow {
  const gm = GM[geo] || ['near_me', 'Use my current location', perm === 'granted' ? 'Jump to the island you’re on' : 'We’ll ask to use your location'];
  const warn = geo === 'denied' || geo === 'far' || geo === 'fail';
  return { icon: gm[0], title: gm[1], sub: gm[2], tile: warn ? '#FFE0D6' : '#D3F1EE', ic: warn ? '#E2522F' : '#087F7A' };
}

const WM: Partial<Record<GeoStatus, string>> = {
  denied: 'Location is off for Naiboli. Pick an island yourself, or allow location in Settings and try again.',
  far: 'You don’t seem to be on a Maldivian island right now. Pick one yourself.',
  fail: 'Couldn’t get your location. Try again, or pick an island yourself.',
};

export interface WelcomeView {
  btn: string;
  hasMsg: boolean;
  msg: string;
  msgIcon: string;
}

export function welcomeOf(geo: GeoStatus, perm: Perm): WelcomeView {
  return { btn: geo === 'locating' ? 'Finding your island…' : 'Use my location', hasMsg: !!WM[geo], msg: WM[geo] || '', msgIcon: geoRowOf(geo, perm).icon };
}

/** CSS row separator, for tests comparing against the prototype. */
export const SEP_CSS = SEP;
