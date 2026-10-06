// One "today" site-wide (WEB6 G3, 2026-10-06), and "Promos tracked" without
// ticket packages.
//
// THE DEFECT. The team pages cut upcoming from past on the UTC day, the hubs,
// the homepage and /promos/today on the Chicago day, several aggregators on
// the server's local day (UTC on Vercel), and My Teams and the calendar ring on
// the visitor's device. Every evening from 00:00 to 05:00 UTC they disagreed:
// on 2026-10-05 the /nhl card said 37 Penguins promotions ahead, the Penguins
// page said 36, and the arena hub's "Team Calendar" link pointed at a row the
// page had already moved out of its upcoming list.
//
// THE RULE. Every surface reads the site's one calendar day, America/New_York
// (src/lib/site-today.ts), the zone the site states its times in.
//
// These tests drive the real readers at instants across the evening window
// against a fake Firestore holding a Penguins-shaped club, and check that the
// team page, its /nhl card, its arena hub, the daily board and the feed agree.
// A static guard then refuses a second "today" anywhere in src.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The server zone on Vercel is UTC. Pin it, so a local-day read fails here the
// way it would in production instead of hiding behind a Central test machine.
process.env.TZ = 'UTC';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-06T16:00:00Z') });

type Data = Record<string, unknown>;
type Doc = ReturnType<typeof fakeDoc>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  const ref: any = { parent: { parent: teamId ? { id: teamId } : null } };
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref };
}
function snap(docs: Doc[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: Doc) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
const docName = (d: Doc) => `${d.ref.parent.parent?.id ?? ''}/${d.id}`;
function query(docs: Doc[]): any {
  let rows = docs;
  let orderField: string | null = null;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      if (value === undefined) throw new Error('Unsupported field value: undefined');
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      return q;
    },
    orderBy: (f: string) => {
      orderField = f;
      return q;
    },
    limit: () => q,
    count: () => ({ get: async () => snap(rows) }),
    get: async () =>
      snap([...rows].sort((a, b) => (orderField ? String(a.data()[orderField]).localeCompare(String(b.data()[orderField])) : 0) || (docName(a) < docName(b) ? -1 : 1))),
  };
  return q;
}

const TEAMS = [
  fakeDoc('pittsburgh-penguins', { league: 'NHL', city: 'Pittsburgh', name: 'Penguins', abbreviation: 'PIT', primaryColor: 0, secondaryColor: 0, division: 'Metropolitan', sportSlug: 'nhl' }),
  fakeDoc('minnesota-twins', { league: 'MLB', city: 'Minnesota', name: 'Twins', abbreviation: 'MIN', primaryColor: 0, secondaryColor: 0, division: 'Central', sportSlug: 'mlb' }),
];
const row = (id: string, team: string, date: string, title: string, type: string, extra: Data = {}) =>
  fakeDoc(id, { date, title, type, description: `${title}.`, opponent: 'Visitors', highlight: true, ...extra }, team);
// The evening of Tuesday 2026-10-06, Eastern. The Penguins' "Team Calendar"
// night is that evening; the other rows bracket it.
const EVENING = '2026-10-06';
const PROMOS = [
  row('p0', 'pittsburgh-penguins', '2026-10-05', 'Polish Heritage Wearable', 'giveaway'),
  row('p1', 'pittsburgh-penguins', EVENING, 'Team Calendar', 'giveaway'),
  row('p2', 'pittsburgh-penguins', EVENING, 'Scout Pack', 'theme', { ticketPackageRequired: true }),
  row('p3', 'pittsburgh-penguins', '2026-10-07', 'Hockey Fights Cancer', 'theme'),
  row('p4', 'pittsburgh-penguins', '2026-10-10', 'Rally Towel', 'giveaway'),
  row('p5', 'pittsburgh-penguins', '2026-10-10', 'Tombstoned Night', 'theme', { tombstoned: true, ticketPackageRequired: true }),
  // The raw extractor flag on an MLB row is not a package anywhere.
  row('t1', 'minnesota-twins', EVENING, 'Fireworks', 'theme', { ticketPackageRequired: true }),
  row('t2', 'minnesota-twins', '2026-10-08', 'Bobblehead', 'giveaway'),
];
const byTeam = (id: string) => PROMOS.filter((d) => d.ref.parent.parent?.id === id);
const fakeDb = {
  collection(name: string): any {
    if (name !== 'teams') return query([]);
    return {
      ...query(TEAMS),
      doc: (id: string) => ({
        get: async () => TEAMS.find((t) => t.id === id) ?? { exists: false, data: () => undefined },
        collection: () => ({
          ...query(byTeam(id)),
          doc: (pid: string) => ({ get: async () => byTeam(id).find((d) => d.id === pid) ?? { exists: false, data: () => undefined } }),
        }),
      }),
    };
  },
  collectionGroup(name: string): any {
    return query(name === 'promos' ? PROMOS : []);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

/** The Eastern calendar day at an instant, computed WITHOUT the module under
 *  test: October and early November 2026 are EDT (UTC-4) until 06:00Z on
 *  Nov 1, then EST (UTC-5). */
function oracleEt(iso: string): string {
  const t = Date.parse(iso);
  const offsetH = t < Date.parse('2026-11-01T06:00:00Z') ? 4 : 5;
  return new Date(t - offsetH * 3_600_000).toISOString().slice(0, 10);
}

// Every 30 minutes from 18:00 UTC on the 6th (14:00 ET) to 08:00 UTC on the
// 7th (04:00 ET): the whole 00:00 to 05:00 UTC window and both sides of it.
const INSTANTS: string[] = [];
for (let t = Date.parse('2026-10-06T18:00:00Z'); t <= Date.parse('2026-10-07T08:00:00Z'); t += 30 * 60_000) {
  INSTANTS.push(new Date(t).toISOString());
}

test('the site day is America/New_York at every instant, DST included', async () => {
  const { siteTodayYmd, SITE_TIME_ZONE } = await import('../site-today');
  assert.equal(SITE_TIME_ZONE, 'America/New_York');
  for (const iso of INSTANTS) assert.equal(siteTodayYmd(new Date(iso)), oracleEt(iso), iso);
  // EST: midnight is 05:00Z.
  assert.equal(siteTodayYmd(new Date('2026-12-02T04:59:59Z')), '2026-12-01');
  assert.equal(siteTodayYmd(new Date('2026-12-02T05:00:00Z')), '2026-12-02');
  // The two DST change nights.
  assert.equal(siteTodayYmd(new Date('2026-11-01T04:30:00Z')), '2026-11-01');
  assert.equal(siteTodayYmd(new Date('2026-11-01T03:59:59Z')), '2026-10-31');
  assert.equal(siteTodayYmd(new Date('2027-03-14T04:59:59Z')), '2027-03-13');
  assert.equal(siteTodayYmd(new Date('2027-03-14T05:00:00Z')), '2027-03-14');
});

test('the calendar helpers are pure day math', async () => {
  const { addDaysYmd, endOfMonthYmd, siteTodayPlusDays } = await import('../site-today');
  assert.equal(addDaysYmd('2026-12-28', 7), '2027-01-04');
  assert.equal(addDaysYmd('2026-03-08', -1), '2026-03-07');
  assert.equal(endOfMonthYmd('2027-02-10'), '2027-02-28');
  assert.equal(endOfMonthYmd('2026-12-31'), '2026-12-31');
  assert.equal(siteTodayPlusDays(1, new Date('2026-10-07T03:30:00Z')), '2026-10-07', 'Oct 6 Eastern plus one');
});

test('in the evening window the team page, its /nhl card, its arena hub, the daily board and the feed agree', async () => {
  const data = await import('../data');
  const { partitionTicketPackages } = await import('../ticket-packages');
  const { splitPromosByDate, todayYmd, promoAnchorId } = await import('../promo-helpers');
  const { getVenueHubWeekPromos } = await import('../venue-hub');
  const { feedWindow } = await import('../social-feed/select');
  const { siteTodayYMD } = await import('../cfb/clock');
  const hub = { tenants: [{ teamId: 'pittsburgh-penguins', league: 'NHL' }] } as never;

  let sawBugWindow = false;
  for (const iso of INSTANTS) {
    mock.timers.setTime(Date.parse(iso));
    const et = oracleEt(iso);
    if (iso.slice(0, 10) !== et) sawBugWindow = true;

    // Every reader's today.
    assert.equal(todayYmd(), et, `team page today at ${iso}`);
    assert.equal(data.promoBoardYMD(0), et, `daily board today at ${iso}`);
    assert.equal(feedWindow(new Date()).start, et, `feed window at ${iso}`);
    assert.equal(siteTodayYMD(), et, `CFB anchor at ${iso}`);

    // The team page, derived the way the route derives it: read, split off
    // the packages, cut on todayYmd().
    const all = await data.getTeamPromos('pittsburgh-penguins');
    const { promos } = partitionTicketPackages(all, data.isTicketPackagePromo, 'NHL');
    const upcoming = splitPromosByDate(promos, todayYmd()).upcoming;
    const pageAnchors = new Set(upcoming.map((p) => promoAnchorId(p)));

    // The /nhl card.
    const card = (await data.getLeagueUpcomingPromoCounts('NHL'))['pittsburgh-penguins'];
    assert.equal(card, upcoming.length, `/nhl card vs team page at ${iso}`);

    // The arena hub and the daily board link to #promo-<anchor> rows that the
    // team page lists as upcoming. "Team Calendar" is on both exactly while it
    // is still the evening of the 6th, Eastern.
    const hubRows = (await getVenueHubWeekPromos(hub)).map((r) => r.promo);
    const board = (await data.getTodayPromos()).filter((p) => p.team.id === 'pittsburgh-penguins');
    for (const p of [...hubRows, ...board]) {
      assert.ok(pageAnchors.has(promoAnchorId(p)), `${p.title} links to a row the page does not list as upcoming, at ${iso}`);
    }
    const tonight = et === EVENING;
    assert.equal(board.some((p) => p.title === 'Team Calendar'), tonight, `board Team Calendar at ${iso}`);
    assert.equal(hubRows.some((p) => p.title === 'Team Calendar'), tonight, `hub Team Calendar at ${iso}`);
    assert.equal(upcoming.some((p) => p.title === 'Team Calendar'), tonight, `page Team Calendar at ${iso}`);
    assert.equal(card, tonight ? 3 : 2, `count at ${iso}`);
  }
  assert.ok(sawBugWindow, 'the instants cover the hours when UTC is a day ahead of Eastern');
});

test('the weekly digest window starts on the site day, even on a manual evening run', async () => {
  const { digestWindow } = await import('../digest');
  // Vercel's server zone is UTC; a test machine's local zone would hide a
  // local-day read, so the case runs in UTC.
  const tz = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    assert.deepEqual(digestWindow(new Date('2026-10-07T02:30:00Z')), { start: '2026-10-06', end: '2026-10-12' });
    assert.deepEqual(digestWindow(new Date('2026-10-06T17:00:00Z')), { start: '2026-10-06', end: '2026-10-12' });
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test('after the nightly refresh, a 12:40 AM Eastern check finds no hub link to an archived row (WEB6 G4)', async () => {
  const data = await import('../data');
  const { partitionTicketPackages } = await import('../ticket-packages');
  const { splitPromosByDate, todayYmd, promoAnchorId } = await import('../promo-helpers');
  const { getVenueHubWeekPromos } = await import('../venue-hub');
  const { nightlyRefreshPaths } = await import('../nightly-refresh');
  const hub = { tenants: [{ teamId: 'pittsburgh-penguins', league: 'NHL' }] } as never;
  // What each cached page holds, rendered at an instant.
  async function render(iso: string) {
    mock.timers.setTime(Date.parse(iso));
    const all = await data.getTeamPromos('pittsburgh-penguins');
    const { promos } = partitionTicketPackages(all, data.isTicketPackagePromo, 'NHL');
    const upcoming = splitPromosByDate(promos, todayYmd()).upcoming;
    return {
      page: new Set(upcoming.map((p) => promoAnchorId(p))),
      card: (await data.getLeagueUpcomingPromoCounts('NHL'))['pittsburgh-penguins'],
      links: [
        ...(await getVenueHubWeekPromos(hub)).map((r) => promoAnchorId(r.promo)),
        ...(await data.getTodayPromos()).filter((p) => p.team.id === 'pittsburgh-penguins').map((p) => promoAnchorId(p)),
      ],
    };
  }
  // 11:30 PM Eastern Oct 6: the hub, /nhl and /promos/today copies are built.
  const before = await render('2026-10-07T03:30:00Z');
  // 12:40 AM Eastern Oct 7: the team page has been regenerated.
  const after = await render('2026-10-07T04:40:00Z');
  // Without the refresh, the old copies point at a row the page has archived.
  const stale = before.links.filter((a) => !after.page.has(a));
  assert.ok(stale.some((a) => a.includes('team-calendar')), `the defect reproduces: ${stale}`);
  assert.notEqual(before.card, after.page.size, 'and the old /nhl card disagrees with the page');
  // The refresh re-renders every one of those pages after midnight...
  const { paths } = await nightlyRefreshPaths({ teams: async () => [{ id: 'pittsburgh-penguins', sportSlug: 'nhl' }], venueHubSlugs: async () => ['ppg-paints-arena'] });
  for (const p of ['/nhl/pittsburgh-penguins', '/venues/ppg-paints-arena', '/nhl', '/promos/today']) assert.ok(paths.includes(p), p);
  // ...so at 12:40 AM every link lands on an upcoming row and the card agrees.
  for (const a of after.links) assert.ok(after.page.has(a), `${a} is archived on the team page`);
  assert.equal(after.card, after.page.size);
});

test('"Promos tracked" counts every document except NHL and NBA ticket packages', async () => {
  const data = await import('../data');
  // 8 documents; p2 and p5 are Penguins packages (p5 tombstoned, still in the
  // raw total, so still subtracted); t1's MLB flag is the raw guess, kept.
  assert.equal(await data.getPromoCount(), 6);
});

test('the route cuts its page on todayYmd(), in the metadata and in the page', () => {
  const src = readFileSync(new URL('../../app/[sport]/[team]/page.tsx', import.meta.url), 'utf8');
  assert.equal(src.split('const todayStr = todayYmd();').length - 1, 2);
  const helpers = readFileSync(new URL('../promo-helpers.ts', import.meta.url), 'utf8');
  const body = helpers.slice(helpers.indexOf('export function todayYmd(): string {'), helpers.indexOf('\n}\n', helpers.indexOf('export function todayYmd(): string {')));
  assert.match(body, /return siteTodayYmd\(\);/);
});

test('the daily /promos/today refresh fires after Eastern midnight, summer and winter', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
  const cron = cfg.crons.find((c: { path: string }) => c.path === '/api/cron/indexnow-daily');
  const [min, hour, ...rest] = cron.schedule.split(' ');
  assert.deepEqual(rest, ['*', '*', '*'], 'daily');
  const utcMinutes = Number(hour) * 60 + Number(min);
  // Eastern midnight is 04:00Z in EDT and 05:00Z in EST. Fire after both, and
  // within two hours of the later one, so the board is regenerated before the
  // morning rather than whenever the hourly ISR is next hit.
  assert.ok(utcMinutes > 5 * 60 && utcMinutes <= 7 * 60, `cron at ${cron.schedule}`);
});

// ---- The guard: no second "today" anywhere in src ----
//
// Each pattern is a way a different day has entered this codebase before:
//   the UTC day          new Date().toISOString().split('T')[0] / .slice(0, 10)
//   the server's or device's local day
//                        a YYYY-MM-DD built from getFullYear() in a file that
//                        reads the clock with new Date()
//   the Chicago day      'America/Chicago' as a timeZone
// The allowances are exact, each with its reason.
const SRC = new URL('../../', import.meta.url).pathname;
const ALLOWED_CHICAGO = new Map<string, string>([
  ['lib/mlb-venue-tz.ts', 'ballpark zones, the zone of a game, not the site day'],
  ['lib/ingest-nfl.ts', 'stadium zones, the zone of a game'],
  ['lib/cfb/venue-timezones.ts', 'stadium zones, the zone of a game'],
  ['lib/cfb/kickoff.ts', 'zone abbreviations for a printed kickoff time'],
  ['lib/social-feed/select.ts', 'the stable pubDate of feed items (noon Central), not the window day'],
]);
const ALLOWED_LOCAL_DAY = new Map<string, string>([]);
// A YYYY-MM-DD formatter ('en-CA') is a day. Only these may build one, each
// with an explicit zone: the site's, a game's, or a venue's.
const ALLOWED_YMD_FORMATTERS = new Map<string, string>([
  ['lib/site-today.ts', 'the site day itself'],
  ['lib/nfl-week.ts', "a game's Eastern day (gameEtYmd)"],
  ['lib/cfb/clock.ts', "todayYMD(zone): a venue's day for CFB played/upcoming"],
]);
// A UTC cut of a timestamp is fine in pure date math (Date.UTC(...)) and in
// game-time ingest; in a file that also reads the clock it is a UTC today.
const ALLOWED_UTC_CUT_WITH_CLOCK = new Map<string, string>([
  ['lib/ingest-nhl.ts', 'game dates from NHL API instants; the clock read is a takenAt timestamp'],
]);
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === '__fixtures__') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('no UTC day: new Date().toISOString() cut to a date', () => {
  const hits = walk(SRC).filter((f) => /new Date\(\)\.toISOString\(\)\.(split\(['"]T['"]\)\[0\]|slice\(0, ?10\)|substring\(0, ?10\))/.test(strip(readFileSync(f, 'utf8'))));
  assert.deepEqual(hits.map((f) => relative(SRC, f)), []);
});

test('no UTC day by way of a variable: a toISOString() date cut in a file that reads the clock', () => {
  const hits = walk(SRC)
    .filter((f) => {
      const s = strip(readFileSync(f, 'utf8'));
      return /new Date\(\)/.test(s) && /\.toISOString\(\)\.(split\(['"]T['"]\)\[0\]|slice\(0, ?10\)|substring\(0, ?10\))/.test(s);
    })
    .map((f) => relative(SRC, f))
    .filter((f) => !ALLOWED_UTC_CUT_WITH_CLOCK.has(f));
  assert.deepEqual(hits, []);
});

test('no other day by way of a YYYY-MM-DD formatter: en-CA only where a zone is named on purpose', () => {
  const hits = walk(SRC)
    .filter((f) => /['"]en-CA['"]/.test(strip(readFileSync(f, 'utf8'))))
    .map((f) => relative(SRC, f))
    .filter((f) => !ALLOWED_YMD_FORMATTERS.has(f));
  assert.deepEqual(hits, []);
});

test('the promo list that carries the #promo- anchors cuts on the page\'s todayStr', () => {
  const list = strip(readFileSync(new URL('../../components/promo-list.tsx', import.meta.url), 'utf8'));
  assert.match(list, /const today = todayProp \?\? todayYmd\(\);/);
  const route = strip(readFileSync(new URL('../../app/[sport]/[team]/page.tsx', import.meta.url), 'utf8'));
  assert.match(route, /<PromoList\s+league=\{team\.league\}\s+today=\{todayStr\}/);
  const redesign = strip(readFileSync(new URL('../../components/redesign/RedesignTeamPage.tsx', import.meta.url), 'utf8'));
  assert.match(redesign, /<PromoList\s+league=\{team\.league\}\s+today=\{today\}/);
});

test('no device or server local day: a getFullYear() YYYY-MM-DD in a file that reads the clock', () => {
  const hits = walk(SRC)
    .filter((f) => {
      const s = strip(readFileSync(f, 'utf8'));
      return /new Date\(\)/.test(s) && /getFullYear\(\)\}-/.test(s);
    })
    .map((f) => relative(SRC, f))
    .filter((f) => !ALLOWED_LOCAL_DAY.has(f));
  assert.deepEqual(hits, []);
});

test('no Chicago day: America/Chicago only where it names a game or a feed timestamp', () => {
  const hits = walk(SRC)
    .filter((f) => /America\/Chicago/.test(strip(readFileSync(f, 'utf8'))))
    .map((f) => relative(SRC, f))
    .filter((f) => !ALLOWED_CHICAGO.has(f));
  assert.deepEqual(hits, []);
});

test('no Eastern-day formatter written with a literal zone outside the known ones', () => {
  const hits = walk(SRC)
    .filter((f) => /timeZone: 'America\/New_York'/.test(strip(readFileSync(f, 'utf8'))))
    .map((f) => relative(SRC, f));
  // site-today.ts uses the constant. nfl-week.ts (ET) and postseason/view.ts
  // (EASTERN) keep their own Eastern constants for game days; neither writes
  // the literal as a timeZone option, and nothing new may.
  assert.deepEqual(hits, []);
});

// THE RATCHET (review round 2). The patterns above name spellings; this names
// none. A file that reads the clock (new Date() or Date.now()) AND formats a
// date (toISOString, toJSON, get[UTC]FullYear, toLocaleDateString,
// DateTimeFormat) is where a second "today" can be made, in any spelling. Each
// such file is listed with its reason and its exact number of clock reads; a
// new file, or one more read in a listed file, fails until someone looks at it
// and either routes the day through src/lib/site-today.ts or adds the entry.
const CLOCK_AND_FORMATTER = new Map<string, [number, string]>([
  ['lib/site-today.ts', [2, 'the site day itself']],
  ['lib/cfb/clock.ts', [1, "todayYMD(zone): a venue's day for CFB played/upcoming"]],
  ['lib/nightly-refresh.ts', [2, 'Date.now() times the warm-up and verify budgets; the hour it formats is SITE_TIME_ZONE (the 00:00 window)']],
  ['components/my-teams-view.tsx', [2, 'Date.now() stamps the geo cache; the day is siteTodayYmd()']],
  ['components/team-hero.tsx', [2, 'legacy hero: the year label and an Eastern "Last updated"']],
  ['components/browse-collections.tsx', [1, 'the year suffix, formatted in SITE_TIME_ZONE']],
  ['components/footer.tsx', [1, 'the copyright year']],
  ['app/team-rankings/page.tsx', [1, 'now passed to localYMD, which is siteYmd']],
  ['app/best-promos/page.tsx', [1, 'now passed to localYMD/addDaysYMD, which are siteYmd']],
  ['app/best-promos/bobbleheads/page.tsx', [1, 'now passed to localYMD/addDaysYMD, which are siteYmd']],
  ['app/ads.txt/route.ts', [1, 'a resolved-at timestamp header']],
  ['app/api/log-request/route.ts', [1, 'a log timestamp']],
  ['app/api/cfb/contribute/route.ts', [1, 'a submittedAt timestamp']],
  ['lib/subscribers.ts', [1, 'a resend cooldown in milliseconds']],
  ['lib/attribution.ts', [1, 'a landed_at timestamp']],
  ['lib/ingest-mlb.ts', [1, 'game times from the MLB API; a takenAt timestamp']],
  ['lib/ingest-nfl.ts', [1, 'game times in stadium zones; a takenAt timestamp']],
  ['lib/ingest-nhl.ts', [1, 'game dates from NHL API instants; a takenAt timestamp']],
]);

test('the ratchet: every file that reads the clock and formats a date is listed, with its exact count of clock reads', () => {
  const found = new Map<string, number>();
  for (const f of walk(SRC)) {
    const s = strip(readFileSync(f, 'utf8'));
    const reads = (s.match(/new Date\(\s*\)|Date\.now\(\)/g) ?? []).length;
    if (reads && /toISOString|toJSON\(|get(?:UTC)?FullYear|toLocaleDateString|DateTimeFormat/.test(s)) found.set(relative(SRC, f), reads);
  }
  const unexpected = [...found].filter(([f, n]) => CLOCK_AND_FORMATTER.get(f)?.[0] !== n).map(([f, n]) => `${f}: ${n} clock read(s)`);
  assert.deepEqual(unexpected, [], 'route the day through src/lib/site-today.ts, or list the file with its reason');
});
