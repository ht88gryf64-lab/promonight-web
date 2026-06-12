/* eslint-disable no-console */
// Regenerates the [AUTO] sections of docs/SITE-AUDIT.md from repo + Firestore.
//
// It reuses the repo's existing Firestore credential path (src/lib/data ->
// src/lib/firebase, FIREBASE_SERVICE_ACCOUNT_KEY) and performs NO PostHog/GSC/
// Bing calls. The [LIVE] and [MANUAL] sections are never touched.
//
// PHASE 1 (this file, for now): read-only. Runs collectAuto() and prints the
// structured result. NO file writes. The assembler + dry-run/--execute write
// path lands in Phase 2.
//
//   # read-only: print the collected [AUTO] data as JSON
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/generate-site-audit.ts
//
//   # add --summary for a compact human-readable digest instead of raw JSON
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/generate-site-audit.ts --summary

import { collectAuto, type AuditData } from './collect';

function printSummary(d: AuditData): void {
  const L = (s: string) => console.log(s);
  L(`PromoNight site audit — collectAuto() — ${d.meta.today}`);
  L(`Teams: ${d.meta.totalTeams} | Leagues: ${d.meta.leagues.join(', ')} | Rubric max: ${d.meta.rubricMax}`);
  L('');
  L('Data completeness by league (/10):');
  for (const l of d.dataCompletenessByLeague) {
    L(`  ${l.league.padEnd(5)} ${l.score.toFixed(1).padStart(4)}  (${l.teamCount} teams)`);
  }
  L('');
  L('Coverage:');
  L(`  Recurring deals:  ${d.coverage.recurringDeals.covered}/${d.coverage.recurringDeals.total}  [${d.coverage.recurringDeals.teamSlugs.join(', ')}]`);
  const vd = d.coverage.venueDetail;
  L(`  Venue PYV detail: ${vd.covered}/${vd.total}  (parking ${vd.byField.parking}, transit ${vd.byField.transit}, bag ${vd.byField.bagPolicy}, gates ${vd.byField.gates})`);
  L(`  TM-ready:         ${d.coverage.affiliate.ticketmasterReady.covered}/${d.coverage.affiliate.ticketmasterReady.total}`);
  L(`  Fanatics-ready:   ${d.coverage.affiliate.fanaticsReady.covered}/${d.coverage.affiliate.fanaticsReady.total}`);
  L('');
  L(`Promos: ${d.promoCounts.upcomingTotal} upcoming, ${d.promoCounts.allTimeTotal} all-time`);
  L(`  upcoming by league: ${Object.entries(d.promoCounts.upcomingByLeague).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  L('');
  L(`Pages: ${d.pageInventory.totalRoutes} routes (${d.pageInventory.dynamicTeamPages} dynamic team pages)`);
  for (const b of d.pageInventory.byRouteType) L(`  ${String(b.count).padStart(4)}  ${b.routeType}`);
  L('');
  L(`Aggregator pages (${d.aggregatorPages.length}): ${d.aggregatorPages.join(', ')}`);
  L('');
  L('Schema presence:');
  for (const s of d.schemaPresence) {
    L(`  [${s.ok ? 'OK ' : 'GAP'}] ${s.template}: actual [${s.actual.join(', ')}] vs expected [${s.expected.join(', ')}]${s.missing.length ? ` — missing ${s.missing.join(', ')}` : ''}`);
  }
  L('');
  L('Technical:');
  L(`  robots: all bots allowed=${d.technical.robots.allBotsAllowed}, root-disallow=${d.technical.robots.rootDisallowed}`);
  L(`  llms.txt present=${d.technical.llmsTxt.present}`);
  L(`  sitemap: single-canonical=${d.technical.sitemap.singleCanonical} (${d.technical.sitemap.canonicalUrl}), non-www-dup=${d.technical.sitemap.nonWwwDuplicate}`);
  L(`  www-canonical consistent=${d.technical.wwwCanonical.consistent}`);
  L('');
  L('Known bugs:');
  for (const b of d.knownBugs) L(`  [${b.status}] ${b.id}: ${b.description}`);
  L('');
  L('Findings:');
  for (const f of d.findings) L(`  - ${f}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const summary = args.includes('--summary');

  const data = await collectAuto();

  if (summary) printSummary(data);
  else console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
