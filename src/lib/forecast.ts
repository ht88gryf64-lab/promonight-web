// The game-time forecast (docs/per-promo-pages-v2-spec.md, Visuals 7, step
// 5b, rulings 2026-11-08): api.weather.gov, free, no key. The points call
// names the grid's two forecast URLs; the hourly one gives the start hour's
// temperature, chance of precipitation and condition (ruling 2026-11-08,
// after the first review), the daily one gives fourteen half-day periods
// and is the fallback when the hourly grid does not reach the start hour.
// All three are fetched with Next's one-hour cache. The row shows on a
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
 *  date has no period, the game's hour has already left the forecast, or a
 *  chosen period lacks a field. With a game time the period containing it
 *  names the condition; without one the night's, else the day's. The high and low are the day and night temperatures when the date
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
  // A known game hour that no remaining period covers (NWS drops a period
  // once it has passed; a 1 PM kickoff read at 5 PM) is a game the forecast
  // no longer describes: no row, rather than tonight's weather under a
  // "game-time" label (ux-review D1, 2026-11-08).
  if (t && !containing) return null;
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
    return { condition, icon: forecastIconKey(condition, named.isDaytime !== false), high, low, temperature: null, unit, precipChance, updatedAt, atTime: null, source: 'daily' };
  }
  const temperature = num(named.temperature);
  if (temperature === null) return null;
  return { condition, icon: forecastIconKey(condition, named.isDaytime !== false), high: null, low: null, temperature, unit, precipChance, updatedAt, atTime: null, source: 'daily' };
}

/** The hourly period covering the game's start hour on its date, by the
 *  period's own local clock; 'past' when the hour is before the grid's
 *  first period (the hour has left the grid: no row, ruling 2026-11-08);
 *  'beyond' when it is after the grid's last period (the daily fallback);
 *  null when the game has no time. */
export function hourlyAt(periods: readonly NwsPeriod[], gameDate: string, displayTime: string | null | undefined): NwsPeriod | 'past' | 'beyond' | null {
  const t = parseDisplayTime(displayTime);
  if (!t) return null;
  const want = `${gameDate}T${String(t.h).padStart(2, '0')}`;
  const starts = periods.map((p) => str(p.startTime).slice(0, 13)).filter(Boolean).sort();
  if (!starts.length) return 'beyond';
  const hit = periods.find((p) => str(p.startTime).slice(0, 13) === want);
  if (hit) return hit;
  return want < starts[0] ? 'past' : 'beyond';
}

/** The row from the start hour's period, or null when a field is missing. */
export function forecastFromHour(period: NwsPeriod, displayTime: string, updatedAt: string): GameForecast | null {
  const condition = str(period.shortForecast);
  const temperature = num(period.temperature);
  const pop = num(period.probabilityOfPrecipitation?.value);
  if (!condition || temperature === null || pop === null) return null;
  const unit = str(period.temperatureUnit) === 'C' ? 'C' : 'F';
  return { condition, icon: forecastIconKey(condition, period.isDaytime !== false), high: null, low: null, temperature, unit, precipChance: pop, updatedAt, atTime: displayTime.trim(), source: 'hourly' };
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
    const pointsBody = (await points.json()) as { properties?: { forecast?: unknown; forecastHourly?: unknown } };
    const forecastUrl = str(pointsBody.properties?.forecast);
    const hourlyUrl = str(pointsBody.properties?.forecastHourly);
    const ok = (u: string) => /^https:\/\/api\.weather\.gov\//.test(u);
    if (!ok(forecastUrl)) return null;
    const grid = async (url: string, name: string) => {
      const res = await fetch(url, { headers: HEADERS, next: { revalidate: FORECAST_CACHE_SECONDS }, signal: controller.signal } as RequestInit);
      if (!res.ok) throw new ForecastFailure(`${name} HTTP ${res.status}`);
      const body = (await res.json()) as { properties?: { updateTime?: unknown; generatedAt?: unknown; periods?: unknown } };
      const updatedAt = str(body.properties?.updateTime) || str(body.properties?.generatedAt);
      if (!updatedAt || !isFresh(updatedAt, now)) throw new ForecastFailure(updatedAt ? `${name} stale (updated ${updatedAt})` : `${name} has no update time`);
      const periods = Array.isArray(body.properties?.periods) ? (body.properties!.periods as NwsPeriod[]) : [];
      return { periods, updatedAt };
    };
    // The start hour from the hourly grid (ruling 2026-11-08); the daily
    // period only when the hourly grid does not reach the hour. Both are
    // asked for together so the deadline covers them as one.
    const wantHourly = ok(hourlyUrl) && !!parseDisplayTime(displayTime);
    const [hourly, daily] = await Promise.all([wantHourly ? grid(hourlyUrl, 'hourly') : Promise.resolve(null), grid(forecastUrl, 'forecast')]);
    if (hourly) {
      const at = hourlyAt(hourly.periods, gameDate, displayTime);
      if (at === 'past') return null;
      if (at && at !== 'beyond') return forecastFromHour(at, displayTime as string, hourly.updatedAt);
    }
    return forecastFromPeriods(daily.periods, gameDate, displayTime, daily.updatedAt);
  } catch (e) {
    const reason = controller.signal.aborted ? `timeout past ${FORECAST_TIMEOUT_MS}ms` : e instanceof Error ? e.message : String(e);
    logFailureOnce(pageKey, reason, now.getTime());
    return null;
  } finally {
    clearTimeout(timer);
  }
}
