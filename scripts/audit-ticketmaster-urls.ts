/* eslint-disable no-console */
/**
 * Generates a CSV audit of expected Ticketmaster team URLs across every team
 * in Firestore. The script does NOT auto-fetch URLs — Ticketmaster blocks
 * bots aggressively and the scrape would yield false negatives. Instead it
 * outputs a per-team URL list for manual click-through verification.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/audit-ticketmaster-urls.ts
 *   # or
 *   npm run audit:ticketmaster
 *
 * Output: scripts/ticketmaster-url-audit.csv
 *
 * Manual verification flow:
 *   1. Click each URL in the CSV.
 *   2. Confirm it resolves to a real Ticketmaster team page (NOT a search-
 *      result page or 404). Ticketmaster usually redirects {slug}-tickets to
 *      the canonical artist page.
 *   3. For any team whose URL fails, populate `ticketmasterSlug` on the
 *      team's Firestore doc with the slug Ticketmaster actually uses.
 *      The `ticketmasterSlug` field is read by `buildTicketmasterUrl` and
 *      overrides the team's PromoNight slug when present.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getAllTeams } from '../src/lib/data';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  const teams = await getAllTeams();
  if (teams.length === 0) {
    console.error('No teams returned from getAllTeams() — Firestore credentials missing?');
    process.exit(1);
  }

  const headers = [
    'league',
    'team_name',
    'internal_slug',
    'expected_ticketmaster_slug',
    'expected_url',
    'has_override',
    'needs_override',
  ];

  const rows = teams.map((team) => {
    const tmSlug = team.ticketmasterSlug ?? team.id;
    return {
      league: team.league,
      team_name: `${team.city} ${team.name}`,
      internal_slug: team.id,
      expected_ticketmaster_slug: tmSlug,
      expected_url: `https://www.ticketmaster.com/${tmSlug}-tickets`,
      has_override: team.ticketmasterSlug ? 'yes' : 'no',
      needs_override: 'pending_manual_review',
    };
  });

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => csvEscape(String(r[h as keyof typeof r] ?? ''))).join(','),
    ),
  ];
  const csv = lines.join('\n') + '\n';

  const outputPath = join(process.cwd(), 'scripts/ticketmaster-url-audit.csv');
  writeFileSync(outputPath, csv, 'utf8');

  console.log(`Wrote ${rows.length} team URLs to ${outputPath}`);
  console.log('');
  console.log('Manual verification steps:');
  console.log('  1. Open the CSV in a spreadsheet.');
  console.log('  2. Click each `expected_url`. Confirm it loads a real Ticketmaster team page.');
  console.log('  3. For any URL that 404s or hits search results, set the');
  console.log('     `ticketmasterSlug` field on the team\'s Firestore doc to the slug');
  console.log('     Ticketmaster actually uses, then re-run this script to confirm.');
  console.log('');
  console.log(
    `Breakdown by league: ${[...new Set(rows.map((r) => r.league))]
      .map((lg) => `${lg}=${rows.filter((r) => r.league === lg).length}`)
      .join(', ')}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
