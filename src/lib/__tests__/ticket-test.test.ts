// STUBHUB vs TICKETNETWORK CROSSOVER TEST (decided design 2026-11-25;
// src/config/ticket-test.ts, src/lib/ticket-test.ts, src/lib/ticket-test-pairing.ts).
// The resolver, the pairing's determinism, the Partnerize link's encoding, the
// fallback, the always-StubHub clubs and the boundary fan-out.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test <this file>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKET_TEST, TICKET_TEST_PAIRS, TICKET_TEST_RANKING, type TicketTestLeague } from '@/config/ticket-test';
import { generatePairs, rankForPairing } from '@/lib/ticket-test-pairing';
import {
  PUBREF_RE,
  STUBHUB,
  TICKET_TEST_NOTE,
  buildStubHubLink,
  isTicketTestOn,
  pickTestTicketLink,
  resolveTicketTest,
  stubHubEventUrlFor,
  stubHubPubref,
  ticketTestBoundary,
  ticketTestClickProps,
  ticketTestPhase,
  ticketTestPromoPaths,
  ticketTestTeamIds,
} from '@/lib/ticket-test';

const LEAGUES: TicketTestLeague[] = ['nba', 'nhl', 'nfl'];
const HEAT_URL = 'https://www.stubhub.com/miami-heat-miami-tickets-12-3-2026/event/161666863/';
const A_DAY = TICKET_TEST.startDate;
const B_DAY = TICKET_TEST.flipDate;

// ── the switch and the dates ─────────────────────────────────────────────────

test('the switch is off unless the variable is exactly "true", and off means no team resolves', () => {
  assert.equal(isTicketTestOn(undefined), false);
  assert.equal(isTicketTestOn(''), false);
  assert.equal(isTicketTestOn('TRUE'), false);
  assert.equal(isTicketTestOn('true'), true);
  assert.equal(resolveTicketTest('miami-heat', A_DAY, false), null);
  // The default reads the environment, which no test or build sets.
  assert.equal(resolveTicketTest('miami-heat', A_DAY), null);
});

test('dates: 30 days of phase A, 30 of phase B, nothing before the start or from the end on', () => {
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  assert.equal(days(TICKET_TEST.startDate, TICKET_TEST.flipDate), 30);
  assert.equal(days(TICKET_TEST.flipDate, TICKET_TEST.endDate), 30);
  const cfg = { startDate: '2026-12-01', flipDate: '2026-12-31', endDate: '2027-01-30' };
  assert.equal(ticketTestPhase('2026-11-30', cfg), null);
  assert.equal(ticketTestPhase('2026-12-01', cfg), 'a');
  assert.equal(ticketTestPhase('2026-12-30', cfg), 'a');
  assert.equal(ticketTestPhase('2026-12-31', cfg), 'b');
  assert.equal(ticketTestPhase('2027-01-29', cfg), 'b');
  assert.equal(ticketTestPhase('2027-01-30', cfg), null);
  assert.equal(ticketTestPhase('not-a-date', cfg), null);
});

// ── pairing ──────────────────────────────────────────────────────────────────

test('pairing is deterministic: the same ranking and seed give the config literal, twice', () => {
  for (const lg of LEAGUES) {
    const once = generatePairs(lg, TICKET_TEST_RANKING[lg], TICKET_TEST.seed);
    const twice = generatePairs(lg, TICKET_TEST_RANKING[lg], TICKET_TEST.seed);
    assert.deepEqual(once, twice);
    assert.deepEqual(once, TICKET_TEST_PAIRS[lg], `${lg}: the literal in src/config/ticket-test.ts is not what the generator gives`);
  }
  // Another seed moves at least one flip, so the seed is really read.
  const other = LEAGUES.flatMap((lg) => generatePairs(lg, TICKET_TEST_RANKING[lg], 'another-seed'));
  assert.notDeepEqual(other, LEAGUES.flatMap((lg) => [...TICKET_TEST_PAIRS[lg]]));
});

test('pairing: neighbors in click order, one of each arm per pair, zero-click clubs last and alphabetical, the odd club alone', () => {
  assert.deepEqual(TICKET_TEST_PAIRS.nba[0].teams.map((t) => t.team), ['portland-trail-blazers', 'san-antonio-spurs']);
  assert.deepEqual(TICKET_TEST_PAIRS.nhl[0].teams.map((t) => t.team), ['minnesota-wild', 'detroit-red-wings']);
  assert.deepEqual(TICKET_TEST_PAIRS.nfl[0].teams.map((t) => t.team), ['chicago-bears', 'denver-broncos']);
  for (const lg of LEAGUES) {
    for (const p of TICKET_TEST_PAIRS[lg]) {
      if (p.teams.length === 2) assert.deepEqual(p.teams.map((t) => t.arm).sort(), ['stubhub_first', 'ticketnetwork_first'], p.pairId);
    }
  }
  assert.deepEqual([TICKET_TEST_PAIRS.nba.length, TICKET_TEST_PAIRS.nhl.length, TICKET_TEST_PAIRS.nfl.length], [15, 15, 16]);
  assert.deepEqual(TICKET_TEST_PAIRS.nba[14].teams.map((t) => t.team), ['washington-wizards'], 'NBA has 29 paired clubs: the last is its own pair');
  assert.deepEqual(rankForPairing(TICKET_TEST_RANKING.nfl).slice(-4).map((r) => r.team), ['cleveland-browns', 'green-bay-packers', 'los-angeles-rams', 'new-orleans-saints']);
  assert.equal(rankForPairing(TICKET_TEST_RANKING.nhl).at(-1)?.team, 'utah-hockey-club');
  // A tie keeps the snapshot's order: knicks (24) before nets (24).
  const nba = rankForPairing(TICKET_TEST_RANKING.nba).map((r) => r.team);
  assert.ok(nba.indexOf('new-york-knicks') < nba.indexOf('brooklyn-nets'));
});

test('scope: 91 paired clubs in NBA, NHL and NFL, no club twice, no MLB, MLS or WNBA club, the Ontario clubs outside the pairs', () => {
  const paired = LEAGUES.flatMap((lg) => TICKET_TEST_PAIRS[lg].flatMap((p) => p.teams.map((t) => t.team)));
  assert.equal(paired.length, 29 + 30 + 32);
  assert.equal(new Set(paired).size, paired.length);
  for (const id of TICKET_TEST.alwaysStubHub) assert.ok(!paired.includes(id), id);
  assert.deepEqual([...TICKET_TEST.leagues], ['nba', 'nhl', 'nfl']);
  assert.equal(ticketTestTeamIds().length, 94);
  for (const id of ['minnesota-twins', 'minnesota-united', 'minnesota-lynx', 'ohio-state']) assert.equal(resolveTicketTest(id, A_DAY, true), null, id);
});

// ── the resolver ─────────────────────────────────────────────────────────────

test('resolver: a club shows its arm in phase A and the other partner in phase B; its pair mate is always on the other one', () => {
  for (const lg of LEAGUES) {
    for (const p of TICKET_TEST_PAIRS[lg]) {
      for (const t of p.teams) {
        const a = resolveTicketTest(t.team, A_DAY, true);
        const b = resolveTicketTest(t.team, B_DAY, true);
        assert.ok(a && b, t.team);
        assert.equal(a.partner, t.arm === 'stubhub_first' ? 'stubhub' : 'ticketnetwork', t.team);
        assert.notEqual(a.partner, b.partner, `${t.team} swaps at the flip`);
        assert.deepEqual([a.phase, b.phase, a.pairId, a.arm, a.league], ['a', 'b', p.pairId, t.arm, lg]);
        assert.deepEqual([a.pubref, b.pubref], [`web-${lg}-a`, `web-${lg}-b`]);
      }
      if (p.teams.length === 2) {
        for (const day of [A_DAY, B_DAY]) {
          const [x, y] = p.teams.map((t) => resolveTicketTest(t.team, day, true)!.partner);
          assert.notEqual(x, y, `${p.pairId} on ${day}`);
        }
      }
    }
  }
});

test('resolver: outside the dates nothing resolves, switch on or not', () => {
  const before = '2000-01-01';
  assert.equal(resolveTicketTest('miami-heat', before, true), null);
  assert.equal(resolveTicketTest('miami-heat', TICKET_TEST.endDate, true), null);
  assert.equal(resolveTicketTest('toronto-raptors', TICKET_TEST.endDate, true), null);
});

test('Ontario clubs: always StubHub in both phases, outside the pairs', () => {
  for (const [id, lg] of [['ottawa-senators', 'nhl'], ['toronto-maple-leafs', 'nhl'], ['toronto-raptors', 'nba']] as const) {
    for (const [day, phase] of [[A_DAY, 'a'], [B_DAY, 'b']] as const) {
      assert.deepEqual(resolveTicketTest(id, day, true), { partner: 'stubhub', phase, pairId: 'fixed', arm: 'fixed_stubhub', league: lg, pubref: `web-${lg}-${phase}` });
    }
  }
});

// ── the link ─────────────────────────────────────────────────────────────────

test('link: camref, pubref, destination last; the destination encoded once and nothing appended', () => {
  const link = buildStubHubLink({ eventUrl: HEAT_URL, pubref: 'web-nba-a' });
  assert.equal(link, 'https://stubhub.prf.hn/click/camref:1101l6zbdB/pubref:web-nba-a/destination:https%3A%2F%2Fwww.stubhub.com%2Fmiami-heat-miami-tickets-12-3-2026%2Fevent%2F161666863%2F');
  assert.ok(link!.startsWith(`${STUBHUB.clickBase}/camref:${STUBHUB.camref}/pubref:`));
  const [, dest] = link!.split('/destination:');
  assert.equal(decodeURIComponent(dest), HEAT_URL);
  assert.doesNotMatch(dest, /[?&#/]/, 'the encoded destination is the last thing in the link');
  assert.doesNotMatch(link!, /utm_|subId|[?&]/i);
});

test('link: only a StubHub event page is a destination, only a clean pubref is sent', () => {
  for (const bad of [null, undefined, '', `${HEAT_URL}?quantity=2`, `${HEAT_URL}#x`, 'https://www.stubhub.com/miami-heat-tickets', 'http://www.stubhub.com/miami-heat-miami-tickets-12-3-2026/event/161666863/', 'https://stubhub.evil.example/miami-heat-miami-tickets-12-3-2026/event/1/', 'https://www.stubhub.com/miami-heat-miami-tickets-12-3-2026/event/0/', 'https://www.ticketnetwork.com/tickets/8205881']) {
    assert.equal(buildStubHubLink({ eventUrl: bad as string, pubref: 'web-nba-a' }), null, String(bad));
  }
  for (const bad of ['', 'web_nba_a', 'Web-NBA-A', 'web-nba-a/destination:x', 'web nba']) assert.equal(buildStubHubLink({ eventUrl: HEAT_URL, pubref: bad }), null, bad);
  assert.equal(stubHubPubref('web', 'nba', 'a'), 'web-nba-a');
  assert.equal(stubHubPubref('app-ios', 'NHL', 'b'), 'app-ios-nhl-b');
  for (const s of ['web', 'app-ios', 'app-android', 'email'] as const) assert.match(stubHubPubref(s, 'nfl', 'a'), PUBREF_RE);
});

test('stored event: a link only when the id is the URL\'s, and shEventDate, the URL\'s date and the game\'s date are one day', () => {
  const doc = { shEventUrl: HEAT_URL, shEventId: 161666863, shEventDate: '2026-12-03' };
  assert.equal(stubHubEventUrlFor(doc, '2026-12-03'), HEAT_URL);
  assert.equal(stubHubEventUrlFor(doc, '2026-12-04'), null, 'the game moved');
  assert.equal(stubHubEventUrlFor({ ...doc, shEventDate: '2026-12-04' }, '2026-12-04'), null, 'the stored date is not the URL\'s');
  assert.equal(stubHubEventUrlFor({ ...doc, shEventId: 161666864 }, '2026-12-03'), null);
  assert.equal(stubHubEventUrlFor({ ...doc, shEventId: '161666863' }, '2026-12-03'), null);
  assert.equal(stubHubEventUrlFor({ ...doc, shEventDate: undefined }, '2026-12-03'), null);
  assert.equal(stubHubEventUrlFor({ ...doc, shEventUrl: `${HEAT_URL}?a=1` }, '2026-12-03'), null);
  assert.equal(stubHubEventUrlFor({}, '2026-12-03'), null);
});

// ── the fallback ─────────────────────────────────────────────────────────────

test('fallback: a StubHub day without a matched event carries the TicketNetwork link and says so', () => {
  const sh = resolveTicketTest('toronto-raptors', A_DAY, true)!;
  const tn = 'https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=x';
  const tm = 'https://www.ticketmaster.com/x-tickets';
  const hit = pickTestTicketLink(sh, { stubHubEventUrl: HEAT_URL, ticketNetwork: tn, ticketmaster: tm })!;
  assert.deepEqual([hit.partner, hit.fallback], ['stubhub', false]);
  assert.deepEqual(ticketTestClickProps(sh, hit), { in_test: true, test_arm: 'fixed_stubhub', test_pair_id: 'fixed', test_phase: 'a', pubref: 'web-nba-a', fallback: false });
  const miss = pickTestTicketLink(sh, { stubHubEventUrl: null, ticketNetwork: tn, ticketmaster: tm })!;
  assert.deepEqual(miss, { partner: 'ticketnetwork', href: tn, fallback: true });
  assert.deepEqual(ticketTestClickProps(sh, miss), { in_test: true, test_arm: 'fixed_stubhub', test_pair_id: 'fixed', test_phase: 'a', pubref: null, fallback: true });
  // A club TicketNetwork does not list has no TicketNetwork link to fall back to.
  assert.deepEqual(pickTestTicketLink(sh, { stubHubEventUrl: null, ticketNetwork: null, ticketmaster: tm }), { partner: 'ticketmaster', href: tm, fallback: true });
  assert.equal(pickTestTicketLink(sh, { stubHubEventUrl: null, ticketNetwork: null, ticketmaster: null }), null);
  // A bad stored URL is a miss, never a link.
  assert.equal(pickTestTicketLink(sh, { stubHubEventUrl: `${HEAT_URL}?x=1`, ticketNetwork: tn, ticketmaster: tm })!.partner, 'ticketnetwork');
});

test('TicketNetwork day: the TicketNetwork link as it was, never a StubHub link even when an event is stored', () => {
  const club = TICKET_TEST_PAIRS.nba[0].teams.find((t) => t.arm === 'ticketnetwork_first')!.team;
  const tnDay = resolveTicketTest(club, A_DAY, true)!;
  assert.equal(tnDay.partner, 'ticketnetwork');
  const link = pickTestTicketLink(tnDay, { stubHubEventUrl: HEAT_URL, ticketNetwork: 'https://tn.example/x', ticketmaster: 'https://tm.example/x' })!;
  assert.deepEqual(link, { partner: 'ticketnetwork', href: 'https://tn.example/x', fallback: false });
  assert.equal(ticketTestClickProps(tnDay, link).pubref, null);
});

// ── the boundary fan-out and the copy ────────────────────────────────────────

test('boundary: the start, the flip and the end are boundary days only while the switch is on', () => {
  assert.equal(ticketTestBoundary(TICKET_TEST.startDate, true), 'start');
  assert.equal(ticketTestBoundary(TICKET_TEST.flipDate, true), 'flip');
  assert.equal(ticketTestBoundary(TICKET_TEST.endDate, true), 'end');
  assert.equal(ticketTestBoundary('2026-12-15', true), null);
  assert.equal(ticketTestBoundary(TICKET_TEST.flipDate, false), null);
});

test('boundary paths: every promo page of a test club once, no page of any other club', () => {
  const index = [
    { teamId: 'miami-heat', pageSlug: 'bobblehead-night' },
    { teamId: 'miami-heat', pageSlug: 'bobblehead-night' },
    { teamId: 'toronto-raptors', pageSlug: 'kids-day' },
    { teamId: 'minnesota-twins', pageSlug: 'hat-night' },
    { teamId: 'chicago-bears', pageSlug: '' },
  ];
  const sportOf = new Map([['miami-heat', 'nba'], ['toronto-raptors', 'nba'], ['minnesota-twins', 'mlb'], ['chicago-bears', 'nfl']]);
  assert.deepEqual(ticketTestPromoPaths(index, sportOf, (s, t, p) => `/${s}/${t}/promos/${p}`), ['/nba/miami-heat/promos/bobblehead-night', '/nba/toronto-raptors/promos/kids-day']);
});

test('the line under the button: the ruled sentence, no partner name, no price, no long dash', () => {
  assert.equal(TICKET_TEST_NOTE, 'PromoNight may earn a commission on ticket purchases made through these links. Resale prices may differ from face value.');
  assert.doesNotMatch(TICKET_TEST_NOTE, /StubHub|TicketNetwork|Ticketmaster|\$|\u2014|\u2013/);
});
