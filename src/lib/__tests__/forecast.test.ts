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

test('the selection: the game date’s day and night give high and low, the period containing the game time names the condition, the chance is the date’s highest', async () => {
  const { forecastFromPeriods } = await load();
  const evening = forecastFromPeriods(PERIODS, '2026-11-09', '7:00 PM', UPDATED);
  assert.deepEqual(evening, { condition: 'Mostly Clear', icon: 'cloud-moon', high: 60, low: 37, temperature: null, unit: 'F', precipChance: 10, updatedAt: UPDATED });
  const matinee = forecastFromPeriods(PERIODS, '2026-11-09', '1:00 PM', UPDATED);
  assert.equal(matinee?.condition, 'Partly Sunny');
  assert.equal(matinee?.icon, 'cloud-sun');
  const noTime = forecastFromPeriods(PERIODS, '2026-11-09', null, UPDATED);
  assert.equal(noTime?.condition, 'Mostly Clear', 'no time: the night period, most games are evenings');
  // One period only (the last day of the range): its own temperature.
  const single = forecastFromPeriods(PERIODS, '2026-11-14', '7:00 PM', UPDATED);
  assert.deepEqual([single?.condition, single?.high, single?.low, single?.temperature, single?.precipChance], ['Chance Rain', null, null, 48, 30]);
  assert.equal(forecastSummary(evening!), 'Mostly Clear, high 60° low 37°, 10% chance of precipitation');
  assert.equal(forecastSummary(single!), 'Chance Rain, 48°, 30% chance of precipitation');
  // No period on the date: nothing. A missing field: nothing.
  assert.equal(forecastFromPeriods(PERIODS, '2026-11-20', '7:00 PM', UPDATED), null);
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, null)], '2026-11-09', null, UPDATED), null, 'no chance of precipitation, no row');
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, null, 5)], '2026-11-09', null, UPDATED), null, 'no temperature, no row');
  assert.equal(forecastFromPeriods([period('2026-11-09T06:00:00-06:00', '2026-11-09T18:00:00-06:00', true, 60, 5, '')], '2026-11-09', null, UPDATED), null, 'no condition, no row');
  assert.equal(formatForecastTime(UPDATED, 'America/Chicago'), 'Nov 8, 1:06 PM CT');
  assert.equal(formatForecastTime('garbage', 'America/Chicago'), null);
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
  if (url.startsWith('https://api.weather.gov/points/')) return json({ properties: { forecast: 'https://api.weather.gov/gridpoints/MPX/108,72/forecast', timeZone: 'America/Chicago' } });
  if (url === 'https://api.weather.gov/gridpoints/MPX/108,72/forecast') return json({ properties: { updateTime: UPDATED, periods: PERIODS } });
  return new Response('', { status: 404 });
};
let warns: string[] = [];
beforeEach(async () => {
  (await load())._resetForecastForTests();
  calls.length = 0;
  warns = [];
  mock.method(console, 'warn', (...a: unknown[]) => { warns.push(a.map(String).join(' ')); });
});
const input = { lat: 44.9817, lng: -93.2776, gameDate: '2026-11-09', displayTime: '7:00 PM', pageKey: '/mlb/minnesota-twins/promos/x', now: NOW };

test('a good call: points, then the grid forecast, both with the hour cache; the game date’s forecast back', async () => {
  const { fetchGameForecast } = await load();
  handler = okHandler;
  const f = await fetchGameForecast(input);
  assert.deepEqual([f?.condition, f?.high, f?.low, f?.precipChance], ['Mostly Clear', 60, 37, 10]);
  assert.deepEqual(calls, ['https://api.weather.gov/points/44.9817,-93.2776', 'https://api.weather.gov/gridpoints/MPX/108,72/forecast']);
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
  assert.match(warns[0], /\/mlb\/minnesota-twins\/promos\/x: no row \(forecast HTTP 500\)/);
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
