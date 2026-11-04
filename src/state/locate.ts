/**
 * First-run and "use my location" flow — the prototype's `permState()`, `maybeWelcome()` and `locate()`,
 * with the README "Location & last-island behaviour" rules:
 *
 * - First run, permission already granted → locate silently; success picks + saves, failure shows Welcome
 *   with the reason.
 * - First run, not granted → show Welcome once (sets `locAsked`); never again on later launches.
 * - Tapping "Use my location" (Welcome) or "Use my current location" (picker): granted → locate; else ask
 *   (the only places the app asks); if the OS can't ask again → "Location is off", and a further tap opens
 *   system settings.
 *
 * Platform APIs are injected so the rules are unit-testable.
 */
import type { ApiIsland } from '@/data/types';

import { interpretWhereAmI, resolveIsland, type GeoStatus } from '@/data/location';

import type { Perm } from './sheets';

export interface PermResult {
  granted: boolean;
  /** false once the OS will no longer show the prompt */
  canAskAgain: boolean;
}

export interface LocatorDeps {
  getPermission(): Promise<PermResult>;
  requestPermission(): Promise<PermResult>;
  /** current position (implementation applies the 15 s timeout / 5 min cache); rejects on failure */
  getPosition(): Promise<{ latitude: number; longitude: number }>;
  whereAmI(lat: number, lon: number): Promise<{ status: number; json: unknown }>;
  /** island list (resolves null if it failed to load) */
  islands(): Promise<ApiIsland[] | null>;
  locAsked(): Promise<boolean>;
  setLocAsked(): void;
  openSettings(): void;
  /** current UI facts */
  getGeo(): GeoStatus;
  isFirstRun(): boolean;
  isSheetOpen(): boolean;
  /** effects */
  setGeo(g: GeoStatus): void;
  setPerm(p: Perm): void;
  openWelcome(): void;
  pick(I: ApiIsland): void;
}

const permOf = (r: PermResult): Perm => (r.granted ? 'granted' : r.canAskAgain ? 'unknown' : 'denied');

export function createLocator(deps: LocatorDeps) {
  let perm: Perm | null = null;
  let blocked = false;
  /** a lookup is in flight (guards double taps before the UI re-renders) */
  let busy = false;
  let splashDone = false;
  let welDone = false;
  let autoFail = false;
  let dead = false;

  const setGeo = (g: GeoStatus) => deps.setGeo(g);
  const setPerm = (r: PermResult) => {
    perm = permOf(r);
    blocked = !r.granted && !r.canAskAgain;
    deps.setPerm(perm);
  };

  /** `maybeWelcome()` — runs after the splash, after the permission check and after a failed auto-locate. */
  async function maybeWelcome() {
    if (welDone || perm == null || !splashDone || !deps.isFirstRun()) return;
    if (perm === 'granted' && !autoFail) return;
    welDone = true;
    if ((!autoFail && (await deps.locAsked())) || deps.isSheetOpen() || dead) return;
    deps.setLocAsked();
    deps.openWelcome();
  }

  async function locate(auto: boolean) {
    if (busy || deps.getGeo() === 'locating') return;
    busy = true;
    try {
      await run(auto);
    } finally {
      busy = false;
    }
  }

  async function run(auto: boolean) {
    const fail = (st: GeoStatus) => {
      if (dead) return;
      setGeo(st);
      if (auto) {
        autoFail = true;
        void maybeWelcome();
      }
    };

    if (!auto) {
      let p: PermResult;
      try {
        p = await deps.getPermission();
        if (!p.granted && p.canAskAgain) p = await deps.requestPermission();
      } catch {
        return fail('fail');
      }
      if (dead) return;
      const wasOff = deps.getGeo() === 'denied';
      setPerm(p);
      if (!p.granted) {
        // Blocked: the row already says "Location is off" → this tap goes to Settings.
        if (!p.canAskAgain && wasOff) deps.openSettings();
        return fail('denied');
      }
    }

    setGeo('locating');
    let pos: { latitude: number; longitude: number };
    try {
      pos = await deps.getPosition();
    } catch {
      // The permission may have been revoked meanwhile.
      const p = await deps.getPermission().catch(() => null);
      if (p && !p.granted) {
        setPerm(p);
        return fail('denied');
      }
      return fail('fail');
    }
    try {
      const r = await deps.whereAmI(pos.latitude, pos.longitude);
      const res = interpretWhereAmI(r.status, r.json);
      if (res.kind !== 'ok') return fail(res.kind);
      const list = await deps.islands();
      if (dead) return;
      setGeo('idle');
      deps.pick(resolveIsland(res.island, list));
    } catch {
      fail('fail');
    }
  }

  return {
    /** On launch: read the permission; first run + granted → locate silently. */
    async start() {
      dead = false; // React StrictMode re-runs effects: stop() then start() again
      try {
        setPerm(await deps.getPermission());
      } catch {
        perm = 'unknown';
        deps.setPerm(perm);
      }
      if (dead) return;
      if (deps.isFirstRun() && perm === 'granted') void locate(true);
      else void maybeWelcome();
    },
    /** Splash has gone. */
    splashDone() {
      splashDone = true;
      void maybeWelcome();
    },
    /** Tap on "Use my location" / "Use my current location". */
    locate: () => locate(false),
    /** App back in the foreground: the user may have changed the permission in Settings. */
    async refreshPermission() {
      try {
        const p = await deps.getPermission();
        if (!dead) setPerm(p);
      } catch {
        // keep the last known state
      }
    },
    isBlocked: () => blocked,
    stop() {
      dead = true;
    },
  };
}

export type Locator = ReturnType<typeof createLocator>;
