/* eslint-disable no-console */
/**
 * Resolves the canonical Ticketmaster URL + attraction ID for every team in
 * PromoNight via the Discovery API (the authorized data source — direct
 * scraping of ticketmaster.com is bot-blocked).
 *
 * Outputs:
 *   scripts/ticketmaster-team-mapping.csv   (human review — sort by confidence)
 *   scripts/ticketmaster-team-mapping.json  (machine-readable map for code)
 *
 * Both outputs are gitignored — regenerate via `npm run map:ticketmaster`.
 *
 * Usage:
 *   echo "TICKETMASTER_API_KEY=<consumer-key>" >> .env.local
 *   npm run map:ticketmaster
 *
 * Rate limit: Discovery API is 5 req/sec, 5000/day. We pace at ~4.5 req/sec
 * with a 220ms inter-request delay so a 167-team run stays comfortably
 * under the daily cap and doesn't trip the per-second throttle.
 */
import { writeFileSync } from 'fs';
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
const RATE_LIMIT_DELAY_MS = 220; // ~4.5 req/sec, under the 5/sec cap

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    size: '20',
  });
  if (classificationName) {
    params.append('classificationName', classificationName);
  }

  const url = `${DISCOVERY_API_BASE}/attractions.json?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discovery API ${res.status}: ${body.slice(0, 200)}`);
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
  const fullName = `${team.city} ${team.name}`.trim();
  const baseRow = {
    internal_slug: team.id,
    team_name: fullName,
    league: team.league,
  };

  try {
    const classification = leagueToClassification(team.league);
    const attractions = await searchAttractions(fullName, classification);

    if (attractions.length === 0) {
      return {
        ...baseRow,
        match_status: 'no_match',
        match_confidence: 'none',
        ticketmaster_attraction_id: null,
        ticketmaster_canonical_url: null,
        ticketmaster_matched_name: null,
        notes: 'No attractions returned from Discovery API',
      };
    }

    const scored = attractions.map((a) => ({
      attraction: a,
      score: scoreMatch({ fullName, nickname: team.name, league: team.league }, a),
    }));
    scored.sort((a, b) => b.score - a.score);

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
    return {
      ...baseRow,
      match_status: 'error',
      match_confidence: 'none',
      ticketmaster_attraction_id: null,
      ticketmaster_canonical_url: null,
      ticketmaster_matched_name: null,
      notes: `API error: ${err instanceof Error ? err.message : String(err)}`,
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
  const teams = await getAllTeams();
  if (teams.length === 0) {
    console.error('No teams returned — Firestore credentials missing?');
    process.exit(1);
  }
  console.log(`Loaded ${teams.length} teams. Querying Ticketmaster Discovery API...`);
  console.log('');

  const results: TeamMappingRow[] = [];

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const label = `[${i + 1}/${teams.length}] ${team.league} ${team.city} ${team.name}`;
    process.stdout.write(`${label.padEnd(56)} ... `);

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
  const csvPath = join(process.cwd(), 'scripts/ticketmaster-team-mapping.csv');
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
  const jsonPath = join(process.cwd(), 'scripts/ticketmaster-team-mapping.json');
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

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
