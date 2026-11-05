import { acts1069, NOW_MS, synthTide, weather1069 } from '@/data/__tests__/fixtures';
import { POP } from '@/data/islands';
import { isData, type ApiIsland } from '@/data/types';
import { makeStorage } from '../storage';
import { CLOCK_MS, createDataStore, STALE_MS } from '../store';

const male = POP[0];
const hulhumale = POP[1]; // same weather anchor (27) as Malé
const thulusdhoo = POP[3]; // anchor 28

type Reply = { status: number; body: unknown; wait?: Promise<void> } | 'network';
type Route = (path: string) => Reply;

function setup(opts: { route?: Route; saved?: ApiIsland | null } = {}) {
  let t = NOW_MS;
  const calls: string[] = [];
  let route: Route =
    opts.route ??
    ((p) =>
      p === '/islands'
        ? { status: 200, body: [{ ...male, latitude_decimal: '4.17' }, hulhumale, thulusdhoo] }
        : p.startsWith('/weather-for-island/')
          ? { status: 200, body: weather1069 }
          : p.startsWith('/tide-for-island/')
            ? { status: 200, body: synthTide() }
            : p.endsWith('/activity-scores')
              ? { status: 200, body: acts1069 }
              : { status: 200, body: { description: 'An island', beaches: [], reefs: [], accessibilities: [] } });
  /** pending responses, released by `flush()` */
  const fetcher = jest.fn(async (url: string) => {
    const p = String(url).replace('https://moodhu.dev/api', '');
    calls.push(p);
    const r = route(p);
    if (r === 'network') throw new TypeError('Network request failed');
    if (r.wait) await r.wait;
    return { ok: r.status < 300, status: r.status, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  const kv = new Map<string, string>();
  const storage = makeStorage({ getItem: async (k) => kv.get(k) ?? null, setItem: async (k, v) => void kv.set(k, v) });
  let tickFn: (() => void) | null = null;
  const store = createDataStore({
    fetcher,
    storage,
    now: () => t,
    setInterval: (fn, ms) => {
      expect(ms).toBe(CLOCK_MS);
      tickFn = fn;
      return 1;
    },
    clearInterval: () => (tickFn = null),
  });
  store.init(opts.saved ?? null);
  return {
    store,
    calls,
    kv,
    setRoute: (r: Route) => (route = r),
    advance: (ms: number) => (t += ms),
    tick: () => tickFn!(),
    count: (prefix: string) => calls.filter((c) => c.startsWith(prefix)).length,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('data store', () => {
  it('launch without a saved island: Malé, first run, nothing saved', async () => {
    const s = setup();
    expect(s.store.getState()).toMatchObject({ island: male, firstRun: true });
    s.store.start();
    expect(s.store.getState().wx['27']).toBe('loading');
    await flush();
    const st = s.store.getState();
    expect(s.calls.sort()).toEqual(['/islands', '/islands/1069', '/islands/1069/activity-scores', '/tide-for-island/1069', '/weather-for-island/1069']);
    expect(isData(st.wx['27']) && isData(st.tides[1069]) && isData(st.acts[1069]) && isData(st.isle[1069])).toBe(true);
    // island object refreshed from the list, but not saved during first run
    expect(st.island.latitude_decimal).toBe('4.17');
    expect(s.kv.size).toBe(0);
    expect(st.lastW).toBe(st.wx['27']);
    expect(st.lastTide).toBe(st.tides[1069]);
    expect(st.sun.rise).toBeCloseTo(5.83, 1);
    await expect(s.store.listPromise).resolves.toHaveLength(3);
  });

  it('launch with a saved island: renders it and refreshes the saved copy from the list', async () => {
    const s = setup({ saved: thulusdhoo });
    expect(s.store.getState()).toMatchObject({ island: thulusdhoo, firstRun: false });
    s.store.start();
    await flush();
    expect(JSON.parse(s.kv.get('naiboli.island.v1')!)).toEqual(thulusdhoo);
  });

  it('recents: every pick goes to the front, saved; the saved island counts as recent at launch', async () => {
    const s = setup({ saved: thulusdhoo });
    expect(s.store.getState().recents.map((i) => i.id)).toEqual([1017]);
    s.store.start();
    await flush();
    s.store.pickIsland(male);
    s.store.pickIsland(hulhumale);
    s.store.pickIsland(male);
    expect(s.store.getState().recents.map((i) => i.id)).toEqual([1069, 1068, 1017]);
    expect(JSON.parse(s.kv.get('naiboli.recents.v1')!).map((i: ApiIsland) => i.id)).toEqual([1069, 1068, 1017]);
    // stored recents load back (invalid entries dropped)
    s.kv.set('naiboli.recents.v1', JSON.stringify([hulhumale, { id: 3 }, null, male]));
    const storage = makeStorage({ getItem: async (k) => s.kv.get(k) ?? null, setItem: async () => {} });
    expect((await storage.loadRecents()).map((i) => i.id)).toEqual([1068, 1069]);
    s.store.stop();
  });

  it('first run without a saved island has no recents', () => {
    expect(setup().store.getState().recents).toEqual([]);
  });

  it('caches weather by anchor and dedupes in-flight requests', async () => {
    const s = setup();
    s.store.start();
    s.store.ensureWx(male);
    s.store.ensureWx(hulhumale);
    await flush();
    s.store.ensureWx(hulhumale);
    expect(s.count('/weather-for-island/')).toBe(1);
    s.store.ensureWx(thulusdhoo);
    expect(s.count('/weather-for-island/')).toBe(2);
  });

  it('pickIsland saves, leaves first run and loads everything for the island', async () => {
    const s = setup();
    s.store.start();
    await flush();
    s.store.pickIsland(thulusdhoo);
    expect(s.store.getState()).toMatchObject({ island: thulusdhoo, firstRun: false });
    expect(s.store.getState().wx['28']).toBe('loading');
    // last good weather (Malé's) bridges the switch
    expect(s.store.getState().lastW).toBe(s.store.getState().wx['27']);
    // Malé's tide stays on screen while Thulusdhoo's loads
    expect(s.store.getState().lastTide).toBe(s.store.getState().tides[1069]);
    await flush();
    expect(s.store.getState().lastTide).toBe(s.store.getState().tides[1017]);
    expect(JSON.parse(s.kv.get('naiboli.island.v1')!).id).toBe(1017);
    expect(s.count('/tide-for-island/1017') + s.count('/islands/1017')).toBe(3); // tide, details, scores
    expect(s.store.getState().lastW).toBe(s.store.getState().wx['28']);
  });

  it('refetches weather and scores when older than 10 min, keeping data during refresh', async () => {
    const s = setup();
    s.store.start();
    await flush();
    const W = s.store.getState().wx['27'];
    s.advance(STALE_MS - 1000);
    s.tick();
    expect(s.count('/weather-for-island/')).toBe(1);
    s.advance(2000);
    s.tick();
    expect(s.count('/weather-for-island/')).toBe(2);
    expect(s.count('/islands/1069/activity-scores')).toBe(2);
    expect(s.store.getState().wx['27']).toBe(W); // not reset to loading
    await flush();
    expect(s.store.getState().wx['27']).not.toBe(W);
  });

  it('keeps the last good data when a refresh fails', async () => {
    const s = setup();
    s.store.start();
    await flush();
    const before = s.store.getState();
    s.setRoute(() => 'network');
    s.advance(STALE_MS + 1);
    s.tick();
    await flush();
    expect(s.store.getState().wx['27']).toBe(before.wx['27']);
    expect(s.store.getState().acts[1069]).toBe(before.acts[1069]);
  });

  it('marks failures and retries failed scores every minute', async () => {
    const s = setup({ route: (p) => (p.endsWith('/activity-scores') ? { status: 503, body: null } : p.startsWith('/weather') ? { status: 200, body: { nope: 1 } } : 'network') });
    s.store.start();
    await flush();
    const st = s.store.getState();
    expect(st.acts[1069]).toBe('err');
    expect(st.wx['27']).toBe('err'); // bad payload
    expect(st.tides[1069]).toBe('err');
    expect(st.lastTide).toBeNull();
    await expect(s.store.listPromise).resolves.toBeNull();
    s.advance(CLOCK_MS);
    s.tick();
    expect(s.store.getState().acts[1069]).toBe('loading');
    expect(s.count('/islands/1069/activity-scores')).toBe(2);
    // weather is not retried by the clock (only on demand)
    expect(s.count('/weather-for-island/')).toBe(1);
  });

  it('a tide payload that is too short is an error, not data', async () => {
    const s = setup();
    s.setRoute((p) => (p.startsWith('/tide') ? { status: 200, body: synthTide({ minutes: 60 }) } : { status: 200, body: weather1069 }));
    s.store.ensureTide(male);
    await flush();
    expect(s.store.getState().tides[1069]).toBe('err');
  });

  it('resets at local midnight and drops responses from the previous day', async () => {
    const s = setup();
    s.store.start();
    await flush();
    const day0 = s.store.getState().day0;
    // a stale-weather refresh at 23:55 that only answers after midnight, with a marker payload
    let release!: () => void;
    const late = new Promise<void>((r) => (release = r));
    const marker = JSON.parse(JSON.stringify(weather1069));
    marker.data.current.temp = 99;
    s.setRoute((p) =>
      p.startsWith('/weather') ? { status: 200, body: marker, wait: late } : { status: 200, body: p.endsWith('/activity-scores') ? acts1069 : synthTide() },
    );
    s.advance((9 * 60 + 35) * 60000); // 14:20 → 23:55
    s.tick();
    expect(s.count('/weather-for-island/')).toBe(2);
    s.setRoute((p) => ({ status: 200, body: p.startsWith('/weather') ? weather1069 : p.endsWith('/activity-scores') ? acts1069 : synthTide() }));
    s.advance(10 * 60000); // 00:05
    s.tick();
    const st = s.store.getState();
    expect(st.day0).toBe(day0 + 86400);
    expect(st.lastW).toBeNull();
    expect(st.lastTide).toBeNull();
    expect(st.wx['27']).toBe('loading');
    expect(st.tides[1069]).toBe('loading');
    expect(st.acts[1069]).toBe('loading');
    expect(isData(st.isle[1069])).toBe(true); // island details survive
    expect(s.count('/weather-for-island/')).toBe(3); // refetched despite the old request in flight
    await flush();
    release();
    await flush();
    const W = s.store.getState().wx['27'];
    expect(isData(W) && W.hrs[0].temp).toBe(weather1069.data!.current!.temp); // marker dropped
    expect(isData(W) && W.hrs[0].h).toBeLessThan(0); // yesterday's 14:00 is now negative
  });

  it('notifies subscribers on change and stops the clock', async () => {
    const s = setup();
    const l = jest.fn();
    const off = s.store.subscribe(l);
    s.store.start();
    expect(l).toHaveBeenCalled();
    off();
    s.store.stop();
    await flush();
  });
});
