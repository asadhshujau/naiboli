/**
 * Wires the location flow (`./locate`) to expo-location, the API, storage and the screen's UI state.
 * Location request: balanced accuracy (coarse is enough), cached fix up to 5 min, 15 s timeout.
 *
 * The locator is an app-wide singleton (like `dataStore`); the scene screen binds its UI handlers.
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { api } from '@/data/api';
import type { GeoStatus } from '@/data/location';
import type { ApiIsland } from '@/data/types';

import { dataStore, storage } from './app';
import { createLocator, type PermResult } from './locate';
import type { Perm } from './sheets';

export const LOCATE_TIMEOUT_MS = 15000;
export const MAX_FIX_AGE_MS = 5 * 60 * 1000;

const permOf = (r: Location.LocationPermissionResponse): PermResult => ({ granted: r.granted, canAskAgain: r.canAskAgain });

async function getPosition() {
  const cached = await Location.getLastKnownPositionAsync({ maxAge: MAX_FIX_AGE_MS }).catch(() => null);
  if (cached) return cached.coords;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('location timeout')), LOCATE_TIMEOUT_MS);
  });
  try {
    const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]);
    return fix.coords;
  } finally {
    clearTimeout(timer);
  }
}

interface Handlers {
  setGeo: (g: GeoStatus) => void;
  setPerm: (p: Perm) => void;
  openWelcome: () => void;
  pick: (I: ApiIsland) => void;
}

/** Latest UI facts and handlers from the bound screen. */
const ui = { geo: 'idle' as GeoStatus, sheetOpen: false };
let handlers: Handlers = { setGeo: () => {}, setPerm: () => {}, openWelcome: () => {}, pick: () => {} };

export const locator = createLocator({
  getPermission: async () => permOf(await Location.getForegroundPermissionsAsync()),
  requestPermission: async () => permOf(await Location.requestForegroundPermissionsAsync()),
  getPosition,
  whereAmI: (lat, lon) => api.whereAmI(lat, lon),
  islands: () => {
    const l = dataStore.getState().islands;
    return l ? Promise.resolve(l) : dataStore.listPromise;
  },
  locAsked: () => storage.locAsked(),
  setLocAsked: () => void storage.setLocAsked(),
  openSettings: () => void Linking.openSettings(),
  getGeo: () => ui.geo,
  isFirstRun: () => dataStore.getState().firstRun,
  isSheetOpen: () => ui.sheetOpen,
  setGeo: (g) => {
    ui.geo = g;
    handlers.setGeo(g);
  },
  setPerm: (p) => handlers.setPerm(p),
  openWelcome: () => handlers.openWelcome(),
  pick: (I) => handlers.pick(I),
});

interface Options {
  geo: GeoStatus;
  sheetOpen: boolean;
  setGeo: (g: GeoStatus) => void;
  openWelcome: () => void;
  pick: (I: ApiIsland) => void;
}

/** Binds the screen to the locator, starts it, and returns the location permission. */
export function useLocator({ geo, sheetOpen, setGeo, openWelcome, pick }: Options): Perm {
  const [perm, setPerm] = useState<Perm>('unknown');
  useEffect(() => {
    ui.geo = geo;
    ui.sheetOpen = sheetOpen;
  }, [geo, sheetOpen]);
  useEffect(() => {
    handlers = { setGeo, setPerm, openWelcome, pick };
  }, [setGeo, openWelcome, pick]);
  useEffect(() => {
    void locator.start();
    // Back from Settings (or anywhere): pick up permission changes.
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void locator.refreshPermission();
    });
    return () => {
      sub.remove();
      locator.stop();
    };
  }, []);
  return perm;
}
