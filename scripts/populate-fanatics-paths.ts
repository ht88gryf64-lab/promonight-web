/* eslint-disable no-console */
/**
 * One-shot script that populates `fanaticsPath` on every team document
 * in Firestore from scripts/fanatics-team-mapping.json.
 *
 * Usage:
 *   npm run populate:fanatics              # writes to Firestore
 *   npm run populate:fanatics -- --dry-run # validates only, no writes
 *
 * Behavior mirrors scripts/populate-ticketmaster-fields.ts:
 *   1. Loads the mapping JSON. Top-level shape is { _meta, teams } where
 *      teams is keyed by PromoNight slug.
 *   2. Validates every entry's `fanaticsPath` against the canonical
 *      regex /^/(mlb|nba|nhl|nfl|mls|wnba)/[a-z0-9-]+/o-N+t-N+z-N-N$/.
 *      If any fails, the script logs the bad entries and exits without
 *      writing — all-or-nothing prevents partial Firestore state.
 *   3. Loads all teams from Firestore once for cross-referencing.
 *   4. Writes via batched commits (max 500 ops per batch — well above the
 *      167-team count today, but kept for forward-compat).
 *   5. Logs progress + a final summary including symmetric differences
 *      between JSON and Firestore.
 *
 * Re-running is safe — `update()` overwrites the field idempotently.
 *
 * Dry-run mode (the default for first invocation): does steps 1-3 plus a
 * pre-flight check that every JSON slug exists in Firestore, but skips
 * step 4. Confirms expected count before any writes go out.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

interface MappingEntry {
  league: string;
  fanaticsPath: string;
  trackingLink?: string;
  impactAdId?: string;
  name?: string;
  confidence: string;
  source: string;
}

interface MappingFile {
  _meta?: {
    totalTeams?: number;
    leagues?: string[];
  };
  teams: Record<string, MappingEntry>;
}

interface ParsedEntry {
  internalSlug: string;
  fanaticsPath: string;
  league: string;
}

// Canonical Fanatics path regex. Three +-joined segments after the
// /{league}/{slug}/ prefix. NO +d-/+f-/+c- modifiers (those are product
// URLs). NO query string. NO trailing slash. League is lowercase.
const PATH_RE =
  /^\/(mlb|nba|nhl|nfl|mls|wnba)\/[a-z0-9-]+\/o-\d+\+t-\d+\+z-\d+-\d+$/;

const FIRESTORE_BATCH_LIMIT = 500;

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  // 1. Load + parse-validate the mapping JSON before touching Firestore.
  const mappingPath = join(process.cwd(), 'scripts/fanatics-team-mapping.json');
  const raw = readFileSync(mappingPath, 'utf8');
  const mapping = JSON.parse(raw) as MappingFile;
  const teams = mapping.teams ?? {};

  const slugs = Object.keys(teams).sort();
  console.log(`Loaded ${slugs.length} entries from ${mappingPath}.`);
  if (DRY_RUN) console.log('Mode: DRY RUN (no writes)');

  const parsed: ParsedEntry[] = [];
  const parseFailures: Array<{ slug: string; path: string }> = [];

  for (const internalSlug of slugs) {
    const entry = teams[internalSlug];
    if (!PATH_RE.test(entry.fanaticsPath)) {
      parseFailures.push({ slug: internalSlug, path: entry.fanaticsPath });
      continue;
    }
    parsed.push({
      internalSlug,
      fanaticsPath: entry.fanaticsPath,
      league: entry.league,
    });
  }

  if (parseFailures.length > 0) {
    console.error(
      `\n${parseFailures.length} entry/entries failed canonical-path validation. ` +
        `Aborting without writes:`,
    );
    for (const f of parseFailures) {
      console.error(`  ${f.slug}: ${f.path}`);
    }
    process.exit(1);
  }
  console.log(`All ${parsed.length} fanaticsPath values passed regex validation.`);

  // 2. Connect to Firestore (deferred so the parse-validate step above
  //    runs even when Firebase Admin can't be initialized).
  console.log('Connecting to Firestore...');
  const { db } = await import('../src/lib/firebase');

  // 3. Load every team once. Faster than 167 individual existence checks.
  const teamsSnap = await db.collection('teams').get();
  const teamDocs = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  const teamLeague = new Map<string, string>();
  const teamDisplayName = new Map<string, string>();
  for (const doc of teamsSnap.docs) {
    teamDocs.set(doc.id, doc);
    const data = doc.data();
    teamLeague.set(doc.id, typeof data?.league === 'string' ? data.league : '?');
    teamDisplayName.set(
      doc.id,
      `${typeof data?.city === 'string' ? data.city : ''} ${
        typeof data?.name === 'string' ? data.name : ''
      }`.trim(),
    );
  }
  console.log(`Loaded ${teamDocs.size} teams from Firestore.\n`);

  // Pre-flight: which JSON entries have a matching Firestore doc?
  const stats = {
    written: 0,
    skipped: 0,
    notFound: [] as string[],
    failed: [] as Array<{ slug: string; reason: string }>,
  };

  const writable: ParsedEntry[] = [];
  for (const p of parsed) {
    if (!teamDocs.has(p.internalSlug)) {
      stats.notFound.push(p.internalSlug);
      continue;
    }
    writable.push(p);
  }

  console.log(`Resolvable in Firestore: ${writable.length} / ${parsed.length}`);
  if (stats.notFound.length > 0) {
    console.log(`Not in Firestore (${stats.notFound.length}):`);
    for (const s of stats.notFound) console.log(`  - ${s}`);
  }

  if (DRY_RUN) {
    // Symmetric difference for diagnostic
    const jsonSlugs = new Set(parsed.map((p) => p.internalSlug));
    const firestoreOnly: string[] = [];
    for (const slug of teamDocs.keys()) {
      if (!jsonSlugs.has(slug)) firestoreOnly.push(slug);
    }

    console.log('');
    console.log('=== Dry-run summary ===');
    console.log(`JSON entries (validated): ${parsed.length}`);
    console.log(`Firestore teams:          ${teamDocs.size}`);
    console.log(`Resolvable (would write): ${writable.length}`);
    console.log(`In JSON but not Firestore: ${stats.notFound.length}`);
    console.log(`In Firestore but not JSON: ${firestoreOnly.length}`);
    if (firestoreOnly.length > 0) {
      console.log("\nIn Firestore but not JSON (won't have fanaticsPath populated):");
      for (const s of firestoreOnly) console.log(`  - ${s}`);
    }
    console.log('\nNo writes performed. Re-run without --dry-run to apply.');
    return;
  }

  // 4. Batched writes — group up to FIRESTORE_BATCH_LIMIT ops per batch
  //    and commit. With 167 teams this is one batch today, but the
  //    chunking is forward-compat for league expansion.
  console.log('\nBatched writes:');
  const batches: ParsedEntry[][] = [];
  for (let i = 0; i < writable.length; i += FIRESTORE_BATCH_LIMIT) {
    batches.push(writable.slice(i, i + FIRESTORE_BATCH_LIMIT));
  }
  for (let bi = 0; bi < batches.length; bi += 1) {
    const chunk = batches[bi];
    const batch = db.batch();
    for (const p of chunk) {
      const ref = db.collection('teams').doc(p.internalSlug);
      batch.update(ref, { fanaticsPath: p.fanaticsPath });
    }
    try {
      await batch.commit();
      stats.written += chunk.length;
      console.log(
        `  batch ${bi + 1}/${batches.length}: committed ${chunk.length} updates`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // If the batch failed atomically, all ops in this chunk are not
      // applied. Log each as a failure for diagnosis.
      for (const p of chunk) {
        stats.failed.push({ slug: p.internalSlug, reason });
      }
      console.log(
        `  batch ${bi + 1}/${batches.length}: FAILED — ${reason}`,
      );
    }
  }

  // Per-team detail (after the batch commits) for visual confirmation.
  for (let i = 0; i < writable.length; i += 1) {
    const p = writable[i];
    const league = teamLeague.get(p.internalSlug) ?? p.league;
    const displayName = teamDisplayName.get(p.internalSlug) ?? p.internalSlug;
    const failed = stats.failed.find((f) => f.slug === p.internalSlug);
    const status = failed ? `FAILED — ${failed.reason}` : '✓';
    console.log(
      `[${String(i + 1).padStart(3)}/${writable.length}] ${league} ${displayName}: ${p.fanaticsPath.slice(0, 60)}${p.fanaticsPath.length > 60 ? '…' : ''} ${status}`,
    );
  }
  stats.skipped = stats.notFound.length;

  // 5. Symmetric difference summary.
  const jsonSlugs = new Set(parsed.map((p) => p.internalSlug));
  const firestoreOnly: string[] = [];
  for (const slug of teamDocs.keys()) {
    if (!jsonSlugs.has(slug)) firestoreOnly.push(slug);
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Written:                   ${stats.written}`);
  console.log(`Skipped (not in Firestore): ${stats.skipped}`);
  console.log(`Failed:                    ${stats.failed.length}`);
  console.log(`In JSON but not Firestore: ${stats.notFound.length}`);
  console.log(`In Firestore but not JSON: ${firestoreOnly.length}`);

  if (stats.failed.length > 0) {
    console.log('\nFailures:');
    for (const f of stats.failed) {
      console.log(`  ${f.slug}: ${f.reason}`);
    }
  }
  if (stats.notFound.length > 0) {
    console.log('\nIn JSON but not Firestore (no doc to update — investigate):');
    for (const s of stats.notFound) console.log(`  ${s}`);
  }
  if (firestoreOnly.length > 0) {
    console.log("\nIn Firestore but not JSON (won't have fanaticsPath populated):");
    for (const s of firestoreOnly) console.log(`  ${s}`);
  }

  if (stats.failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
