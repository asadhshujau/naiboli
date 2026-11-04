import { islandsSmall } from '@/data/__tests__/fixtures';
import type { GeoStatus } from '@/data/location';
import type { ApiIsland } from '@/data/types';

import { createLocator, type LocatorDeps, type PermResult } from '../locate';
import type { Perm } from '../sheets';

const GRANTED: PermResult = { granted: true, canAskAgain: true };
const UNDETERMINED: PermResult = { granted: false, canAskAgain: true };
const BLOCKED: PermResult = { granted: false, canAskAgain: false };
const male = { id: 1069, english_name: 'Malé', atoll_code_english: 'K' } as ApiIsland;
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(o: {
  perm?: PermResult;
  afterRequest?: PermResult;
  firstRun?: boolean;
  asked?: boolean;
  position?: 'ok' | 'fail';
  where?: { status: number; json: unknown } | 'network';
  sheetOpen?: boolean;
}) {
  let perm = o.perm ?? UNDETERMINED;
  const log: string[] = [];
  const st = { geo: 'idle' as GeoStatus, perm: null as Perm | null, asked: !!o.asked, picked: null as ApiIsland | null, welcome: 0, settings: 0, requests: 0 };
  const deps: LocatorDeps = {
    getPermission: async () => perm,
    requestPermission: async () => {
      st.requests++;
      perm = o.afterRequest ?? perm;
      return perm;
    },
    getPosition: async () => {
      if (o.position === 'fail') throw new Error('timeout');
      return { latitude: 4.17, longitude: 73.5 };
    },
    whereAmI: async () => {
      const w = o.where ?? { status: 200, json: { resolved: true, island: male } };
      if (w === 'network') throw new Error('offline');
      return w;
    },
    islands: async () => islandsSmall,
    locAsked: async () => st.asked,
    setLocAsked: () => {
      st.asked = true;
      log.push('setLocAsked');
    },
    openSettings: () => st.settings++,
    getGeo: () => st.geo,
    isFirstRun: () => o.firstRun ?? true,
    isSheetOpen: () => !!o.sheetOpen,
    setGeo: (g) => {
      st.geo = g;
      log.push('geo:' + g);
    },
    setPerm: (p) => (st.perm = p),
    openWelcome: () => st.welcome++,
    pick: (I) => (st.picked = I),
  };
  return { L: createLocator(deps), st, log, setPerm: (p: PermResult) => (perm = p) };
}

describe('first run', () => {
  it('permission granted → locates silently during the splash and picks the full list entry', async () => {
    const { L, st } = setup({ perm: GRANTED });
    await L.start();
    await flush();
    expect(st.perm).toBe('granted');
    expect(st.picked).toBe(islandsSmall.find((i) => i.id === 1069));
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(0);
    expect(st.requests).toBe(0);
  });

  it('granted but not near an island → Welcome with the reason after the splash (even if asked before)', async () => {
    const { L, st } = setup({ perm: GRANTED, asked: true, where: { status: 422, json: { resolved: false } } });
    await L.start();
    await flush();
    expect(st.geo).toBe('far');
    expect(st.welcome).toBe(0); // splash still up
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(1);
    expect(st.picked).toBeNull();
  });

  it('not granted → Welcome once, after the splash, and remembers it', async () => {
    const { L, st, log } = setup({ perm: UNDETERMINED });
    await L.start();
    await flush();
    expect(st.welcome).toBe(0);
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(1);
    expect(log).toContain('setLocAsked');
    expect(st.requests).toBe(0); // never prompts by itself
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(1);
  });

  it('already asked and not granted → no sheet, no prompt', async () => {
    const { L, st } = setup({ perm: UNDETERMINED, asked: true });
    await L.start();
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(0);
    expect(st.requests).toBe(0);
  });

  it('a saved island → nothing happens on launch, even with permission', async () => {
    const { L, st } = setup({ perm: GRANTED, firstRun: false });
    await L.start();
    L.splashDone();
    await flush();
    expect(st.picked).toBeNull();
    expect(st.welcome).toBe(0);
  });

  it('does not cover a sheet the user already opened', async () => {
    const { L, st } = setup({ perm: UNDETERMINED, sheetOpen: true });
    await L.start();
    L.splashDone();
    await flush();
    expect(st.welcome).toBe(0);
  });
});

describe('use my location', () => {
  it('asks when the OS can, then locates', async () => {
    const { L, st, log } = setup({ perm: UNDETERMINED, afterRequest: GRANTED, firstRun: false });
    await L.start();
    await L.locate();
    expect(st.requests).toBe(1);
    expect(log.filter((l) => l.startsWith('geo:'))).toEqual(['geo:locating', 'geo:idle']);
    expect(st.picked?.id).toBe(1069);
    expect(st.perm).toBe('granted');
  });

  it('declined → Location is off', async () => {
    const { L, st } = setup({ perm: UNDETERMINED, afterRequest: BLOCKED, firstRun: false });
    await L.locate();
    expect(st.geo).toBe('denied');
    expect(st.perm).toBe('denied');
    expect(st.settings).toBe(0);
  });

  it('blocked → "Location is off", and the next tap opens Settings without prompting', async () => {
    const { L, st } = setup({ perm: BLOCKED, firstRun: false });
    await L.locate();
    expect(st.geo).toBe('denied');
    expect(st.settings).toBe(0);
    await L.locate();
    expect(st.settings).toBe(1);
    expect(st.requests).toBe(0);
  });

  it('allowed in Settings → the next tap locates', async () => {
    const { L, st, setPerm } = setup({ perm: BLOCKED, firstRun: false });
    await L.locate();
    setPerm(GRANTED);
    await L.refreshPermission();
    expect(st.perm).toBe('granted');
    await L.locate();
    expect(st.picked?.id).toBe(1069);
  });

  it.each([
    ['no fix', { position: 'fail' as const }, 'fail'],
    ['network error', { where: 'network' as const }, 'fail'],
    ['server error', { where: { status: 500, json: null } }, 'fail'],
    ['resolved:false', { where: { status: 200, json: { resolved: false } } }, 'far'],
  ])('%s → %s', async (_, o, geo) => {
    const { L, st } = setup({ perm: GRANTED, firstRun: false, ...o });
    await L.locate();
    expect(st.geo).toBe(geo);
    expect(st.picked).toBeNull();
    expect(st.welcome).toBe(0);
  });

  it('ignores taps while a lookup is running', async () => {
    const { L, st } = setup({ perm: GRANTED, firstRun: false });
    const a = L.locate();
    const b = L.locate();
    await Promise.all([a, b]);
    expect(st.picked?.id).toBe(1069);
    expect(st.requests).toBe(0);
  });

  it('a failed manual lookup never opens Welcome', async () => {
    const { L, st } = setup({ perm: GRANTED, firstRun: true, where: { status: 422, json: null } });
    L.splashDone();
    await L.locate();
    await flush();
    expect(st.geo).toBe('far');
    expect(st.welcome).toBe(0);
  });
});
