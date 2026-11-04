/**
 * Data store: selected island, island list and per-island caches with the prototype's
 * fetch / refresh rules (`ensureWx`, `ensureTide`, `ensureIsle`, `ensureActs`, `loadLive` clock).
 *
 * - Weather is cached by weather anchor; tide, details and scores by island id.
 * - Weather and scores refetch when older than 10 min; failed scores retry every minute.
 * - A failed refresh keeps the last good data.
 * - At local midnight the hour axis advances and weather, tide and scores reset and refetch.
 */
import { procActs } from '@/data/activities';
import { api, type Fetcher } from '@/data/api';
import { cleanIslands, DEFAULT_ISLAND, procIsle, wxKey } from '@/data/islands';
import { DEFAULT_SUN, sunOf } from '@/data/sun';
import { procTide } from '@/data/tide';
import { day0Of, hOfUnix } from '@/data/time';
import { isData, type Acts, type ApiIsland, type Entry, type IslandDetail, type Sun, type Tide, type Weather } from '@/data/types';
import { procWx } from '@/data/weather';
import type { Storage } from './storage';

export const STALE_MS = 10 * 60 * 1000;
export const CLOCK_MS = 60 * 1000;

export interface DataState {
  /** unix s of local midnight today — the hour axis origin */
  day0: number;
  island: ApiIsland;
  /** no island saved yet */
  firstRun: boolean;
  islands: ApiIsland[] | null;
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
    wx: {},
    tides: {},
    isle: {},
    acts: {},
    lastW: null,
    lastTide: null,
    sun: DEFAULT_SUN,
    clock: now(),
  };
  const listeners = new Set<() => void>();
  /** bumped on midnight reset so late responses from the previous day are dropped */
  let gen = 0;
  let inflight = { wx: {} as Record<string, boolean>, tide: {} as Record<number, boolean>, isle: {} as Record<number, boolean>, acts: {} as Record<number, boolean> };
  let clockId: unknown = null;
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

  function ensureWx(I: ApiIsland, force = false) {
    const k = wxKey(I);
    const cur = state.wx[k];
    if (inflight.wx[k] || (!force && cur && cur !== 'err')) return;
    inflight.wx[k] = true;
    const g = gen;
    const fl = inflight;
    if (!cur || cur === 'err') set((s) => ({ wx: { ...s.wx, [k]: 'loading' } }));
    api
      .weather(I.id, f)
      .then((j) => {
        const W = procWx(j, state.day0, now());
        if (!W) throw new Error('bad payload');
        if (g === gen) set((s) => ({ wx: { ...s.wx, [k]: W } }));
      })
      .catch(() => {
        if (g === gen) set((s) => ({ wx: { ...s.wx, [k]: isData(s.wx[k]) ? s.wx[k] : 'err' } }));
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
        if (g === gen) set((s) => ({ tides: { ...s.tides, [k]: T || 'err' } }));
      })
      .catch(() => {
        if (g === gen) set((s) => ({ tides: { ...s.tides, [k]: 'err' } }));
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

  function ensureActs(I: ApiIsland, force = false) {
    const k = I.id;
    const cur = state.acts[k];
    if (inflight.acts[k] || (!force && cur && cur !== 'err')) return;
    inflight.acts[k] = true;
    const g = gen;
    const fl = inflight;
    if (!cur || cur === 'err') set((s) => ({ acts: { ...s.acts, [k]: 'loading' } }));
    api
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

    /** Launch with the saved island (rendered immediately), or Malé unsaved. */
    init(saved: ApiIsland | null) {
      set({ island: saved || DEFAULT_ISLAND, firstRun: !saved });
    },

    /** `loadLive()` — fetch everything for the current island, the island list, and start the clock. */
    start() {
      ensureAll(state.island);
      api
        .islands(f)
        .then((raw) => {
          const list = cleanIslands(raw);
          if (!list) return listResolve(null);
          const found = list.find((i) => i.id === state.island.id);
          // Refresh the saved copy from the list (never saves during first run).
          if (found && !state.firstRun) void deps.storage.saveIsland(found);
          set((s) => ({ islands: list, island: list.find((i) => i.id === s.island.id) || s.island }));
          listResolve(list);
        })
        .catch(() => listResolve(null));
      if (clockId == null) clockId = setIv(tick, CLOCK_MS);
    },
    stop() {
      if (clockId != null) clearIv(clockId);
      clockId = null;
    },
    tick,

    /** Any pick (manual or location): save, select, load everything for it. */
    pickIsland(I: ApiIsland) {
      void deps.storage.saveIsland(I);
      set({ island: I, firstRun: false });
      ensureAll(I);
    },

    ensureWx,
    ensureTide,
    ensureIsle,
    ensureActs,
  };
}

export type DataStore = ReturnType<typeof createDataStore>;
