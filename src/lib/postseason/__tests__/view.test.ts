// What the pages SAY, derived from the captured documents. Expected strings
// are written out in full and were checked by hand against the raw fixture
// values (start instants, scores, seeds), not copied from the code's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import type { Bracket } from '../types';
import {
  buildLeagueView,
  calendarDay,
  clubSlugs,
  currentRoundSeries,
  easternDay,
  easternStamp,
  easternTime,
  easternYmd,
  homeGamesWindow,
  hostSlugs,
  placeholderText,
  seriesIds,
  type LeagueView,
  type SeriesView,
} from '../view';
import { CAPTURED_AT, FIELDS_AT, FIXTURE, IN_GAME_AT, clubs, loadDoc, parks } from './helpers';

type Doc = Record<string, unknown>;
type RawSeries = Doc & { games: Doc[]; higher: Doc; lower: Doc };

function bracket(name: string, edit?: (d: Doc) => void): Bracket {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, `${name} maps`);
  return b;
}
// The view carries no pipeline series key, only the page's own id. Tests name
// a series by the key in the fixture, so each view remembers the key-to-id
// map of the bracket it was built from.
const idsOf = new WeakMap<LeagueView, Map<string, string>>();
function build(b: Bracket, c = clubs(), p = parks(), now: Date = CAPTURED_AT): LeagueView | null {
  const v = buildLeagueView(b, c, p, now);
  if (v) idsOf.set(v, seriesIds(b));
  return v;
}
function view(name: string, now: Date = CAPTURED_AT, edit?: (d: Doc) => void): LeagueView {
  const v = build(bracket(name, edit), clubs(), parks(), now);
  assert.ok(v, `${name} builds`);
  return v;
}
const all = (v: LeagueView): SeriesView[] => v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
const series = (v: LeagueView, key: string): SeriesView => {
  const id = idsOf.get(v)?.get(key);
  assert.ok(id, `${key} is in the bracket`);
  const s = all(v).find((x) => x.id === id);
  assert.ok(s, key);
  return s;
};
const raw = (d: Doc, key: string): RawSeries => (d.series as RawSeries[]).find((s) => s.seriesKey === key) as RawSeries;

// ---- Time ----

test('TIME: Eastern, labeled ET, daylight and standard', () => {
  assert.equal(easternTime('2026-09-29T21:00:00.000Z'), '5:00 PM ET');
  assert.equal(easternDay('2026-09-29T21:00:00.000Z'), 'Tue, Sep 29');
  // 02:00 UTC on the 30th is still the 29th in the East.
  assert.equal(easternDay('2026-09-30T02:00:00.000Z'), 'Tue, Sep 29');
  assert.equal(easternTime('2026-09-30T02:00:00.000Z'), '10:00 PM ET');
  assert.equal(easternYmd(new Date('2026-09-30T02:00:00.000Z')), '2026-09-29');
  // Daylight time ends on Nov 1, 2026. 01:08 UTC on Nov 4 is 8:08 PM EST.
  assert.equal(easternTime('2026-11-04T01:08:00.000Z'), '8:08 PM ET');
  assert.equal(easternDay('2026-11-04T01:08:00.000Z'), 'Tue, Nov 3');
  assert.equal(easternStamp('2026-09-29T17:42:10.000Z'), 'Sep 29, 1:42 PM ET');
  assert.equal(easternTime('2026-09-29T16:05:00.000Z'), '12:05 PM ET');
  assert.equal(easternTime('2026-09-29T04:05:00.000Z'), '12:05 AM ET');
});

test('TIME: a stored date is shown as written, with no zone arithmetic', () => {
  assert.equal(calendarDay('2026-10-03'), 'Sat, Oct 3');
  assert.equal(calendarDay('2026-11-01'), 'Sun, Nov 1');
  assert.equal(calendarDay('2026-01-01'), 'Thu, Jan 1');
});

test('TIME: every rendered time is plain ASCII spacing', () => {
  for (const f of Object.values(FIXTURE)) {
    const text = JSON.stringify(view(f));
    assert.ok(!/[   ]/.test(text), `${f} holds a no-break or thin space`);
  }
});

// ---- The live MLB bracket, before first pitch ----

test('MLB LIVE: rounds are the document rounds, in its order, under its labels', () => {
  const v = view(FIXTURE.mlbLive);
  assert.deepEqual(v.rounds.map((r) => [r.key, r.label, r.shortLabel]), [
    ['wild_card', 'Wild Card Series', null],
    ['division_series', 'Division Series', null],
    ['championship_series', 'Championship Series', null],
    ['world_series', 'World Series', null],
  ]);
  // The id is the round key and the position in the round, document order.
  assert.deepEqual(v.rounds[0].groups.map((g) => [g.conference, g.series.map((s) => s.id)]), [
    ['AL', ['wild_card-1', 'wild_card-2']],
    ['NL', ['wild_card-3', 'wild_card-4']],
  ]);
  assert.deepEqual(v.rounds[3].groups.map((g) => [g.conference, g.series.map((s) => s.id)]), [[null, ['world_series-1']]]);
  assert.equal(series(v, 'AL-WC-B').id, 'wild_card-2');
  assert.equal(series(v, 'NL-DS-A').id, 'division_series-3');
  assert.deepEqual(v.phase, { kind: 'active', roundKey: 'wild_card', roundLabel: 'Wild Card Series' });
  assert.equal(v.league, 'MLB');
  assert.equal(v.season, 2026);
});

test('MLB LIVE: seeds and clubs are the document seeds and the web team names', () => {
  const s = series(view(FIXTURE.mlbLive), 'AL-WC-A');
  assert.equal(s.higher.seed, 3);
  assert.equal(s.higher.label, 'Astros');
  assert.equal(s.higher.fullName, 'Houston Astros');
  assert.equal(s.higher.abbreviation, 'HOU');
  assert.equal(s.higher.teamHref, '/mlb/houston-astros');
  assert.equal(s.lower.seed, 6);
  assert.equal(s.lower.label, 'White Sox');
  assert.equal(s.status, 'upcoming');
  assert.equal(s.scoreLine, null);
  assert.equal(s.liveLabel, null);
  assert.equal(s.formatLabel, 'Best of 3');
});

test('MLB LIVE: the next game carries its Eastern day and time, its host and its park', () => {
  const v = view(FIXTURE.mlbLive);
  const a = series(v, 'AL-WC-A');
  // Stored start 2026-09-29T21:00:00Z.
  assert.equal(a.nextLabel, 'Game 1 · Tue, Sep 29 · 5:00 PM ET');
  assert.equal(a.next?.hostName, 'Astros');
  assert.equal(a.next?.park, 'Daikin Park');
  // The park's page on this site, from the web's own venue pages.
  assert.deepEqual(a.next?.parkPage, { href: '/venues/daikin-park', buildingSlug: 'daikin-park', buildingName: 'Daikin Park' });
  assert.equal(a.next?.matchup, 'White Sox at Astros');
  // Stored start 2026-09-30T02:00:00Z: a 10 PM ET game on the 29th.
  assert.equal(series(v, 'NL-WC-B').nextLabel, 'Game 1 · Tue, Sep 29 · 10:00 PM ET');
  assert.equal(series(v, 'NL-WC-B').next?.day, '2026-09-29');
});

test('TBD TIME: an untimed game shows its stored date and "Time TBD", never the filler instant', () => {
  const d = loadDoc(FIXTURE.mlbLive);
  const g = raw(d, 'AL-DS-A').games[0];
  // The feed fills an untimed game with 07:33 UTC, which is 3:33 AM in the East.
  assert.equal(g.startTimeTBD, true);
  assert.equal(g.start, '2026-10-03T07:33:00Z');
  assert.equal(g.date, '2026-10-03');
  const s = series(view(FIXTURE.mlbLive), 'AL-DS-A');
  assert.equal(s.games[0].when, 'Sat, Oct 3 · Time TBD');
  assert.equal(s.nextLabel, 'Game 1 · Sat, Oct 3 · Time TBD');
  const text = JSON.stringify(view(FIXTURE.mlbLive));
  assert.ok(!text.includes('3:33'), 'the filler time is rendered nowhere');
  assert.ok(!text.includes('11:33'), 'the filler time is rendered nowhere');
});

test('TBD TIME: a game with no time and no date says so', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    raw(d, 'AL-DS-A').games[0].date = null;
  });
  assert.equal(series(v, 'AL-DS-A').games[0].when, 'Date TBD');
  assert.ok(!v.homeGames.some((g) => g.key === 'MLB-division_series-1-g1'), 'a game with no day is not offered as an upcoming home game');
});

test('PLACEHOLDERS: the slot shows the stored label and no club', () => {
  const v = view(FIXTURE.mlbLive);
  const ds = series(v, 'AL-DS-A');
  assert.equal(ds.lower.kind, 'placeholder');
  assert.equal(ds.lower.label, 'NYY/BOS');
  assert.equal(ds.lower.teamId, null);
  assert.equal(ds.lower.teamHref, null);
  assert.equal(ds.lower.abbreviation, null);
  assert.equal(ds.lower.seed, null);
  assert.equal(ds.higher.label, 'Rays');
  assert.equal(series(v, 'AL-CS').higher.label, 'AL Higher Seed');
  assert.equal(series(v, 'WS').higher.label, 'Higher Seed League Champion');
  // A game hosted by a known club against a placeholder names the visitor by
  // the slot's own text.
  assert.equal(ds.games[0].matchup, 'NYY/BOS at Rays');
  assert.equal(ds.games[0].park, 'Tropicana Field');
  // A game whose host is a placeholder has no host and no park.
  const cs = series(v, 'AL-CS');
  assert.equal(cs.games[0].hostTeamId, null);
  assert.equal(cs.games[0].park, null);
});

test('PLACEHOLDERS: no club name appears that the document does not name', () => {
  // The Yankees and Red Sox are in the bracket, in AL-WC-B. They must appear
  // in the Division Series only as the stored label until the feed resolves it.
  const ds = series(view(FIXTURE.mlbLive), 'AL-DS-A');
  const text = JSON.stringify(ds);
  assert.ok(!text.includes('Yankees'));
  assert.ok(!text.includes('Red Sox'));
});

// OVERLAY: see the note in map.test.ts. No stored document carries the pair.
test('OVERLAY: a feeder key and two candidates render as "<Club A> / <Club B> winner"', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    Object.assign(raw(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  });
  const ds = series(v, 'AL-DS-A');
  assert.equal(ds.lower.label, 'Yankees / Red Sox winner');
  assert.equal(ds.lower.kind, 'placeholder');
  assert.equal(ds.lower.teamId, null);
  assert.equal(ds.games[0].matchup, 'Yankees / Red Sox winner at Rays');
});

test('OVERLAY: a candidate the web has no team record for falls back to the stored label', () => {
  const slot = { kind: 'placeholder' as const, label: 'NYY/BOS', seed: null, candidates: ['new-york-yankees', 'no-such-club'] as [string, string] };
  assert.equal(placeholderText(slot, clubs()), 'NYY/BOS');
  assert.equal(placeholderText({ ...slot, candidates: ['new-york-yankees', 'boston-red-sox'] }, clubs()), 'Yankees / Red Sox winner');
  assert.equal(placeholderText({ ...slot, candidates: null }, clubs()), 'NYY/BOS');
});

// ---- Placeholder resolution, as the reader sees it ----

test('CAPTURED: a feeder being played, with two candidates, reads "<A> / <B> winner"', () => {
  const v = view(FIXTURE.mlbFields, FIELDS_AT);
  assert.equal(series(v, 'NL-WC-A').status, 'live');
  const ds = series(v, 'NL-DS-B');
  assert.equal(ds.lower.kind, 'placeholder');
  assert.equal(ds.lower.label, 'Braves / Phillies winner');
  assert.equal(ds.lower.teamHref, null);
  assert.equal(ds.lower.seed, null);
  assert.equal(ds.higher.label, 'Dodgers');
  assert.equal(ds.games[0].matchup, 'Braves / Phillies winner at Dodgers');
  assert.deepEqual(['AL-DS-A', 'AL-DS-B', 'NL-DS-A'].map((k) => series(v, k).lower.label), ['Yankees / Red Sox winner', 'Astros / White Sox winner', 'Padres / Cubs winner']);
  // A slot with neither keeps the stored label.
  assert.equal(series(v, 'AL-CS').higher.label, 'AL Higher Seed');
  assert.equal(series(v, 'WS').lower.label, 'Lower Seed League Champion');
  assert.equal(series(view(FIXTURE.wnbaFields, FIELDS_AT), 'SF-A').higher.label, 'TBD');
});

test('CAPTURED: rounds carry the short label for the pills and the full one for headings', () => {
  assert.deepEqual(view(FIXTURE.mlbFields, FIELDS_AT).rounds.map((r) => [r.label, r.shortLabel]), [
    ['Wild Card Series', 'Wild Card'],
    ['Division Series', 'Division'],
    ['Championship Series', 'LCS'],
    ['World Series', 'World Series'],
  ]);
  assert.deepEqual(view(FIXTURE.wnbaFields, FIELDS_AT).rounds.map((r) => [r.label, r.shortLabel]), [
    ['First Round', 'First Round'],
    ['Semifinals', 'Semifinals'],
    ['WNBA Finals', 'Finals'],
  ]);
});

// OVERLAY: no captured document holds a slot whose feeder is decided.
test('RESOLUTION 1: a decided feeder shows its winner by name, as a club, with the winner\'s seed', () => {
  // Mixed 2025 document: AL-DS-A is final, won by Toronto, the 1 seed.
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'), (d) => {
    Object.assign(raw(d, 'AL-CS').higher, { feederSeriesKey: 'AL-DS-A' });
    for (const g of raw(d, 'AL-CS').games) if (g.home === 'AL Higher Seed') g.home = 'toronto-blue-jays';
  });
  const cs = series(v, 'AL-CS');
  assert.equal(cs.higher.kind, 'club');
  assert.equal(cs.higher.label, 'Blue Jays');
  assert.equal(cs.higher.fullName, 'Toronto Blue Jays');
  assert.equal(cs.higher.seed, 1);
  assert.equal(cs.higher.teamHref, '/mlb/toronto-blue-jays');
  assert.equal(cs.higher.abbreviation, 'TOR');
  // The other slot's feeder is still being played. It stays as it was.
  assert.equal(cs.lower.kind, 'placeholder');
  assert.equal(cs.lower.label, 'AL Lower Seed');
  // The winner hosts what the slot hosted, at its own park.
  assert.equal(cs.games[0].hostName, 'Blue Jays');
  assert.equal(cs.games[0].park, 'Rogers Centre');
  assert.equal(cs.games[0].matchup, 'AL Lower Seed at Blue Jays');
});

test('RESOLUTION 2: a feeder still being played, with candidates, shows "<A> / <B> winner"', () => {
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'), (d) => {
    assert.equal(raw(d, 'AL-DS-B').status, 'live');
    Object.assign(raw(d, 'AL-CS').lower, { feederSeriesKey: 'AL-DS-B', candidates: ['seattle-mariners', 'detroit-tigers'] });
  });
  const cs = series(v, 'AL-CS');
  assert.equal(cs.lower.kind, 'placeholder');
  assert.equal(cs.lower.label, 'Mariners / Tigers winner');
  assert.equal(cs.lower.teamHref, null);
  assert.equal(cs.lower.seed, null);
});

test('RESOLUTION 3: with neither, the stored label', () => {
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'), (d) => {
    Object.assign(raw(d, 'AL-CS').lower, { feederSeriesKey: 'AL-DS-B' });
  });
  assert.equal(series(v, 'AL-CS').lower.label, 'AL Lower Seed');
  assert.equal(series(view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z')), 'AL-CS').lower.label, 'AL Lower Seed');
});

test('STORED KEY: "Winner of AL-WC-B" is never what the reader sees', () => {
  // Feeder still being played: the document's words for it.
  const live = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    raw(d, 'AL-DS-A').lower = { placeholder: 'Winner of AL-WC-B', seed: null };
    for (const g of raw(d, 'AL-DS-A').games) if (g.away === 'NYY/BOS') g.away = 'Winner of AL-WC-B';
  });
  assert.equal(series(live, 'AL-DS-A').lower.label, 'AL Wild Card Series winner');
  assert.ok(!JSON.stringify(live).includes('AL-WC-B'));
  // Feeder decided, which is when the pipeline writes this label: the winner.
  const decided = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'), (d) => {
    raw(d, 'AL-CS').higher = { placeholder: 'Winner of AL-DS-A', seed: null };
    for (const g of raw(d, 'AL-CS').games) if (g.home === 'AL Higher Seed') g.home = 'Winner of AL-DS-A';
  });
  assert.equal(series(decided, 'AL-CS').higher.label, 'Blue Jays');
  assert.equal(series(decided, 'AL-CS').higher.kind, 'club');
  assert.ok(!JSON.stringify(decided).includes('AL-DS-A'));
});

// OVERLAY. The ruling of 2026-09-29: a feeder key with no candidates renders
// the stored label, and the key is text nowhere.
test('FEEDER KEY: with no candidates the slot shows its stored label and the key is nowhere in the view', () => {
  for (const extra of [{ feederSeriesKey: 'AL-WC-B' }, { feederSeriesKey: 'AL-WC-B', candidates: null }]) {
    const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
      Object.assign(raw(d, 'AL-DS-A').lower, extra);
    });
    const ds = series(v, 'AL-DS-A');
    assert.equal(ds.lower.label, 'NYY/BOS');
    assert.equal(ds.lower.fullName, 'NYY/BOS');
    assert.equal(ds.games[0].matchup, 'NYY/BOS at Rays');
    assert.ok(!JSON.stringify(v).includes('AL-WC-B'), 'the feeder key is in the view');
  }
});

test('FEEDER KEY: with candidates the text is composed and the key is still nowhere in the view', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    Object.assign(raw(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  });
  assert.equal(series(v, 'AL-DS-A').lower.label, 'Yankees / Red Sox winner');
  assert.ok(!JSON.stringify(v).includes('AL-WC-B'));
});

test('NO SERIES KEY: no pipeline series key is anywhere in any view', () => {
  for (const f of Object.values(FIXTURE)) {
    const d = loadDoc(f);
    const text = JSON.stringify(view(f));
    for (const s of d.series as RawSeries[]) {
      const key = s.seriesKey as string;
      // "F" and "WS" are too short to search for as bare strings. Quoted, as
      // a JSON value would hold them, they are exact.
      assert.ok(!text.includes(`"${key}"`), `${f}: ${key} is a value in the view`);
      if (key.length >= 4) assert.ok(!text.includes(key), `${f}: ${key} is in the view`);
    }
  }
});

// ---- The live WNBA bracket, one game into the first round ----

test('WNBA LIVE: series score, leader and result come from the rows', () => {
  const v = view(FIXTURE.wnbaLive);
  const s = series(v, 'R1-1v8');
  assert.equal(s.status, 'live');
  assert.equal(s.higher.label, 'Lynx');
  assert.equal(s.higher.wins, 0);
  assert.equal(s.lower.label, 'Liberty');
  assert.equal(s.lower.wins, 1);
  assert.equal(s.lower.leads, true);
  assert.equal(s.higher.leads, false);
  assert.equal(s.scoreLine, 'NYL leads 1-0');
  // Stored: home minnesota-lynx 75, away new-york-liberty 91.
  assert.equal(s.games[0].result, 'NYL 91, MIN 75');
  assert.equal(s.games[0].stateLabel, 'Final');
  // Stored start 2026-09-30T00:30Z.
  assert.equal(s.nextLabel, 'Game 2 · Tue, Sep 29 · 8:30 PM ET');
  assert.equal(s.next?.hostName, 'Liberty');
  assert.equal(s.next?.park, 'Barclays Center');
  assert.equal(s.formatLabel, 'Best of 3 · 1-1-1');
  assert.equal(s.headline, 'NYL leads 1-0');
  // No game is in progress in this capture, whatever the series status says.
  assert.equal(s.liveLabel, null);
  assert.ok(all(v).every((x) => x.liveLabel === null));
});

test('WNBA LIVE: a series with no clubs and no games says only that', () => {
  const s = series(view(FIXTURE.wnbaLive), 'SF-A');
  assert.equal(s.higher.label, 'TBD');
  assert.equal(s.lower.label, 'TBD');
  assert.deepEqual(s.games, []);
  assert.equal(s.next, null);
  assert.equal(s.nextLabel, null);
  assert.equal(s.scoreLine, null);
  assert.equal(s.headline, 'Matchup to be decided');
  assert.equal(s.formatLabel, 'Best of 5');
});

test('WNBA LIVE: an if-necessary game is marked', () => {
  const s = series(view(FIXTURE.wnbaLive), 'R1-1v8');
  assert.equal(s.games[2].ifNecessary, true);
  assert.equal(s.games[2].stateLabel, 'If necessary');
  assert.equal(s.games[1].stateLabel, 'Scheduled');
});

// ---- A game in progress ----

test('IN PROGRESS (captured): Game 1 of Phillies at Braves, under way at 1 to 1', () => {
  // The stored row: status live, homeScore 1, awayScore 1, series wins 0 and 0.
  const d = loadDoc(FIXTURE.mlbInGame);
  const row = raw(d, 'NL-WC-A').games[0];
  assert.deepEqual([row.status, row.homeScore, row.awayScore], ['live', 1, 1]);

  const v = view(FIXTURE.mlbInGame, IN_GAME_AT);
  const s = series(v, 'NL-WC-A');
  assert.equal(s.status, 'live');
  assert.equal(s.liveLabel, 'Game 1 live');
  assert.equal(s.headline, 'Game 1 live');
  assert.equal(s.scoreLine, null, 'no game is final, so the series has no score to state');
  assert.equal(s.nextLabel, null);
  assert.equal(s.next?.gameNumber, 1);
  assert.equal(s.next?.hostName, 'Braves');
  assert.equal(s.next?.park, 'Truist Park');
  assert.equal(s.games[0].stateLabel, 'Live');
  assert.equal(s.games[0].result, null, 'a score in progress is not shown');
  assert.equal(s.games[0].when, 'Tue, Sep 29 · 2:00 PM ET');
  assert.equal(s.higher.leads, false);
  assert.equal(s.lower.leads, false);
  // The other ten series are untouched by it.
  assert.deepEqual(all(v).filter((x) => x.liveLabel !== null).map((x) => x.id), [series(v, 'NL-WC-A').id]);
  assert.deepEqual(v.phase, { kind: 'active', roundKey: 'wild_card', roundLabel: 'Wild Card Series' });
  // A game under way is not an upcoming home game. Its Game 2 still is.
  assert.ok(!v.homeGames.some((g) => g.key === 'MLB-wild_card-3-g1'));
  assert.ok(v.homeGames.some((g) => g.key === 'MLB-wild_card-3-g2'));
  assert.equal(v.homeGames[0].key, 'MLB-wild_card-1-g1', 'the soonest game still ahead leads the list');
  // Stored lastChangedAt 2026-09-29T18:51:14.414Z.
  assert.equal(v.updatedLabel, 'Sep 29, 2:51 PM ET');
});

// OVERLAY on a live capture, for the one combination the captured game does
// not hold: a game under way in a series that already has a leader. The edit
// is the status of one row, the value the adapters write for a game under way.
test('IN PROGRESS: a game under way is named, carries no score, and is the headline', () => {
  const v = view(FIXTURE.wnbaLive, CAPTURED_AT, (d) => {
    const g = raw(d, 'R1-1v8').games[1];
    g.status = 'live';
    g.homeScore = 41;
    g.awayScore = 38;
  });
  const s = series(v, 'R1-1v8');
  assert.equal(s.liveLabel, 'Game 2 live');
  assert.equal(s.headline, 'Game 2 live');
  assert.equal(s.scoreLine, 'NYL leads 1-0');
  assert.equal(s.nextLabel, null);
  assert.equal(s.next?.gameNumber, 2);
  assert.equal(s.games[1].stateLabel, 'Live');
  assert.equal(s.games[1].result, null);
  const text = JSON.stringify(s.games[1]);
  assert.ok(!text.includes('41') && !text.includes('38'), 'a score in progress is not shown');
  assert.ok(!v.homeGames.some((g) => g.key === 'WNBA-first_round-1-g2'), 'a game under way is not offered as an upcoming home game');
});

test('POSTPONED and SUSPENDED: the next game says so and shows no time', () => {
  for (const [status, label] of [['postponed', 'Postponed'], ['suspended', 'Suspended']] as const) {
    const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
      raw(d, 'AL-WC-A').games[0].status = status;
    });
    const s = series(v, 'AL-WC-A');
    assert.equal(s.nextLabel, `Game 1 · ${label}`);
    assert.ok(!v.homeGames.some((g) => g.key === 'MLB-wild_card-1-g1'));
  }
});

test('CANCELLED: a cancelled game is skipped as the next game', () => {
  const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    raw(d, 'AL-WC-A').games[0].status = 'cancelled';
  });
  assert.equal(series(v, 'AL-WC-A').next?.gameNumber, 2);
  assert.equal(series(v, 'AL-WC-A').games[0].stateLabel, 'Cancelled');
});

// ---- Final series and a concluded postseason ----

test('FINAL: a decided series names its winner and its score, and nothing is next', () => {
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'));
  const s = series(v, 'AL-DS-A');
  assert.equal(s.status, 'final');
  assert.equal(s.scoreLine, 'TOR won 3-1');
  assert.equal(s.higher.won, true);
  assert.equal(s.lower.won, false);
  assert.equal(s.next, null);
  assert.equal(s.nextLabel, null);
  assert.equal(s.headline, 'TOR won 3-1');
  // The lower seed won this one.
  const wc = series(v, 'AL-WC-A');
  assert.equal(wc.scoreLine, 'DET won 2-1');
  assert.equal(wc.lower.won, true);
  assert.equal(wc.lower.label, 'Tigers');
});

test('MIXED: tied, leading, and the round being played', () => {
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'));
  assert.deepEqual(v.phase, { kind: 'active', roundKey: 'division_series', roundLabel: 'Division Series' });
  assert.equal(series(v, 'AL-DS-B').scoreLine, 'Series tied 2-2');
  assert.equal(series(v, 'AL-DS-B').higher.leads, false);
  assert.equal(series(v, 'AL-DS-B').lower.leads, false);
  assert.equal(series(v, 'NL-DS-A').scoreLine, 'MIL leads 2-1');
  assert.equal(series(v, 'NL-DS-B').scoreLine, 'LAD leads 2-0');
  assert.equal(series(v, 'NL-DS-B').lower.leads, true);
  assert.deepEqual(currentRoundSeries(v).map((s) => s.id), ['division_series-1', 'division_series-2', 'division_series-3', 'division_series-4']);
});

test('CONCLUDED: the champion is the winner of the last round in the document', () => {
  const mlb = view(FIXTURE.mlbFinal, new Date('2025-11-02T04:00:00Z'));
  assert.deepEqual(mlb.phase, {
    kind: 'concluded',
    championTeamId: 'los-angeles-dodgers',
    championName: 'Los Angeles Dodgers',
    championHref: '/mlb/los-angeles-dodgers',
    summary: 'Won the World Series 4-3',
  });
  assert.deepEqual(mlb.homeGames, []);
  assert.deepEqual(currentRoundSeries(mlb), []);
  assert.ok(all(mlb).every((s) => s.next === null && s.nextLabel === null && s.liveLabel === null));
  const wnba = view(FIXTURE.wnbaFinal, new Date('2025-10-11T04:00:00Z'));
  assert.deepEqual(wnba.phase, {
    kind: 'concluded',
    championTeamId: 'las-vegas-aces',
    championName: 'Las Vegas Aces',
    championHref: '/wnba/las-vegas-aces',
    summary: 'Won the WNBA Finals 4-0',
  });
});

test('CONCLUDED: one series short of finished is still active', () => {
  const v = view(FIXTURE.mlbFinal, new Date('2025-11-01T00:00:00Z'), (d) => {
    const ws = raw(d, 'WS');
    ws.status = 'live';
    ws.winner = null;
  });
  assert.deepEqual(v.phase, { kind: 'active', roundKey: 'world_series', roundLabel: 'World Series' });
});

// ---- Home games ----

test('HOME GAMES: scheduled games with a confirmed host, soonest first', () => {
  const v = view(FIXTURE.mlbLive);
  assert.deepEqual(
    v.homeGames.slice(0, 4).map((g) => [g.matchup, g.gameTitle, g.when, g.park, g.hostTeamId]),
    [
      ['Phillies at Braves', 'Game 1', 'Tue, Sep 29 · 2:00 PM ET', 'Truist Park', 'atlanta-braves'],
      ['White Sox at Astros', 'Game 1', 'Tue, Sep 29 · 5:00 PM ET', 'Daikin Park', 'houston-astros'],
      ['Red Sox at Yankees', 'Game 1', 'Tue, Sep 29 · 8:00 PM ET', 'Yankee Stadium', 'new-york-yankees'],
      ['Cubs at Padres', 'Game 1', 'Tue, Sep 29 · 10:00 PM ET', 'Petco Park', 'san-diego-padres'],
    ],
  );
  const sorted = [...v.homeGames].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  assert.deepEqual(v.homeGames.map((g) => g.sortKey), sorted.map((g) => g.sortKey));
  // Every one has a club host. No game hosted by an unfilled slot is offered.
  assert.ok(v.homeGames.every((g) => clubs().has(g.hostTeamId)));
  assert.ok(!v.homeGames.some((g) => g.key.startsWith('MLB-championship_series') || g.key.startsWith('MLB-world_series')));
});

test('HOME GAMES: an untimed game sorts after the timed games of its day', () => {
  const v = view(FIXTURE.mlbMixed, new Date('2025-10-09T03:08:00Z'));
  // The timed game is stored as 2025-10-11T00:08:00Z, the next day in UTC.
  const oct10 = v.homeGames.filter((g) => g.day === '2025-10-10').map((g) => g.when);
  assert.deepEqual(oct10, ['Fri, Oct 10 · 8:08 PM ET', 'Fri, Oct 10 · Time TBD']);
  // And a day never interleaves with the next one.
  assert.deepEqual(v.homeGames.map((g) => g.day), [...v.homeGames.map((g) => g.day)].sort());
});

test('HOME GAMES: a scheduled game dated before today is not offered', () => {
  const later = view(FIXTURE.mlbLive, new Date('2026-10-01T16:00:00Z'));
  assert.ok(later.homeGames.every((g) => g.day >= '2026-10-01'));
  assert.ok(!later.homeGames.some((g) => g.key === 'MLB-wild_card-1-g1'));
  assert.ok(view(FIXTURE.mlbLive).homeGames.some((g) => g.key === 'MLB-wild_card-1-g1'));
});

// ---- The list the pages show: three days, eight rows, the week behind it ----

test('HOME GAMES WINDOW: the short list is today and the two days after it, Eastern', () => {
  const v = view(FIXTURE.mlbLive);
  const w = homeGamesWindow([v], CAPTURED_AT);
  assert.ok(w.primary.length > 0);
  assert.ok(w.primary.every((g) => g.day >= '2026-09-29' && g.day <= '2026-10-01'), 'Sep 29, Sep 30, Oct 1');
  // The capture holds 12 Wild Card games on those three days. Eight show.
  assert.equal(v.homeGames.filter((g) => g.day <= '2026-10-01').length, 12);
  assert.equal(w.primary.length, 8);
  assert.deepEqual(w.primary.map((g) => g.sortKey), [...w.primary.map((g) => g.sortKey)].sort(), 'soonest first');
  assert.deepEqual(w.primary.slice(0, 2).map((g) => [g.matchup, g.when]), [
    ['Phillies at Braves', 'Tue, Sep 29 · 2:00 PM ET'],
    ['White Sox at Astros', 'Tue, Sep 29 · 5:00 PM ET'],
  ]);
  // 03:00 UTC on Sep 30 is still Sep 29 in the East: the same three days.
  assert.deepEqual(homeGamesWindow([v], new Date('2026-09-30T03:00:00Z')).primary.map((g) => g.key), w.primary.map((g) => g.key));
});

test('HOME GAMES WINDOW: "Show all" holds the rest of the week, and nothing past it', () => {
  const v = view(FIXTURE.mlbLive);
  const w = homeGamesWindow([v], CAPTURED_AT);
  const week = v.homeGames.filter((g) => g.day >= '2026-09-29' && g.day <= '2026-10-05');
  assert.equal(w.primary.length + w.rest.length, week.length);
  assert.deepEqual([...w.primary, ...w.rest].map((g) => g.key), week.map((g) => g.key), 'the two lists are the week, in order, with nothing twice');
  // The rest begins with the four games of the first three days that did not
  // fit in eight rows, then runs on to Oct 5.
  assert.deepEqual(w.rest.slice(0, 4).map((g) => g.day), ['2026-10-01', '2026-10-01', '2026-10-01', '2026-10-01']);
  assert.ok(w.rest.some((g) => g.day > '2026-10-01'));
  assert.ok(v.homeGames.some((g) => g.day > '2026-10-05'), 'the capture holds a home game beyond the week');
  assert.ok(![...w.primary, ...w.rest].some((g) => g.day > '2026-10-05'));
});

test('HOME GAMES WINDOW: one row for each game, however many times it arrives', () => {
  const v = view(FIXTURE.mlbLive);
  const once = homeGamesWindow([v], CAPTURED_AT);
  const twice = homeGamesWindow([v, v], CAPTURED_AT);
  assert.deepEqual(twice, once);
  const keys = [...twice.primary, ...twice.rest].map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('HOME GAMES WINDOW: the hub merges leagues by start, under the same two limits', () => {
  const w = homeGamesWindow([view(FIXTURE.mlbLive), view(FIXTURE.wnbaLive)], CAPTURED_AT);
  assert.equal(w.primary.length, 8);
  assert.deepEqual(w.primary.slice(0, 6).map((g) => [g.league, g.matchup, g.when]), [
    ['MLB', 'Phillies at Braves', 'Tue, Sep 29 · 2:00 PM ET'],
    ['MLB', 'White Sox at Astros', 'Tue, Sep 29 · 5:00 PM ET'],
    ['WNBA', 'Aces at Fever', 'Tue, Sep 29 · 6:30 PM ET'],
    ['MLB', 'Red Sox at Yankees', 'Tue, Sep 29 · 8:00 PM ET'],
    ['WNBA', 'Lynx at Liberty', 'Tue, Sep 29 · 8:30 PM ET'],
    ['MLB', 'Cubs at Padres', 'Tue, Sep 29 · 10:00 PM ET'],
  ]);
  assert.ok(w.rest.some((g) => g.league === 'WNBA') && w.rest.some((g) => g.league === 'MLB'));
  assert.deepEqual(homeGamesWindow([], CAPTURED_AT), { primary: [], rest: [] });
});

test('HOME GAMES WINDOW: a quiet three days leaves the short list empty and the week intact', () => {
  // Sep 24: the first game is five days off. Nothing in three days, but the
  // Wild Card openers fall inside the week.
  const w = homeGamesWindow([view(FIXTURE.mlbLive, new Date('2026-09-24T16:00:00Z'))], new Date('2026-09-24T16:00:00Z'));
  assert.deepEqual(w.primary, []);
  assert.ok(w.rest.length > 0);
  assert.ok(w.rest.every((g) => g.day >= '2026-09-24' && g.day <= '2026-09-30'));
});

test('PARK: a host with no venue record gets no park line, and nothing in its place', () => {
  const b = bracket(FIXTURE.mlbLive);
  const some = parks();
  some.delete('houston-astros');
  const v = build(b, clubs(), some) as LeagueView;
  const s = series(v, 'AL-WC-A');
  assert.equal(s.games[0].park, null);
  assert.equal(s.games[0].parkPage, null);
  assert.equal(s.games[0].hostName, 'Astros');
  assert.equal(v.homeGames.find((g) => g.key === 'MLB-wild_card-1-g1')?.park, null);
  assert.equal(series(v, 'AL-WC-B').games[0].park, 'Yankee Stadium');
});

test('PARK PAGE: a park with no page on this site is a name and no link', () => {
  const b = bracket(FIXTURE.mlbLive);
  const some = parks();
  some.set('houston-astros', { name: 'Daikin Park', page: null });
  const v = build(b, clubs(), some) as LeagueView;
  const g = series(v, 'AL-WC-A').games[0];
  assert.equal(g.park, 'Daikin Park');
  assert.equal(g.parkPage, null);
  const row = v.homeGames.find((x) => x.key === 'MLB-wild_card-1-g1');
  assert.equal(row?.park, 'Daikin Park');
  assert.equal(row?.parkPage, null);
  assert.deepEqual(series(v, 'AL-WC-B').games[0].parkPage, { href: '/venues/yankee-stadium', buildingSlug: 'yankee-stadium', buildingName: 'Yankee Stadium' });
});

test('UNKNOWN CLUB: a club with no team record refuses the whole view', () => {
  const b = bracket(FIXTURE.mlbLive);
  const some = clubs();
  some.delete('houston-astros');
  assert.equal(buildLeagueView(b, some, parks(), CAPTURED_AT), null);
});

test('the change stamp is an absolute Eastern time, and absent when the document has none', () => {
  // Stored lastChangedAt 2026-09-29T17:10:32.300Z.
  assert.equal(view(FIXTURE.mlbLive).updatedLabel, 'Sep 29, 1:10 PM ET');
  const none = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
    delete d.lastChangedAt;
  });
  assert.equal(none.updatedLabel, null);
});

test('lookups: the clubs to resolve and the hosts to find parks for', () => {
  const b = bracket(FIXTURE.mlbLive);
  assert.equal(clubSlugs(b).length, 12);
  assert.deepEqual(hostSlugs(b).sort(), [
    'atlanta-braves', 'cleveland-guardians', 'houston-astros', 'los-angeles-dodgers',
    'milwaukee-brewers', 'new-york-yankees', 'san-diego-padres', 'tampa-bay-rays',
  ]);
  const withPair = bracket(FIXTURE.mlbLive, (d) => {
    Object.assign(raw(d, 'AL-DS-A').lower, { feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'boston-red-sox'] });
  });
  assert.equal(clubSlugs(withPair).length, 12, 'candidates already in the bracket add nothing');
});

test('the view is plain data: it survives a JSON round trip unchanged', () => {
  for (const f of Object.values(FIXTURE)) {
    const v = view(f);
    assert.deepEqual(JSON.parse(JSON.stringify(v)), v, f);
  }
});
