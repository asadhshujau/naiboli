import type { ApiIsland } from './types';

/** Geo row / welcome states. */
export type GeoStatus = 'idle' | 'locating' | 'denied' | 'far' | 'fail';

export type WhereAmIResult = { kind: 'ok'; island: ApiIsland } | { kind: 'far' } | { kind: 'fail' };

/**
 * `POST /where-am-i` response handling: 422 or `resolved:false` → far; other non-2xx, no body,
 * or no island id → fail.
 */
export function interpretWhereAmI(status: number, json: unknown): WhereAmIResult {
  const j = json && typeof json === 'object' ? (json as { resolved?: unknown; island?: unknown }) : null;
  if (status === 422 || (j && j.resolved === false)) return { kind: 'far' };
  const ok = status >= 200 && status < 300;
  if (!ok || !j || !j.island || (j.island as ApiIsland).id == null) return { kind: 'fail' };
  return { kind: 'ok', island: j.island as ApiIsland };
}

/** Prefer the full list entry for the resolved island (it carries `weather_anchor_id` etc.). */
export function resolveIsland(island: ApiIsland, list: ApiIsland[] | null): ApiIsland {
  const found = (list || []).find((x) => x.id === island.id);
  return found || island;
}
