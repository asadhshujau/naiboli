import type {
  ApiActivityScoresResponse,
  ApiIsland,
  ApiTideResponse,
  ApiWeatherResponse,
} from '../../types';

import actsJson from './acts-1069.json';
import islandsQuarterJson from './islands-quarter.json';
import islandsJson from './islands-small.json';
import tideHeadJson from './tide-1069-head.json';
import weatherJson from './weather-1069.json';

/** Real payloads captured 2026-11-04 ~14:00 MVT for Malé (1069). */
export const weather1069 = weatherJson as unknown as ApiWeatherResponse;
export const acts1069 = actsJson as unknown as ApiActivityScoresResponse;
export const tideHead1069 = tideHeadJson as unknown as ApiTideResponse;
export const islandsSmall = islandsJson as unknown as ApiIsland[];
/** Every 4th island of the real list (286) plus the popular ones. */
export const islandsQuarter = islandsQuarterJson as unknown as ApiIsland[];

/** 2026-11-04 14:20 MVT */
export const NOW_MS = Date.parse('2026-11-04T14:20:00+05:00');
/** local midnight 2026-11-04 */
export const DAY0 = Date.parse('2026-11-04T00:00:00+05:00') / 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Full 48 h per-minute tide in the API's format (wall-clock time tagged Z), two cycles a day plus a slow wobble. */
export function synthTide(opts: { startDate?: string; minutes?: number; flat?: boolean; distanceKm?: string; sameIsland?: boolean } = {}): ApiTideResponse {
  const start = Date.parse((opts.startDate ?? '2026-11-04') + 'T00:00:00.000Z');
  const n = opts.minutes ?? 2880;
  const data = Array.from({ length: n }, (_, i) => {
    const h = i / 60;
    const d = new Date(start + i * 60000);
    const tide_m = opts.flat
      ? 0.1 + 0.001 * Math.sin(h)
      : 0.1 + 0.42 * Math.cos((2 * Math.PI * (h - 3.3)) / 12.42) + 0.06 * Math.sin((2 * Math.PI * h) / 23.9);
    return {
      time_utc_plus5: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00.000Z`,
      tide_m,
    };
  });
  return {
    data,
    source_island_name: opts.sameIsland === false ? 'Hulhumalé' : 'Malé',
    source_island_id: opts.sameIsland === false ? 1068 : 1069,
    island_id: 1069,
    distance_km: opts.distanceKm ?? '0.00',
  };
}

/** The real weather payload with thunder + strong gusts injected from +3 h to +5 h. */
export function stormyWeather(): ApiWeatherResponse {
  const j = JSON.parse(JSON.stringify(weather1069)) as ApiWeatherResponse;
  const hourly = j.data!.hourly!;
  for (let i = 3; i <= 5; i++) {
    hourly[i].weather = [{ id: i === 4 ? 211 : 501 }];
    hourly[i].wind_gust = 16 + i; // m/s → ~65 km/h
    hourly[i].rain = { '1h': 2.4 };
  }
  hourly[7].wind_gust = 14.2; // gusty hour 2 h after the cell (outside the 1.5 h grouping gap)
  hourly[9].weather = [{ id: 200 }]; // a later, separate storm cell
  return j;
}
