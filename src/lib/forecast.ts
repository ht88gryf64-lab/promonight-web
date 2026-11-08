// The game-time forecast (docs/per-promo-pages-v2-spec.md, Visuals 7, step
// 5b, rulings 2026-11-08): api.weather.gov, free, no key. The points call
// names the grid's forecast URL, the forecast call gives fourteen half-day
// periods; both are fetched with Next's one-hour cache. The row shows on a
// promo page whose game is within seven days at a US venue with coordinates;
// the points call answering 404 is a venue outside the US (every Canadian
// building) and renders nothing, quietly.
//
// FAILURE. Any error, a timeout past 800ms over both calls, a stale response
// or a period without all three fields (condition, temperature, chance of
// precipitation) renders nothing; a failure is logged once per page per ISR
// window; the page never throws.
//
// Server only: the fetches and the log live here; the view gets a
// GameForecast and the roof flag, nothing else (never sources.roof).
import 'server-only';
import { forecastIconKey, type GameForecast } from './forecast-label';
import { parseDisplayTime } from './promo-page-time';

export const FORECAST_TIMEOUT_MS = 800;
export const FORECAST_CACHE_SECONDS = 3600;
/** A response whose updateTime is older than this is stale: nothing renders. */
export const FORECAST_FRESH_MS = 24 * 3600_000;
export const FORECAST_LOG_WINDOW_MS = 86_400_000;
const POINTS = 'https://api.weather.gov/points';
const HEADERS = { 'user-agent': '(getpromonight.com, hello@getpromonight.com)', accept: 'application/geo+json' };

export interface NwsPeriod {
  number?: unknown;
  name?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  isDaytime?: unknown;
  temperature?: unknown;
  temperatureUnit?: unknown;
  probabilityOfPrecipitation?: { value?: unknown } | null;
  shortForecast?: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The periods whose local date (the ISO's own offset) is the game's. */
export function periodsOn(periods: readonly NwsPeriod[], gameDate: string): NwsPeriod[] {
  return periods.filter((p) => str(p.startTime).slice(0, 10) === gameDate);
}

/** The forecast for the game's date out of the periods, or null when the
 *  date has no period or a chosen period lacks a field. With a game time the
 *  period containing it names the condition; else the night's, else the
 *  day's. The high and low are the day and night temperatures when the date
 *  has both; a single period gives its own temperature. The chance of
 *  precipitation is the highest over the date's periods, and every period
 *  must carry one. */
export function forecastFromPeriods(periods: readonly NwsPeriod[], gameDate: string, displayTime: string | null | undefined, updatedAt: string): GameForecast | null {
  const day = periodsOn(periods, gameDate);
  if (!day.length) return null;
  const t = parseDisplayTime(displayTime);
  const containing = t
    ? day.find((p) => {
        const s = str(p.startTime);
        const e = str(p.endTime);
        const sh = Number(s.slice(11, 13));
        const eh = e.slice(0, 10) === gameDate ? Number(e.slice(11, 13)) : 24;
        return Number.isFinite(sh) && Number.isFinite(eh) && t.h >= sh && t.h < eh;
      })
    : undefined;
  const night = day.find((p) => p.isDaytime === false);
  const light = day.find((p) => p.isDaytime === true);
  const named = containing ?? night ?? light ?? day[0];
  const condition = str(named.shortForecast);
  if (!condition) return null;
  const pops = day.map((p) => num(p.probabilityOfPrecipitation?.value));
  if (pops.some((v) => v === null)) return null;
  const precipChance = Math.max(...(pops as number[]));
  const unit = str(day[0].temperatureUnit) === 'C' ? 'C' : 'F';
  if (light && night) {
    const high = num(light.temperature);
    const low = num(night.temperature);
    if (high === null || low === null) return null;
    return { condition, icon: forecastIconKey(condition, named.isDaytime !== false), high, low, temperature: null, unit, precipChance, updatedAt };
  }
  const temperature = num(named.temperature);
  if (temperature === null) return null;
  return { condition, icon: forecastIconKey(condition, named.isDaytime !== false), high: null, low: null, temperature, unit, precipChance, updatedAt };
}

export function isFresh(updateTime: string, now: Date): boolean {
  const t = Date.parse(updateTime);
  return Number.isFinite(t) && now.getTime() - t <= FORECAST_FRESH_MS && t - now.getTime() < 3600_000;
}

const failureLoggedAt = new Map<string, number>();
export function _resetForecastForTests(): void {
  failureLoggedAt.clear();
}
function logFailureOnce(pageKey: string, reason: string, now = Date.now()): void {
  const at = failureLoggedAt.get(pageKey);
  if (at !== undefined && now - at < FORECAST_LOG_WINDOW_MS) return;
  failureLoggedAt.set(pageKey, now);
  console.warn(`[forecast] ${pageKey}: no row (${reason})`);
}

class ForecastFailure extends Error {}

export interface GameForecastInput {
  lat: number;
  lng: number;
  /** The game's date, YYYY-MM-DD, already inside the window. */
  gameDate: string;
  displayTime?: string | null;
  /** Names the page in the failure log. */
  pageKey: string;
  now?: Date;
}

/** The forecast for the game, or null for any reason at all. Never throws. */
export async function fetchGameForecast(input: GameForecastInput): Promise<GameForecast | null> {
  const { lat, lng, gameDate, displayTime, pageKey } = input;
  const now = input.now ?? new Date();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORECAST_TIMEOUT_MS);
  try {
    const points = await fetch(`${POINTS}/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: HEADERS, next: { revalidate: FORECAST_CACHE_SECONDS }, signal: controller.signal } as RequestInit);
    // Outside the NWS grid (a Canadian building): not a failure, nothing to show.
    if (points.status === 404) return null;
    if (!points.ok) throw new ForecastFailure(`points HTTP ${points.status}`);
    const pointsBody = (await points.json()) as { properties?: { forecast?: unknown } };
    const forecastUrl = str(pointsBody.properties?.forecast);
    if (!/^https:\/\/api\.weather\.gov\//.test(forecastUrl)) return null;
    const res = await fetch(forecastUrl, { headers: HEADERS, next: { revalidate: FORECAST_CACHE_SECONDS }, signal: controller.signal } as RequestInit);
    if (!res.ok) throw new ForecastFailure(`forecast HTTP ${res.status}`);
    const body = (await res.json()) as { properties?: { updateTime?: unknown; generatedAt?: unknown; periods?: unknown } };
    const updatedAt = str(body.properties?.updateTime) || str(body.properties?.generatedAt);
    if (!updatedAt || !isFresh(updatedAt, now)) throw new ForecastFailure(updatedAt ? `stale (updated ${updatedAt})` : 'no update time');
    const periods = Array.isArray(body.properties?.periods) ? (body.properties!.periods as NwsPeriod[]) : [];
    return forecastFromPeriods(periods, gameDate, displayTime, updatedAt);
  } catch (e) {
    const reason = controller.signal.aborted ? `timeout past ${FORECAST_TIMEOUT_MS}ms` : e instanceof Error ? e.message : String(e);
    logFailureOnce(pageKey, reason, now.getTime());
    return null;
  } finally {
    clearTimeout(timer);
  }
}
