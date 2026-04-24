/* eslint-disable no-console */
// CLI wrapper around the shared MLB ingestion logic.
//
// Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/ingest-mlb-schedule.ts
//
// The same ingestion runs weekly as a Vercel Cron via /api/cron/mlb-schedule.
// Run this script manually when you want to force a fresh pull ahead of the
// next scheduled cron (reschedules, postseason expansion, etc.).

import { ingestMlbSchedule } from '../src/lib/ingest-mlb';

async function main() {
  const stats = await ingestMlbSchedule({ log: (m) => console.log(`[ingest-mlb] ${m}`) });
  console.log('');
  console.log('=== Ingestion summary ===');
  console.log(`  Total fetched:         ${stats.totalFetched}`);
  console.log(`  Upserted:              ${stats.upserted}`);
  console.log(`  Postseason:            ${stats.postseason}`);
  console.log(`  Doubleheader games:    ${stats.doubleheaders}`);
  console.log(`  Skipped (bad date):    ${stats.skippedBadDate}`);
  console.log(`  Skipped (slug miss):   ${stats.skippedMissingSlug}`);
  console.log(`  Errors:                ${stats.errors}`);
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
