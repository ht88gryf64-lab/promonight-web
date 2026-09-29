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
  homeGamesThisWeek,
  hostSlugs,
  nextHomeGames,
  placeholderText,
  type LeagueView,
  type SeriesView,
} from '../view';
import { CAPTURED_AT, FIXTURE, clubs, loadDoc, parks } from './helpers';

type Doc = Record<string, unknown>;
type RawSeries = Doc & { games: Doc[]; higher: Doc; lower: Doc };

function bracket(name: string, edit?: (d: Doc) => void): Bracket {
  const d = loadDoc(name);
  if (edit) edit(d);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b, `${name} maps`);
  return b;
}
function view(name: string, now: Date = CAPTURED_AT, edit?: (d: Doc) => void): LeagueView {
  const v = buildLeagueView(bracket(name, edit), clubs(), parks(), now);
  assert.ok(v, `${name} builds`);
  return v;
}
const all = (v: LeagueView): SeriesView[] => v.rounds.flatMap((r) => r.groups.flatMap((g) => g.series));
const series = (v: LeagueView, key: string): SeriesView => {
  const s = all(v).find((x) => x.seriesKey === key);
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
  assert.deepEqual(v.rounds[0].groups.map((g) => [g.conference, g.series.map((s) => s.seriesKey)]), [
    ['AL', ['AL-WC-A', 'AL-WC-B']],
    ['NL', ['NL-WC-A', 'NL-WC-B']],
  ]);
  assert.deepEqual(v.rounds[3].groups.map((g) => [g.conference, g.series.map((s) => s.seriesKey)]), [[null, ['WS']]]);
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
  assert.ok(!v.homeGames.some((g) => g.key === 'MLB-AL-DS-A-1'), 'a game with no day is not offered as an upcoming home game');
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
  const slot = { kind: 'placeholder' as const, label: 'NYY/BOS', seed: null, feederSeriesKey: 'AL-WC-B', candidates: ['new-york-yankees', 'no-such-club'] as [string, string] };
  assert.equal(placeholderText(slot, clubs()), 'NYY/BOS');
  assert.equal(placeholderText({ ...slot, candidates: ['new-york-yankees', 'boston-red-sox'] }, clubs()), 'Yankees / Red Sox winner');
  assert.equal(placeholderText({ ...slot, feederSeriesKey: null, candidates: null }, clubs()), 'NYY/BOS');
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
//
// OVERLAY on a live capture: no captured document had a game in progress when
// these were written. The edit is the status of one row, the value the
// adapters write for a game under way.
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
  assert.ok(!v.homeGames.some((g) => g.key === 'WNBA-R1-1v8-2'), 'a game under way is not offered as an upcoming home game');
});

test('POSTPONED and SUSPENDED: the next game says so and shows no time', () => {
  for (const [status, label] of [['postponed', 'Postponed'], ['suspended', 'Suspended']] as const) {
    const v = view(FIXTURE.mlbLive, CAPTURED_AT, (d) => {
      raw(d, 'AL-WC-A').games[0].status = status;
    });
    const s = series(v, 'AL-WC-A');
    assert.equal(s.nextLabel, `Game 1 · ${label}`);
    assert.ok(!v.homeGames.some((g) => g.key === 'MLB-AL-WC-A-1'));
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
  assert.deepEqual(currentRoundSeries(v).map((s) => s.seriesKey), ['AL-DS-A', 'AL-DS-B', 'NL-DS-A', 'NL-DS-B']);
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
  assert.ok(!v.homeGames.some((g) => g.key.startsWith('MLB-AL-CS') || g.key.startsWith('MLB-NL-CS') || g.key.startsWith('MLB-WS')));
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
  assert.ok(!later.homeGames.some((g) => g.key === 'MLB-AL-WC-A-1'));
  assert.ok(view(FIXTURE.mlbLive).homeGames.some((g) => g.key === 'MLB-AL-WC-A-1'));
});

test('HOME GAMES: "this week" is today and the six days after it, on the Eastern calendar', () => {
  const v = view(FIXTURE.mlbLive);
  const week = homeGamesThisWeek(v, CAPTURED_AT);
  assert.ok(week.length > 0);
  assert.ok(week.every((g) => g.day >= '2026-09-29' && g.day <= '2026-10-05'));
  assert.ok(v.homeGames.some((g) => g.day > '2026-10-05'), 'the capture holds a home game beyond the week');
  assert.ok(!week.some((g) => g.day > '2026-10-05'));
  // 03:00 UTC on Sep 30 is still Sep 29 in the East.
  assert.deepEqual(homeGamesThisWeek(v, new Date('2026-09-30T03:00:00Z')).map((g) => g.key), week.map((g) => g.key));
});

test('HOME GAMES: the hub list merges leagues by start and stops at its limit', () => {
  const mlb = view(FIXTURE.mlbLive);
  const wnba = view(FIXTURE.wnbaLive);
  const next = nextHomeGames([mlb, wnba], 6);
  assert.deepEqual(next.map((g) => [g.league, g.matchup, g.when]), [
    ['MLB', 'Phillies at Braves', 'Tue, Sep 29 · 2:00 PM ET'],
    ['MLB', 'White Sox at Astros', 'Tue, Sep 29 · 5:00 PM ET'],
    ['WNBA', 'Aces at Fever', 'Tue, Sep 29 · 6:30 PM ET'],
    ['MLB', 'Red Sox at Yankees', 'Tue, Sep 29 · 8:00 PM ET'],
    ['WNBA', 'Lynx at Liberty', 'Tue, Sep 29 · 8:30 PM ET'],
    ['MLB', 'Cubs at Padres', 'Tue, Sep 29 · 10:00 PM ET'],
  ]);
  assert.deepEqual(nextHomeGames([], 6), []);
});

test('PARK: a host with no venue record gets no park line, and nothing in its place', () => {
  const b = bracket(FIXTURE.mlbLive);
  const some = parks();
  some.delete('houston-astros');
  const v = buildLeagueView(b, clubs(), some, CAPTURED_AT) as LeagueView;
  const s = series(v, 'AL-WC-A');
  assert.equal(s.games[0].park, null);
  assert.equal(s.games[0].hostName, 'Astros');
  assert.equal(v.homeGames.find((g) => g.key === 'MLB-AL-WC-A-1')?.park, null);
  assert.equal(series(v, 'AL-WC-B').games[0].park, 'Yankee Stadium');
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
