// The game-time forecast (step 5b, rulings 2026-11-08): the label by roof,
// the window, the period selection, and the call with its failure modes.
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test src/lib/__tests__/forecast.test.ts
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { forecastIconKey, forecastLabel, forecastSummary, formatForecastTime, gameStartWord, parseRoof, roofNote, withinForecastWindow } from '../forecast-label';

mock.module('server-only', { namedExports: {} });
const load = () => import('../forecast');

test('the label by roof and league: open and retractable alike, fixed names the start, absent is generic and never suppresses', () => {
  assert.equal(forecastLabel('open', 'NHL'), 'Game-time forecast');
  assert.equal(forecastLabel('retractable', 'MLB'), 'Game-time forecast');
  assert.equal(forecastLabel('fixed', 'NHL'), 'Outside at puck drop');
  assert.equal(forecastLabel('fixed', 'NBA'), 'Outside at tip-off');
  assert.equal(forecastLabel('fixed', 'WNBA'), 'Outside at tip-off');
  assert.equal(forecastLabel('fixed', 'NFL'), 'Outside at kickoff');
  assert.equal(forecastLabel('fixed', 'MLS'), 'Outside at kickoff');
  assert.equal(forecastLabel('fixed', 'MLB'), 'Outside at first pitch');
  assert.equal(forecastLabel(null, 'NHL'), 'Forecast');
  assert.equal(gameStartWord('XFL'), 'game time');
  assert.equal(roofNote('retractable'), 'retractable roof');
  assert.equal(roofNote('open'), null);
  assert.equal(roofNote('fixed'), null);
  assert.equal(roofNote(null), null);
  assert.equal(parseRoof('fixed'), 'fixed');
  assert.equal(parseRoof('retractable'), 'retractable');
  assert.equal(parseRoof('dome'), null);
  assert.equal(parseRoof(undefined), null);
});

test('the window: today through seven days out; eight is out; the past is out', () => {
  assert.equal(withinForecastWindow('2026-11-08', '2026-11-08'), true);
  assert.equal(withinForecastWindow('2026-11-08', '2026-11-15'), true);
  assert.equal(withinForecastWindow('2026-11-08', '2026-11-16'), false, 'eight days out');
  assert.equal(withinForecastWindow('2026-11-08', '2026-11-07'), false);
  assert.equal(withinForecastWindow('2026-11-08', 'TBD'), false);
});

test('the glyph for a short forecast, day and night', () => {
  assert.equal(forecastIconKey('Sunny', true), 'sun');
  assert.equal(forecastIconKey('Clear', false), 'moon');
  assert.equal(forecastIconKey('Partly Cloudy', false), 'cloud-moon');
  assert.equal(forecastIconKey('Mostly Sunny', true), 'cloud-sun');
  assert.equal(forecastIconKey('Mostly Cloudy', true), 'cloud');
  assert.equal(forecastIconKey('Chance Rain Showers', true), 'rain');
  assert.equal(forecastIconKey('Slight Chance Snow Showers', false), 'snow');
  assert.equal(forecastIconKey('Chance Showers And Thunderstorms', true), 'storm');
  assert.equal(forecastIconKey('Patchy Fog', false), 'fog');
  assert.equal(forecastIconKey('Breezy', true), 'wind');
});

const period = (startTime: string, endTime: string, isDaytime: boolean, temperature: number | null, pop: number | null, shortForecast = isDaytime ? 'Sunny' : 'Partly Cloudy') => ({
  startTime, endTime, isDaytime, temperature, temperatureUnit: 'F', probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: pop }, shortForecast,
});
const PERIODS = [
  period('2026-11-08T13:00:00-06:00', '2026-11-08T18:00:00-06:00', true, 57, 0),
  period('2026-11-08T18:00:00-06:00', '2026-11-09T06:00:00-06:00', false, 39, 0),
  period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, 2, 'Partly Sunny'),
  period('2026-11-09T18:00:00-06:00', '2026-11-10T06:00:00-06:00', false, 37, 10, 'Mostly Clear'),
  period('2026-11-14T06:00:00-06:00', '2026-11-14T18:00:00-06:00', true, 48, 30, 'Chance Rain'),
];
const UPDATED = '2026-11-08T19:06:26+00:00';
// The hourly grid: 21:00 Nov 8 through 20:00 Nov 9 local (a short run for the tests).
const hour = (start: string, temperature: number, pop: number, shortForecast: string, isDaytime = false) => ({
  startTime: start, endTime: start.replace(/T(\d{2})/, (_m, h: string) => `T${String(Number(h) + 1).padStart(2, '0')}`), isDaytime, temperature, temperatureUnit: 'F', probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: pop }, shortForecast,
});
const HOURLY = [
  hour('2026-11-08T21:00:00-06:00', 44, 0, 'Clear'),
  hour('2026-11-09T06:00:00-06:00', 40, 2, 'Partly Sunny', true),
  hour('2026-11-09T13:00:00-06:00', 58, 2, 'Sunny', true),
  hour('2026-11-09T18:00:00-06:00', 49, 10, 'Mostly Clear'),
  hour('2026-11-09T19:00:00-06:00', 46, 10, 'Mostly Clear'),
  hour('2026-11-09T20:00:00-06:00', 44, 15, 'Partly Cloudy'),
];
const HOURLY_UPDATED = '2026-11-08T19:10:00+00:00';

test('the selection: the game date’s day and night give high and low, the period containing the game time names the condition, the chance is the date’s highest', async () => {
  const { forecastFromPeriods } = await load();
  const evening = forecastFromPeriods(PERIODS, '2026-11-09', '7:00 PM', UPDATED);
  assert.deepEqual(evening, { condition: 'Mostly Clear', icon: 'cloud-moon', high: 60, low: 37, temperature: null, unit: 'F', precipChance: 10, updatedAt: UPDATED, atTime: null, source: 'daily' });
  const matinee = forecastFromPeriods(PERIODS, '2026-11-09', '1:00 PM', UPDATED);
  assert.equal(matinee?.condition, 'Partly Sunny');
  assert.equal(matinee?.icon, 'cloud-sun');
  const noTime = forecastFromPeriods(PERIODS, '2026-11-09', null, UPDATED);
  assert.equal(noTime?.condition, 'Mostly Clear', 'no time: the night period, most games are evenings');
  // One period only (the last day of the range, the day period): its own
  // temperature for a game inside it; an evening game that day has no
  // period yet, so no row.
  const single = forecastFromPeriods(PERIODS, '2026-11-14', '1:00 PM', UPDATED);
  assert.deepEqual([single?.condition, single?.high, single?.low, single?.temperature, single?.precipChance], ['Chance Rain', null, null, 48, 30]);
  assert.equal(forecastFromPeriods(PERIODS, '2026-11-14', '7:00 PM', UPDATED), null, 'the evening of the last day is not forecast yet');
  assert.equal(forecastSummary(evening!), 'Mostly clear, high 60°, low 37°, 10% chance of precipitation');
  assert.equal(forecastSummary(single!), 'Chance rain, 48°, 30% chance of precipitation');
  // A known game hour no period covers any more (a 10 AM game read in the
  // afternoon, the morning period gone): no row, never tonight's weather
  // under a game-time label (ux-review D1).
  assert.equal(forecastFromPeriods([period('2026-11-09T13:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, 2), period('2026-11-09T18:00:00-06:00', '2026-11-10T06:00:00-06:00', false, 37, 10)], '2026-11-09', '10:00 AM', UPDATED), null);
  assert.equal(forecastFromPeriods([period('2026-11-09T13:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, 2), period('2026-11-09T18:00:00-06:00', '2026-11-10T06:00:00-06:00', false, 37, 10)], '2026-11-09', '1:00 PM', UPDATED)?.condition, 'Sunny', 'the afternoon period still covers 1 PM');
  // No period on the date: nothing. A missing field: nothing.
  assert.equal(forecastFromPeriods(PERIODS, '2026-11-20', '7:00 PM', UPDATED), null);
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, null)], '2026-11-09', null, UPDATED), null, 'no chance of precipitation, no row');
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, null, 5)], '2026-11-09', null, UPDATED), null, 'no temperature, no row');
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, 5, '')], '2026-11-09', null, UPDATED), null, 'no condition, no row');
  assert.equal(formatForecastTime(UPDATED, 'America/Chicago'), 'Nov 8, 1:06 PM CT');
  assert.equal(formatForecastTime('garbage', 'America/Chicago'), null);
});

test('the start hour from the hourly grid: the covering period, past once the hour has left the grid, beyond past its end, null without a time; the hourly row’s fields', async () => {
  const { hourlyAt, forecastFromHour } = await load();
  const at = hourlyAt(HOURLY, '2026-11-09', '7:20 PM');
  assert.equal((at as { temperature: number }).temperature, 46, 'the 19:00 period covers 7:20 PM');
  assert.equal(hourlyAt(HOURLY, '2026-11-08', '1:00 PM'), 'past', 'a 1 PM kickoff read after 9 PM: the hour has left the grid');
  assert.equal(hourlyAt(HOURLY, '2026-11-12', '7:00 PM'), 'beyond', 'beyond the grid: the daily fallback');
  assert.equal(hourlyAt(HOURLY, '2026-11-09', null), null, 'no time, no hour');
  assert.equal(hourlyAt([], '2026-11-09', '7:00 PM'), 'beyond', 'an empty grid reaches nothing');
  const row = forecastFromHour(at as (typeof HOURLY)[number], '7:20 PM', HOURLY_UPDATED);
  assert.deepEqual(row, { condition: 'Mostly Clear', icon: 'cloud-moon', high: null, low: null, temperature: 46, unit: 'F', precipChance: 10, updatedAt: HOURLY_UPDATED, atTime: '7:20 PM', source: 'hourly' });
  assert.equal(forecastSummary(row!), 'Mostly clear, 46° at 7:20 PM, 10% chance of precipitation');
  assert.equal(forecastFromHour({ ...HOURLY[4], probabilityOfPrecipitation: { value: null } }, '7:20 PM', HOURLY_UPDATED), null, 'no chance, no row');
  assert.equal(forecastFromHour({ ...HOURLY[4], temperature: null as unknown as number }, '7:20 PM', HOURLY_UPDATED), null, 'no temperature, no row');
});

// ── the call ─────────────────────────────────────────────────────────────────
type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
let handler: Handler = () => new Response('', { status: 500 });
const calls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  calls.push(url);
  return handler(url, init);
}) as typeof fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/geo+json' } });
const NOW = new Date('2026-11-08T20:00:00Z');
const okHandler: Handler = (url) => {
  if (url.startsWith('https://api.weather.gov/points/')) return json({ properties: { forecast: 'https://api.weather.gov/gridpoints/MPX/108,72/forecast', forecastHourly: 'https://api.weather.gov/gridpoints/MPX/108,72/forecast/hourly', timeZone: 'America/Chicago' } });
  if (url === 'https://api.weather.gov/gridpoints/MPX/108,72/forecast') return json({ properties: { updateTime: UPDATED, periods: PERIODS } });
  if (url === 'https://api.weather.gov/gridpoints/MPX/108,72/forecast/hourly') return json({ properties: { updateTime: HOURLY_UPDATED, periods: HOURLY } });
  return new Response('', { status: 404 });
};
/** The points answer without an hourly URL: the daily grid alone. */
const dailyOnlyHandler: Handler = (url) => (url.startsWith('https://api.weather.gov/points/') ? json({ properties: { forecast: 'https://api.weather.gov/gridpoints/MPX/108,72/forecast' } }) : okHandler(url));
let warns: string[] = [];
beforeEach(async () => {
  (await load())._resetForecastForTests();
  calls.length = 0;
  warns = [];
  mock.method(console, 'warn', (...a: unknown[]) => { warns.push(a.map(String).join(' ')); });
});
const input = { lat: 44.9817, lng: -93.2776, gameDate: '2026-11-09', displayTime: '7:00 PM', pageKey: '/mlb/minnesota-twins/promos/x', now: NOW };

test('a good call: points, then the hourly and daily grids together; the start hour’s row from the hourly grid (ruling 2026-11-08)', async () => {
  const { fetchGameForecast } = await load();
  handler = okHandler;
  const f = await fetchGameForecast(input);
  assert.deepEqual([f?.source, f?.condition, f?.temperature, f?.precipChance, f?.atTime, f?.high], ['hourly', 'Mostly Clear', 46, 10, '7:00 PM', null]);
  assert.deepEqual([...calls].sort(), ['https://api.weather.gov/gridpoints/MPX/108,72/forecast', 'https://api.weather.gov/gridpoints/MPX/108,72/forecast/hourly', 'https://api.weather.gov/points/44.9817,-93.2776']);
  assert.deepEqual(warns, []);
});

test('the daily period is the fallback: no hourly URL, or a start hour beyond the hourly grid; a start hour that has left the hourly grid is no row', async () => {
  const { fetchGameForecast } = await load();
  handler = dailyOnlyHandler;
  const daily = await fetchGameForecast(input);
  assert.deepEqual([daily?.source, daily?.high, daily?.low, daily?.atTime], ['daily', 60, 37, null], 'no hourly URL: the daily period');
  handler = okHandler;
  const beyond = await fetchGameForecast({ ...input, gameDate: '2026-11-14', displayTime: '1:00 PM' });
  assert.deepEqual([beyond?.source, beyond?.temperature, beyond?.condition], ['daily', 48, 'Chance Rain'], 'beyond the hourly grid: the daily period');
  const past = await fetchGameForecast({ ...input, gameDate: '2026-11-08', displayTime: '1:00 PM' });
  assert.equal(past, null, 'the hour has left the hourly grid: nothing, not tonight’s weather');
  assert.deepEqual(warns, []);
});

test('a Canadian building: the points call answers 404, nothing renders, nothing is logged', async () => {
  const { fetchGameForecast } = await load();
  handler = () => new Response('', { status: 404 });
  assert.equal(await fetchGameForecast({ ...input, lat: 43.6435, lng: -79.3791 }), null);
  assert.equal(calls.length, 1);
  assert.deepEqual(warns, []);
});

test('an NWS 500, a stale response, bad JSON and a thrown fetch each render nothing, log once per page per window, and never throw', async () => {
  const { fetchGameForecast, _resetForecastForTests } = await load();
  handler = (url) => (url.startsWith('https://api.weather.gov/points/') ? okHandler(url) : new Response('', { status: 500 }));
  assert.equal(await fetchGameForecast(input), null);
  assert.equal(await fetchGameForecast(input), null);
  assert.equal(warns.length, 1, 'once for the page');
  assert.match(warns[0], /\/mlb\/minnesota-twins\/promos\/x: no row \((forecast|hourly) HTTP 500\)/);
  assert.equal(await fetchGameForecast({ ...input, pageKey: '/other' }), null);
  assert.equal(warns.length, 2);
  _resetForecastForTests();
  handler = (url) => (url.startsWith('https://api.weather.gov/points/') ? okHandler(url) : json({ properties: { updateTime: '2026-11-06T10:00:00+00:00', periods: PERIODS } }));
  assert.equal(await fetchGameForecast(input), null);
  assert.match(warns[2], /stale/);
  _resetForecastForTests();
  handler = () => new Response('', { status: 503 });
  assert.equal(await fetchGameForecast(input), null);
  assert.match(warns[3], /points HTTP 503/);
  _resetForecastForTests();
  handler = () => { throw new TypeError('fetch failed'); };
  assert.equal(await fetchGameForecast(input), null);
  assert.match(warns[4], /fetch failed/);
  _resetForecastForTests();
  handler = (url) => (url.startsWith('https://api.weather.gov/points/') ? okHandler(url) : new Response('not json', { status: 200 }));
  assert.equal(await fetchGameForecast(input), null);
  assert.equal(warns.length, 6);
});

test('a call past 800ms is abandoned: nothing rendered, the timeout logged', async () => {
  const { fetchGameForecast, FORECAST_TIMEOUT_MS } = await load();
  handler = (url, init) => new Promise<Response>((resolve, reject) => {
    if (url.startsWith('https://api.weather.gov/points/')) return resolve(okHandler(url) as Response);
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const t0 = Date.now();
  assert.equal(await fetchGameForecast(input), null);
  const took = Date.now() - t0;
  assert.ok(took >= FORECAST_TIMEOUT_MS - 50 && took < FORECAST_TIMEOUT_MS + 700, `took ${took}ms`);
  assert.match(warns[0], /timeout past 800ms/);
});
