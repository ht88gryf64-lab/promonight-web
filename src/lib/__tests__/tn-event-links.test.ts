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
  tnSubId,
  TN_SUBID_RE,
} from '../affiliates';
import { KNOWN_SURFACE_VALUES } from '../analytics';
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

// ── subId1 (ruling 2026-11-02, before merge) ────────────────────────────────

test('surface is a required argument: omitting it is a type error, not a default', () => {
  // Never called: the assertion is the @ts-expect-error, which tsc fails on if
  // surface ever becomes optional.
  const typeOnly = () =>
    // @ts-expect-error surface is required
    buildTicketNetworkLink({ team: STARS });
  assert.equal(typeof typeOnly, 'function');
});

test('tnSubId: {surface}_{slug}, lowercase, [a-z0-9_-] only, at most 64, the slug truncated', () => {
  assert.equal(tnSubId('web_promo_page', 'dallas-stars'), 'web_promo_page_dallas-stars');
  assert.equal(tnSubId('web_promo_date', 'Dallas Stars!'), 'web_promo_date_dallas-stars');
  assert.equal(tnSubId('web_venue', "levi's-stadium"), 'web_venue_levi-s-stadium');
  const long = tnSubId('web_promo_date', 'a'.repeat(100));
  assert.equal(long.length, 64);
  assert.ok(long.startsWith('web_promo_date_aaa'));
  assert.ok(!/[-_]$/.test(tnSubId('web_team_page', 'x'.repeat(48) + '-tail')));
});

test('every analytics surface and web_promo_date yields a valid subId1, even with a long or odd slug', () => {
  for (const surface of [...KNOWN_SURFACE_VALUES, 'web_promo_date' as const]) {
    for (const slug of ['dallas-stars', 'St. Louis Blues', 'z'.repeat(120)]) {
      const href = buildTicketNetworkLink({ team: { id: slug, ticketNetworkSlug: undefined } as never, surface }) as string;
      const sub = new URL(href).searchParams.get('subId1') as string;
      assert.match(sub, TN_SUBID_RE, `${surface} / ${slug}`);
      assert.ok(sub.startsWith(surface.slice(0, 64)), `${surface} / ${slug}`);
    }
  }
});

test('a venue hub keys on the building; an away row keeps its complete token, sanitised and capped', () => {
  const v = new URL(buildTicketNetworkLink({ team: STARS, surface: 'web_venue', venueSlug: 'canada-life-centre' }) as string);
  assert.equal(v.searchParams.get('subId1'), 'web_venue_canada-life-centre');
  const a = new URL(buildTicketNetworkLink({ team: STARS, surface: 'web_team_page', subKey: 'web_away_game_' + 'q'.repeat(80) }) as string);
  assert.match(a.searchParams.get('subId1') as string, TN_SUBID_RE);
});

test('the preview override accepts hyphens up to 64 characters', () => {
  assert.equal(tnSubIdOverride({ vercelEnv: 'preview', override: 'preview-tn_test' }), 'preview-tn_test');
  assert.equal(tnSubIdOverride({ vercelEnv: 'preview', override: 'p'.repeat(65) }), null);
});
