// The head of each playoffs page, as data. One branch per state the body can
// render, written from the same value the body is rendered from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBracketDoc } from '../map';
import { hubCopy, hubJsonLd, leagueCopy, leagueJsonLd, type HubLeagueState } from '../metadata';
import { buildLeagueView, type LeagueView } from '../view';
import { FIELDS_AT, FIXTURE, clubs, loadDoc, parks, seriesKeyIn } from './helpers';

function view(name: string, now: Date): LeagueView {
  const d = loadDoc(name);
  const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
  assert.ok(b);
  const v = buildLeagueView(b, clubs(), parks(), now);
  assert.ok(v);
  return v;
}
const MIXED_AT = new Date('2025-10-09T03:08:00Z');
const FINAL_AT = new Date('2025-11-02T04:00:00Z');
const okState = (v: LeagueView): HubLeagueState => ({ league: v.league, state: 'ok', view: v });
const SUFFIX = ' | PromoNight';
const ROUTES = ['MLB', 'WNBA'] as const;

/** What any title or description must satisfy. */
function sound(text: string, where: string) {
  assert.ok(!/[\u2014\u2013]/.test(text), `${where}: a dash`);
  assert.ok(!/\bhourly\b|\breal[- ]time\b|\blive\b|\bup to the minute\b|\btonight\b|\btoday\b/i.test(text), `${where}: ${text}`);
  assert.equal(seriesKeyIn(text), null, `${where}: a series key`);
  assert.ok(!/undefined|null|NaN|\s{2,}|\.\./.test(text), `${where}: ${text}`);
}

test('LEAGUE, being played: the title names the page, the description names the round', () => {
  const c = leagueCopy(2026, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbFields, FIELDS_AT));
  assert.deepEqual(c, {
    title: '2026 MLB Playoffs Bracket, Schedule and Scores',
    canonical: 'https://www.getpromonight.com/playoffs/mlb',
    description: 'The 2026 MLB postseason bracket. Current round: Wild Card Series. Every series, seed and result, with game times in Eastern and the home games coming up.',
  });
  const w = leagueCopy(2026, 'WNBA', '/playoffs/wnba', view(FIXTURE.wnbaFields, FIELDS_AT));
  assert.equal(w.title, '2026 WNBA Playoffs Bracket, Schedule and Scores');
  assert.ok(w.description.includes('Current round: First Round.'));
  assert.equal(w.canonical, 'https://www.getpromonight.com/playoffs/wnba');
});

test('LEAGUE, a later round: the description moves with the bracket', () => {
  assert.ok(leagueCopy(2025, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbMixed, MIXED_AT)).description.includes('Current round: Division Series.'));
});

test('LEAGUE, finished: the champion and the result, and no round "being played"', () => {
  const c = leagueCopy(2025, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbFinal, FINAL_AT));
  assert.equal(c.description, 'The 2025 MLB postseason bracket, complete. Los Angeles Dodgers: won the World Series 4-3. Every series and result, round by round.');
  assert.ok(!c.description.includes('Current round'));
  assert.equal(c.title, '2025 MLB Playoffs Bracket, Schedule and Scores');
  const w = leagueCopy(2025, 'WNBA', '/playoffs/wnba', view(FIXTURE.wnbaFinal, FINAL_AT));
  assert.ok(w.description.includes('Las Vegas Aces: won the WNBA Finals 4-0.'));
});

test('LEAGUE, no bracket: nothing is said about one', () => {
  assert.deepEqual(leagueCopy(2026, 'MLB', '/playoffs/mlb', null), {
    title: '2026 MLB Playoffs Bracket, Schedule and Scores',
    canonical: 'https://www.getpromonight.com/playoffs/mlb',
    description: 'The 2026 MLB postseason bracket.',
  });
});

test('HUB, being played: the leagues playing and the round each is in', () => {
  const c = hubCopy(2026, ROUTES, [okState(view(FIXTURE.mlbFields, FIELDS_AT)), okState(view(FIXTURE.wnbaFields, FIELDS_AT))]);
  assert.deepEqual(c, {
    title: '2026 Playoffs: MLB and WNBA Brackets',
    canonical: 'https://www.getpromonight.com/playoffs',
    description: 'The 2026 postseason brackets for MLB and WNBA, series by series, with Eastern game times and the next home games. MLB: Wild Card Series. WNBA: First Round.',
  });
});

test('HUB, one league finished and one playing: the description is about the one playing', () => {
  const c = hubCopy(2025, ROUTES, [okState(view(FIXTURE.mlbMixed, MIXED_AT)), okState(view(FIXTURE.wnbaFinal, MIXED_AT))]);
  assert.equal(c.description, 'The 2025 postseason brackets for MLB, series by series, with Eastern game times and the next home games. MLB: Division Series.');
});

test('HUB, finished: complete, with no round and no next game', () => {
  const c = hubCopy(2025, ROUTES, [okState(view(FIXTURE.mlbFinal, FINAL_AT)), okState(view(FIXTURE.wnbaFinal, FINAL_AT))]);
  assert.equal(c.description, 'The 2025 MLB and WNBA postseason is complete. The final brackets, round by round, with each champion.');
  assert.equal(hubCopy(2025, ROUTES, [okState(view(FIXTURE.mlbFinal, FINAL_AT))]).description, 'The 2025 MLB postseason is complete. The final bracket, round by round, with each champion.');
});

test('HUB, offseason: says so, and promises no date', () => {
  const c = hubCopy(2026, ROUTES, []);
  assert.equal(c.description, "No postseason is underway. The MLB and WNBA brackets appear here once each league's postseason begins.");
  assert.equal(c.title, '2026 Playoffs: MLB and WNBA Brackets');
  assert.ok(!/\d/.test(c.description));
});

test('HUB: there is no "could not be read" state; the type admits only a rendered league', () => {
  // A read that fails throws before the head is written, so the copy has
  // exactly three branches: playing, complete, and no bracket at all.
  const states: HubLeagueState[] = [okState(view(FIXTURE.mlbFinal, FINAL_AT))];
  assert.equal(hubCopy(2025, ROUTES, states).description, 'The 2025 MLB postseason is complete. The final bracket, round by round, with each champion.');
  assert.ok(hubCopy(2026, ROUTES, []).description.startsWith('No postseason is underway.'));
});

test('every title fits the audit, and every string is sound', () => {
  const copies = [
    leagueCopy(2026, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbFields, FIELDS_AT)),
    leagueCopy(2026, 'WNBA', '/playoffs/wnba', view(FIXTURE.wnbaFields, FIELDS_AT)),
    leagueCopy(2025, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbMixed, MIXED_AT)),
    leagueCopy(2025, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbFinal, FINAL_AT)),
    leagueCopy(2025, 'WNBA', '/playoffs/wnba', view(FIXTURE.wnbaFinal, FINAL_AT)),
    leagueCopy(2026, 'WNBA', '/playoffs/wnba', null),
    hubCopy(2026, ROUTES, [okState(view(FIXTURE.mlbFields, FIELDS_AT)), okState(view(FIXTURE.wnbaFields, FIELDS_AT))]),
    hubCopy(2025, ROUTES, [okState(view(FIXTURE.mlbFinal, FINAL_AT)), okState(view(FIXTURE.wnbaFinal, FINAL_AT))]),
    hubCopy(2026, ROUTES, []),
  ];
  for (const c of copies) {
    assert.ok((c.title + SUFFIX).length <= 65, `${c.title}: ${(c.title + SUFFIX).length} characters with the suffix`);
    assert.ok(c.description.length <= 160, `${c.description.length}: ${c.description}`);
    assert.match(c.canonical, /^https:\/\/www\.getpromonight\.com\/playoffs(\/(mlb|wnba))?$/);
    sound(c.title, 'title');
    sound(c.description, 'description');
  }
});

test('no round of either league pushes a description past 160 characters', () => {
  const MLB_ROUNDS = ['Wild Card Series', 'Division Series', 'Championship Series', 'World Series'];
  const WNBA_ROUNDS = ['First Round', 'Semifinals', 'WNBA Finals'];
  const base = { MLB: view(FIXTURE.mlbFields, FIELDS_AT), WNBA: view(FIXTURE.wnbaFields, FIELDS_AT) };
  const inRound = (league: 'MLB' | 'WNBA', roundLabel: string): LeagueView => {
    const v = base[league];
    assert.equal(v.phase.kind, 'active');
    return { ...v, phase: { ...v.phase, roundLabel } as LeagueView['phase'] };
  };
  let longest = 0;
  for (const m of MLB_ROUNDS) {
    const one = leagueCopy(2026, 'MLB', '/playoffs/mlb', inRound('MLB', m)).description;
    assert.ok(one.length <= 160, `${one.length}: ${one}`);
    for (const w of WNBA_ROUNDS) {
      const both = hubCopy(2026, ROUTES, [okState(inRound('MLB', m)), okState(inRound('WNBA', w))]).description;
      assert.ok(both.length <= 160, `${both.length}: ${both}`);
      longest = Math.max(longest, both.length, one.length);
    }
  }
  for (const w of WNBA_ROUNDS) {
    const one = leagueCopy(2026, 'WNBA', '/playoffs/wnba', inRound('WNBA', w)).description;
    assert.ok(one.length <= 160, `${one.length}: ${one}`);
  }
  assert.ok(longest > 140, 'the enumeration reached the long labels');
});

test('JSON-LD: a WebPage and a BreadcrumbList, and no Event of any kind', () => {
  const v = view(FIXTURE.mlbFields, FIELDS_AT);
  const copy = leagueCopy(2026, 'MLB', '/playoffs/mlb', v);
  const schemas = leagueJsonLd(copy, 'MLB', v.updatedAt);
  assert.deepEqual(schemas.map((s) => s['@type']), ['WebPage', 'BreadcrumbList']);
  assert.deepEqual(schemas[0], {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.title,
    description: copy.description,
    url: 'https://www.getpromonight.com/playoffs/mlb',
    isPartOf: { '@type': 'WebSite', name: 'PromoNight', url: 'https://www.getpromonight.com' },
    dateModified: '2026-09-29T20:00:52.690Z',
  });
  assert.deepEqual(schemas[1], {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.getpromonight.com' },
      { '@type': 'ListItem', position: 2, name: 'Playoffs', item: 'https://www.getpromonight.com/playoffs' },
      { '@type': 'ListItem', position: 3, name: 'MLB', item: 'https://www.getpromonight.com/playoffs/mlb' },
    ],
  });
  const text = JSON.stringify(schemas);
  assert.ok(!/Event|SportsTeam|Offer|startDate|location/.test(text));
  assert.equal(seriesKeyIn(text), null);
});

test('JSON-LD: dateModified is the bracket\'s own change time, and absent when there is no bracket', () => {
  const none = leagueJsonLd(leagueCopy(2026, 'MLB', '/playoffs/mlb', null), 'MLB', null);
  assert.ok(!('dateModified' in none[0]), 'the render clock is not a modification date');
  const mlb = view(FIXTURE.mlbFields, FIELDS_AT);
  const wnba = view(FIXTURE.wnbaFields, FIELDS_AT);
  const hub = hubJsonLd(hubCopy(2026, ROUTES, [okState(mlb), okState(wnba)]), [mlb.updatedAt, wnba.updatedAt]);
  assert.deepEqual(hub.map((s) => s['@type']), ['WebPage', 'BreadcrumbList']);
  // The later of the two.
  assert.equal(hub[0].dateModified, '2026-09-29T20:00:52.690Z');
  assert.ok((mlb.updatedAt as string) > (wnba.updatedAt as string));
  assert.deepEqual((hub[1].itemListElement as { name: string }[]).map((i) => i.name), ['Home', 'Playoffs']);
  assert.ok(!('dateModified' in hubJsonLd(hubCopy(2026, ROUTES, []), [])[0]));
});

test('WITH PREDICTIONS: every round and the finished season stay within 160 characters, say "simulation", and never say "computer"', () => {
  const MLB_ROUNDS = ['Wild Card Series', 'Division Series', 'Championship Series', 'World Series'];
  const WNBA_ROUNDS = ['First Round', 'Semifinals', 'WNBA Finals'];
  const base = { MLB: view(FIXTURE.mlbFields, FIELDS_AT), WNBA: view(FIXTURE.wnbaFields, FIELDS_AT) };
  const inRound = (league: 'MLB' | 'WNBA', roundLabel: string): LeagueView => ({ ...base[league], phase: { ...base[league].phase, roundLabel } as LeagueView['phase'] });
  const all: { title: string; description: string }[] = [];
  for (const r of MLB_ROUNDS) all.push(leagueCopy(2026, 'MLB', '/playoffs/mlb', inRound('MLB', r), true));
  for (const r of WNBA_ROUNDS) all.push(leagueCopy(2026, 'WNBA', '/playoffs/wnba', inRound('WNBA', r), true));
  const doneMlb = leagueCopy(2025, 'MLB', '/playoffs/mlb', view(FIXTURE.mlbFinal, FINAL_AT), true);
  const doneWnba = leagueCopy(2025, 'WNBA', '/playoffs/wnba', view(FIXTURE.wnbaFinal, FINAL_AT), true);
  all.push(doneMlb, doneWnba);
  assert.equal(doneMlb.description, "The 2025 MLB postseason bracket, complete. Los Angeles Dodgers: won the World Series 4-3. Every series and result, and how the simulation's locked picks did.");
  for (const c of all) {
    assert.ok(c.description.length <= 160, `${c.description.length}: ${c.description}`);
    assert.ok(/simulation/.test(c.description), c.description);
    assert.ok(!/computer/i.test(c.title + c.description), c.description);
    assert.match(c.title, /Playoff Bracket and Predictions$/);
    sound(c.description, 'description');
  }
});

