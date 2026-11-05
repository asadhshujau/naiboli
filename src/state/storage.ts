import { isIsland, RECENTS_MAX } from '@/data/islands';
import type { ApiIsland } from '@/data/types';

/** Last selected island (full island object). */
export const LS_ISLE = 'naiboli.island.v1';
/** Recently loaded islands, most recent first (full island objects, current included). */
export const LS_RECENTS = 'naiboli.recents.v1';
/** `1` once the first-run "Where are you?" sheet has been shown. */
export const LS_ASKED = 'naiboli.locAsked.v1';

/** Subset of AsyncStorage used here (injectable for tests). */
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function makeStorage(kv: KV) {
  const get = async (k: string): Promise<unknown> => {
    try {
      const raw = await kv.getItem(k);
      return raw == null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const set = async (k: string, v: unknown): Promise<void> => {
    try {
      await kv.setItem(k, JSON.stringify(v));
    } catch {
      // storage full / unavailable: the app keeps working unsaved
    }
  };
  return {
    async loadIsland(): Promise<ApiIsland | null> {
      const I = await get(LS_ISLE);
      return isIsland(I) ? I : null;
    },
    saveIsland: (I: ApiIsland) => set(LS_ISLE, I),
    async loadRecents(): Promise<ApiIsland[]> {
      const L = await get(LS_RECENTS);
      return Array.isArray(L) ? L.filter(isIsland).slice(0, RECENTS_MAX) : [];
    },
    saveRecents: (L: ApiIsland[]) => set(LS_RECENTS, L),
    async locAsked(): Promise<boolean> {
      return !!(await get(LS_ASKED));
    },
    setLocAsked: () => set(LS_ASKED, 1),
  };
}

export type Storage = ReturnType<typeof makeStorage>;
