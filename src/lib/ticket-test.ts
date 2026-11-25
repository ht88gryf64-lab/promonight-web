// StubHub vs TicketNetwork crossover test: the ONE resolver and the ONE
// StubHub link builder (decided design 2026-11-25). Pure and client-safe:
// strings and the config only, no clock read. Every caller passes the site
// day it already holds (the server's one clock read); a client component
// never resolves on its own clock: the server resolves and hands the result
// down (TicketTestProvider).
//
// SCOPE (Gate 0 ruling 2). The test covers a test team's OWN pages: its team
// page (sidebar card, every schedule row, away rows included) and its promo
// pages. Every multi-team page (/promos/today, league hubs, /best-promos, the
// homepage modal, /my-teams, venue hubs, playoffs), CFB and event stops never
// call the resolver and render exactly as before.
//
// COMMITMENTS TO STUBHUB. A StubHub link is a Partnerize deep link and nothing
// else; the destination is a StubHub event page, last, URL-encoded, with no
// added parameter; no price is shown; the disclosure sits under the button.
import { TICKET_TEST, TICKET_TEST_PAIRS, type TicketTestLeague } from '@/config/ticket-test';
import type { TicketTestArm } from './ticket-test-pairing';

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

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The phase on a site day, or null outside [startDate, endDate). */
export function ticketTestPhase(today: string, cfg: { startDate: string; flipDate: string; endDate: string } = TICKET_TEST): TicketTestPhase | null {
  if (!YMD_RE.test(today)) return null;
  if (today < cfg.startDate || today >= cfg.endDate) return null;
  return today < cfg.flipDate ? 'a' : 'b';
}

// teamId -> its pair and arm, built once from the config literal.
const ASSIGNMENTS: ReadonlyMap<string, { league: TicketTestLeague; pairId: string; arm: TicketTestArm }> = (() => {
  const m = new Map<string, { league: TicketTestLeague; pairId: string; arm: TicketTestArm }>();
  for (const league of TICKET_TEST.leagues) for (const p of TICKET_TEST_PAIRS[league]) for (const t of p.teams) m.set(t.team, { league, pairId: p.pairId, arm: t.arm });
  return m;
})();

const FIXED_LEAGUE: Readonly<Record<string, TicketTestLeague>> = { 'ottawa-senators': 'nhl', 'toronto-maple-leafs': 'nhl', 'toronto-raptors': 'nba' };

export const PUBREF_RE = /^[a-z0-9-]+$/;
export type StubHubPubrefSurface = 'web' | 'app-ios' | 'app-android' | 'email';

/** {surface}-{league}-{phase}: lowercase letters, digits and hyphens only. */
export function stubHubPubref(surface: StubHubPubrefSurface, league: string, phase: TicketTestPhase): string {
  return `${surface}-${league}-${phase}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

/** The resolver: (team, site day) -> partner, phase and pair, or null when the
 *  test does not govern this team today (switch off, outside the dates, a club
 *  of another league). `on` is injectable for tests. */
export function resolveTicketTest(teamId: string, today: string, on: boolean = isTicketTestOn()): TicketTestResolution | null {
  if (!on) return null;
  const phase = ticketTestPhase(today);
  if (!phase) return null;
  if (TICKET_TEST.alwaysStubHub.includes(teamId)) {
    const league = FIXED_LEAGUE[teamId];
    if (!league) return null;
    return { partner: 'stubhub', phase, pairId: 'fixed', arm: 'fixed_stubhub', league, pubref: stubHubPubref('web', league, phase) };
  }
  const a = ASSIGNMENTS.get(teamId);
  if (!a) return null;
  const stubHubNow = (a.arm === 'stubhub_first') === (phase === 'a');
  return { partner: stubHubNow ? 'stubhub' : 'ticketnetwork', phase, pairId: a.pairId, arm: a.arm, league: a.league, pubref: stubHubPubref('web', a.league, phase) };
}

/** Every club the test governs (the pairs and the always-StubHub clubs). */
export function ticketTestTeamIds(): string[] {
  return [...ASSIGNMENTS.keys(), ...TICKET_TEST.alwaysStubHub];
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
 *  when the team is on StubHub today and this control has no matched StubHub
 *  event, so it carries the TicketNetwork link (or, for a club TicketNetwork
 *  does not list, the Ticketmaster link) instead. */
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
  return links.ticketmaster ? { partner: 'ticketmaster', href: links.ticketmaster, fallback: true } : null;
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

// ── The phase boundaries ─────────────────────────────────────────────────────
// A boundary is a site day on which a test team's ticket links change: the
// start (the test's links appear), the flip (every club swaps partners) and
// the end (the pages go back). Team pages are refreshed by the nightly batch
// at 00:15 Eastern on every day; promo pages are not, so on a boundary day
// the same job revalidates every upcoming promo page of the test's clubs
// (src/app/api/cron/nightly-refresh/route.ts).

/** 'start' | 'flip' | 'end' when `today` is a boundary day and the switch is
 *  on, else null. */
export function ticketTestBoundary(today: string, on: boolean = isTicketTestOn(), cfg: { startDate: string; flipDate: string; endDate: string } = TICKET_TEST): 'start' | 'flip' | 'end' | null {
  if (!on) return null;
  if (today === cfg.startDate) return 'start';
  if (today === cfg.flipDate) return 'flip';
  if (today === cfg.endDate) return 'end';
  return null;
}

/** The promo page paths of the test's clubs out of an upcoming promo index,
 *  deduped (a series is one page with several rows). */
export function ticketTestPromoPaths(
  index: readonly { teamId: string; pageSlug: string }[],
  sportOf: ReadonlyMap<string, string>,
  pathOf: (sport: string, teamId: string, pageSlug: string) => string,
): string[] {
  const clubs = new Set(ticketTestTeamIds());
  const out = new Set<string>();
  for (const p of index) {
    const sport = sportOf.get(p.teamId);
    if (sport && p.pageSlug && clubs.has(p.teamId)) out.add(pathOf(sport, p.teamId, p.pageSlug));
  }
  return [...out].sort();
}
