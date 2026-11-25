// StubHub vs TicketNetwork crossover test: the CLIENT-SAFE half (decided
// design 2026-11-25). Types, the switch, the ONE StubHub link builder and the
// pick of which link a ticket control carries. Strings only: no config, no
// pairs, no clock. The resolver and the config live in src/lib/ticket-test.ts,
// which is server-only, so the seed, the dates, the pairs and the click counts
// never enter a client bundle (review 2026-11-25). A client component gets the
// server's resolution as plain data (TicketTestProvider) and imports this file.
//
// COMMITMENTS TO STUBHUB. A StubHub link is a Partnerize deep link and nothing
// else; the destination is a StubHub event page, last, URL-encoded, with no
// added parameter; no price is shown; the disclosure sits under the button.
import type { TicketTestArm } from './ticket-test-pairing';

export type TicketTestLeague = 'nba' | 'nhl' | 'nfl';

export type TicketTestPartner = 'stubhub' | 'ticketnetwork';
export type TicketTestPhase = 'a' | 'b';

/** What the test says about one team on one site day. Plain data: it crosses
 *  into client components as a prop. */
export interface TicketTestResolution {
  /** The partner this team's ticket buttons use today. */
  partner: TicketTestPartner;
  phase: TicketTestPhase;
  /** "{league}-{nn}", or "fixed" for a club that is always StubHub. */
  pairId: string;
  /** The club's sequence, or "fixed_stubhub" outside the pairs. */
  arm: TicketTestArm | 'fixed_stubhub';
  league: TicketTestLeague;
  /** The Partnerize pubref of this team's StubHub links: web-{league}-{phase}. */
  pubref: string;
}

/** The switch, default OFF. A literal process.env read, so Next inlines the
 *  same value into the server render and the client bundle. */
export function isTicketTestOn(value: string | undefined = process.env.NEXT_PUBLIC_TICKET_TEST): boolean {
  return value === 'true';
}

export const PUBREF_RE = /^[a-z0-9-]+$/;
export type StubHubPubrefSurface = 'web' | 'app-ios' | 'app-android' | 'email';

/** {surface}-{league}-{phase}: lowercase letters, digits and hyphens only. */
export function stubHubPubref(surface: StubHubPubrefSurface, league: string, phase: TicketTestPhase): string {
  return `${surface}-${league}-${phase}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

// ── StubHub (Partnerize) ─────────────────────────────────────────────────────
// https://stubhub.prf.hn/click/camref:{camref}/pubref:{pubref}/destination:{encoded event URL}
// Order matters: camref, pubref, destination LAST. The destination is encoded
// once and carries no UTM or other added parameter. The prebuild guard
// (scripts/verify-affiliate-tracking.ts) pins both constants.
export const STUBHUB = {
  clickBase: 'https://stubhub.prf.hn/click',
  camref: '1101l6zbdB',
} as const;

// https://www.stubhub.com/{home-team}-{city}-tickets-{M-D-YYYY}/event/{eventId}/
// exactly as the pipeline stores it (games.shEventUrl): no query, no fragment.
const SH_EVENT_URL_RE = /^https:\/\/www\.stubhub\.com\/[a-z0-9-]+-tickets-(\d{1,2})-(\d{1,2})-(\d{4})\/event\/([1-9]\d*)\/$/;

export function isStubHubEventUrl(u: unknown): u is string {
  return typeof u === 'string' && SH_EVENT_URL_RE.test(u);
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The stored StubHub event page FOR THIS DATE, or null. Same strictness as
 *  tnEventDate: the id must be a positive integer and the one in the URL, and
 *  shEventDate must be a real YYYY-MM-DD equal to the game's date and to the
 *  date in the URL's own slug. Anything else links nothing. */
export function stubHubEventUrlFor(d: { shEventUrl?: unknown; shEventId?: unknown; shEventDate?: unknown }, gameDate: string): string | null {
  if (typeof d.shEventId !== 'number' || !Number.isSafeInteger(d.shEventId) || d.shEventId <= 0) return null;
  if (typeof d.shEventDate !== 'string' || !YMD_RE.test(d.shEventDate) || d.shEventDate !== gameDate) return null;
  if (typeof d.shEventUrl !== 'string') return null;
  const m = SH_EVENT_URL_RE.exec(d.shEventUrl);
  if (!m || Number(m[4]) !== d.shEventId) return null;
  const slugDate = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return slugDate === gameDate ? d.shEventUrl : null;
}

/** The Partnerize deep link for one StubHub event page, or null when the
 *  destination is not a StubHub event URL or the pubref is not clean. */
export function buildStubHubLink(opts: { eventUrl: string | null | undefined; pubref: string }): string | null {
  if (!isStubHubEventUrl(opts.eventUrl)) return null;
  if (!PUBREF_RE.test(opts.pubref)) return null;
  return `${STUBHUB.clickBase}/camref:${STUBHUB.camref}/pubref:${opts.pubref}/destination:${encodeURIComponent(opts.eventUrl)}`;
}

/** What one ticket control on a test team's page links to. `fallback` is true
 *  only when the team is on StubHub today and this control has no matched
 *  StubHub event, so it carries the TicketNetwork link (or, for a club
 *  TicketNetwork does not list, the Ticketmaster link) instead. */
export interface TestTicketLink {
  partner: 'stubhub' | 'ticketnetwork' | 'ticketmaster';
  href: string;
  fallback: boolean;
}

export function pickTestTicketLink(
  test: TicketTestResolution,
  links: { stubHubEventUrl?: string | null; ticketNetwork: string | null; ticketmaster: string | null },
): TestTicketLink | null {
  if (test.partner === 'stubhub') {
    const sh = buildStubHubLink({ eventUrl: links.stubHubEventUrl, pubref: test.pubref });
    if (sh) return { partner: 'stubhub', href: sh, fallback: false };
    if (links.ticketNetwork) return { partner: 'ticketnetwork', href: links.ticketNetwork, fallback: true };
    return links.ticketmaster ? { partner: 'ticketmaster', href: links.ticketmaster, fallback: true } : null;
  }
  if (links.ticketNetwork) return { partner: 'ticketnetwork', href: links.ticketNetwork, fallback: false };
  // A TicketNetwork day whose control never had a TicketNetwork link (an away
  // row at a building TicketNetwork does not list): Ticketmaster, as before
  // the test. Not a fallback: `fallback` means a StubHub day without an event.
  return links.ticketmaster ? { partner: 'ticketmaster', href: links.ticketmaster, fallback: false } : null;
}

/** The affiliate_click properties of a ticket click on a test surface. */
export interface TicketTestClickProps {
  in_test: true;
  test_arm: string;
  test_pair_id: string;
  test_phase: TicketTestPhase;
  pubref: string | null;
  fallback: boolean;
}

export function ticketTestClickProps(test: TicketTestResolution, link: TestTicketLink): TicketTestClickProps {
  return { in_test: true, test_arm: test.arm, test_pair_id: test.pairId, test_phase: test.phase, pubref: link.partner === 'stubhub' ? test.pubref : null, fallback: link.fallback };
}

// The one line under a test team's ticket button lives with every other
// ticket button's words, in src/lib/ticket-labels.ts (TICKET_TEST_NOTE).
export { TICKET_TEST_NOTE } from './ticket-labels';
