// THE RANKED SURFACES' SEASON GATE (ruling 2026-11-05).
//
// The homepage best rail, /best-promos, /best-promos/bobbleheads and the
// /team-rankings tease admit a promo only when its date falls inside its
// league's current season window (src/lib/seasons/season-window.ts). This file
// proves the rule on the known-bad rows that made it necessary, at every
// window's boundaries, through the readers the pages call, and on the real
// clock for staleness.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BRACKET_LEAGUES,
  LEAD_IN_DAYS,
  SEASON_TABLE,
  STALE_WARNING_DAYS,
  bracketFinalYmd,
  currentSeasonPredicate,
  currentSeasonWindows,
  effectiveEnd,
  isInCurrentSeason,
  leagueWindows,
} from '../seasons/season-window';
import { addDaysYmd, siteYmd } from '../site-today';
import type { Bracket } from '../postseason/types';

const NO_FINALS = new Map<string, string>();
// What postseasonBrackets held on 2026-11-05: MLB_2026's last final game was
// 2026-10-29T00:00Z, i.e. 2026-10-28 Eastern; WNBA_2026's 2026-11-01T00:00Z.
const REAL_FINALS = new Map([['MLB_2026', '2026-10-28'], ['WNBA_2026', '2026-10-31']]);

// ── Known-bad input (scanner-framework 6b.6) ───────────────────────────────

test('known-bad: Giants 2027-03-27 is out on 2026-11-05 and in on 2027-02-10', () => {
  for (const finals of [NO_FINALS, REAL_FINALS]) {
    assert.equal(isInCurrentSeason('MLB', '2027-03-27', '2026-11-05', finals), false);
    assert.equal(isInCurrentSeason('MLB', '2027-03-27', '2027-02-10', finals), true);
  }
});

test('known-bad: Galaxy 2027-02-20 is out on 2026-11-05, while MLS 2026 is still current', () => {
  assert.equal(isInCurrentSeason('MLS', '2027-02-20', '2026-11-05', REAL_FINALS), false);
  // Not vacuous: MLS is in season that day, which is why a league-level
  // "in season today" check would have passed the row.
  assert.equal(currentSeasonWindows('MLS', '2026-11-05').map((w) => w.season).join(), '2026');
  assert.equal(isInCurrentSeason('MLS', '2026-11-07', '2026-11-05', REAL_FINALS), true);
});

test('known-bad: an NHL 2026-11-20 row is in on 2026-11-05', () => {
  assert.equal(isInCurrentSeason('NHL', '2026-11-20', '2026-11-05', REAL_FINALS), true);
});

test('known-bad: an MLB 2026-10-28 row is in on 2026-10-25 (World Series under way, bracket not final)', () => {
  assert.equal(isInCurrentSeason('MLB', '2026-10-28', '2026-10-25', NO_FINALS), true);
  // And on the day the bracket went final, the final game's date is still in.
  assert.equal(isInCurrentSeason('MLB', '2026-10-28', '2026-10-28', REAL_FINALS), true);
});

// ── Boundaries, for every window in the table ──────────────────────────────

test('every window: the lead-in opens exactly LEAD_IN_DAYS before the start', () => {
  for (const league of Object.keys(SEASON_TABLE)) {
    for (const w of leagueWindows(league)) {
      const opens = addDaysYmd(w.start, -LEAD_IN_DAYS);
      const day = (d: string) => currentSeasonWindows(league, d).some((c) => c.season === w.season);
      assert.equal(day(addDaysYmd(opens, -1)), false, `${league} ${w.season}: not current the day before its lead-in`);
      assert.equal(day(opens), true, `${league} ${w.season}: current from ${opens}`);
      assert.equal(isInCurrentSeason(league, w.start, addDaysYmd(opens, -1)), false, `${league} ${w.season}: its opener is out before the lead-in`);
      assert.equal(isInCurrentSeason(league, w.start, opens), true, `${league} ${w.season}: its opener is in on the lead-in's first day`);
    }
  }
});

test('every window: in through its fixed end, out the day after; nothing dated before its start', () => {
  for (const league of Object.keys(SEASON_TABLE)) {
    for (const w of leagueWindows(league)) {
      assert.equal(isInCurrentSeason(league, w.end, w.end), true, `${league} ${w.season}: the end day is in`);
      assert.equal(isInCurrentSeason(league, addDaysYmd(w.end, 1), w.end), false, `${league} ${w.season}: the day after the end is out`);
      assert.equal(
        currentSeasonWindows(league, addDaysYmd(w.end, 1)).some((c) => c.season === w.season),
        false,
        `${league} ${w.season}: not current after its end`,
      );
      // A preseason row dated the day before the opener, seen mid-season.
      assert.equal(isInCurrentSeason(league, addDaysYmd(w.start, -1), w.start), false, `${league} ${w.season}: the day before the start is out`);
    }
  }
});

test('a final bracket ends MLB and WNBA on the last game; MLS ignores its bracket by ruling', () => {
  // MLB 2026 ended 2026-10-28, three days before the scheduled Game 7.
  assert.equal(isInCurrentSeason('MLB', '2026-10-30', '2026-10-28', REAL_FINALS), false, 'unplayed Game 6 date is out');
  assert.equal(currentSeasonWindows('MLB', '2026-10-29', REAL_FINALS).length, 0, 'MLB has no current season the day after its final');
  assert.equal(currentSeasonWindows('MLB', '2026-10-29', NO_FINALS).length, 1, 'without the bracket the fixed end holds');
  assert.equal(currentSeasonWindows('WNBA', '2026-11-01', REAL_FINALS).length, 0);
  const mls = leagueWindows('MLS').find((w) => w.season === '2026')!;
  assert.equal(effectiveEnd(mls, new Map([['MLS_2026', '2026-11-01']])), mls.end, 'MLS_2026 bracket is not read');
  assert.deepEqual(BRACKET_LEAGUES, ['MLB', 'WNBA']);
});

test('fails closed: no windows, no admission; malformed dates out; league case ignored', () => {
  assert.equal(isInCurrentSeason('NFL', '2026-11-08', '2026-11-05'), false);
  assert.equal(isInCurrentSeason('', '2026-11-08', '2026-11-05'), false);
  assert.equal(isInCurrentSeason('MLS', '', '2026-11-05'), false);
  assert.equal(isInCurrentSeason('MLS', 'TBD', '2026-11-05'), false);
  assert.equal(isInCurrentSeason('mls', '2026-11-07', '2026-11-05'), true);
  const p = currentSeasonPredicate('2026-11-05', REAL_FINALS);
  assert.equal(p('MLB', '2027-03-27'), false);
  assert.equal(p('NHL', '2026-11-20'), true);
});

// ── The bracket's final day ────────────────────────────────────────────────

const bracketFixture = (name: string): Bracket =>
  JSON.parse(readFileSync(new URL(`../postseason/__fixtures__/${name}`, import.meta.url), 'utf-8')) as Bracket;

test('bracketFinalYmd: the official date of the last final game; null while any series is live', () => {
  // The 2025 World Series Game 7: official date 2025-11-01, start 2025-11-02T00:00Z.
  assert.equal(bracketFinalYmd(bracketFixture('MLB_2025.final.json')), '2025-11-01');
  assert.equal(bracketFinalYmd(bracketFixture('MLB_2026.live-20261001T0017Z.json')), null);
  assert.equal(bracketFinalYmd({ series: [] }), null);
  const undated = {
    series: [{ status: 'final', games: [{ status: 'final', date: null, start: '2026-10-29T00:00:00Z' }] }],
  } as unknown as Bracket;
  assert.equal(bracketFinalYmd(undated), '2026-10-28', 'an 8 PM Eastern start stored as the next UTC day is the Eastern day');
  const undatable = {
    series: [
      { status: 'final', games: [{ status: 'final', date: '2026-10-24', start: null }] },
      { status: 'final', games: [{ status: 'final', date: null, start: null }] },
    ],
  } as unknown as Bracket;
  assert.equal(bracketFinalYmd(undatable), null, 'a final game it cannot date: fixed end, never an earlier game\'s day');
});

// ── The table ──────────────────────────────────────────────────────────────

test('windows.json: valid dates, start before end, a source, no overlap within a league', () => {
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  for (const league of Object.keys(SEASON_TABLE)) {
    assert.equal(league, league.toUpperCase(), `${league}: league keys are upper case, as team docs store them`);
    const ws = leagueWindows(league);
    assert.ok(ws.length > 0, `${league}: at least one window`);
    for (const w of ws) {
      assert.match(w.season, /^\d{4}(-\d{2})?$/, `${league}: season key "${w.season}"`);
      assert.match(w.start, YMD);
      assert.match(w.end, YMD);
      assert.ok(w.start < w.end, `${league} ${w.season}: start before end`);
      assert.ok(w.source.trim().length > 0, `${league} ${w.season}: source stated`);
    }
    for (let i = 1; i < ws.length; i++) {
      assert.ok(ws[i - 1].end < ws[i].start, `${league}: ${ws[i - 1].season} ends before ${ws[i].season} starts`);
    }
  }
  for (const l of BRACKET_LEAGUES) assert.ok(SEASON_TABLE[l], `${l} reads a bracket, so it has windows`);
});

// REAL CLOCK, ON PURPOSE. Ruling 2026-11-05, point 3: staleness is loud. When
// this fails, add the league's next season to src/lib/seasons/windows.json
// from its published schedule (mark any unpublished date `provisional`);
// docs/known-issues.md entry 75. It reads the WALL clock, as the entry-69 test
// does: performance.timeOrigin + performance.now() is not moved by
// test:future's Date shift or by mock.timers, so it fires on the real date in
// every run and never a year early.
test(`real clock: no league's last window ends within ${STALE_WARNING_DAYS} days of today`, () => {
  const today = siteYmd(new Date(performance.timeOrigin + performance.now()));
  const stale: string[] = [];
  for (const league of Object.keys(SEASON_TABLE)) {
    const lastEnd = leagueWindows(league).reduce((acc, w) => (w.end > acc ? w.end : acc), '');
    if (addDaysYmd(lastEnd, -STALE_WARNING_DAYS) <= today) stale.push(`${league} (last window ends ${lastEnd})`);
  }
  assert.deepEqual(stale, [], `src/lib/seasons/windows.json needs next-season entries for: ${stale.join(', ')}`);
});

// ── Through the readers the pages call ─────────────────────────────────────

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref: { parent: { parent: teamId ? { id: teamId } : null } } };
}
function fakeSnap(docs: ReturnType<typeof fakeDoc>[]) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
}
function query(docs: ReturnType<typeof fakeDoc>[]): any {
  let rows = docs;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      const v = (d: (typeof docs)[number]) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    count: () => ({ get: async () => fakeSnap(rows) }),
    get: async () => fakeSnap([...rows].sort((a, b) => String(a.data().date).localeCompare(String(b.data().date)))),
  };
  return q;
}
const team = (id: string, league: string) =>
  fakeDoc(id, { league, city: id, name: id, abbreviation: id.slice(0, 3).toUpperCase(), primaryColor: 0, secondaryColor: 0, division: 'X', sportSlug: league.toLowerCase() });
const TEAMS = [team('san-francisco-giants', 'MLB'), team('la-galaxy', 'MLS'), team('san-diego-fc', 'MLS'), team('detroit-red-wings', 'NHL')];
const scored = (id: string, teamId: string, date: string, title: string, score: number) =>
  fakeDoc(id, { date, title, type: 'giveaway', time: '7:00 PM', opponent: 'Visitors', description: 'd', highlight: true, score, scoreBreakdown: { baseType: 10 }, derivedSignals: { itemType: 'generic' } }, teamId);
const PROMOS = [
  scored('marichal', 'san-francisco-giants', '2027-03-27', 'Juan Marichal Bobblehead', 95),
  scored('shrek', 'la-galaxy', '2027-03-06', 'Shrek Hawaiian Shirt', 90),
  scored('galaxy-now', 'la-galaxy', '2026-11-08', 'Galaxy Scarf', 40),
  scored('beanie', 'san-diego-fc', '2026-11-07', 'Camo Beanie', 68),
];

let bracketDocs: Record<string, Data> = {};
let getAllThrows = false;
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        get: async () => fakeSnap(TEAMS),
        doc: (id: string) => ({
          get: async () => TEAMS.find((t) => t.id === id) ?? { exists: false, data: () => undefined },
          collection: () => query(PROMOS.filter((p) => p.ref.parent.parent?.id === id)),
        }),
      };
    }
    return { ...query([]), doc: (id: string) => ({ id, path: `${name}/${id}` }) };
  },
  collectionGroup(name: string): any {
    return query(name === 'promos' ? PROMOS : []);
  },
  async getAll(...args: any[]) {
    if (getAllThrows) throw new Error('unavailable');
    const refs = args.filter((a) => a && typeof a.id === 'string');
    return refs.map((r: { id: string }) => {
      const data = bracketDocs[r.id];
      return { id: r.id, exists: data !== undefined, data: () => data };
    });
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

const ON = new Date('2026-11-05T17:00:00Z');
const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

test('getSeasonFinals: a final MLB bracket ends the season; a live one does not; a failed read falls back', async () => {
  const { getSeasonFinals } = await import('../seasons/finals');
  const mlbFinal = { ...bracketFixture('MLB_2025.final.json'), season: 2026 } as unknown as Data;
  const wnbaLive = bracketFixture('WNBA_2026.live-20261001T1625Z.json') as unknown as Data;
  bracketDocs = { MLB_2026: mlbFinal, WNBA_2026: wnbaLive };
  // getSeasonFinals is React cache()-wrapped; outside a render each call reads.
  const finals = await getSeasonFinals();
  assert.equal(finals.get('MLB_2026'), '2025-11-01', 'the fixture\'s last final game');
  assert.equal(finals.has('WNBA_2026'), false, 'a live bracket ends nothing');
  getAllThrows = true;
  try {
    assert.equal((await getSeasonFinals()).size, 0, 'no throw: the fixed ends apply');
  } finally {
    getAllThrows = false;
    bracketDocs = {};
  }
});

test('/best-promos reader: next-season rows out BEFORE the cap; ungated callers unchanged', async () => {
  const { getScoredPromosInDateRange, getScoredPromosByItemType } = await import('../data');
  const { getCurrentSeasonPredicate } = await import('../seasons/finals');
  const gate = await getCurrentSeasonPredicate(ON);
  const end = addDaysYmd('2026-11-05', 180);
  assert.deepEqual(titles(await getScoredPromosInDateRange('2026-11-05', end, 300, gate)), ['Camo Beanie', 'Galaxy Scarf']);
  // limit 1: the in-season row takes the slot the 95 would have taken ungated.
  assert.deepEqual(titles(await getScoredPromosInDateRange('2026-11-05', end, 1, gate)), ['Camo Beanie']);
  assert.deepEqual(titles(await getScoredPromosByItemType('2026-11-05', end, 'generic', 300, gate)), ['Camo Beanie', 'Galaxy Scarf']);
  // The social feed and the retrospective read pass no gate: as before.
  assert.deepEqual(titles(await getScoredPromosInDateRange('2026-11-05', end, 300)), ['Juan Marichal Bobblehead', 'Shrek Hawaiian Shirt', 'Camo Beanie', 'Galaxy Scarf']);
  // On 2027-02-10 the MLB and MLS lead-ins are open; the Nov 2026 rows are past
  // the reader's own window.
  const feb = await getCurrentSeasonPredicate(new Date('2027-02-10T17:00:00Z'));
  assert.deepEqual(titles(await getScoredPromosInDateRange('2027-02-10', '2027-08-09', 300, feb)), ['Juan Marichal Bobblehead', 'Shrek Hawaiian Shirt']);
});

test('/team-rankings reader: a team\'s tease is its best IN-SEASON row, not dropped', async () => {
  const { getTopPromosPerTeam } = await import('../data');
  const { getCurrentSeasonPredicate } = await import('../seasons/finals');
  const top = await getTopPromosPerTeam('2026-11-05', await getCurrentSeasonPredicate(ON));
  assert.equal(top.get('la-galaxy')?.title, 'Galaxy Scarf', 'Shrek (90, 2027) loses to the in-season 40');
  assert.equal(top.has('san-francisco-giants'), false, 'the Giants have no in-season row');
  assert.equal(top.get('san-diego-fc')?.title, 'Camo Beanie');
  const ungated = await getTopPromosPerTeam('2026-11-05');
  assert.equal(ungated.get('la-galaxy')?.title, 'Shrek Hawaiian Shirt', 'the gate is what changed it');
});

test('homepage best rail: gated before the cut, so it fills from in-season rows', async () => {
  const { pickBestStubPromos } = await import('../../components/redesign/pick-best-stub-promos');
  const { getPromosFromDate } = await import('../data');
  const all = await getPromosFromDate('2026-11-05');
  const gate = currentSeasonPredicate('2026-11-05', REAL_FINALS);
  assert.deepEqual(titles(pickBestStubPromos(all, 2, gate)), ['Camo Beanie', 'Galaxy Scarf']);
  assert.deepEqual(titles(pickBestStubPromos(all, 8, currentSeasonPredicate('2027-02-10', REAL_FINALS))), ['Juan Marichal Bobblehead', 'Shrek Hawaiian Shirt']);
});

// ── Every ranked surface is wired, and only those ─────────────────────────

test('the four ranked call sites pass the season gate', () => {
  const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf-8');
  const SITES: [string, RegExp][] = [
    ['app/page.tsx', /pickBestStubPromos\(allFuture, 8, inCurrentSeason\)/],
    ['app/best-promos/page.tsx', /getScoredPromosInDateRange\(todayYMD, endYMD, SERVER_FETCH_CAP, inCurrentSeason\)/],
    ['app/best-promos/bobbleheads/page.tsx', /getScoredPromosByItemType\(todayYMD, endYMD, 'bobblehead', SERVER_FETCH_CAP, inCurrentSeason\)/],
    ['app/team-rankings/page.tsx', /getTopPromosPerTeam\(todayYMD, inCurrentSeason\)/],
  ];
  for (const [file, call] of SITES) {
    const s = src(file);
    assert.match(s, call, `${file}: the ranked read passes the gate`);
    assert.match(s, /const inCurrentSeason = await getCurrentSeasonPredicate\(/, `${file}: the gate is built from the bracket-aware reader`);
  }
  // Ruling point 6: the 7-day surfaces are not gated.
  assert.doesNotMatch(src('lib/social-feed/feed.ts'), /getCurrentSeasonPredicate|seasons\//, 'social feed untouched');
});
