/* eslint-disable no-console */
// CLI wrapper around the shared NFL ingestion logic in src/lib/ingest-nfl.ts.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/ingest-nfl-schedule.ts             # dry-run, no writes
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/ingest-nfl-schedule.ts --execute   # writes to Firestore
//
// Unlike MLB, there is no scheduled cron. The 2026 NFL schedule is
// released once (mid-May) with sporadic flex revisions during the
// season; this script is run manually after each revision.
//
// Idempotency: writes use batch.set(doc, data, { merge: true }) so
// re-runs are safe. The `ingestedAt` server timestamp is the only field
// that changes on a no-op re-run.

import { ingestNflSchedule } from '../src/lib/ingest-nfl';

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[ingest-nfl] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log('');

  const stats = await ingestNflSchedule({
    execute,
    log: (m) => console.log(`[ingest-nfl] ${m}`),
  });

  console.log('');
  console.log('=== Ingestion summary ===');
  console.log(`  Total fetched:    ${stats.totalFetched}`);
  console.log(`  Prepared:         ${stats.prepared}`);
  console.log(`  International:    ${stats.international}`);
  console.log(`  Primetime:        ${stats.primetime}`);
  console.log(`  Time TBD (flex):  ${stats.timeTbd}`);
  console.log(`  Skipped (date):   ${stats.skippedBadDate}`);
  console.log(`  Upserted:         ${stats.upserted}`);
  console.log(`  Errors:           ${stats.errors}`);
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
