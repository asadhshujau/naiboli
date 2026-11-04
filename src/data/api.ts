import type {
  ApiActivityScoresResponse,
  ApiIsland,
  ApiIslandDetail,
  ApiTideResponse,
  ApiWeatherResponse,
} from './types';

export const API = 'https://moodhu.dev/api';
export const TIMEOUT_MS = 20000;

export type Fetcher = typeof fetch;

/** GET JSON with a 20 s timeout; throws on network error, timeout or non-2xx. */
export async function getJSON<T>(path: string, f: Fetcher = fetch): Promise<T> {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await f(API + path, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

export const api = {
  islands: (f?: Fetcher) => getJSON<ApiIsland[]>('/islands', f),
  island: (id: number, f?: Fetcher) => getJSON<ApiIslandDetail>(`/islands/${id}`, f),
  weather: (id: number, f?: Fetcher) => getJSON<ApiWeatherResponse>(`/weather-for-island/${id}`, f),
  tide: (id: number, f?: Fetcher) => getJSON<ApiTideResponse>(`/tide-for-island/${id}`, f),
  activityScores: (id: number, f?: Fetcher) => getJSON<ApiActivityScoresResponse>(`/islands/${id}/activity-scores`, f),

  /** Returns status + parsed body (null if not JSON) for `interpretWhereAmI`. Throws on network error. */
  async whereAmI(latitude: number, longitude: number, f: Fetcher = fetch): Promise<{ status: number; json: unknown }> {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await f(API + '/where-am-i', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
        signal: ctl.signal,
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, json };
    } finally {
      clearTimeout(to);
    }
  },
};
