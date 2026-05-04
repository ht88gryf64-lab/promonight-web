/* eslint-disable no-console */
/**
 * Resolves the canonical Ticketmaster URL + attraction ID for every team in
 * PromoNight via the Discovery API (the authorized data source — direct
 * scraping of ticketmaster.com is bot-blocked).
 *
 * Outputs (full run):
 *   scripts/ticketmaster-team-mapping.csv         (human review)
 *   scripts/ticketmaster-team-mapping.json        (machine-readable map)
 *
 * Outputs (--rerun mode — only RERUN_SLUGS):
 *   scripts/ticketmaster-team-mapping-rerun.csv
 *   scripts/ticketmaster-team-mapping-rerun.json
 *
 * Diagnostic log (appended on every Discovery API failure):
 *   scripts/ticketmaster-mapping-errors.log
 *   Contains timestamp, team slug, query, redacted URL, HTTP status, body,
 *   and message. The apikey is stripped before write.
 *
 * Outputs are gitignored — regenerate via `npm run map:ticketmaster` /
 * `npm run map:ticketmaster:rerun`.
 *
 * Two-stage search per team:
 *   1. Strict: query with the league's classification (Hockey/Baseball/etc).
 *   2. Broad: same query without classification — used as a fallback when
 *      strict errors persistently OR returns zero results. scoreMatch still
 *      validates the sport on each candidate so confidence isn't diluted.
 *
 * Usage:
 *   echo "TICKETMASTER_API_KEY=<consumer-key>" >> .env.local
 *   npm run map:ticketmaster              # full run, all teams
 *   npm run map:ticketmaster:rerun        # only the problem teams
 *
 * Rate limit: Discovery API is 5 req/sec, 5000/day. Full run paces at
 * ~4.5 req/sec (220ms delay) to stay under the per-second cap. Rerun
 * mode pages much slower (600ms delay) for headroom on transient errors,
 * with a single retry per team before giving up.
 */
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import type { Team } from '../src/lib/types';

const API_KEY = process.env.TICKETMASTER_API_KEY;
if (!API_KEY) {
  console.error('TICKETMASTER_API_KEY env var is required. Set it in .env.local:');
  console.error('  echo "TICKETMASTER_API_KEY=<consumer-key>" >> .env.local');
  process.exit(1);
}

// Deferred import — `src/lib/data` initializes Firebase Admin at module load,
// which crashes on missing FIREBASE_SERVICE_ACCOUNT before our env check has
// a chance to run. Loading dynamically inside main() keeps the API-key
// validation as the first failure mode (the one the user is most likely to
// hit and whose error message is most actionable).

const DISCOVERY_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

// Mode flags — `--rerun` flips both pacing and output paths.
const RERUN_MODE = process.argv.includes('--rerun');

const RATE_LIMIT_DELAY_MS = RERUN_MODE ? 600 : 220;
const RESULT_SIZE = RERUN_MODE ? 50 : 20;
const RETRY_DELAY_MS = 2000;

// Slugs that errored or returned ambiguous matches in the prior full run
// (4 NHL transient errors + 3 MLS query-construction edge cases). Looked up
// from Firestore — these are the actual `team.id` values, not derived from
// names. The override map below produces the right query strings so the
// MLS three resolve cleanly once the rerun fires.
const RERUN_SLUGS: ReadonlySet<string> = new Set([
  'boston-bruins',
  'new-jersey-devils',
  'philadelphia-flyers',
  'washington-capitals',
  'lafc',
  'inter-miami',
  'houston-dynamo',
]);

// Per-team query overrides for cases where neither `team.name` nor
// `${team.city} ${team.name}` produces a clean Discovery API match. These
// happen when the team's actual name layout doesn't compose from the
// PromoNight-internal city/name fields — usually MLS teams whose canonical
// brand puts the locale on the opposite side of where PromoNight stores it.
// Slug → canonical search keyword.
const QUERY_OVERRIDES: Record<string, string> = {
  lafc: 'LAFC',
  'inter-miami': 'Inter Miami CF',
  'sporting-kansas-city': 'Sporting Kansas City',
  'real-salt-lake': 'Real Salt Lake',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Strip diacritics so "Montréal" (team.name for cf-montreal) folds into
// "Montreal" (team.city) and the contains-check finds the duplication.
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Builds the Discovery API search keyword for a team. Three rules, in order:
//   1. If a per-slug override exists, use it. Catches LAFC, Inter Miami CF,
//      Sporting Kansas City, Real Salt Lake — teams whose canonical brand
//      layout doesn't compose from PromoNight's city/name fields.
//   2. If team.name (accent-folded) already contains team.city, use name
//      alone. Catches "Austin FC", "FC Dallas", "Toronto FC", "CF Montréal",
//      etc. where naive concatenation produces "Austin Austin FC".
//   3. Otherwise concatenate `${city} ${name}` — the standard case for
//      teams like Minnesota Twins, Boston Bruins, Atlanta Hawks.
export function buildQueryName(team: Pick<Team, 'id' | 'city' | 'name'>): string {
  const override = QUERY_OVERRIDES[team.id];
  if (override) return override;

  const cityFolded = fold(team.city);
  const nameFolded = fold(team.name);
  if (cityFolded.length > 0 && nameFolded.includes(cityFolded)) {
    return team.name;
  }

  return `${team.city} ${team.name}`.trim();
}

interface TicketmasterAttraction {
  id: string;
  name: string;
  url: string;
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
}

// Carries HTTP context out of searchAttractions so the catch block in
// mapTeam can write a diagnostic record without re-fetching. Network
// failures (DNS, TCP, etc.) leave status/body undefined.
class DiscoveryApiError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

const ERROR_LOG_PATH = join(process.cwd(), 'scripts/ticketmaster-mapping-errors.log');

// Strip the API key from any URL before it reaches disk. The mapping log is
// gitignored but local files still leak via shoulder-surfing, screenshots,
// pasted snippets, etc. — redaction is the cheap defense.
function redactApiKey(url: string): string {
  return url.replace(/([?&]apikey=)[^&]+/gi, '$1<REDACTED>');
}

// `error_kind` triage values written to the log so you can grep:
//   discovery_api_http     — Discovery API returned non-2xx
//   discovery_api_network  — fetch() threw (DNS, TCP, AbortError, etc.)
//   js_score_loop          — scoreMatch crashed on a specific attraction
//   js_unknown             — JS error somewhere else in mapTeam (stack pinpoints)
type ErrorKind =
  | 'discovery_api_http'
  | 'discovery_api_network'
  | 'js_score_loop'
  | 'js_unknown';

function classifyError(err: unknown): ErrorKind {
  if (err instanceof DiscoveryApiError) {
    return err.status !== undefined ? 'discovery_api_http' : 'discovery_api_network';
  }
  return 'js_unknown';
}

function logApiError(ctx: {
  teamSlug: string;
  team?: Pick<Team, 'id' | 'city' | 'name' | 'league' | 'sportSlug' | 'division' | 'abbreviation'>;
  query: string;
  classification: string | undefined;
  err: unknown;
  /** Override the auto-classified kind. Use 'js_score_loop' when the throw
   *  happens inside the per-attraction wrapper so the log explicitly says so. */
  kind?: ErrorKind;
  /** Full attraction object that triggered a scoreMatch crash. Only populated
   *  for kind='js_score_loop'. */
  offendingAttraction?: unknown;
}): void {
  const err = ctx.err;
  const isDiscovery = err instanceof DiscoveryApiError;
  const kind = ctx.kind ?? classifyError(err);
  const stack = err instanceof Error && err.stack ? err.stack : '(no stack)';

  const lines = [
    `=== ${new Date().toISOString()} ===`,
    `team_slug:      ${ctx.teamSlug}`,
    `query:          ${ctx.query}`,
    `classification: ${ctx.classification ?? '(none)'}`,
    `error_kind:     ${kind}`,
    `url:            ${
      isDiscovery
        ? redactApiKey(err.url)
        : '(n/a — error was a JS exception, not a Discovery API response)'
    }`,
    `status:         ${isDiscovery && err.status !== undefined ? String(err.status) : '(no response)'}`,
    `body:           ${
      isDiscovery && err.body ? err.body.slice(0, 600).replace(/\n/g, ' ') : '(no body)'
    }`,
    `message:        ${err instanceof Error ? err.message : String(err)}`,
    `team_data:      ${ctx.team ? JSON.stringify(ctx.team) : '(not provided)'}`,
    `offending_attraction: ${
      ctx.offendingAttraction !== undefined
        ? JSON.stringify(ctx.offendingAttraction).slice(0, 800)
        : '(none)'
    }`,
    `stack:`,
    ...stack.split('\n').map((l) => `  ${l}`),
    ``,
  ];
  try {
    appendFileSync(ERROR_LOG_PATH, lines.join('\n'), 'utf8');
  } catch {
    // If the log write itself fails, don't crash the run — the error row
    // in the CSV still records that something went wrong.
  }
}

type MatchStatus = 'matched' | 'ambiguous' | 'no_match' | 'error';
type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

interface TeamMappingRow {
  internal_slug: string;
  team_name: string;
  league: string;
  match_status: MatchStatus;
  match_confidence: MatchConfidence;
  ticketmaster_attraction_id: string | null;
  ticketmaster_canonical_url: string | null;
  ticketmaster_matched_name: string | null;
  notes: string;
}

async function searchAttractions(
  query: string,
  classificationName?: string,
): Promise<TicketmasterAttraction[]> {
  const params = new URLSearchParams({
    apikey: API_KEY!,
    keyword: query,
    locale: 'en-us',
    countryCode: 'US',
    size: String(RESULT_SIZE),
  });
  if (classificationName) {
    params.append('classificationName', classificationName);
  }

  const url = `${DISCOVERY_API_BASE}/attractions.json?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (networkErr) {
    throw new DiscoveryApiError(
      `Network error: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`,
      url,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new DiscoveryApiError(
      `Discovery API ${res.status}: ${body.slice(0, 200)}`,
      url,
      res.status,
      body,
    );
  }

  const data = (await res.json()) as {
    _embedded?: { attractions?: TicketmasterAttraction[] };
  };
  return data._embedded?.attractions ?? [];
}

// Discovery API uses "Sports" as the segment and the league name as the
// classification (genre). Mapping league → genre yields the cleanest filter.
function leagueToClassification(league: string): string | undefined {
  const map: Record<string, string> = {
    mlb: 'Baseball',
    nba: 'Basketball',
    nhl: 'Hockey',
    nfl: 'Football',
    mls: 'Soccer',
    wnba: 'Basketball',
  };
  return map[league.toLowerCase()];
}

function scoreMatch(
  team: { fullName: string; nickname: string; league: string },
  attraction: TicketmasterAttraction,
): number {
  let score = 0;
  const fullLower = team.fullName.toLowerCase();
  const nickLower = team.nickname.toLowerCase();
  const attractionLower = attraction.name.toLowerCase();

  // Name similarity. Full city+nickname match is strongest; nickname-only
  // matches happen for ambiguous nicknames (e.g. "Cardinals" — MLB vs NFL).
  if (attractionLower === fullLower) score += 100;
  else if (attractionLower.includes(fullLower)) score += 80;
  else if (fullLower.includes(attractionLower)) score += 70;
  else if (attractionLower === nickLower) score += 60;
  else if (attractionLower.includes(nickLower)) score += 40;

  // Sport classification match — disambiguates same-nickname collisions.
  const expectedGenre = leagueToClassification(team.league);
  const actualGenre = attraction.classifications?.[0]?.genre?.name;
  if (expectedGenre && actualGenre && actualGenre.toLowerCase() === expectedGenre.toLowerCase()) {
    score += 30;
  }

  // Sports-segment confirmation. Fan-attraction results sometimes leak in;
  // requiring "Sports" segment filters those out.
  const segment = attraction.classifications?.[0]?.segment?.name;
  if (segment?.toLowerCase() === 'sports') {
    score += 10;
  }

  // Canonical Ticketmaster team URL shape.
  if (attraction.url.includes('-tickets') && attraction.url.includes('/artist/')) {
    score += 20;
  }

  return score;
}

async function mapTeam(team: Team): Promise<TeamMappingRow> {
  const queryName = buildQueryName(team);
  const classification = leagueToClassification(team.league);
  const baseRow = {
    internal_slug: team.id,
    team_name: queryName,
    league: team.league,
  };

  // Two-stage search:
  //   1. Strict — query with the league's genre classification. Filters
  //      out same-name cross-sport collisions ("Cardinals" — MLB vs NFL,
  //      "Devils" — NHL vs anything).
  //   2. Broad — same query without classification. Triggered when the
  //      strict call (a) returns 0 results or (b) errors persistently.
  //      scoreMatch still validates sport on each candidate so a broad
  //      query doesn't dilute confidence; it just gives us more raw
  //      candidates to filter through.
  // Empirically the four NHL "common-noun nickname" teams (Bruins, Devils,
  // Flyers, Capitals) errored consistently across two prior runs at
  // different rate-limit delays — strongly suggesting a deterministic
  // API-side reaction to the strict-filter request shape, not a transient.
  const strictAttempt = async () => searchAttractions(queryName, classification);
  const broadAttempt = async () => searchAttractions(queryName);

  let usedFallback = false;
  let firstErrorMessage = '';

  try {
    let attractions: TicketmasterAttraction[] = [];

    // Stage 1: strict
    try {
      attractions = await strictAttempt();
    } catch (firstErr) {
      logApiError({ teamSlug: team.id, team, query: queryName, classification, err: firstErr });
      firstErrorMessage = firstErr instanceof Error ? firstErr.message : String(firstErr);

      // Rerun mode retries the strict query once before falling back, on
      // the chance the failure was actually transient. Full-run goes
      // straight to the broad fallback to keep total runtime short.
      if (RERUN_MODE) {
        console.log(`    strict attempt failed: ${firstErrorMessage}`);
        console.log(`    retrying strict after ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        try {
          attractions = await strictAttempt();
        } catch (secondErr) {
          logApiError({ teamSlug: team.id, team, query: queryName, classification, err: secondErr });
          console.log(
            `    strict retry failed: ${
              secondErr instanceof Error ? secondErr.message : String(secondErr)
            }`,
          );
          console.log(`    falling back to broad query (no classification)...`);
          attractions = await broadAttempt();
          usedFallback = true;
        }
      } else {
        console.log(`    strict failed; falling back to broad (no classification)...`);
        attractions = await broadAttempt();
        usedFallback = true;
      }
    }

    // Stage 2: empty-results fallback. Strict call succeeded (no error) but
    // returned nothing — drop the classification filter and try once more.
    if (attractions.length === 0 && classification && !usedFallback) {
      console.log(`    0 results with classification; falling back to broad query...`);
      attractions = await broadAttempt();
      usedFallback = true;
    }

    if (attractions.length === 0) {
      return {
        ...baseRow,
        match_status: 'no_match',
        match_confidence: 'none',
        ticketmaster_attraction_id: null,
        ticketmaster_canonical_url: null,
        ticketmaster_matched_name: null,
        notes: usedFallback
          ? `No attractions returned (query="${queryName}", strict + broad both empty)`
          : `No attractions returned (query="${queryName}")`,
      };
    }

    // Per-attraction try/catch so a single malformed attraction object
    // (missing url, missing name, etc.) doesn't kill the whole team — and
    // when it does kill scoreMatch, the catch logs the exact attraction
    // payload so the next run pinpoints which API field is undefined.
    const scored: Array<{ attraction: TicketmasterAttraction; score: number }> = [];
    for (const a of attractions) {
      try {
        scored.push({
          attraction: a,
          score: scoreMatch(
            { fullName: queryName, nickname: team.name, league: team.league },
            a,
          ),
        });
      } catch (scoreErr) {
        logApiError({
          teamSlug: team.id,
          team,
          query: queryName,
          classification,
          err: scoreErr,
          kind: 'js_score_loop',
          offendingAttraction: a,
        });
        // Skip this attraction; keep going so a single bad result doesn't
        // sink the team. Equivalent to score=0, just without polluting the
        // ranked list with a row that'd never win.
      }
    }
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return {
        ...baseRow,
        match_status: 'no_match',
        match_confidence: 'none',
        ticketmaster_attraction_id: null,
        ticketmaster_canonical_url: null,
        ticketmaster_matched_name: null,
        notes: `${attractions.length} attractions returned but all crashed scoreMatch — see error log`,
      };
    }

    const best = scored[0];
    const second = scored[1];

    let confidence: MatchConfidence = 'none';
    let status: MatchStatus = 'no_match';
    let notes = '';

    if (best.score >= 100) {
      confidence = 'high';
      status = 'matched';
    } else if (best.score >= 80) {
      confidence = 'medium';
      status = 'matched';
      notes = `Top score ${best.score}, runner-up ${second?.score ?? 'none'}`;
    } else if (best.score >= 50) {
      confidence = 'low';
      status = 'ambiguous';
      notes = `Top score ${best.score}, runner-up ${second?.score ?? 'none'} — verify manually`;
    } else {
      status = 'no_match';
      notes = `Best score only ${best.score} — likely wrong match, verify manually`;
    }

    if (usedFallback) {
      const prefix = firstErrorMessage
        ? `via broad-query fallback after strict error (${firstErrorMessage})`
        : `via broad-query fallback (strict returned 0 results)`;
      notes = notes ? `${prefix}; ${notes}` : prefix;
    }

    return {
      ...baseRow,
      match_status: status,
      match_confidence: confidence,
      ticketmaster_attraction_id: best.attraction.id,
      ticketmaster_canonical_url: best.attraction.url,
      ticketmaster_matched_name: best.attraction.name,
      notes,
    };
  } catch (err) {
    logApiError({ teamSlug: team.id, team, query: queryName, classification, err });
    return {
      ...baseRow,
      match_status: 'error',
      match_confidence: 'none',
      ticketmaster_attraction_id: null,
      ticketmaster_canonical_url: null,
      ticketmaster_matched_name: null,
      notes: `API error: ${
        err instanceof Error ? err.message : String(err)
      }${firstErrorMessage && firstErrorMessage !== (err instanceof Error ? err.message : '') ? ` (initial: ${firstErrorMessage})` : ''}`,
    };
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  console.log('Loading teams from Firestore...');
  const { getAllTeams } = await import('../src/lib/data');
  const allTeams = await getAllTeams();
  if (allTeams.length === 0) {
    console.error('No teams returned — Firestore credentials missing?');
    process.exit(1);
  }

  const teams = RERUN_MODE
    ? allTeams.filter((t) => RERUN_SLUGS.has(t.id))
    : allTeams;

  if (RERUN_MODE) {
    const found = new Set(teams.map((t) => t.id));
    const missing = [...RERUN_SLUGS].filter((s) => !found.has(s));
    if (missing.length > 0) {
      console.warn(`WARN: ${missing.length} rerun slug(s) not found in Firestore: ${missing.join(', ')}`);
    }
    console.log(
      `Rerun mode — processing ${teams.length}/${RERUN_SLUGS.size} target slugs ` +
        `(${RATE_LIMIT_DELAY_MS}ms delay, size=${RESULT_SIZE}, retry-on-error).`,
    );
  } else {
    console.log(
      `Loaded ${teams.length} teams. Querying Ticketmaster Discovery API ` +
        `(${RATE_LIMIT_DELAY_MS}ms delay, size=${RESULT_SIZE}).`,
    );
  }
  console.log('');

  const results: TeamMappingRow[] = [];

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const queryPreview = buildQueryName(team);
    const label = `[${i + 1}/${teams.length}] ${team.league} ${team.id} → "${queryPreview}"`;
    process.stdout.write(`${label.padEnd(70)} ... `);

    const row = await mapTeam(team);
    results.push(row);

    console.log(`${row.match_status} (${row.match_confidence})`);

    if (i < teams.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  // CSV output
  const headers: Array<keyof TeamMappingRow> = [
    'internal_slug',
    'team_name',
    'league',
    'match_status',
    'match_confidence',
    'ticketmaster_attraction_id',
    'ticketmaster_canonical_url',
    'ticketmaster_matched_name',
    'notes',
  ];
  const csvLines = [
    headers.join(','),
    ...results.map((r) =>
      headers.map((h) => csvEscape(r[h] === null ? '' : String(r[h]))).join(','),
    ),
  ];
  const csvBaseName = RERUN_MODE
    ? 'ticketmaster-team-mapping-rerun.csv'
    : 'ticketmaster-team-mapping.csv';
  const csvPath = join(process.cwd(), 'scripts', csvBaseName);
  writeFileSync(csvPath, csvLines.join('\n') + '\n', 'utf8');

  // JSON output — keyed by internal_slug for direct lookup. Skip rows without
  // an attraction id; those need manual triage and shouldn't ship in the map.
  const jsonMap: Record<
    string,
    {
      attractionId: string;
      url: string;
      matchedName: string;
      confidence: MatchConfidence;
    }
  > = {};
  for (const row of results) {
    if (row.ticketmaster_attraction_id && row.ticketmaster_canonical_url) {
      jsonMap[row.internal_slug] = {
        attractionId: row.ticketmaster_attraction_id,
        url: row.ticketmaster_canonical_url,
        matchedName: row.ticketmaster_matched_name ?? '',
        confidence: row.match_confidence,
      };
    }
  }
  const jsonBaseName = RERUN_MODE
    ? 'ticketmaster-team-mapping-rerun.json'
    : 'ticketmaster-team-mapping.json';
  const jsonPath = join(process.cwd(), 'scripts', jsonBaseName);
  writeFileSync(jsonPath, JSON.stringify(jsonMap, null, 2) + '\n', 'utf8');

  // Summary
  const summary = {
    total: results.length,
    matched_high: results.filter((r) => r.match_confidence === 'high').length,
    matched_medium: results.filter((r) => r.match_confidence === 'medium').length,
    ambiguous: results.filter((r) => r.match_status === 'ambiguous').length,
    no_match: results.filter((r) => r.match_status === 'no_match').length,
    errors: results.filter((r) => r.match_status === 'error').length,
  };

  console.log('');
  console.log('=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('');
  console.log('Wrote:');
  console.log(`  ${csvPath} (review manually)`);
  console.log(`  ${jsonPath} (use for code)`);

  if (RERUN_MODE) {
    console.log('');
    console.log('Rerun next steps:');
    console.log('  1. Open the rerun CSV and confirm every row reads sensibly.');
    console.log('  2. If matches look correct, merge the rerun JSON into');
    console.log('     ticketmaster-team-mapping.json (or send a follow-up prompt).');
    console.log('  3. Anything still ambiguous: look up the attraction at');
    console.log('     https://developer.ticketmaster.com/api-explorer/v2/ and patch');
    console.log('     ticketmaster-team-mapping.json directly.');
  } else {
    console.log('');
    console.log('Next steps:');
    console.log('  1. Open the CSV.');
    console.log('  2. Sort/filter by match_confidence — review every "low" and "medium" row.');
    console.log('  3. Spot-check 5-10 "high" matches by clicking the URL.');
    console.log('  4. For wrong matches, look up the right attraction at');
    console.log('     https://developer.ticketmaster.com/api-explorer/v2/ and edit the JSON.');
    console.log('  5. Send a follow-up Claude Code prompt to populate ticketmasterSlug');
    console.log('     (and optionally ticketmasterAttractionId) on team docs from the JSON.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
