/* eslint-disable no-console */
/**
 * Validate-on-build pass for the TicketNetwork ticket vendor.
 *
 * For every team in Firestore, generates the TicketNetwork performer LANDING
 * page URL (the decoded `?u=` target of the tracked link — NOT the tracked
 * link itself) using the same resolver the app uses (ticketNetworkLandingUrl),
 * then HTTP-checks that it resolves (200, not 404 / redirect-to-error).
 *
 * DRY-RUN ONLY — writes nothing. Output is a console report, ordered MLB-first
 * (LEAGUE_ORDER), splitting teams that PASS on the default rule (slug = team.id)
 * from teams that NEED an override. Use the NEEDS-OVERRIDE list to populate the
 * TICKETNETWORK_OVERRIDES map in src/lib/affiliates.ts.
 *
 * Usage:
 *   npm run validate:ticketnetwork
 *   # or
 *   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
 *     audit/validate-ticketnetwork-links.ts
 *
 * Flags:
 *   --mlb-only     check only MLB teams (fast, in-season focus)
 *   --limit=N      check only the first N teams (after MLB-first ordering)
 *   --concurrency=N  parallel requests (default 6)
 *
 * WAF NOTE: TicketNetwork may rate-limit / bot-block. The checker sends a
 * browser User-Agent and follows redirects. Network errors, timeouts, and
 * 403/429 responses are reported as INCONCLUSIVE rather than failures, so the
 * report never produces a false "needs override" from a blocked request.
 */
import { getAllTeams } from '../src/lib/data';
import { ticketNetworkLandingUrl } from '../src/lib/affiliates';
import { LEAGUE_ORDER } from '../src/lib/types';
import type { Team } from '../src/lib/types';

// Mirrors the default rule in src/lib/affiliates.ts (host + /e/performers/ +
// {team.id} + -tickets). Used only to detect whether a team's resolved landing
// differs from the default — i.e. whether an override is already in play.
const DEFAULT_HOST = 'https://www.ticketnetwork.com';
const DEFAULT_PATH = '/e/performers/';
function defaultRuleLanding(team: Pick<Team, 'id'>): string {
  return `${DEFAULT_HOST}${DEFAULT_PATH}${team.id}-tickets`;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

type Verdict = 'PASS' | 'NEEDS_OVERRIDE' | 'OVERRIDE_OK' | 'OVERRIDE_BROKEN' | 'INCONCLUSIVE';

type Result = {
  team: Team;
  landing: string | null;
  hasOverride: boolean;
  status: number | null;
  finalUrl: string | null;
  redirectedAway: boolean;
  verdict: Verdict;
  note: string;
};

type CheckOutcome = {
  status: number | null;
  finalUrl: string | null;
  inconclusive: boolean;
  note: string;
};

async function checkUrl(url: string, timeoutMs = 15000): Promise<CheckOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const status = res.status;
    const finalUrl = res.url || null;
    // WAF / rate-limit responses must not be read as a 404 → INCONCLUSIVE.
    if (status === 403 || status === 429 || status === 503) {
      return { status, finalUrl, inconclusive: true, note: `blocked/rate-limited (${status})` };
    }
    return { status, finalUrl, inconclusive: false, note: '' };
  } catch (err) {
    const msg = err instanceof Error ? err.name + ': ' + err.message : String(err);
    return { status: null, finalUrl: null, inconclusive: true, note: `request failed (${msg})` };
  } finally {
    clearTimeout(timer);
  }
}

function pathOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function classify(
  team: Team,
  landing: string | null,
  hasOverride: boolean,
  outcome: CheckOutcome,
): { verdict: Verdict; redirectedAway: boolean; note: string } {
  if (!landing) {
    return { verdict: 'NEEDS_OVERRIDE', redirectedAway: false, note: 'no slug resolved' };
  }
  if (outcome.inconclusive) {
    return { verdict: 'INCONCLUSIVE', redirectedAway: false, note: outcome.note };
  }
  // Did a 200 redirect us away from the requested performer path (soft-404 /
  // bounce to search/home)? Flag for eyeballing, but treat a 200 as a pass.
  const reqPath = pathOf(landing);
  const finalPath = pathOf(outcome.finalUrl);
  const redirectedAway =
    finalPath.length > 0 && finalPath !== reqPath && !finalPath.includes(`${reqPath.split('/').pop()}`);

  const ok = outcome.status !== null && outcome.status >= 200 && outcome.status < 300;
  if (ok) {
    const note = redirectedAway ? `200 but redirected to ${finalPath} — verify soft-404` : '';
    return {
      verdict: hasOverride ? 'OVERRIDE_OK' : 'PASS',
      redirectedAway,
      note,
    };
  }
  // Non-2xx, non-inconclusive → a real failure.
  const note = `HTTP ${outcome.status ?? '??'}`;
  return {
    verdict: hasOverride ? 'OVERRIDE_BROKEN' : 'NEEDS_OVERRIDE',
    redirectedAway: false,
    note,
  };
}

function leagueRank(league: string): number {
  const i = (LEAGUE_ORDER as readonly string[]).indexOf(league);
  return i === -1 ? LEAGUE_ORDER.length : i;
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function pull(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pull));
  return results;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const has = (flag: string) => argv.includes(flag);
  const val = (key: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`${key}=`));
    return hit ? hit.split('=')[1] : undefined;
  };
  return {
    mlbOnly: has('--mlb-only'),
    limit: val('--limit') ? Number(val('--limit')) : undefined,
    concurrency: val('--concurrency') ? Number(val('--concurrency')) : 6,
  };
}

const VERDICT_ICON: Record<Verdict, string> = {
  PASS: '✅',
  OVERRIDE_OK: '🟦',
  NEEDS_OVERRIDE: '❌',
  OVERRIDE_BROKEN: '🟥',
  INCONCLUSIVE: '⚠️ ',
};

async function main() {
  const { mlbOnly, limit, concurrency } = parseArgs();

  let teams = await getAllTeams();
  if (teams.length === 0) {
    console.error('No teams returned from getAllTeams() — Firestore credentials missing?');
    process.exit(1);
  }

  // MLB-first ordering (LEAGUE_ORDER), then city, so in-season teams report first.
  teams.sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.city.localeCompare(b.city));
  if (mlbOnly) teams = teams.filter((t) => t.league === 'MLB');
  if (limit && limit > 0) teams = teams.slice(0, limit);

  console.log(`TicketNetwork landing-page validation — ${teams.length} teams, concurrency ${concurrency}`);
  console.log('DRY-RUN: HTTP GET on each resolved landing URL. Writes nothing.\n');

  const results = await runPool<Team, Result>(teams, concurrency, async (team) => {
    const landing = ticketNetworkLandingUrl(team);
    const hasOverride = landing !== null && landing !== defaultRuleLanding(team);
    if (!landing) {
      return {
        team,
        landing,
        hasOverride,
        status: null,
        finalUrl: null,
        redirectedAway: false,
        verdict: 'NEEDS_OVERRIDE',
        note: 'no slug resolved',
      };
    }
    const outcome = await checkUrl(landing);
    const { verdict, redirectedAway, note } = classify(team, landing, hasOverride, outcome);
    return {
      team,
      landing,
      hasOverride,
      status: outcome.status,
      finalUrl: outcome.finalUrl,
      redirectedAway,
      verdict,
      note,
    };
  });

  // Per-team report (MLB-first; teams already ordered).
  for (const r of results) {
    const name = `${r.team.city} ${r.team.name}`.padEnd(26);
    const lg = r.team.league.padEnd(4);
    const ov = r.hasOverride ? ' [override]' : '';
    console.log(
      `${VERDICT_ICON[r.verdict]} ${lg} ${name} ${(r.verdict as string).padEnd(15)} ${r.landing ?? '(none)'}${ov}${r.note ? `  — ${r.note}` : ''}`,
    );
  }

  // Summary.
  const by = (v: Verdict) => results.filter((r) => r.verdict === v);
  console.log('\n── Summary ───────────────────────────────────────────────');
  (['PASS', 'OVERRIDE_OK', 'NEEDS_OVERRIDE', 'OVERRIDE_BROKEN', 'INCONCLUSIVE'] as Verdict[]).forEach((v) => {
    console.log(`  ${VERDICT_ICON[v]} ${v.padEnd(15)} ${by(v).length}`);
  });

  const needs = by('NEEDS_OVERRIDE');
  if (needs.length > 0) {
    console.log('\nNEEDS OVERRIDE (add to TICKETNETWORK_OVERRIDES in src/lib/affiliates.ts):');
    for (const r of needs) {
      console.log(`  '${r.team.id}': { slug: '???' },  // ${r.team.city} ${r.team.name} — ${r.note}`);
    }
  }
  const broken = by('OVERRIDE_BROKEN');
  if (broken.length > 0) {
    console.log('\nOVERRIDE BROKEN (existing override still fails — fix the slug/path):');
    for (const r of broken) console.log(`  ${r.team.id}: ${r.landing} — ${r.note}`);
  }
  const incon = by('INCONCLUSIVE');
  if (incon.length > 0) {
    console.log('\nINCONCLUSIVE (blocked/timeout — re-run or verify manually, NOT a confirmed failure):');
    for (const r of incon) console.log(`  ${r.team.id}: ${r.landing ?? '(none)'} — ${r.note}`);
  }

  console.log(
    `\nBreakdown by league: ${[...new Set(results.map((r) => r.team.league))]
      .map((lg) => `${lg}=${results.filter((r) => r.team.league === lg).length}`)
      .join(', ')}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
