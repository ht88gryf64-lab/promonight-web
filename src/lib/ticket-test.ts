// StubHub vs TicketNetwork crossover test: the ONE resolver (decided design
// 2026-11-25). SERVER ONLY: it reads the config (seed, dates, pairs, click
// counts), which must never reach a client bundle. Every caller passes the
// site day it already holds (the server's one clock read); a client component
// never resolves: the server resolves and hands the result down
// (TicketTestProvider), and client code imports src/lib/ticket-test-link.ts.
//
// SCOPE (Gate 0 ruling 2). The test covers a test team's OWN pages: its team
// page (sidebar card, every schedule row, away rows included) and its promo
// pages. Every multi-team page (/promos/today, league hubs, /best-promos, the
// homepage modal, /my-teams, venue hubs, playoffs), CFB and event stops never
// call the resolver and render exactly as before.
import 'server-only';
import { TICKET_TEST, TICKET_TEST_PAIRS } from '@/config/ticket-test';
import type { TicketTestArm } from './ticket-test-pairing';
import { siteTodayYmd } from './site-today';
import { isTicketTestOn, stubHubPubref, type TicketTestLeague, type TicketTestPhase, type TicketTestResolution } from './ticket-test-link';

export * from './ticket-test-link';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The phase on a site day, or null outside [startDate, endDate). */
export function ticketTestPhase(today: string, cfg: { startDate: string; flipDate: string; endDate: string } = TICKET_TEST): TicketTestPhase | null {
  if (!YMD_RE.test(today)) return null;
  if (today < cfg.startDate || today >= cfg.endDate) return null;
  return today < cfg.flipDate ? 'a' : 'b';
}

/** True while the test is running: the switch on AND the site day inside
 *  [startDate, endDate). The one gate for anything that must not exist before
 *  the start or after the end (the mapper's shEventUrl). */
export function isTicketTestActive(today: string = siteTodayYmd(), on: boolean = isTicketTestOn()): boolean {
  return on && ticketTestPhase(today) !== null;
}

// teamId -> its pair and arm, built once from the config literal.
const ASSIGNMENTS: ReadonlyMap<string, { league: TicketTestLeague; pairId: string; arm: TicketTestArm }> = (() => {
  const m = new Map<string, { league: TicketTestLeague; pairId: string; arm: TicketTestArm }>();
  for (const league of TICKET_TEST.leagues) for (const p of TICKET_TEST_PAIRS[league]) for (const t of p.teams) m.set(t.team, { league, pairId: p.pairId, arm: t.arm });
  return m;
})();

/** The resolver: (team, site day) -> partner, phase and pair, or null when the
 *  test does not govern this team today (switch off, outside the dates, a club
 *  of another league). `on` is injectable for tests. */
export function resolveTicketTest(teamId: string, today: string, on: boolean = isTicketTestOn()): TicketTestResolution | null {
  if (!on) return null;
  const phase = ticketTestPhase(today);
  if (!phase) return null;
  const fixed = TICKET_TEST.alwaysStubHub.find((c) => c.team === teamId);
  if (fixed) {
    const league = fixed.league;
    return { partner: 'stubhub', phase, pairId: 'fixed', arm: 'fixed_stubhub', league, pubref: stubHubPubref('web', league, phase) };
  }
  const a = ASSIGNMENTS.get(teamId);
  if (!a) return null;
  const stubHubNow = (a.arm === 'stubhub_first') === (phase === 'a');
  return { partner: stubHubNow ? 'stubhub' : 'ticketnetwork', phase, pairId: a.pairId, arm: a.arm, league: a.league, pubref: stubHubPubref('web', a.league, phase) };
}

/** Every club the test governs (the pairs and the always-StubHub clubs). */
export function ticketTestTeamIds(): string[] {
  return [...ASSIGNMENTS.keys(), ...TICKET_TEST.alwaysStubHub.map((c) => c.team)];
}

// ── The phase boundaries ─────────────────────────────────────────────────────
// A boundary is a site day on which a test team's ticket links change: the
// start (the test's links appear), the flip (every club swaps partners) and
// the end (the pages go back). Team pages are refreshed by the nightly batch
// at 00:15 Eastern on every day; promo pages are not, so on a boundary day
// the same job revalidates every upcoming promo page of the test's clubs
// (src/app/api/cron/nightly-refresh/route.ts).

/** 'start' | 'flip' | 'end' when `today` is a boundary day or the day after
 *  one and the switch is on, else null. */
export function ticketTestBoundary(today: string, on: boolean = isTicketTestOn(), cfg: { startDate: string; flipDate: string; endDate: string } = TICKET_TEST): 'start' | 'flip' | 'end' | null {
  if (!on || !YMD_RE.test(today)) return null;
  // The day itself and the day after: revalidation is idempotent, and a job
  // that missed the boundary night (or a batch that failed on it) is made
  // good the next night instead of waiting out each page's own 24 hours.
  const next = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  if (today === cfg.startDate || today === next(cfg.startDate)) return 'start';
  if (today === cfg.flipDate || today === next(cfg.flipDate)) return 'flip';
  if (today === cfg.endDate || today === next(cfg.endDate)) return 'end';
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
