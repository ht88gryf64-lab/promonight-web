// Sub-ID unification contract (Gate 1 of the affiliate attribution fixes; see
// audit/affiliate-attribution-audit.md). Pins the four-partner token scheme:
//  - awayGameSubKey is the ONE source of the away-game token,
//    web_away_game_{pageTeamId}_at_{opponentId}, consumed verbatim by every
//    partner via the subKey override.
//  - Ticketmaster's SharedID carries the same full {surface}_{id} token the
//    other partners receive (it previously shipped the bare surface, which
//    collapsed whole page types into single partner-side buckets).
//  - resolveHotelLink no longer derives its own away pubref from gameDate.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// A realistic wrap template (shape only, not the production value): the env
// var must be set BEFORE the module loads because affiliates.ts reads it at
// module scope.
const WRAP =
  'https://ticketmaster.evyy.net/c/7236189/264167/4272?u={TARGET}&sharedid={SHARED_ID}';

type Affiliates = typeof import('../affiliates');
type HotelLink = typeof import('../hotel-link');
let affiliates: Affiliates;
let hotelLink: HotelLink;

before(async () => {
  process.env.NEXT_PUBLIC_TICKETMASTER_IMPACT_WRAP = WRAP;
  affiliates = await import('../affiliates');
  hotelLink = await import('../hotel-link');
});

const twins = { id: 'minnesota-twins', ticketNetworkSlug: undefined } as never;

describe('awayGameSubKey', () => {
  test('composes the compound page-team_at_opponent token', () => {
    assert.equal(
      affiliates.awayGameSubKey('minnesota-twins', 'san-diego-padres'),
      'web_away_game_minnesota-twins_at_san-diego-padres',
    );
  });
});

describe('buildTicketNetworkLink subId1', () => {
  test('defaults to {surface}_{team.id}', () => {
    const url = affiliates.buildTicketNetworkLink({ team: twins, surface: 'web_team_page' });
    assert.ok(url && url.endsWith('&subId1=web_team_page_minnesota-twins'));
  });

  test('venueSlug keys the building with no team suffix', () => {
    const url = affiliates.buildTicketNetworkLink({
      team: twins,
      surface: 'web_venue',
      venueSlug: 'target-field',
    });
    assert.ok(url && url.endsWith('&subId1=web_venue_target-field'));
  });

  test('subKey override wins verbatim (away rows)', () => {
    const url = affiliates.buildTicketNetworkLink({
      team: twins,
      surface: 'web_team_page',
      subKey: affiliates.awayGameSubKey('minnesota-twins', 'san-diego-padres'),
    });
    assert.ok(
      url && url.endsWith('&subId1=web_away_game_minnesota-twins_at_san-diego-padres'),
    );
  });
});

describe('buildTicketmasterUrl SharedID', () => {
  test('carries the FULL {surface}_{teamSlug} token, not the bare surface', () => {
    const url = affiliates.buildTicketmasterUrl({
      teamSlug: 'minnesota-twins',
      ticketmasterSlug: 'minnesota-twins',
      ticketmasterAttractionId: '805972',
      surface: 'web_team_page',
    });
    assert.ok(url.endsWith('&sharedid=web_team_page_minnesota-twins'));
  });

  test('venueSlug keys the building', () => {
    const url = affiliates.buildTicketmasterUrl({
      teamSlug: 'kansas-city-chiefs',
      surface: 'web_venue',
      venueSlug: 'arrowhead-stadium',
    });
    assert.ok(url.endsWith('&sharedid=web_venue_arrowhead-stadium'));
  });

  test('subKey override wins verbatim and is encoded into the SharedID slot', () => {
    const url = affiliates.buildTicketmasterUrl({
      teamSlug: 'minnesota-twins',
      surface: 'web_team_page',
      subKey: 'web_away_game_minnesota-twins_at_san-diego-padres',
    });
    assert.ok(url.endsWith('&sharedid=web_away_game_minnesota-twins_at_san-diego-padres'));
  });
});

describe('resolveHotelLink pubref', () => {
  const team = {
    id: 'minnesota-twins',
    city: 'Minneapolis',
    name: 'Twins',
  } as never;

  test('defaults to {surface}_{team.id}', () => {
    const link = hotelLink.resolveHotelLink({ team, surface: 'web_team_page' });
    assert.ok(link && link.href.endsWith('&pubref=web_team_page_minnesota-twins'));
  });

  test('gameDate alone no longer flips the pubref (dating is search-only)', () => {
    const link = hotelLink.resolveHotelLink({
      team,
      surface: 'web_team_page',
      gameDate: '2026-08-21',
    });
    assert.ok(link && link.href.endsWith('&pubref=web_team_page_minnesota-twins'));
    assert.equal(link.checkIn, '2026-08-21');
    assert.equal(link.checkOut, '2026-08-22');
  });

  test('subKey override wins verbatim (away rows pass the compound token)', () => {
    const link = hotelLink.resolveHotelLink({
      team,
      surface: 'web_team_page',
      gameDate: '2026-08-21',
      subKey: 'web_away_game_minnesota-twins_at_san-diego-padres',
    });
    assert.ok(
      link &&
        link.href.endsWith('&pubref=web_away_game_minnesota-twins_at_san-diego-padres'),
    );
  });
});
