/**
 * Screen UI state (bubble, sheets, picker query, location row) — the prototype's
 * `openBubble`, `onSceneClick` toggle, `openSheet`, `closeSheet` and `pickIsland` state changes.
 */
import type { GeoStatus } from '@/data/location';

import type { BubbleKind, SheetName, SheetTarget, WxFocus } from './sheets';

/** Sheet slide-out time; content stays mounted until it has finished. */
export const SHEET_MS = 450;

export interface UiState {
  bubble: { kind: BubbleKind; x: number; y: number } | null;
  bubbleOpen: boolean;
  sheet: SheetName | null;
  sheetOpen: boolean;
  actId: string | null;
  focus: WxFocus | null;
  query: string;
  geo: GeoStatus;
  hintSeen: boolean;
  /** bumped by every `openSheet` so the sheet scrolls to the focused card (or the top) */
  seq: number;
}

export const initialUi: UiState = {
  bubble: null,
  bubbleOpen: false,
  sheet: null,
  sheetOpen: false,
  actId: null,
  focus: null,
  query: '',
  geo: 'idle',
  hintSeen: false,
  seq: 0,
};

export type OpenSheet =
  | { sheet: Exclude<SheetName, 'act' | 'wx'> }
  | { sheet: 'wx'; focus?: WxFocus | null }
  | { sheet: 'act'; actId: string };

export type UiAction =
  | { type: 'openBubble'; kind: BubbleKind; x: number; y: number }
  /** scene tap: tapping the open bubble's object again closes it */
  | { type: 'sceneTap'; kind: BubbleKind; x: number; y: number }
  | { type: 'closeBubble' }
  /** scrubber pointer down */
  | { type: 'scrub' }
  /** "Now" button */
  | { type: 'backToNow' }
  | ({ type: 'openSheet' } & OpenSheet)
  | { type: 'closeSheet' }
  /** the close animation finished */
  | { type: 'sheetGone' }
  | { type: 'query'; query: string }
  | { type: 'geo'; geo: GeoStatus }
  /** an island was picked (manually or by location) */
  | { type: 'picked' };

export function uiReducer(s: UiState, a: UiAction): UiState {
  switch (a.type) {
    case 'openBubble':
      return { ...s, bubble: { kind: a.kind, x: a.x, y: a.y }, bubbleOpen: true, hintSeen: true };
    case 'sceneTap':
      if (s.bubbleOpen && s.bubble?.kind === a.kind) return { ...s, bubbleOpen: false };
      return uiReducer(s, { ...a, type: 'openBubble' });
    case 'closeBubble':
    case 'backToNow':
      return s.bubbleOpen ? { ...s, bubbleOpen: false } : s;
    case 'scrub':
      return s.bubbleOpen || !s.hintSeen ? { ...s, bubbleOpen: false, hintSeen: true } : s;
    case 'openSheet': {
      const next: UiState = {
        ...s,
        sheet: a.sheet,
        sheetOpen: true,
        bubbleOpen: false,
        focus: null,
        seq: s.seq + 1,
      };
      if (a.sheet === 'island') {
        if (s.geo !== 'locating') next.geo = 'idle';
        next.query = '';
      }
      if (a.sheet === 'wx') next.focus = a.focus ?? null;
      if (a.sheet === 'act') next.actId = a.actId;
      return next;
    }
    case 'closeSheet':
      return s.sheetOpen ? { ...s, sheetOpen: false } : s;
    case 'sheetGone':
      return s.sheetOpen ? s : { ...s, sheet: null, query: '' };
    case 'query':
      return { ...s, query: a.query };
    case 'geo':
      return { ...s, geo: a.geo };
    case 'picked':
      return { ...s, bubbleOpen: false, geo: 'idle', sheetOpen: false };
  }
}

/** A bubble action's target as an `openSheet` action. */
export function openTarget(t: SheetTarget): UiAction {
  switch (t.sheet) {
    case 'wx':
      return { type: 'openSheet', sheet: 'wx', focus: t.focus };
    case 'act':
      return { type: 'openSheet', sheet: 'act', actId: t.actId };
    default:
      return { type: 'openSheet', sheet: t.sheet };
  }
}
