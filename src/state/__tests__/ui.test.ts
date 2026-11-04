import { initialUi, openTarget, uiReducer, type UiAction, type UiState } from '../ui';

const run = (s: UiState, ...as: UiAction[]) => as.reduce(uiReducer, s);

describe('bubble', () => {
  it('opens on a scene tap and hides the hint', () => {
    const s = run(initialUi, { type: 'sceneTap', kind: 'sun', x: 100, y: 200 });
    expect(s).toMatchObject({ bubble: { kind: 'sun', x: 100, y: 200 }, bubbleOpen: true, hintSeen: true });
  });

  it('tapping the same object again closes it; another object moves it', () => {
    let s = run(initialUi, { type: 'sceneTap', kind: 'sun', x: 100, y: 200 });
    s = run(s, { type: 'sceneTap', kind: 'sun', x: 120, y: 210 });
    expect(s.bubbleOpen).toBe(false);
    expect(s.bubble).toEqual({ kind: 'sun', x: 100, y: 200 }); // keeps its content while fading out
    s = run(s, { type: 'sceneTap', kind: 'sun', x: 120, y: 210 });
    expect(s).toMatchObject({ bubbleOpen: true, bubble: { x: 120 } });
    s = run(s, { type: 'sceneTap', kind: 'sea', x: 50, y: 600 });
    expect(s).toMatchObject({ bubbleOpen: true, bubble: { kind: 'sea' } });
  });

  it('closes on scrub, Now, close button and when a sheet opens', () => {
    const open = run(initialUi, { type: 'openBubble', kind: 'temp', x: 340, y: 90 });
    for (const a of [{ type: 'scrub' }, { type: 'backToNow' }, { type: 'closeBubble' }, { type: 'openSheet', sheet: 'tide' }] as UiAction[]) {
      expect(uiReducer(open, a).bubbleOpen).toBe(false);
    }
    expect(uiReducer(initialUi, { type: 'scrub' }).hintSeen).toBe(true);
  });
});

describe('sheets', () => {
  it('openSheet resets focus, sets extras and bumps seq', () => {
    let s = run(initialUi, { type: 'openSheet', sheet: 'wx', focus: 'uv' });
    expect(s).toMatchObject({ sheet: 'wx', sheetOpen: true, focus: 'uv', seq: 1 });
    s = run(s, { type: 'openSheet', sheet: 'acts' });
    expect(s).toMatchObject({ sheet: 'acts', focus: null, seq: 2 });
    s = run(s, { type: 'openSheet', sheet: 'act', actId: 'sail' });
    expect(s).toMatchObject({ sheet: 'act', actId: 'sail', seq: 3 });
  });

  it('opening the picker clears the query and resets the location row unless locating', () => {
    let s = run(initialUi, { type: 'query', query: 'maa' }, { type: 'geo', geo: 'far' }, { type: 'openSheet', sheet: 'island' });
    expect(s).toMatchObject({ query: '', geo: 'idle' });
    s = run(s, { type: 'geo', geo: 'locating' }, { type: 'openSheet', sheet: 'island' });
    expect(s.geo).toBe('locating');
  });

  it('closeSheet keeps the content until sheetGone; reopening in time cancels the unmount', () => {
    let s = run(initialUi, { type: 'openSheet', sheet: 'island' }, { type: 'query', query: 'hul' }, { type: 'closeSheet' });
    expect(s).toMatchObject({ sheet: 'island', sheetOpen: false, query: 'hul' });
    expect(run(s, { type: 'sheetGone' })).toMatchObject({ sheet: null, query: '' });
    s = run(s, { type: 'openSheet', sheet: 'menu' }, { type: 'sheetGone' });
    expect(s).toMatchObject({ sheet: 'menu', sheetOpen: true });
  });

  it('a pick closes bubble and sheet and resets the location row', () => {
    const s = run(initialUi, { type: 'openBubble', kind: 'island', x: 1, y: 2 }, { type: 'openSheet', sheet: 'island' }, { type: 'geo', geo: 'locating' }, { type: 'picked' });
    expect(s).toMatchObject({ bubbleOpen: false, sheetOpen: false, geo: 'idle' });
  });

  it('maps bubble targets to openSheet actions', () => {
    expect(openTarget({ sheet: 'wx', focus: 'moon' })).toEqual({ type: 'openSheet', sheet: 'wx', focus: 'moon' });
    expect(openTarget({ sheet: 'act', actId: 'sail' })).toEqual({ type: 'openSheet', sheet: 'act', actId: 'sail' });
    expect(openTarget({ sheet: 'isle' })).toEqual({ type: 'openSheet', sheet: 'isle' });
  });
});
