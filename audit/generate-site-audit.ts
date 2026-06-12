/* eslint-disable no-console */
// Regenerates the [AUTO] sections of docs/SITE-AUDIT.md from repo + Firestore.
//
// It reuses the repo's existing Firestore credential path (src/lib/data ->
// src/lib/firebase, FIREBASE_SERVICE_ACCOUNT_KEY) and performs NO PostHog/GSC/
// Bing calls. [LIVE], [MANUAL], and untagged sections are preserved
// byte-for-byte; only [AUTO] section bodies are regenerated and [AUTO] headers
// are normalized to a generated-date stamp.
//
//   # dry-run (default): write docs/SITE-AUDIT.generated.md + print unified diff
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/generate-site-audit.ts
//
//   # apply: replace docs/SITE-AUDIT.md in place
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     audit/generate-site-audit.ts --execute
//
//   # inspect collected data only (no doc parsing): --summary (digest) | --json
//
// Or via npm: `npm run audit:generate`  /  `npm run audit:generate -- --execute`.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectAuto, REQUIRED_BOTS, type AuditData } from './collect';

const AUDIT_PATH_REL = 'docs/SITE-AUDIT.md';
const GENERATED_PATH_REL = 'docs/SITE-AUDIT.generated.md';

// ── Section body renderers (markdown lines, no surrounding blank lines) ───────

function renderSection3(d: AuditData): string[] {
  const lines: string[] = [];
  lines.push(
    'Per-league data completeness from the field-presence rubric (see `audit/README.md`). ' +
      '**Overall /10** is the signed-off score; **Structural /10** is the season-independent subset ' +
      '(venue resolved + PYV detail + gates + recurring), normalized ×2.',
  );
  lines.push('');
  lines.push('| League | Overall /10 | Structural /10 | Season |');
  lines.push('|--------|-------------|----------------|--------|');
  for (const l of d.dataCompletenessByLeague) {
    lines.push(`| ${l.league} | ${l.score.toFixed(1)} | ${l.structuralScore.toFixed(1)} | ${l.season} |`);
  }
  lines.push('');
  lines.push(
    `Overall reflects current-season promo presence (5 of 10 points require upcoming promos). ` +
      `Leagues flagged \`offseason\` had 0 upcoming promos as of ${d.meta.today}, so their Overall is ` +
      `mostly venue coverage — read **Structural /10** for the season-independent picture.`,
  );
  return lines;
}

function renderSection4(d: AuditData): string[] {
  const c = d.coverage;
  const others = d.pageInventory.totalRoutes - d.pageInventory.dynamicTeamPages;
  return [
    `- Recurring every-game deals: ${c.recurringDeals.covered}/${c.recurringDeals.total} teams populated`,
    `- Venue detail (parking + transit + bag policy): ${c.venueDetail.covered}/${c.venueDetail.total} populated; gate times: ${c.venueDetail.byField.gates}/${c.venueDetail.total}`,
    `- Affiliate readiness: Ticketmaster ${c.affiliate.ticketmasterReady.covered}/${c.affiliate.ticketmasterReady.total}, Fanatics ${c.affiliate.fanaticsReady.covered}/${c.affiliate.fanaticsReady.total}`,
    `- Promo coverage: ${d.promoCounts.upcomingTotal} upcoming across ${d.meta.totalTeams} teams, ${d.promoCounts.allTimeTotal} all-time`,
    `- Page inventory: ${d.pageInventory.totalRoutes} routes (${d.pageInventory.dynamicTeamPages} team pages + ${others} others)`,
    `- Aggregator pages live (${d.aggregatorPages.length}): ${d.aggregatorPages.join(', ')}`,
  ];
}

function renderSection6(d: AuditData): string[] {
  const t = d.technical;
  const lines: string[] = [];
  lines.push(
    `- Canonical: www is canonical and ${t.wwwCanonical.consistent ? 'consistent' : 'INCONSISTENT'} across metadataBase, sitemap, and robots (verified ${d.meta.today}).`,
  );
  lines.push(
    `- Sitemap: ${t.sitemap.singleCanonical ? 'single canonical sitemap' : `MULTIPLE sitemap sources (${t.sitemap.sources.join(', ')})`} at ${t.sitemap.canonicalUrl}; ${t.sitemap.nonWwwDuplicate ? 'NON-WWW DUPLICATE present' : 'no non-www duplicate'}.`,
  );
  lines.push(
    `- robots.txt: ${t.robots.allBotsAllowed ? 'allows' : 'MISSING allow rules for some of'} ${REQUIRED_BOTS.join(', ')}${t.robots.rootDisallowed ? ' — WARNING: root "/" disallow present' : ''}.`,
  );
  lines.push(`- llms.txt: ${t.llmsTxt.present ? 'present' : 'MISSING'}.`);
  lines.push('- Schema presence per template:');
  for (const s of d.schemaPresence) {
    const actual = s.actual.join(' + ') || '(none)';
    const suffix = s.ok ? ' ✓' : ` — GAP: missing ${s.missing.join(' + ')} (expected ${s.expected.join(' + ')})`;
    lines.push(`  - ${s.template}: ${actual}${suffix}`);
  }
  lines.push('- Known bugs:');
  for (const b of d.knownBugs) {
    const label = b.status === 'resolved' ? 'RESOLVED' : b.status === 'open' ? 'OPEN' : 'MANUAL';
    lines.push(`  - [${label}] ${b.description}`);
  }
  return lines;
}

// ── Assembler ─────────────────────────────────────────────────────────────────

type Tag = 'AUTO' | 'LIVE' | 'MANUAL' | 'NONE';

export function detectTag(header: string): Tag {
  if (/\[AUTO\b/.test(header)) return 'AUTO';
  if (/\[LIVE\b/.test(header)) return 'LIVE';
  if (/\[MANUAL\b/.test(header)) return 'MANUAL';
  return 'NONE';
}

export function normalizeAutoHeader(header: string, today: string): string {
  return header.replace(/\[AUTO[^\]]*\]/, `[AUTO, generated ${today}]`);
}

/** Returns regenerated body lines for a known [AUTO] section, or null to preserve. */
function renderAutoBody(header: string, d: AuditData): string[] | null {
  if (/Data completeness by league/.test(header)) return renderSection3(d);
  if (/Content coverage/.test(header)) return renderSection4(d);
  if (/Technical health/.test(header)) return renderSection6(d);
  return null; // unknown [AUTO] section: preserve its existing body (fail-safe)
}

/**
 * Rebuild the document: update the top `Generated:` line, regenerate [AUTO]
 * section bodies + normalize their headers, and preserve every [LIVE],
 * [MANUAL], and untagged section byte-for-byte.
 */
export function assemble(original: string, d: AuditData): string {
  const lines = original.split('\n');
  const today = d.meta.today;

  // Section boundaries = level-2 headers only (### subsections stay in-section).
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (/^## /.test(l)) starts.push(i);
  });
  const firstStart = starts.length ? starts[0] : lines.length;

  // Preamble (everything before the first `## `): update the Generated line.
  const out: string[] = lines.slice(0, firstStart).map((l) => (/^Generated:/.test(l) ? `Generated: ${today}` : l));

  for (let k = 0; k < starts.length; k++) {
    const start = starts[k];
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const header = lines[start];
    const body = lines.slice(start + 1, end); // includes blank lines + ### subsections

    if (detectTag(header) === 'AUTO') {
      const rendered = renderAutoBody(header, d);
      if (rendered) {
        // Preserve the original section's surrounding blank-line shape: one
        // blank after the header, the rendered content, one trailing blank.
        out.push(normalizeAutoHeader(header, today), '', ...rendered, '');
        continue;
      }
    }
    out.push(header, ...body);
  }

  return out.join('\n');
}

// ── Unified diff (system `diff -u`; exits 1 when files differ) ────────────────

function unifiedDiff(aPath: string, bPath: string): string {
  try {
    return execFileSync('diff', ['-u', aPath, bPath], { encoding: 'utf8' });
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    if (typeof e.stdout === 'string') return e.stdout;
    throw err;
  }
}

// ── Auxiliary digests (Phase 1 behavior, retained) ───────────────────────────

function printSummary(d: AuditData): void {
  const L = (s: string) => console.log(s);
  L(`PromoNight site audit — collectAuto() — ${d.meta.today}`);
  L(`Teams: ${d.meta.totalTeams} | Leagues: ${d.meta.leagues.join(', ')} | Rubric max: ${d.meta.rubricMax}`);
  L('');
  L('Data completeness by league (Overall / Structural, season):');
  for (const l of d.dataCompletenessByLeague) {
    L(`  ${l.league.padEnd(5)} ${l.score.toFixed(1).padStart(4)} / ${l.structuralScore.toFixed(1).padStart(4)}  ${l.season}  (${l.teamCount} teams)`);
  }
  L('');
  L('Coverage:');
  L(`  Recurring deals:  ${d.coverage.recurringDeals.covered}/${d.coverage.recurringDeals.total}`);
  const vd = d.coverage.venueDetail;
  L(`  Venue PYV detail: ${vd.covered}/${vd.total}  (parking ${vd.byField.parking}, transit ${vd.byField.transit}, bag ${vd.byField.bagPolicy}, gates ${vd.byField.gates})`);
  L(`  TM-ready:         ${d.coverage.affiliate.ticketmasterReady.covered}/${d.coverage.affiliate.ticketmasterReady.total}`);
  L(`  Fanatics-ready:   ${d.coverage.affiliate.fanaticsReady.covered}/${d.coverage.affiliate.fanaticsReady.total}`);
  L('');
  L(`Pages: ${d.pageInventory.totalRoutes} routes (${d.pageInventory.dynamicTeamPages} dynamic team pages)`);
  L(`Aggregator pages (${d.aggregatorPages.length}): ${d.aggregatorPages.join(', ')}`);
  L('');
  L('Findings:');
  for (const f of d.findings) L(`  - ${f}`);
}

// ── Entry ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const repoRoot = process.cwd();
  const data = await collectAuto({ repoRoot });

  if (args.includes('--json')) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (args.includes('--summary')) {
    printSummary(data);
    return;
  }

  const auditPath = join(repoRoot, AUDIT_PATH_REL);
  const original = readFileSync(auditPath, 'utf8');
  const regenerated = assemble(original, data);

  if (args.includes('--execute')) {
    writeFileSync(auditPath, regenerated);
    console.log(`Wrote ${AUDIT_PATH_REL} (${regenerated.length} bytes).`);
    return;
  }

  // Dry-run (default): write the generated file and print a unified diff.
  const generatedPath = join(repoRoot, GENERATED_PATH_REL);
  writeFileSync(generatedPath, regenerated);
  const diff = unifiedDiff(auditPath, generatedPath);
  if (diff.trim()) {
    console.log(diff);
    console.log(`Dry run: wrote ${GENERATED_PATH_REL}. Review the diff above, then re-run with --execute to replace ${AUDIT_PATH_REL}.`);
  } else {
    console.log(`No changes: ${AUDIT_PATH_REL} is already up to date. (Wrote identical ${GENERATED_PATH_REL}.)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
