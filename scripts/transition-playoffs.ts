/* eslint-disable no-console */
/**
 * Playoff-round transition tool for appConfig/playoffs + the playoffPromos
 * collection. Run this whenever a round ends and the alive-team set shrinks
 * (e.g. Conference Finals → Finals).
 *
 * ── Auth ────────────────────────────────────────────────────────────────────
 * Firestore credentials come from the FIREBASE_SERVICE_ACCOUNT_KEY env var (a
 * JSON-stringified service account), exactly like src/lib/firebase.ts. There is
 * NO service-account.json file in this repo. Always run with --env-file:
 *
 *   npx tsx --env-file=.env.local scripts/transition-playoffs.ts \
 *     --keep san-antonio-spurs,new-york-knicks,carolina-hurricanes,vegas-golden-knights \
 *     --nba-round nba_finals --nhl-round stanley_cup_final \
 *     --delete-promos \
 *     [--apply]
 *
 * ── Data model (verified, not assumed) ───────────────────────────────────────
 *  • appConfig/playoffs: { playoffsActive, nbaActive, nhlActive, nbaRound,
 *    nhlRound, activeTeamIds[], eliminatedTeamIds[], lastScanDate, updatedAt }.
 *    "Still alive" = activeTeamIds − eliminatedTeamIds (see getStillAlive-
 *    PlayoffTeamIds in src/lib/data.ts). activeTeamIds is append-only history
 *    written by the external scanner; we shrink the alive set by ADDING to
 *    eliminatedTeamIds, never by pruning activeTeamIds.
 *  • playoffPromos: a FLAT collection of individual promo docs with
 *    auto-generated IDs. Each doc carries a `teamId` FIELD. Deletion therefore
 *    filters on the teamId field — NOT on the document id.
 *
 * ── What it does ──────────────────────────────────────────────────────────────
 *  1. eliminatedTeamIds ∪= (activeTeamIds not in --keep)  → alive set becomes --keep
 *  2. nbaRound / nhlRound set to the provided round codes
 *  3. updatedAt = serverTimestamp (lastScanDate is the scanner's; left untouched)
 *  4. --delete-promos: deletes every playoffPromos doc whose teamId is not in --keep
 *
 * Dry-run by default. Pass --apply to write. Re-running is idempotent.
 */
import {
  initializeApp,
  cert,
  getApps,
} from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const KNOWN_ROUND_CODES = new Set([
  'first_round',
  'conference_semifinals',
  'conference_finals',
  'nba_finals',
  'stanley_cup_final',
]);

const BATCH_LIMIT = 450; // Firestore caps batched writes at 500.

type Args = {
  keep: string[];
  nbaRound?: string;
  nhlRound?: string;
  deletePromos: boolean;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { keep: [], deletePromos: false, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    const eq = tok.indexOf('=');
    const flag = eq === -1 ? tok : tok.slice(0, eq);
    const inlineVal = eq === -1 ? undefined : tok.slice(eq + 1);
    const take = () => inlineVal ?? argv[++i];
    switch (flag) {
      case '--keep':
        out.keep = take()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--nba-round':
        out.nbaRound = take();
        break;
      case '--nhl-round':
        out.nhlRound = take();
        break;
      case '--delete-promos':
        out.deletePromos = true;
        break;
      case '--apply':
        out.apply = true;
        break;
      default:
        console.error(`Unknown argument: ${tok}`);
        process.exit(2);
    }
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Run with:\n' +
        '  npx tsx --env-file=.env.local scripts/transition-playoffs.ts ...',
    );
    process.exit(2);
  }
  if (args.keep.length === 0) {
    console.error('Refusing to run with an empty --keep list (that would eliminate everyone). Pass --keep slug,slug,...');
    process.exit(2);
  }
  for (const code of [args.nbaRound, args.nhlRound]) {
    if (code && !KNOWN_ROUND_CODES.has(code)) {
      console.warn(`⚠ round code "${code}" is not in the known set ${[...KNOWN_ROUND_CODES].join(', ')} — proceeding anyway.`);
    }
  }

  const mode = args.apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)';
  console.log(`\n=== transition-playoffs — ${mode} ===`);
  console.log('keep (still-alive after this transition):', args.keep.join(', '));
  if (args.nbaRound) console.log('nbaRound →', args.nbaRound);
  if (args.nhlRound) console.log('nhlRound →', args.nhlRound);
  console.log('delete stale playoffPromos:', args.deletePromos);

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  }
  const db = getFirestore();
  const keepSet = new Set(args.keep);

  // ── 1. appConfig/playoffs ──────────────────────────────────────────────────
  const cfgRef = db.collection('appConfig').doc('playoffs');
  const cfgSnap = await cfgRef.get();
  if (!cfgSnap.exists) {
    console.error('appConfig/playoffs does not exist — aborting.');
    process.exit(1);
  }
  const cfg = cfgSnap.data()!;
  const activeTeamIds: string[] = Array.isArray(cfg.activeTeamIds) ? cfg.activeTeamIds : [];
  const eliminatedTeamIds: string[] = Array.isArray(cfg.eliminatedTeamIds) ? cfg.eliminatedTeamIds : [];

  const keepNotActive = args.keep.filter((t) => !activeTeamIds.includes(t));
  if (keepNotActive.length > 0) {
    console.warn(`⚠ these --keep teams are NOT in activeTeamIds and will not render as alive: ${keepNotActive.join(', ')}`);
  }

  const alreadyElim = new Set(eliminatedTeamIds);
  const toEliminate = activeTeamIds.filter((t) => !keepSet.has(t) && !alreadyElim.has(t));
  const aliveAfter = activeTeamIds.filter((t) => keepSet.has(t)); // active ∩ keep
  console.log('\n-- appConfig/playoffs --');
  console.log('currently still-alive:', activeTeamIds.filter((t) => !alreadyElim.has(t)).join(', ') || '(none)');
  console.log('newly eliminated this run:', toEliminate.join(', ') || '(none — already up to date)');
  console.log('still-alive AFTER:', aliveAfter.join(', ') || '(none)');

  // ── 2. playoffPromos to delete ───────────────────────────────────────────────
  let deleteRefs: FirebaseFirestore.DocumentReference[] = [];
  if (args.deletePromos) {
    const promosSnap = await db.collection('playoffPromos').get();
    const perTeamDelete: Record<string, number> = {};
    let keepCount = 0;
    for (const doc of promosSnap.docs) {
      const teamId = doc.data().teamId as string | undefined;
      if (teamId && keepSet.has(teamId)) {
        keepCount++;
      } else {
        deleteRefs.push(doc.ref);
        const k = teamId || '(no teamId)';
        perTeamDelete[k] = (perTeamDelete[k] || 0) + 1;
      }
    }
    console.log('\n-- playoffPromos --');
    console.log(`total docs: ${promosSnap.size} | keep (Finals teams): ${keepCount} | DELETE: ${deleteRefs.length}`);
    if (keepCount + deleteRefs.length !== promosSnap.size) {
      console.error('Sanity check failed: keep + delete != total. Aborting.');
      process.exit(1);
    }
    console.log('  per-team deletions:');
    Object.entries(perTeamDelete)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => console.log(`    ${t}: ${n}`));
  }

  if (!args.apply) {
    console.log('\nDRY-RUN complete. No writes performed. Re-run with --apply to commit.');
    process.exit(0);
  }

  // ── APPLY ────────────────────────────────────────────────────────────────────
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (toEliminate.length > 0) update.eliminatedTeamIds = FieldValue.arrayUnion(...toEliminate);
  if (args.nbaRound) update.nbaRound = args.nbaRound;
  if (args.nhlRound) update.nhlRound = args.nhlRound;
  await cfgRef.update(update);
  console.log('\n✓ appConfig/playoffs updated.');

  if (args.deletePromos && deleteRefs.length > 0) {
    let deleted = 0;
    for (const group of chunk(deleteRefs, BATCH_LIMIT)) {
      const batch = db.batch();
      for (const ref of group) batch.delete(ref);
      await batch.commit();
      deleted += group.length;
      console.log(`  …deleted ${deleted}/${deleteRefs.length}`);
    }
    console.log(`✓ deleted ${deleted} stale playoffPromos docs.`);
  }

  // ── Verify post-conditions ─────────────────────────────────────────────────
  const after = (await cfgRef.get()).data()!;
  const afterAlive = (after.activeTeamIds as string[]).filter(
    (t) => !(after.eliminatedTeamIds as string[]).includes(t),
  );
  console.log('\n=== VERIFY ===');
  console.log('still-alive now:', afterAlive.join(', '));
  console.log('nbaRound:', after.nbaRound, '| nhlRound:', after.nhlRound);
  const aliveMatches =
    afterAlive.length === args.keep.length && args.keep.every((t) => afterAlive.includes(t));
  console.log('alive set matches --keep:', aliveMatches ? 'YES ✓' : 'NO ✗');
  if (args.deletePromos) {
    const remaining = await db.collection('playoffPromos').get();
    const strays = remaining.docs.filter((d) => {
      const t = d.data().teamId as string | undefined;
      return !t || !keepSet.has(t);
    });
    console.log(`playoffPromos remaining: ${remaining.size} (stray non-keep docs: ${strays.length})`);
  }
  process.exit(aliveMatches ? 0 : 1);
}

main().catch((err) => {
  console.error('transition-playoffs failed:', err);
  process.exit(1);
});
