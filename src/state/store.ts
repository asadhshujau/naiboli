/**
 * Data store: selected island, island list and per-island caches with the prototype's
 * fetch / refresh rules (`ensureWx`, `ensureTide`, `ensureIsle`, `ensureActs`, `loadLive` clock).
 *
 * - Weather is cached by weather anchor; tide, details and scores by island id.
 * - Weather and scores refetch when older than 10 min; failed scores retry every minute.
 * - A failed first load of weather, tide or the island list retries on the clock with a backoff
 *   (1, 2, 4, 8, then every 10 min); `retryNow()` retries everything failed at once (tap to retry, app foreground).
 * - A failed refresh keeps the last good data.
 * - At local midnight the hour axis advances and weather, tide and scores reset and refetch.
 */
import { procActs } from '@/data/activities';
import { api, type Fetcher } from '@/data/api';
import { addRecent, cleanIslands, DEFAULT_ISLAND, procIsle, wxKey } from '@/data/islands';
import { DEFAULT_SUN, sunOf } from '@/data/sun';
import { procTide } from '@/data/tide';
import { day0Of, hOfUnix } from '@/data/time';
import { isData, type Acts, type ApiIsland, type Entry, type IslandDetail, type Sun, type Tide, type Weather } from '@/data/types';
import { procWx } from '@/data/weather';
import type { Storage } from './storage';

export const STALE_MS = 10 * 60 * 1000;
export const CLOCK_MS = 60 * 1000;
/** Wait before the n-th clock retry of a failed load (n = failures so far, from 1); last value repeats. */
/** A manual refresh skips data fetched less than this long ago. */
export const REFRESH_MIN_MS = 30 * 1000;
export const RETRY_MS = [1, 2, 4, 8, 10].map((m) => m * 60 * 1000);

export interface DataState {
  /** unix s of local midnight today — the hour axis origin */
  day0: number;
  island: ApiIsland;
  /** no island saved yet */
  firstRun: boolean;
  islands: ApiIsland[] | null;
  /** recently loaded islands, most recent first (current included); see `defaultIslands` */
  recents: ApiIsland[];
  wx: Record<string, Entry<Weather>>;
  tides: Record<number, Entry<Tide>>;
  isle: Record<number, Entry<IslandDetail>>;
  acts: Record<number, Entry<Acts>>;
  /** last good weather shown for the current island (bridges island switches) */
  lastW: Weather | null;
  /** tide shown for the current island: kept while a new island's tide loads, cleared on error/midnight (prototype `TIDE`) */
  lastTide: Tide | null;
  /** last known sunrise/sunset */
  sun: Sun;
  /** a manual refresh (tap on the HUD time line) is running */
  refreshing: boolean;
  /** Date.now() of the last clock tick — changes once a minute so views re-render */
  clock: number;
}

export interface StoreDeps {
  fetcher?: Fetcher;
  now?: () => number;
  storage: Storage;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
}

export function createDataStore(deps: StoreDeps) {
  const now = deps.now ?? Date.now;
  const f = deps.fetcher;
  const setIv = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clearIv = deps.clearInterval ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>));

  let state: DataState = {
    day0: day0Of(now()),
    island: DEFAULT_ISLAND,
    firstRun: true,
    islands: null,
    recents: [],
    wx: {},
    tides: {},
    isle: {},
    acts: {},
    lastW: null,
    lastTide: null,
    sun: DEFAULT_SUN,
    refreshing: false,
    clock: now(),
  };
  const listeners = new Set<() => void>();
  /** bumped on midnight reset so late responses from the previous day are dropped */
  let gen = 0;
  let inflight = { wx: {} as Record<string, boolean>, tide: {} as Record<number, boolean>, isle: {} as Record<number, boolean>, acts: {} as Record<number, boolean> };
  let clockId: unknown = null;
  /** failed loads to retry on the clock: key → failures so far and when the last one happened */
  let fails: Record<string, { n: number; at: number }> = {};
  let listInflight = false;
  const failed = (k: string) => (fails[k] = { n: (fails[k]?.n ?? 0) + 1, at: now() });
  const due = (k: string) => {
    const r = fails[k];
    return !!r && now() - r.at >= RETRY_MS[Math.min(r.n, RETRY_MS.length) - 1];
  };
  let listResolve: (l: ApiIsland[] | null) => void = () => {};
  const listPromise = new Promise<ApiIsland[] | null>((r) => (listResolve = r));

  function set(patch: Partial<DataState> | ((s: DataState) => Partial<DataState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    let next = { ...state, ...p };
    // Track the last good weather for the current island (prototype `_lastW`) and its sun times.
    const W = next.wx[wxKey(next.island)];
    if (isData(W) && W !== next.lastW) next = { ...next, lastW: W, sun: sunOf(W, next.sun) };
    const Tc = next.tides[next.island.id];
    if (Tc === 'err' && next.lastTide) next = { ...next, lastTide: null };
    else if (isData(Tc) && Tc !== next.lastTide) next = { ...next, lastTide: Tc };
    state = next;
    listeners.forEach((l) => l());
  }

  /** Returns the request when one starts. */
  function ensureWx(I: ApiIsland, force = false): Promise<void> | undefined {
    const k = wxKey(I);
    const cur = state.wx[k];
    if (inflight.wx[k] || (!force && cur && cur !== 'err')) return;
    inflight.wx[k] = true;
    const g = gen;
    const fl = inflight;
    if (!cur || cur === 'err') set((s) => ({ wx: { ...s.wx, [k]: 'loading' } }));
    return api
      .weather(I.id, f)
      .then((j) => {
        const W = procWx(j, state.day0, now());
        if (!W) throw new Error('bad payload');
        if (g !== gen) return;
        delete fails['wx:' + k];
        set((s) => ({ wx: { ...s.wx, [k]: W } }));
      })
      .catch(() => {
        if (g !== gen) return;
        if (!isData(state.wx[k])) failed('wx:' + k);
        set((s) => ({ wx: { ...s.wx, [k]: isData(s.wx[k]) ? s.wx[k] : 'err' } }));
      })
      .finally(() => {
        fl.wx[k] = false;
      });
  }

  function ensureTide(I: ApiIsland) {
    const k = I.id;
    const cur = state.tides[k];
    if (inflight.tide[k] || (cur && cur !== 'err')) return;
    inflight.tide[k] = true;
    const g = gen;
    const fl = inflight;
    set((s) => ({ tides: { ...s.tides, [k]: 'loading' } }));
    api
      .tide(I.id, f)
      .then((j) => {
        const T = procTide(j, state.day0);
        if (g !== gen) return;
        // a short / unusable payload means no usable feed for this island: not retried
        delete fails['tide:' + k];
        set((s) => ({ tides: { ...s.tides, [k]: T || 'err' } }));
      })
      .catch(() => {
        if (g !== gen) return;
        failed('tide:' + k);
        set((s) => ({ tides: { ...s.tides, [k]: 'err' } }));
      })
      .finally(() => {
        fl.tide[k] = false;
      });
  }

  function ensureIsle(I: ApiIsland) {
    const k = I.id;
    const cur = state.isle[k];
    if (inflight.isle[k] || (cur && cur !== 'err')) return;
    inflight.isle[k] = true;
    const fl = inflight;
    set((s) => ({ isle: { ...s.isle, [k]: 'loading' } }));
    api
      .island(k, f)
      .then((j) => {
        const D = procIsle(j);
        set((s) => ({ isle: { ...s.isle, [k]: D } }));
      })
      .catch(() => set((s) => ({ isle: { ...s.isle, [k]: 'err' } })))
      .finally(() => {
        fl.isle[k] = false;
      });
  }

  /** Returns the request when one starts. */
  function ensureActs(I: ApiIsland, force = false): Promise<void> | undefined {
    const k = I.id;
    const cur = state.acts[k];
    if (inflight.acts[k] || (!force && cur && cur !== 'err')) return;
    inflight.acts[k] = true;
    const g = gen;
    const fl = inflight;
    if (!cur || cur === 'err') set((s) => ({ acts: { ...s.acts, [k]: 'loading' } }));
    return api
      .activityScores(k, f)
      .then((j) => {
        const A = procActs(j, state.day0, now());
        if (!A) throw new Error('bad payload');
        if (g === gen) set((s) => ({ acts: { ...s.acts, [k]: A } }));
      })
      .catch(() => {
        if (g === gen) set((s) => ({ acts: { ...s.acts, [k]: isData(s.acts[k]) ? s.acts[k] : 'err' } }));
      })
      .finally(() => {
        fl.acts[k] = false;
      });
  }

  /** `/islands`; `listPromise` settles with the first attempt, later retries just fill `islands`. */
  function loadList() {
    if (listInflight || state.islands) return;
    listInflight = true;
    api
      .islands(f)
      .then((raw) => {
        const list = cleanIslands(raw);
        if (!list) throw new Error('bad payload');
        delete fails.list;
        const found = list.find((i) => i.id === state.island.id);
        // Refresh the saved copy from the list (never saves during first run).
        if (found && !state.firstRun) void deps.storage.saveIsland(found);
        set((s) => ({ islands: list, island: list.find((i) => i.id === s.island.id) || s.island }));
        listResolve(list);
      })
      .catch(() => {
        failed('list');
        listResolve(null);
      })
      .finally(() => {
        listInflight = false;
      });
  }

  /** Clock retries of failed first loads for the current island (and the list), once their backoff is up. */
  function retryDue() {
    const c = state.island;
    const k = wxKey(c);
    if (state.wx[k] === 'err' && due('wx:' + k)) ensureWx(c);
    if (state.tides[c.id] === 'err' && due('tide:' + c.id)) ensureTide(c);
    if (!state.islands && due('list')) loadList();
  }

  /** Retry everything that failed for the current island right away (tap to retry, back to foreground). */
  function retryNow() {
    const c = state.island;
    const k = wxKey(c);
    if (state.wx[k] === 'err') ensureWx(c);
    if (state.tides[c.id] === 'err' && fails['tide:' + c.id]) ensureTide(c);
    if (state.acts[c.id] === 'err') ensureActs(c);
    if (state.isle[c.id] === 'err') ensureIsle(c);
    if (!state.islands) loadList();
  }

  /**
   * Manual refresh (tap on the HUD time line): refetch weather and scores now unless fetched in the last 30 s,
   * and retry anything that failed. `refreshing` is set while the refetch runs (the HUD shows "· Updating").
   */
  function refresh() {
    if (state.refreshing) return;
    const c = state.island;
    const t = now();
    const W = state.wx[wxKey(c)];
    const AC = state.acts[c.id];
    const ps = [
      isData(W) && t - W.fetched < REFRESH_MIN_MS ? undefined : ensureWx(c, true),
      isData(AC) && t - AC.fetched < REFRESH_MIN_MS ? undefined : ensureActs(c, true),
    ].filter((p): p is Promise<void> => !!p);
    retryNow();
    if (!ps.length) return;
    set({ refreshing: true });
    void Promise.allSettled(ps).then(() => set({ refreshing: false }));
  }

  function ensureAll(I: ApiIsland) {
    ensureWx(I);
    ensureTide(I);
    ensureIsle(I);
    ensureActs(I);
  }

  /** 60 s clock body (also call on app foreground). */
  function tick() {
    const t = now();
    if (hOfUnix(t / 1000, state.day0) >= 24) {
      gen++;
      inflight = { wx: {}, tide: {}, isle: {}, acts: {} };
      fails = {};
      set({ day0: day0Of(t), wx: {}, tides: {}, acts: {}, lastW: null, lastTide: null, clock: t });
      const c = state.island;
      ensureWx(c);
      ensureTide(c);
      ensureActs(c);
      return;
    }
    const c = state.island;
    const W = state.wx[wxKey(c)];
    if (isData(W) && t - W.fetched > STALE_MS) ensureWx(c, true);
    const AC = state.acts[c.id];
    if (isData(AC) && t - AC.fetched > STALE_MS) ensureActs(c, true);
    else if (AC === 'err') ensureActs(c);
    retryDue();
    set({ clock: t });
  }

  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** Resolves with the island list once `/islands` has loaded (null on failure). */
    listPromise,

    /** Launch with the saved island (rendered immediately), or Malé unsaved. The saved island counts as recent. */
    init(saved: ApiIsland | null, recents: ApiIsland[] = []) {
      set({ island: saved || DEFAULT_ISLAND, firstRun: !saved, recents: saved && !recents.some((r) => r.id === saved.id) ? addRecent(recents, saved) : recents });
    },

    /** `loadLive()` — fetch everything for the current island, the island list, and start the clock. */
    start() {
      ensureAll(state.island);
      loadList();
      if (clockId == null) clockId = setIv(tick, CLOCK_MS);
    },
    stop() {
      if (clockId != null) clearIv(clockId);
      clockId = null;
    },
    tick,
    retryNow,
    refresh,

    /** Any pick (manual or location): save, select, load everything for it. */
    pickIsland(I: ApiIsland) {
      const recents = addRecent(state.recents, I);
      void deps.storage.saveIsland(I);
      void deps.storage.saveRecents(recents);
      set({ island: I, firstRun: false, recents });
      ensureAll(I);
    },

    ensureWx,
    ensureTide,
    ensureIsle,
    ensureActs,
  };
}

export type DataStore = ReturnType<typeof createDataStore>;
