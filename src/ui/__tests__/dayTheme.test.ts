import { lightOf } from '@/scene/palette';
import { DAY_THEME, dayTheme, type DayTheme } from '@/ui/dayTheme';
import { C } from '@/ui/theme';

const SUN = { rise: 6, set: 18.2 };
const at = (h: number, gloom = 0) => dayTheme(lightOf(h, gloom, SUN), gloom);

/** WCAG contrast ratio of two opaque hex colours. */
function contrast(a: string, b: string) {
  const L = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const HOURS = Array.from({ length: 48 }, (_, i) => i / 2);
const GLOOMS = [0, 0.2, 0.45, 0.6, 0.8, 1];
const all: DayTheme[] = HOURS.flatMap((h) => GLOOMS.map((g) => at(h, g)));

describe('dayTheme', () => {
  it('is the prototype design on a clear day', () => {
    const t = at(12);
    expect(t.key).toBe(DAY_THEME.key);
    expect(t.dark).toBe(false);
    expect(t.c.sheet).toBe(C.sheet);
    expect(t.c.card).toBe(C.card);
    expect(t.c.ink).toBe(C.ink);
    // builder colours pass through unchanged
    expect(t.bg('#FFF0C6')).toBe('#FFF0C6');
    expect(t.fg('#0B6B57')).toBe('#0B6B57');
  });

  it('switches to dark exactly when the bottom panel does', () => {
    for (const h of HOURS)
      for (const g of GLOOMS) {
        const Lt = lightOf(h, g, SUN);
        expect(at(h, g).dark).toBe(!(Lt.D > 0.5 && g < 0.5));
      }
    expect(at(0).dark).toBe(true);
    expect(at(12, 0.8).dark).toBe(true);
  });

  it('warms at low sun and cools under cloud (light), takes the sky hue (dark)', () => {
    expect(at(7.5).c.sheet).not.toBe(C.sheet); // morning
    expect(at(16.75).c.sheet).not.toBe(C.sheet); // late afternoon
    expect(at(12, 0.4).c.sheet).not.toBe(C.sheet); // overcast
    expect(at(0).c.sheet).not.toBe(at(12, 0.9).c.sheet); // night navy vs storm slate
  });

  it('is cached by look', () => {
    expect(at(0)).toBe(at(1));
    expect(new Set(all.map((t) => t.key)).size).toBeLessThan(40);
  });

  it('keeps text readable on every surface at every hour', () => {
    for (const t of all) {
      const { c } = t;
      for (const ground of [c.sheet, c.card, c.tile]) {
        expect(contrast(c.ink, ground)).toBeGreaterThanOrEqual(7);
        expect(contrast(c.secondary, ground)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(c.onInverse, c.inverse)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.tipText, c.tipBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.warnInk, c.warnBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.tealDark, c.tealTint)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('maps builder chip colours to readable pairs in the dark', () => {
    const chips: [string, string][] = [
      ['#D3F4E9', '#0B6B57'], // go
      ['#FFF0C2', '#7A5600'], // maybe
      ['#FFE0D6', '#B23A1C'], // skip
      ['#DDE3F6', '#3A4890'], // after sunrise
      ['#F1E9DA', '#5B4A2A'], // tag
      ['#0A3346', '#FFFFFF'], // selected hour
    ];
    for (const t of all.filter((x) => x.dark))
      for (const [bg, fg] of chips) expect(contrast(t.fg(fg), t.bg(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
