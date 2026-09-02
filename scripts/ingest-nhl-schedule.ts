/* eslint-disable no-console */
// CLI wrapper around the shared NHL ingestion logic in src/lib/ingest-nhl.ts.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/ingest-nhl-schedule.ts --out=/path/nhl-games-2026.json \
//       [--cache-dir=/path/payloads] [--use-cache]
//       dry-run: 32 NHL API fetches (0 with --use-cache and a warm cache),
//       no writes, full doc array to --out
//
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/ingest-nhl-schedule.ts --execute --snapshot=/path/pre-write.json
//       writes to Firestore. NOT AUTHORIZED as of 2026-09-01; the games
//       write is a separate authorization. --snapshot is mandatory with
//       --execute and the pre-write snapshot lands before any batch.
//
// No scheduled cron. The NHL schedule is released once in the summer with
// occasional in-season changes; re-run manually after a change.
//
// Two known-truth rows are checked on every run, taken from
// promo-pipeline/docs/nhl-pending-decisions.md entries 7 and 8:
//   Bruins   2026-09-29 home vs NYR   nhlGameId 2026020003   regular
//   Detroit  2026-10-04 home vs WPG   nhlGameId 2026020035   regular

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ingestNhlSchedule, type NhlGameDoc } from '../src/lib/ingest-nhl';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

interface KnownTruth {
  label: string;
  nhlGameId: number;
  date: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  seasonType: 'preseason' | 'regular';
}

const KNOWN_TRUTH: KnownTruth[] = [
  { label: 'Bruins opener (entry 7)', nhlGameId: 2026020003, date: '2026-09-29', homeTeamSlug: 'boston-bruins', awayTeamSlug: 'new-york-rangers', seasonType: 'regular' },
  { label: 'Detroit Oct 4 (entry 8)', nhlGameId: 2026020035, date: '2026-10-04', homeTeamSlug: 'detroit-red-wings', awayTeamSlug: 'winnipeg-jets', seasonType: 'regular' },
];

function checkKnownTruth(docs: NhlGameDoc[]): boolean {
  let allOk = true;
  console.log('');
  console.log('=== Known-truth rows ===');
  for (const k of KNOWN_TRUTH) {
    const d = docs.find((x) => x.nhlGameId === k.nhlGameId);
    const ok = !!d && d.date === k.date && d.homeTeamSlug === k.homeTeamSlug && d.awayTeamSlug === k.awayTeamSlug && d.seasonType === k.seasonType;
    allOk = allOk && ok;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${k.label}: expect ${k.date} ${k.awayTeamSlug} at ${k.homeTeamSlug} ${k.seasonType} id ${k.nhlGameId}` + (d ? ` | got ${d.date} ${d.awayTeamSlug} at ${d.homeTeamSlug} ${d.seasonType} (${d.id})` : ' | got NOT FOUND'));
  }
  return allOk;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const seasonCode = Number(arg('season-code') ?? 20262027);
  const out = arg('out') ?? path.join(tmpdir(), `nhl-games-${Math.floor(seasonCode / 10000)}.json`);
  const snapshotPath = arg('snapshot');
  const cacheDir = arg('cache-dir');
  const useCache = process.argv.includes('--use-cache');

  console.log(`[ingest-nhl] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}  seasonCode=${seasonCode}`);
  if (execute) {
    if (!snapshotPath) {
      console.error('[ingest-nhl] --execute requires --snapshot=<path>. Aborting before any read or write.');
      process.exit(2);
    }
    console.log('[ingest-nhl] SNAPSHOT-BEFORE-WRITE PLAN: every existing games doc with league == "nhl" is read and written to');
    console.log(`[ingest-nhl]   ${snapshotPath}`);
    console.log('[ingest-nhl] before the first batch. If that file cannot be written, nothing is written to Firestore.');
  }
  console.log('');

  const { stats, docs } = await ingestNhlSchedule({
    execute,
    seasonCode,
    snapshotPath: snapshotPath ?? undefined,
    cacheDir: cacheDir ?? undefined,
    useCache,
    log: (m) => console.log(`[ingest-nhl] ${m}`),
  });

  console.log('');
  console.log('=== Ingestion summary ===');
  console.log(`  Fetches:              ${stats.fetches} (retries ${stats.retries}, cache hits ${stats.cacheHits}, clubs resolved ${stats.clubsFetched})`);
  console.log(`  Games seen (raw):     ${stats.gamesSeen}`);
  console.log(`  Unique by game id:    ${stats.uniqueGames}`);
  console.log(`  Docs built:           ${docs.length}  preseason ${stats.byType.preseason}  regular ${stats.byType.regular}`);
  console.log(`  Skipped by gameType:  ${JSON.stringify(stats.skippedByGameType)}`);
  console.log(`  Skipped, non-NHL side: ${stats.skippedUnknownClub.length}`);
  for (const m of stats.skippedUnknownClub) console.log(`    - ${m}`);
  console.log(`  gameDate vs offset-day mismatches: ${stats.dateMismatchOffset.length}`);
  for (const m of stats.dateMismatchOffset) console.log(`    - ${m}`);
  console.log(`  gameDate vs tz-day mismatches:     ${stats.dateMismatchTz.length}`);
  for (const m of stats.dateMismatchTz) console.log(`    - ${m}`);
  console.log(`  Missing venue zone:   ${stats.missingVenueZone.length}`);
  for (const m of stats.missingVenueZone) console.log(`    - ${m}`);
  console.log(`  Neutral-site games:   ${stats.neutralSite.length}`);
  for (const m of stats.neutralSite) console.log(`    - ${m}`);
  console.log(`  Non-North-American:   ${stats.nonNorthAmerican.length}`);
  for (const m of stats.nonNorthAmerican) console.log(`    - ${m}`);
  console.log(`  Earliest preseason:   ${stats.earliestPreseason}`);
  console.log(`  Regular opener:       ${stats.regularOpener}`);
  console.log(`  Regular last:         ${stats.regularLast}`);

  console.log('');
  console.log('=== Home games per club ===');
  const slugs = Object.keys(stats.perClubHome).sort();
  for (const s of slugs) {
    const c = stats.perClubHome[s];
    console.log(`  ${s.padEnd(24)} preseason ${String(c.preseason).padStart(2)}  regular ${String(c.regular).padStart(2)}`);
  }
  const regularCounts = new Set(slugs.map((s) => stats.perClubHome[s].regular));
  console.log(`  distinct regular home counts: ${[...regularCounts].sort().join(', ')}`);

  const truthOk = checkKnownTruth(docs);

  if (!execute) {
    writeFileSync(out, JSON.stringify(docs, null, 1));
    console.log('');
    console.log(`[ingest-nhl] dry-run docs written to ${out}`);
  } else {
    console.log('');
    console.log(`  Existing nhl games before write: ${stats.existingNhlGamesBeforeWrite}`);
    console.log(`  Upserted:                        ${stats.upserted}`);
    console.log(`  Errors:                          ${stats.errors}`);
  }
  process.exit(stats.errors > 0 || !truthOk ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
