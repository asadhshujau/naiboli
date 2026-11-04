/**
 * View model for the selected hour — port of the prototype's `renderVals()`.
 * HUD, bottom panel and scene input; bubble and sheet values are in `./sheets`.
 */
import { actAt, actDefs, apiAt, makeScorer, SAIL_INDEX, type ActDefLive, type Scorer } from '@/data/activities';
import { labelOf, wxKey } from '@/data/islands';
import { hourView, rainAt, resolveMood, tempAt, windAt, type Mood } from '@/data/mood';
import { sunState } from '@/data/sun';
import { tideView, type TideView } from '@/data/tide';
import { dayLabel, fmt, fmtHr, hOfUnix } from '@/data/time';
import { isData, type ActEntry, type Acts, type Sun, type Tide } from '@/data/types';
import { VC, verdictLabel, type VerdictKey } from '@/data/verdict';
import { moonDataFor, sample, uvWordOf, windWordOf, type Phrases } from '@/data/weather';
import { lightOf, lum } from '@/scene/palette';
import type { SceneInput } from '@/scene/paint';

import type { DataState } from './store';

export interface HudTone {
  ink: string;
  sub: string;
  chip: string;
  shadow: boolean;
  panel: string;
  panelSolid: string;
  pEdge: string;
  pInk: string;
  pSub: string;
  pBtn: string;
  pCard: string;
}

export interface ActRow extends ActDefLive {
  s: number;
  k: VerdictKey;
  e: ActEntry | null;
  base: string;
  /** "Ideal" / "Go" / … */
  v: string;
  score: string;
  reason: string;
  /** panel-tone colours */
  vBg: string;
  vInk: string;
  vWord: string;
  /** light colours (sheets) */
  lBg: string;
  lInk: string;
}

/** Inputs that stay fixed while scrubbing (memoised by the hook). */
export interface ViewBase {
  mood: Mood;
  sun: Sun;
  tide: Tide | null;
  acts: Acts | null;
  actsRaw: DataState['acts'][number];
  defs: ActDefLive[];
  score: Scorer;
  day0: number;
}

export function buildBase(d: DataState, nowMs: number): ViewBase {
  const tide = d.lastTide;
  const I = d.island;
  const { mood, sun } = resolveMood({ W: d.wx[wxKey(I)], lastW: d.lastW, label: labelOf(I), nowH: hOfUnix(nowMs / 1000, d.day0), prevSun: d.sun });
  const actsRaw = d.acts[I.id];
  const acts = isData(actsRaw) ? actsRaw : null;
  return { mood, sun, tide, acts, actsRaw, defs: actDefs(acts), score: makeScorer(mood, sun, tide), day0: d.day0 };
}

/** Scene input — independent of the scrubber. */
export function buildSceneInput(b: ViewBase, signName: string, animate: boolean): SceneInput {
  const m = b.mood;
  const sail: number[] = [];
  const sailApi = b.acts ? b.acts.byId.sail : undefined;
  for (let k = 0; k <= 26 * 4; k++) {
    const h = m.hour + k / 4;
    const e = b.acts && sailApi ? apiAt(b.acts, sailApi, h) : null;
    sail.push(e ? e.s : b.score(SAIL_INDEX, h));
  }
  return {
    live: m.live,
    hrs: m.live ? m.W.hrs : [],
    gloom: m.gloom,
    rainAmt: m.rainAmt,
    wind: m.wind,
    cloudN: m.cloudN,
    deg: m.deg,
    flash: m.flash,
    hour0: m.hour,
    sun: b.sun,
    tide: b.tide ? { v: b.tide.v, lo: b.tide.lo, hi: b.tide.hi } : null,
    moon: moonDataFor(m.live ? m.W : null, b.day0, b.sun),
    sail,
    signName,
    animate,
  };
}

export interface View {
  m: Mood;
  hSel: number;
  /** whole-hour scrubber offset (prototype `o0`) */
  o0: number;
  isLater: boolean;
  darkSky: boolean;
  lightPanel: boolean;
  hud: HudTone;
  loc: string;
  now: { icon: string; temp: number };
  eyebrow: string;
  head: string;
  sub: string;
  warning: Mood['warning'];
  hasWarning: boolean;
  whenLabel: string;
  acts: ActRow[];
  top3: ActRow[];
  actCount: number;
  actsSrc: string;
  ribbon: { h: number; c: string; o: number }[];
  axis: { x: number; tx: number; label: string }[];
  // shared with bubbles / sheets (phase 3)
  wind: number;
  temp: number;
  tide: TideView;
  rainSel: number;
  rainLine: string;
  uvNow: number;
  isDayH: boolean;
  ph: Phrases;
}

export function buildView(b: ViewBase, d: DataState, offsetH: number): View {
  const m0 = b.mood;
  const sun = b.sun;
  const day0 = b.day0;
  const hSel = m0.hour + offsetH;
  const isLater = offsetH > 0;
  const m: Mood = m0.live && isLater ? { ...m0, ...hourView(m0.W, hSel, sun) } : m0;

  const Lt = lightOf(hSel, m.gloom, sun);
  const skyL = lum(Lt.pal.sky[0]) * 0.6 + lum(Lt.pal.sky[1]) * 0.4;
  const darkSky = skyL < 0.42;
  const lightPanel = Lt.D > 0.5 && m.gloom < 0.5;
  const hud: HudTone = {
    ink: darkSky ? '#FFFFFF' : '#05314A',
    sub: darkSky ? 'rgba(255,255,255,.9)' : '#0B4560',
    chip: darkSky ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.58)',
    shadow: darkSky,
    panel: lightPanel ? 'rgba(255,255,255,.8)' : 'rgba(6,22,36,.58)',
    panelSolid: lightPanel ? '#F4FAFA' : '#0E2333',
    pEdge: lightPanel ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.1)',
    pInk: lightPanel ? '#0A3346' : '#FFFFFF',
    pSub: lightPanel ? '#4F6F79' : 'rgba(255,255,255,.75)',
    pBtn: lightPanel ? 'rgba(10,51,70,.07)' : 'rgba(255,255,255,.12)',
    pCard: lightPanel ? '#FFFFFF' : 'rgba(255,255,255,.08)',
  };
  const tone = lightPanel ? 'light' : 'dark';
  const wind = windAt(m, hSel);
  const temp = tempAt(m, hSel);
  const tide = tideView(hSel, b.tide);
  const rainSel = isLater ? rainAt(m, hSel) : m.rain;
  const rainLine = isLater
    ? rainSel >= 70
      ? 'Showers likely'
      : rainSel >= 40
        ? 'Could get wet'
        : rainSel >= 15
          ? 'Small chance of a shower'
          : 'Should stay dry'
    : m.phrases.rain;
  const ssH = sunState(hSel, sun);
  const isDayH = ssH.el > 0;
  const uvNow = isDayH ? (m.live ? Math.round(sample(m.W.hrs, hSel).uvi) : Math.round(m.uvMax * Math.sin(Math.PI * ssH.f))) : 0;
  const ph: Phrases = {
    ...m.phrases,
    uv: isDayH ? (uvNow >= 8 ? `UV ${uvNow}. Reef-safe sunscreen!` : `UV ${uvNow}. ${uvWordOf(uvNow)}`) : `No sun till ${fmt(sun.rise)}`,
    vis: isDayH ? (m.key === 'night' ? 'Water clarity looks good' : m.phrases.vis) : 'Dark water. Bring a torch',
    cloud: isDayH ? (m.key === 'night' ? 'Clear skies' : m.phrases.cloud) : m.clouds > 50 ? 'Cloudy night' : 'Clear night sky',
  };

  const AD = b.acts;
  const limTxt = (f: string) =>
    f === 'wind'
      ? `wind, ${wind} km/h`
      : f === 'rain'
        ? `rain, ${rainSel}% chance`
        : f === 'uv'
          ? `strong sun, UV ${uvNow}`
          : f === 'visibility'
            ? `haze, ${m.vis} km visibility`
            : f === 'tide'
              ? `the tide, ${tide.dirText.toLowerCase()} at ${tide.levelText} m`
              : f === 'temp'
                ? `the heat, ${temp}°`
                : f === 'daylight'
                  ? isDayH
                    ? 'fading light'
                    : `the dark, sunrise ${fmt(sun.rise)}`
                  : String(f).replace(/_/g, ' ');
  const acts: ActRow[] = b.defs
    .map((a) => {
      const r = actAt(AD, a, hSel, b.score);
      const { s, k, e } = r;
      const c = VC[k][tone];
      const cl = VC[k].light;
      const base = a.key === 'tide' ? `${tide.dirText} tide, ${tide.levelText} m` : a.key === 'wind' ? `${windWordOf(wind)}, ${wind} km/h` : ph[a.key];
      const lim = e ? e.lim.filter((f) => !(f === 'daylight' && k === 'wait')) : [];
      const reason =
        k === 'wait'
          ? `Too dark till ${fmt(sun.rise)}${e && e.c != null ? ` · otherwise ${e.c.toFixed(1)}` : ''}`
          : lim.length
            ? `${s >= 7 ? 'Only catch:' : 'Held back by'} ${limTxt(lim[0])}`
            : base;
      return { ...a, s, k, e, base, v: verdictLabel(k, e), score: s.toFixed(1), reason, vBg: c.bg, vInk: c.ink, vWord: c.word, lBg: cl.bg, lInk: cl.ink };
    })
    .sort((x, y) => y.s - x.s);
  const actsSrc = AD
    ? `Activity scores from moodhu.dev, updated ${fmt(AD.at)}.`
    : b.actsRaw === 'err'
      ? 'Couldn’t load activity scores, so these are our own estimate from the weather.'
      : 'Loading activity scores… showing our own estimate for now.';
  const top3 = acts.slice(0, 3);
  const whenLabel = isLater ? `Forecast · ${dayLabel(hSel, day0)} · ${fmt(Math.floor(hSel))}` : `Today · Now`;
  const best = acts[0];
  const word = !best ? 'grim' : best.s >= 8.5 ? 'brilliant' : best.s >= 7 ? 'good' : best.s >= 5 ? 'so-so' : 'grim';
  const head = isLater ? `${fmt(Math.floor(hSel)).replace(':00', '')} looks ${word}.` : m.headEn;
  const sub = isLater
    ? `Best bet: ${best?.name}. ${temp}°, wind ${wind} km/h, tide ${tide.dirText.toLowerCase()}.`
    : m.offline
      ? 'Couldn’t reach the live feed. Showing sample conditions.'
      : !m.live && m.loading
        ? 'Fetching live conditions…'
        : m.sub;
  const eyebrow = isLater
    ? `${dayLabel(hSel, day0)} · ${fmt(Math.floor(hSel))}`
    : `Today · ${dayLabel(m.hour, day0)} · ${fmt(m.hour)}${m.loading && m.live ? ' · Updating' : ''}`;

  const ribbon: View['ribbon'] = [];
  for (let o = 0; o < 24; o++) {
    const h = m.hour + o;
    let bs = -1;
    let bk: VerdictKey = 'skip';
    for (const a of b.defs) {
      const r = actAt(AD, a, h, b.score);
      if (r.s > bs) {
        bs = r.s;
        bk = r.k;
      }
    }
    ribbon.push({ h: 22 + bs * 7.8, c: VC[bk].fill, o: o === offsetH ? 1 : 0.6 });
  }
  const axis = [0, 6, 12, 18, 23].map((o, i) => ({ x: (o / 23) * 100, tx: i === 0 ? 0 : i === 4 ? -100 : -50, label: o === 0 ? 'Now' : fmtHr(m.hour + o) }));

  const ss = sunState(hSel, sun);
  const now = {
    icon: m.live ? m.icon : isLater ? (ss.day ? (m.key === 'night' || m.key === 'golden' ? 'sunny' : m.icon) : 'bedtime') : m.icon,
    temp,
  };

  return {
    m,
    hSel,
    o0: offsetH,
    isLater,
    darkSky,
    lightPanel,
    hud,
    loc: labelOf(d.island),
    now,
    eyebrow,
    head,
    sub,
    warning: m.warning,
    hasWarning: !!m.warning && !isLater,
    whenLabel,
    acts,
    top3,
    actCount: acts.length,
    actsSrc,
    ribbon,
    axis,
    wind,
    temp,
    tide,
    rainSel,
    rainLine,
    uvNow,
    isDayH,
    ph,
  };
}

