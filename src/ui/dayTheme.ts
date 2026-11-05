/**
 * The day is the theme: sheets and bubbles take their colours from the scene's light at the selected hour.
 *
 * - Light or dark follows the bottom panel (`lightPanel` in `state/view.ts`: daylight > .5 and gloom < .5),
 *   so sheets, bubbles and the panel always agree.
 * - Light: the prototype's cream design (clear midday = exactly the README tokens), warming toward peach as
 *   the sun gets low (from elevation .5, ~1.5 h after sunrise / before sunset, ahead of the scene's own golden
 *   light) and cooled toward grey under cloud.
 * - Dark: surfaces take the hue of the scene's sky (night navy, dusk indigo, storm slate) at fixed
 *   lightness, so contrast is the same at every hour.
 *
 * Colours that come from the data builders (verdict chips, tags, hourly cells…) are written for the light
 * design; `bg()` / `fg()` map them for the current theme (identity in light mode).
 *
 * Themes are quantised and cached by `key`, so the object (and anything cached per theme, see `themed`)
 * only changes when the look actually changes.
 */
import { createContext, useContext } from 'react';

import type { Light } from '@/scene/palette';

import { C, SHADOW } from './theme';

type RGB = [number, number, number];

// ── colour maths ──

function parse(c: string): { rgb: RGB; a: number } | null {
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h.replace(/./g, (x) => x + x);
    const n = parseInt(h.slice(0, 6), 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x));
  return { rgb: [p[0], p[1], p[2]], a: p[3] ?? 1 };
}

const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgba = (c: RGB, a: number) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;
const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgbOf = (hex: string) => parse(hex)!.rgb;
/** mix two hex colours (k = 0 → a, 1 → b) */
const mix = (a: string, b: string, k: number) => toHex(mixRGB(rgbOf(a), rgbOf(b), k));

function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// ── tokens ──

export interface ThemeColors {
  sheet: string;
  card: string;
  tile: string;
  button: string;
  ink: string;
  secondary: string;
  bodySecondary: string;
  mutedIcon: string;
  placeholder: string;
  /** accent text / icons */
  teal: string;
  tealTint: string;
  tealLine: string;
  tealArea: string;
  /** text on `tealTint` */
  tealDark: string;
  selectedRow: string;
  tipBg: string;
  tipIcon: string;
  tipText: string;
  warnBg: string;
  warnIcon: string;
  warnInk: string;
  warnBody: string;
  islandHero: string;
  coords: string;
  chipIcon: string;
  /** chips / pills on a tinted hero */
  heroChip: string;
  heroChipSoft: string;
  /** small icon tiles on a tinted hero (white in the light design) */
  heroTile: string;
  sand: string;
  rocky: string;
  arc: string;
  /** row separator / hairline */
  sep: string;
  /** inset outline (search field, outlined button) */
  outline: string;
  outlineStrong: string;
  /** filled primary button / bubble action (ink in the light design) and its text */
  inverse: string;
  onInverse: string;
  bubble: string;
  grabber: string;
  /** brand logos that need a light ground on a dark sheet */
  logoGround: string;
  cardShadow: string | undefined;
  focusRing: string;
  /** chart "now" dot fill */
  dot: string;
}

export interface DayTheme {
  key: string;
  dark: boolean;
  c: ThemeColors;
  /** a light-design background colour from the data builders, for this theme */
  bg: (c: string) => string;
  /** a light-design text / icon colour from the data builders, for this theme */
  fg: (c: string) => string;
  /** `{ color: fg(c) }`, the same object every time (no per-render style allocations) */
  fgS: (c: string) => { color: string };
  /** `{ backgroundColor: bg(c) }`, the same object every time */
  bgS: (c: string) => { backgroundColor: string };
}

/** Adds the cached style-object helpers to a theme's colour mappers. */
function withStyles(t: Omit<DayTheme, 'fgS' | 'bgS'>): DayTheme {
  const fgs = new Map<string, { color: string }>();
  const bgs = new Map<string, { backgroundColor: string }>();
  return {
    ...t,
    fgS: (col) => {
      let v = fgs.get(col);
      if (!v) fgs.set(col, (v = { color: t.fg(col) }));
      return v;
    },
    bgS: (col) => {
      let v = bgs.get(col);
      if (!v) bgs.set(col, (v = { backgroundColor: t.bg(col) }));
      return v;
    },
  };
}

const LIGHT: ThemeColors = {
  sheet: C.sheet,
  card: C.card,
  tile: C.tile,
  button: C.button,
  ink: C.ink,
  secondary: C.secondary,
  bodySecondary: C.bodySecondary,
  mutedIcon: C.mutedIcon,
  placeholder: '#757575',
  teal: C.teal,
  tealTint: C.tealTint,
  tealLine: C.tealLine,
  tealArea: C.tealArea,
  tealDark: C.tealDark,
  selectedRow: C.selectedRow,
  tipBg: C.tipBg,
  tipIcon: C.tipIcon,
  tipText: C.tipText,
  warnBg: C.warnBg,
  warnIcon: C.warnIcon,
  warnInk: C.warnInk,
  warnBody: C.warnBody,
  islandHero: C.islandHero,
  coords: C.coords,
  chipIcon: C.chipIcon,
  heroChip: 'rgba(255,255,255,.72)',
  heroChipSoft: 'rgba(255,255,255,.55)',
  heroTile: '#FFFFFF',
  sand: C.sand,
  rocky: C.rocky,
  arc: C.arc,
  sep: 'rgba(10,51,70,.07)',
  outline: 'rgba(10,51,70,.1)',
  outlineStrong: 'rgba(10,51,70,.18)',
  inverse: C.ink,
  onInverse: '#FFFFFF',
  bubble: 'rgba(255,255,255,.95)',
  grabber: 'rgba(10,51,70,.18)',
  logoGround: 'transparent',
  cardShadow: SHADOW.card,
  focusRing: SHADOW.focus,
  dot: '#FFFFFF',
};

/** Warm (low sun) and cool (cloud) targets for the light surfaces. */
const WARM = { sheet: '#FDEEE0', tile: '#FBEADB', button: '#F6E1CF', card: '#FFFCF8', arc: '#EED3B8' };
const COOL = { sheet: '#EEF1F1', tile: '#EBEFF0', button: '#E0E6E8', card: '#FCFDFD', arc: '#D5DDE0' };

function lightTheme(warm: number, cool: number): ThemeColors {
  if (!warm && !cool) return LIGHT;
  const t = (k: keyof typeof WARM) => mix(mix(LIGHT[k] as string, WARM[k], warm), COOL[k], cool);
  return { ...LIGHT, sheet: t('sheet'), tile: t('tile'), button: t('button'), card: t('card'), arc: t('arc') };
}

/** Dark tokens on hue `h`, saturation `s` (capped) of the sky. */
function darkTheme(h: number, s: number): ThemeColors {
  const S = (k: number) => Math.min(s, 0.5) * k;
  const card = hsl(h, S(1), 0.18);
  const tint = (c: string, k: number) => mix(card, c, k);
  const ink = hsl(h, S(0.6), 0.96);
  const sheet = hsl(h, S(1), 0.13);
  return {
    sheet,
    card,
    tile: hsl(h, S(1), 0.22),
    button: hsl(h, S(0.9), 0.26),
    ink,
    secondary: hsl(h, S(0.5), 0.74),
    bodySecondary: hsl(h, S(0.5), 0.82),
    mutedIcon: hsl(h, S(0.4), 0.55),
    placeholder: hsl(h, S(0.3), 0.6),
    teal: '#5ED6CD',
    tealTint: tint('#12B5B0', 0.24),
    tealLine: '#3FD0C8',
    tealArea: tint('#12B5B0', 0.3),
    tealDark: '#9BE9E1',
    selectedRow: 'rgba(63,208,200,.13)',
    tipBg: tint('#FFC83D', 0.2),
    tipIcon: '#FFD772',
    tipText: '#F4E6BE',
    warnBg: tint('#FF7350', 0.24),
    warnIcon: '#FF9273',
    warnInk: '#FFD6CA',
    warnBody: '#F6C9BC',
    islandHero: tint('#E9B86A', 0.24),
    coords: '#EBCB97',
    chipIcon: '#F0BE6E',
    heroChip: 'rgba(255,255,255,.1)',
    heroChipSoft: 'rgba(255,255,255,.08)',
    heroTile: 'rgba(255,255,255,.12)',
    sand: '#D2AE74',
    rocky: hsl(h, S(0.4), 0.42),
    arc: hsl(h, S(0.6), 0.36),
    sep: 'rgba(255,255,255,.08)',
    outline: 'rgba(255,255,255,.14)',
    outlineStrong: 'rgba(255,255,255,.24)',
    inverse: ink,
    onInverse: sheet,
    bubble: rgba(rgbOf(sheet), 0.94),
    grabber: 'rgba(255,255,255,.24)',
    logoGround: 'rgba(255,255,255,.92)',
    cardShadow: undefined,
    focusRing: `0 0 0 2.5px ${ink}`,
    dot: sheet,
  };
}

/** Builder colours that are really tokens map to the theme's tokens. */
function tokenMaps(c: ThemeColors) {
  const bg: Record<string, string> = {
    '#FFFFFF': c.card,
    '#F6F1E6': c.tile,
    '#F1E9DA': c.button,
    '#FBF6EC': c.sheet,
    '#D3F1EE': c.tealTint,
    '#FFF0C6': c.tipBg,
    '#FFE0D6': c.warnBg,
    '#FBEBC4': c.islandHero,
    'rgba(18,181,176,.08)': c.selectedRow,
    // ink as a background = the selected / inverted cell
    '#0A3346': mix(c.card, '#12B5B0', 0.55),
  };
  const fg: Record<string, string> = {
    '#0A3346': c.ink,
    '#05314A': c.ink,
    '#4F6F79': c.secondary,
    '#3F5F69': c.bodySecondary,
    '#9AAFB5': c.mutedIcon,
    '#087F7A': c.teal,
    '#7A5600': c.tipIcon,
    '#FFFFFF': '#FFFFFF',
  };
  return { bg, fg };
}

function makeDark(c: ThemeColors): Pick<DayTheme, 'bg' | 'fg'> {
  const maps = tokenMaps(c);
  const memo = new Map<string, string>();
  const card = rgbOf(c.card);
  const conv = (kind: 'bg' | 'fg', col: string) => {
    const k = kind + col;
    const hit = memo.get(k);
    if (hit) return hit;
    let out = maps[kind][col.toUpperCase()] ?? maps[kind][col];
    if (!out) {
      const p = parse(col);
      if (!p || col === 'transparent') out = col;
      else {
        const [h, s, l] = toHsl(p.rgb);
        if (kind === 'bg') {
          // a pastel ground keeps its hue as a muted tint of the card
          out = p.a < 1 ? col : toHex(mixRGB(card, rgbOf(hsl(h, Math.min(1, s), 0.55)), s < 0.08 ? 0.12 : 0.26));
        } else {
          // text / icons: same hue, light enough for the dark ground
          out = p.a < 1 ? col : l >= 0.78 ? col : hsl(h, Math.min(s, 0.85), Math.max(0.78, l));
        }
      }
    }
    memo.set(k, out);
    return out;
  };
  return { bg: (col) => conv('bg', col), fg: (col) => conv('fg', col) };
}

const same = (col: string) => col;
const cache = new Map<string, DayTheme>();

/** The theme for the scene light at the selected hour (`lightOf(hSel, gloom, sun)`). Cached by look. */
export function dayTheme(Lt: Light, gloom: number): DayTheme {
  const dark = !(Lt.D > 0.5 && gloom < 0.5);
  let key: string;
  let make: () => DayTheme;
  if (!dark) {
    // quarter steps: low sun and cloud (gloom < .5 here)
    const low = Math.max(Lt.G * 2, (0.5 - Lt.el) / 0.45);
    const warm = Math.round(Math.max(0, Math.min(1, low)) * 4) / 4;
    const cool = Math.round(Math.min(1, gloom * 2) * 4) / 4;
    key = `L${warm}/${cool}`;
    make = () => withStyles({ key, dark, c: lightTheme(warm * 0.85, cool * 0.85), bg: same, fg: same });
  } else {
    const sky = mixRGB(Lt.pal.sky[0], Lt.pal.sky[1], 0.35);
    const [h0, s0] = toHsl(sky);
    const h = Math.round(h0 / 10) * 10;
    const s = Math.round(s0 * 10) / 10;
    key = `D${h}/${s}`;
    make = () => {
      const c = darkTheme(h, s);
      return withStyles({ key, dark, c, ...makeDark(c) });
    };
  }
  let t = cache.get(key);
  if (!t) {
    t = make();
    if (cache.size > 64) cache.clear();
    cache.set(key, t);
  }
  return t;
}

/** The clear-day theme (the prototype's design): default before the screen provides one, and in tests. */
export const DAY_THEME: DayTheme = withStyles({ key: 'L0/0', dark: false, c: LIGHT, bg: same, fg: same });

const ThemeCtx = createContext<DayTheme>(DAY_THEME);
export const DayThemeProvider = ThemeCtx.Provider;
export const useDayTheme = () => useContext(ThemeCtx);

/**
 * Styles that depend on the theme, built once per theme look: `const useS = themed((c) => StyleSheet.create({…}))`
 * at module level, then `const s = useS()` in the component.
 */
export function themed<T>(make: (c: ThemeColors, t: DayTheme) => T): () => T {
  const built = new Map<string, T>();
  return function useThemed() {
    const t = useContext(ThemeCtx);
    let v = built.get(t.key);
    if (!v) {
      v = make(t.c, t);
      if (built.size > 64) built.clear();
      built.set(t.key, v);
    }
    return v;
  };
}
