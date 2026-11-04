export type VerdictKey = 'go' | 'maybe' | 'skip' | 'wait';

export interface VerdictTone {
  bg: string;
  ink: string;
  word: string;
}

export interface VerdictColors {
  light: VerdictTone;
  /** used on the bottom panel in dark mode */
  dark: VerdictTone;
  /** bars, dots, scrubber */
  fill: string;
  /** activity detail hero background */
  head: string;
  big: string;
  line: string;
}

export const VC: Record<VerdictKey, VerdictColors> = {
  go: {
    light: { bg: '#D3F4E9', ink: '#0B6B57', word: '#0E9F7E' },
    dark: { bg: 'rgba(23,184,144,.24)', ink: '#8BEDCE', word: '#8BEDCE' },
    fill: '#17B890',
    head: '#D9F5EC',
    big: 'Go.',
    line: 'Yes! Conditions line up nicely.',
  },
  maybe: {
    light: { bg: '#FFF0C2', ink: '#7A5600', word: '#A87000' },
    dark: { bg: 'rgba(255,200,61,.22)', ink: '#FFD772', word: '#FFD772' },
    fill: '#FFC83D',
    head: '#FFF1C6',
    big: 'Maybe.',
    line: 'Doable. Go with a plan and a buddy.',
  },
  skip: {
    light: { bg: '#FFE0D6', ink: '#B23A1C', word: '#E2522F' },
    dark: { bg: 'rgba(255,115,80,.22)', ink: '#FFA58E', word: '#FFA58E' },
    fill: '#FF7350',
    head: '#FFE1D7',
    big: 'Skip.',
    line: 'Not this time. Another hour will treat you better.',
  },
  wait: {
    light: { bg: '#DDE3F6', ink: '#3A4890', word: '#5866A8' },
    dark: { bg: 'rgba(140,151,216,.26)', ink: '#C3CBF7', word: '#C3CBF7' },
    fill: '#8C97D8',
    head: '#E2E7F8',
    big: 'Wait.',
    line: 'Too dark for now.',
  },
};

export const vWord: Record<VerdictKey, string> = { go: 'Go', maybe: 'Maybe', skip: 'Skip', wait: 'Wait' };

/** Route `recommendation` → verdict key. */
export const REC: Record<string, VerdictKey> = {
  ideal: 'go',
  go: 'go',
  caution: 'maybe',
  avoid: 'skip',
  wait_for_daylight: 'wait',
};

/** Fallback from a 0–10 score. */
export function vKey(s: number): VerdictKey {
  'worklet';
  return s >= 7 ? 'go' : s >= 5 ? 'maybe' : 'skip';
}

/** Verdict for a route entry: its recommendation if known, else from the score. */
export function verdictOf(e: { s: number; rec: string }): VerdictKey {
  return REC[e.rec] || vKey(e.s);
}

/** Label shown in pills: "Ideal" for `ideal`, else the verdict word. */
export function verdictLabel(k: VerdictKey, e: { rec: string } | null | undefined): string {
  return e && e.rec === 'ideal' ? 'Ideal' : vWord[k];
}

/** Colour key for a 0–10 factor value. */
export const factorKey = (v: number): VerdictKey => (v >= 7 ? 'go' : v >= 5 ? 'maybe' : 'skip');
