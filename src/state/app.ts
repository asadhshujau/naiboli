import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { makeStorage } from './storage';
import { createDataStore, type DataState } from './store';

export const storage = makeStorage(AsyncStorage);
export const dataStore = createDataStore({ storage });

/** UI preferences read before the first render (set in the root layout), so nothing flashes on launch. */
export const launchPrefs = { immersive: false };

/** Whole data state; re-renders on any store change. */
export function useDataState(): DataState {
  return useSyncExternalStore(dataStore.subscribe, dataStore.getState);
}
