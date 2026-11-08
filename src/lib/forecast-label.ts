// The forecast row's words (docs/per-promo-pages-v2-spec.md, Visuals 7, step
// 5b, rulings 2026-11-08), pure and dependency-free so the view and the tests
// share them with the loader.
//
// THE ROOF FLAG ONLY SETS THE LABEL. The row shows on every promo page with a
// game within seven days and a US venue with coordinates, whatever the roof:
// open or retractable, "Game-time forecast" (retractable adds its note after
// the summary); fixed, "Outside at {tip-off | puck drop | kickoff | first
// pitch}" by league, because the weather is what the fan walks through, not
// what the game is played in; absent, "Forecast". Absent never suppresses
// the row.

export type VenueRoof = 'open' | 'fixed' | 'retractable';

export function parseRoof(v: unknown): VenueRoof | null {
  return v === 'open' || v === 'fixed' || v === 'retractable' ? v : null;
}

/** How the league names the start of its game. */
export function gameStartWord(league: string): string {
  switch (String(league ?? '').toUpperCase()) {
    case 'NBA':
    case 'WNBA':
      return 'tip-off';
    case 'NHL':
      return 'puck drop';
    case 'NFL':
    case 'MLS':
    case 'CFB':
      return 'kickoff';
    case 'MLB':
      return 'first pitch';
    default:
      return 'game time';
  }
}

export function forecastLabel(roof: VenueRoof | null, league: string): string {
  if (roof === 'open' || roof === 'retractable') return 'Game-time forecast';
  if (roof === 'fixed') return `Outside at ${gameStartWord(league)}`;
  return 'Forecast';
}

/** The note after the summary line, or null. */
export function roofNote(roof: VenueRoof | null): string | null {
  return roof === 'retractable' ? 'retractable roof' : null;
}

/** The forecast window: the game is today or within the next seven days. */
export const FORECAST_WINDOW_DAYS = 7;
export function withinForecastWindow(today: string, gameDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) return false;
  const days = Math.round((Date.parse(`${gameDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days >= 0 && days <= FORECAST_WINDOW_DAYS;
}

export type ForecastIconKey = 'sun' | 'moon' | 'cloud-sun' | 'cloud-moon' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'wind';

/** One of ten glyphs for an NWS short forecast ("Partly Cloudy", "Chance
 *  Rain Showers"), in the promo type-icon style, never NWS's own icons. */
export function forecastIconKey(shortForecast: string, isDaytime: boolean): ForecastIconKey {
  const s = shortForecast.toLowerCase();
  if (/thunder|t-storm/.test(s)) return 'storm';
  if (/snow|sleet|flurr|blizzard|ice|freezing|wintry/.test(s)) return 'snow';
  if (/rain|shower|drizzle/.test(s)) return 'rain';
  if (/fog|haze|smoke|mist/.test(s)) return 'fog';
  if (/wind|breezy|blustery/.test(s)) return 'wind';
  if (/mostly cloudy|cloudy|overcast/.test(s) && !/partly|mostly sunny|mostly clear/.test(s)) return 'cloud';
  if (/partly|mostly sunny|mostly clear/.test(s)) return isDaytime ? 'cloud-sun' : 'cloud-moon';
  if (/sunny|clear/.test(s)) return isDaytime ? 'sun' : 'moon';
  return 'cloud';
}

export interface GameForecast {
  /** The NWS short forecast of the game's period ("Partly Cloudy"). */
  condition: string;
  icon: ForecastIconKey;
  /** The day's high and night's low when the date has both periods. */
  high: number | null;
  low: number | null;
  /** The single period's temperature when the date has one period only. */
  temperature: number | null;
  unit: 'F' | 'C';
  /** Chance of precipitation, percent, the highest over the date's periods. */
  precipChance: number;
  /** NWS updateTime, ISO. */
  updatedAt: string;
}

/** "Partly cloudy, high 57° low 39°, 10% chance of precipitation". */
export function forecastSummary(f: GameForecast): string {
  const temps = f.high !== null && f.low !== null ? `high ${f.high}° low ${f.low}°` : `${f.temperature}°`;
  return `${f.condition}, ${temps}, ${f.precipChance}% chance of precipitation`;
}

/** "Nov 8, 1:06 PM CT" in the venue's zone, for "updated {time}". */
export function formatForecastTime(iso: string, timeZone: string | null): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const tz = timeZone && timeZone.includes('/') ? timeZone : 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'shortGeneric' }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const zone = get('timeZoneName');
    const label = zone && !/^GMT/.test(zone) && zone.length <= 5 ? ` ${zone}` : '';
    return `${get('month')} ${get('day')}, ${get('hour')}:${get('minute')} ${get('dayPeriod')}${label}`;
  } catch {
    return null;
  }
}
