/* eslint-disable no-console */
/**
 * One-shot migration: derive a fully-qualified `fanaticsUrl` on every team
 * document from the legacy root-relative `fanaticsPath`.
 *
 * Why: `fanaticsPath` is shaped `/{league}/{slug}/o-N+t-N+z-N-N`. That value
 * rides on every Team object that crosses into a client component, so it
 * lands verbatim in the RSC Flight payload of the homepage, /teams, every
 * team page, /playoffs, and /promos/*. Googlebot and browser link-discovery
 * resolve the bare path against the page origin (getpromonight.com) → 404.
 * A value that starts with `https://` can't be mistaken for an internal link.
 *
 * Usage:
 *   npm run migrate:fanatics-url              # dry run (default) — no writes
 *   npm run migrate:fanatics-url -- --execute # writes fanaticsUrl to Firestore
 *
 * Behavior:
 *   1. Connect to Firestore, load all team docs.
 *   2. For each doc that has a non-empty `fanaticsPath` and does NOT already
 *      have a non-empty `fanaticsUrl`, compute
 *      `fanaticsUrl = 'https://www.fanatics.com' + fanaticsPath`.
 *   3. Dry run: log slug / old path / computed URL / doc ref, print counts,
 *      exit without writing.
 *      --execute: write `fanaticsUrl` via one batched commit per league.
 *   4. `fanaticsPath` is left in place — backwards-compat for the deploy
 *      cycle while the read path still falls back to it. A follow-up
 *      migration deletes it once production has baked.
 *
 * Idempotent: re-running skips docs that already have `fanaticsUrl`, so a
 * second run (dry or execute) is a no-op.
 */
const EXECUTE = process.argv.includes('--execute');
const FANATICS_ORIGIN = 'https://www.fanatics.com';
const FIRESTORE_BATCH_LIMIT = 500;

interface Candidate {
  slug: string;
  league: string;
  fanaticsPath: string;
  fanaticsUrl: string;
  ref: FirebaseFirestore.DocumentReference;
}

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (writes)' : 'DRY RUN (no writes)'}`);
  console.log('Connecting to Firestore...');
  const { db } = await import('../src/lib/firebase');

  const snap = await db.collection('teams').get();
  console.log(`Loaded ${snap.size} team docs.\n`);

  const candidates: Candidate[] = [];
  let alreadyMigrated = 0;
  let noPath = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const fanaticsPath =
      typeof data.fanaticsPath === 'string' && data.fanaticsPath.length > 0
        ? data.fanaticsPath
        : null;
    const existingUrl =
      typeof data.fanaticsUrl === 'string' && data.fanaticsUrl.length > 0
        ? data.fanaticsUrl
        : null;

    if (existingUrl) {
      alreadyMigrated += 1;
      continue;
    }
    if (!fanaticsPath) {
      noPath += 1;
      continue;
    }

    candidates.push({
      slug: doc.id,
      league: typeof data.league === 'string' ? data.league : '?',
      fanaticsPath,
      fanaticsUrl: `${FANATICS_ORIGIN}${fanaticsPath}`,
      ref: doc.ref,
    });
  }

  candidates.sort((a, b) =>
    a.league === b.league ? a.slug.localeCompare(b.slug) : a.league.localeCompare(b.league),
  );

  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    console.log(
      `[${String(i + 1).padStart(3)}/${candidates.length}] ${c.league} ${c.slug}\n` +
        `      path: ${c.fanaticsPath}\n` +
        `       url: ${c.fanaticsUrl}\n` +
        `       ref: ${c.ref.path}`,
    );
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Team docs:                     ${snap.size}`);
  console.log(`Already have fanaticsUrl:       ${alreadyMigrated}`);
  console.log(`No fanaticsPath (nothing to do): ${noPath}`);
  console.log(`Would migrate:                  ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('\nNothing to migrate.');
    return;
  }

  if (!EXECUTE) {
    console.log('\nNo writes performed. Re-run with --execute to apply.');
    return;
  }

  // One batched commit per league (well under the 500-op limit; kept per-
  // league for legible progress and forward-compat with league expansion).
  const byLeague = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = byLeague.get(c.league) ?? [];
    list.push(c);
    byLeague.set(c.league, list);
  }

  console.log('\nBatched writes:');
  let written = 0;
  for (const [league, list] of byLeague) {
    for (let i = 0; i < list.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = list.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const batch = db.batch();
      for (const c of chunk) batch.update(c.ref, { fanaticsUrl: c.fanaticsUrl });
      await batch.commit();
      written += chunk.length;
      console.log(`  ${league}: committed ${chunk.length} updates`);
    }
  }

  console.log(`\nDone. Wrote fanaticsUrl to ${written} team doc(s).`);
  console.log('fanaticsPath left in place — delete it in a follow-up migration once the deploy has baked.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
