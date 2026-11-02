// TicketNetwork event-level links (feature/tn-event-links, rulings 2026-11-02):
// the builder wraps a game's event page when the pipeline matched one and the
// team performer page otherwise; the promo join hands a row its game's event
// only when exactly one live home game sits on the date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTicketNetworkLink,
  isTicketNetworkEventUrl,
  ticketNetworkLinkLevel,
  ticketNetworkLandingUrl,
  tnSubIdOverride,
} from '../affiliates';
import { buildGameIndex, resolveTnEventUrl } from '../promo-game-join';
import type { Game } from '../types';

const STARS = { id: 'dallas-stars', ticketNetworkSlug: undefined } as never;
const EVENT = 'https://www.ticketnetwork.com/tickets/8139510/dallas-stars-vs-florida-panthers-tickets-sun-nov-15-2026-american-airlines-center';
const PREFIX = 'https://ticketnetwork.lusg.net/c/7236189/120057/2322';

test('an event URL is wrapped unchanged, subId1 web_promo_page_{team}', () => {
  const href = buildTicketNetworkLink({ team: STARS, surface: 'web_promo_page', eventUrl: EVENT });
  assert.equal(
    href,
    `${PREFIX}?u=${encodeURIComponent(EVENT)}&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_dallas-stars`,
  );
  assert.equal(new URL(href as string).searchParams.get('u'), EVENT);
});

test('no event URL, or one that is not a TicketNetwork event page: the performer page, byte for byte as before', () => {
  const before = `${PREFIX}?u=${encodeURIComponent('https://www.ticketnetwork.com/e/performers/dallas-stars-tickets')}&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_team_page_dallas-stars`;
  assert.equal(buildTicketNetworkLink({ team: STARS, surface: 'web_team_page' }), before);
  for (const bad of [null, '', 'https://evil.example/tickets/1/x', 'http://www.ticketnetwork.com/tickets/1/x', 'https://www.ticketnetwork.com/performers/x-tickets', 'https://www.ticketnetwork.com/tickets/abc/x']) {
    assert.equal(buildTicketNetworkLink({ team: STARS, surface: 'web_team_page', eventUrl: bad }), before, String(bad));
  }
  assert.equal(ticketNetworkLandingUrl(STARS), 'https://www.ticketnetwork.com/e/performers/dallas-stars-tickets');
});

test('the away-game and venue sub-IDs are untouched by an event URL', () => {
  const href = buildTicketNetworkLink({ team: STARS, surface: 'web_team_page', subKey: 'web_away_game_dallas-stars_at_x', eventUrl: EVENT }) as string;
  assert.ok(href.endsWith('&subId1=web_away_game_dallas-stars_at_x'));
});

test("an apostrophe in a TicketNetwork slug is a valid event URL (Levi's Stadium)", () => {
  assert.ok(isTicketNetworkEventUrl("https://www.ticketnetwork.com/tickets/7730388/san-francisco-49ers-vs-las-vegas-raiders-tickets-sun-nov-8-2026-levi's-stadium"));
});

test('ticketNetworkLinkLevel', () => {
  assert.equal(ticketNetworkLinkLevel(EVENT), 'event');
  assert.equal(ticketNetworkLinkLevel(null), 'team');
  assert.equal(ticketNetworkLinkLevel('https://www.ticketnetwork.com/e/performers/dallas-stars-tickets'), 'team');
});

test('the preview subId override applies on a preview build only', () => {
  assert.equal(tnSubIdOverride({ vercelEnv: 'preview', override: 'preview_tn_test' }), 'preview_tn_test');
  assert.equal(tnSubIdOverride({ vercelEnv: 'production', override: 'preview_tn_test' }), null);
  assert.equal(tnSubIdOverride({ vercelEnv: undefined, override: 'preview_tn_test' }), null);
  assert.equal(tnSubIdOverride({ vercelEnv: 'preview', override: '' }), null);
  assert.equal(tnSubIdOverride({ vercelEnv: 'preview', override: 'x&subId2=y' }), null);
});

test('the build under test carries no override (tests run as neither preview nor with the variable)', () => {
  assert.ok((buildTicketNetworkLink({ team: STARS, surface: 'web_promo_page' }) as string).endsWith('subId1=web_promo_page_dallas-stars'));
});

const g = (over: Partial<Game>): Game => ({ id: 'g', league: 'nhl', date: '2026-11-15', gameTime: '01:00', gameTimeTz: 'America/Chicago', homeTeamSlug: 'dallas-stars', awayTeamSlug: 'florida-panthers', venueName: 'American Airlines Center', status: 'scheduled', ...over }) as Game;
const promo = { date: '2026-11-15', team: { id: 'dallas-stars', sportSlug: 'nhl' } };

test("resolveTnEventUrl: the one live home game's event", () => {
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({ tnEventUrl: EVENT })])), EVENT);
});

test('resolveTnEventUrl: unmatched, two games on the date, postponed, or a bad value -> null', () => {
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({})])), null);
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({ tnEventUrl: EVENT }), g({ id: 'g2', tnEventUrl: EVENT })])), null);
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({ tnEventUrl: EVENT, status: 'postponed' })])), null);
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({ tnEventUrl: 'https://x.example/tickets/1/a' })])), null);
  // A postponed twin does not make the live game ambiguous.
  assert.equal(resolveTnEventUrl(promo, buildGameIndex([g({ tnEventUrl: EVENT }), g({ id: 'g2', status: 'postponed' })])), EVENT);
});
