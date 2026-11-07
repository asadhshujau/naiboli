/**
 * API contracts for https://naiboli.shujau.dev/api plus the parsed shapes the app works with.
 * Raw types only list the fields the app reads; the API returns more.
 */

// ───────────────────────── Raw API ─────────────────────────

export interface ApiIsland {
  id: number;
  english_name: string;
  dhivehi_name?: string | null;
  atoll_code_english: string;
  atoll_name_english?: string | null;
  category?: string | null;
  weather_anchor_id?: number | null;
  latitude_decimal?: string | number | null;
  longitude_decimal?: string | number | null;
}

export interface ApiIslandDetail {
  description?: string | null;
  beaches?: { name?: string | null; type?: string | null }[] | null;
  reefs?: { name?: string | null; type?: string | null; distance?: string | null }[] | null;
  accessibilities?: { method?: string | null }[] | null;
  dhivehi_name?: string | null;
  latitude_decimal?: string | number | null;
  longitude_decimal?: string | number | null;
}

export interface ApiWeatherCondition {
  id?: number;
  main?: string;
  description?: string;
}

/** OpenWeather One Call "current" / "hourly" entry. Units: °C, m/s, metres, pop 0–1. */
export interface ApiWxPoint {
  dt: number;
  temp: number;
  feels_like?: number;
  humidity?: number;
  clouds?: number;
  visibility?: number;
  wind_speed?: number;
  wind_gust?: number;
  wind_deg?: number;
  uvi?: number;
  pop?: number;
  weather?: ApiWeatherCondition[];
  rain?: { '1h'?: number };
}

export interface ApiWxDaily {
  dt: number;
  sunrise: number;
  sunset: number;
  moonrise?: number;
  moonset?: number;
  moon_phase?: number;
  temp?: { min: number; max: number };
  uvi?: number;
  pop?: number;
  wind_speed?: number;
  clouds?: number;
  weather?: ApiWeatherCondition[];
  /** rain mm for the day (only when it rains) */
  rain?: number;
}

/** OpenWeather minute forecast entry: precipitation in mm/h. Optional and often missing. */
export interface ApiWxMinute {
  dt: number;
  precipitation: number;
}

/** Official weather alert passed through by OpenWeather (in the Maldives: the Maldives Meteorological Service). */
export interface ApiWxAlert {
  sender_name?: string;
  event?: string;
  start?: number;
  end?: number;
  description?: string;
  tags?: string[];
}

export interface ApiWeatherResponse {
  data?: { current?: ApiWxPoint; minutely?: ApiWxMinute[]; hourly?: ApiWxPoint[]; daily?: ApiWxDaily[]; alerts?: ApiWxAlert[] } | null;
  observed_at?: string | null;
  updated_at?: string | null;
}

export interface ApiTideRow {
  /** Maldives wall-clock time, serialised with a `Z` suffix, e.g. "2026-11-04T00:00:00.000Z". */
  time_utc_plus5: string;
  tide_m: number;
}

export interface ApiTideResponse {
  data?: ApiTideRow[] | null;
  source_island_name?: string | null;
  source_island_id?: number | null;
  island_id?: number | null;
  distance_km?: string | number | null;
}

export type Factor = 'wind' | 'rain' | 'temp' | 'uv' | 'visibility' | 'tide' | 'daylight';

export interface ApiScoreEntry {
  overall_score?: number | string | null;
  conditions_score?: number | string | null;
  recommendation?: string | null;
  breakdown?: Partial<Record<string, number>> | null;
  limiting_factors?: string[] | null;
  tide_available?: boolean | null;
}

export interface ApiActivityScore extends ApiScoreEntry {
  activity: string;
  label?: string | null;
  hours?: (ApiScoreEntry & { dt: number })[] | null;
  days?: (ApiScoreEntry & { date: string })[] | null;
}

export interface ApiActivityScoresResponse {
  scores?: ApiActivityScore[] | null;
}

export interface ApiWhereAmIResponse {
  resolved?: boolean;
  island?: ApiIsland | null;
  message?: string;
}

// ───────────────────────── Parsed ─────────────────────────

/** Sunrise/sunset as hours since local midnight (0–24). */
export interface Sun {
  rise: number;
  set: number;
}

/** One weather sample on the local hour axis (`h` = hours since local midnight today). */
export interface WxSample {
  h: number;
  temp: number;
  feels: number;
  hum: number;
  clouds: number;
  /** km */
  vis: number;
  /** km/h */
  wind: number;
  /** km/h */
  gust: number;
  deg: number;
  uvi: number;
  /** 0–100 */
  pop: number;
  /** OpenWeather condition id */
  id: number;
  /** rain mm in the last hour */
  mm: number;
}

export interface WxDay {
  h: number;
  rise: number;
  set: number;
  lo: number | undefined;
  hi: number | undefined;
  uvi: number | undefined;
  id: number;
  pop: number;
  wind: number;
  clouds: number;
  mr: number | null;
  ms: number | null;
  mp: number | null;
  /** rain mm for the day, when the feed has it */
  mm: number | null;
}

export interface MoonData {
  /** [rise, set] intervals on the hour axis */
  iv: [number, number][];
  ev: { h: number; rise: boolean }[];
  days: { h: number; mp: number }[];
}

export interface Weather {
  hrs: WxSample[];
  days: WxDay[];
  moon: MoonData;
  /** observation time on the hour axis */
  at: number | null;
  /**
   * Minute forecast (mm/h) for the hour after the snapshot, on the hour axis. Often missing (`null`);
   * read it through `nowcastOf`, which ignores it when too little of it is still ahead.
   */
  min?: { h: number; mm: number }[] | null;
  /** official alerts (start / end on the hour axis); often none */
  alerts?: WxAlert[] | null;
  /** Date.now() at parse time */
  fetched: number;
}

export interface WxAlert {
  start: number;
  end: number;
  event: string;
  desc: string;
  sender: string;
  tags: string[];
}

export interface TideExtreme {
  h: number;
  high: boolean;
  lvl: number;
}

export interface Tide {
  /** 10-minute samples from local midnight, 48 h (289 values) */
  v: number[];
  lo: number;
  hi: number;
  ex: TideExtreme[];
  src: string;
  km: number;
  same: boolean;
}

export interface ActEntry {
  s: number;
  c: number | null;
  rec: string;
  br: Partial<Record<string, number>>;
  lim: string[];
  tideOk: boolean;
}

export interface ActItem {
  id: string;
  label: string;
  now: ActEntry;
  hours: (ActEntry & { h: number })[];
  days: (ActEntry & { di: number })[];
}

export interface Acts {
  list: ActItem[];
  byId: Record<string, ActItem>;
  /** hour-axis time of fetch */
  at: number;
  fetched: number;
}

export interface IslandDetail {
  description: string;
  beaches: { name: string | null | undefined; type: string | null | undefined }[];
  reefs: { name: string | null | undefined; type: string | null | undefined; distance: string | null | undefined }[];
  access: string[];
  dv: string;
  lat: number;
  lon: number;
}

/** Cache entry: in flight, failed (no good data), or data. */
export type Entry<T> = 'loading' | 'err' | T;

export const isData = <T extends object>(e: Entry<T> | undefined): e is T =>
  e != null && typeof e === 'object';
