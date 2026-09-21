/* eslint-disable no-console */
// Approve reader-contributed sections from the cfbContributions review queue
// onto a cfbSchools doc, section by section.
//
// THE ONLY WRITER of cfbSchools.editorial. The public POST endpoint
// (src/app/api/cfb/contribute/route.ts) writes the queue and stops; graduating
// a submission is this script, run by a human, with --execute.
//
// DISCIPLINE
//   dry-run default        nothing writes without --execute
//   section allowlist      --approve names them; everything else is HELD
//   snapshot before write  the full prior school doc, to its OWN pool
//   contact never copied   buildApproval reads content[] and name only, and
//                          src/lib/__tests__/cfb-approve-contribution.test.ts
//                          asserts nothing address-shaped reaches cfbSchools
//   merge, not set          held sections stay absent; a later run can add one
//                          without republishing what is already live
//
// SNAPSHOT POOL. Approval snapshots go to their OWN collection
// (cfbEditorialSnapshots) plus a local file, and NOTHING prunes them.
//
//   The brief asked for this because cfbSchools snapshots were thought to share
//   the CFB sweep's 10-deep pool. They do not, and never did: the sweep's pool
//   is scannerState/{league}/snapshots, its restore path writes only
//   teams/{teamId}/{promos|recurringDeals}/{docId}, nothing in the pipeline
//   touches cfbSchools, and prune({keep:10}) has no caller outside its own
//   test. There was no sharing to undo. A dedicated unpruned pool is still the
//   right answer -- an approval is rare, hand-made and unrebuildable, so its
//   undo should not age out on anyone else's schedule.
//
// USAGE
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/cfb/approve-contribution.ts \
//     --id=<contributionId> --approve=whyYouGo,venueInWords \
//     --reviewer="Matt Kovalik" [--edits=<edits.json>] [--execute]
//
//   --edits is { "<contributionKey>": "<corrected text>" }: TYPO FIXES ONLY.
//   The diff is printed before the write so a rewrite cannot slip through
//   unseen.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../../src/lib/firebase';
import { CFB_COLLECTIONS } from '../../src/lib/cfb/types';
import { buildApproval, SECTION_MAP, type ContributionKey } from '../../src/lib/cfb/editorial';

const QUEUE = 'cfbContributions';
const SNAPSHOTS = 'cfbEditorialSnapshots';

const args = process.argv.slice(2);
const arg = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const EXECUTE = args.includes('--execute');
const ID = arg('id');
const REVIEWER = arg('reviewer') || '';
const APPROVE = (arg('approve') || '').split(',').map((s) => s.trim()).filter(Boolean) as ContributionKey[];
const EDITS_PATH = arg('edits');

function die(msg: string): never { console.error(`\n${msg}\n`); process.exit(1); }

async function main() {
  if (!ID) die('--id=<contributionId> is required.');
  if (!REVIEWER) die('--reviewer="<name>" is required. An approval is attributable or it does not happen.');
  const unknown = APPROVE.filter((k) => !(k in SECTION_MAP));
  if (unknown.length) die(`unknown section(s): ${unknown.join(', ')}\nknown: ${Object.keys(SECTION_MAP).join(', ')}`);

  const edits: Partial<Record<ContributionKey, string>> = EDITS_PATH
    ? JSON.parse(await import('node:fs').then((m) => m.readFileSync(EDITS_PATH, 'utf8')))
    : {};

  const ref = db.collection(QUEUE).doc(ID);
  const snap = await ref.get();
  if (!snap.exists) die(`${QUEUE}/${ID} does not exist.`);
  const doc = snap.data() as Record<string, unknown>;

  const schoolId = typeof doc.schoolId === 'string' ? doc.schoolId : '';
  if (!schoolId) die(`${QUEUE}/${ID} has no schoolId.`);
  const schoolRef = db.collection(CFB_COLLECTIONS.schools).doc(schoolId);
  const schoolSnap = await schoolRef.get();
  if (!schoolSnap.exists) die(`${CFB_COLLECTIONS.schools}/${schoolId} does not exist. Refusing to create a school doc from a contribution.`);
  const priorSchool = schoolSnap.data() as Record<string, unknown>;

  const approvedAt = new Date().toISOString();
  const result = buildApproval({ contributionId: ID, doc, approve: APPROVE, edits, approvedAt });

  // ── report BEFORE anything ────────────────────────────────────────────────
  console.log(`\n${EXECUTE ? 'EXECUTE' : 'DRY RUN'}  ${QUEUE}/${ID}  ->  ${CFB_COLLECTIONS.schools}/${schoolId}`);
  console.log(`reviewer: ${REVIEWER}`);
  console.log(`\nper-section verdict:`);
  for (const [target, v] of Object.entries(result.verdicts)) {
    const note = v.reason ? `  (${v.reason})` : v.verdict === 'approved' && !v.renders ? '  (approved, RENDERS NOWHERE)' : '';
    console.log(`  ${v.verdict === 'approved' ? 'APPROVE' : 'HOLD   '}  ${target}${note}`);
  }

  // Show the exact text going live, and any edit as a visible diff.
  const content = (doc.content ?? {}) as Record<string, unknown>;
  for (const key of APPROVE) {
    const target = SECTION_MAP[key];
    const written = result.editorial[target as keyof typeof result.editorial];
    if (!written || Array.isArray(written)) continue;
    const submitted = typeof content[key] === 'string' ? (content[key] as string) : '';
    if (edits[key] !== undefined && edits[key] !== submitted) {
      console.log(`\n  EDIT ${target}:`);
      console.log(`    submitted: ${JSON.stringify(submitted)}`);
      console.log(`    publishing: ${JSON.stringify(written.text)}`);
    } else {
      console.log(`\n  ${target} (as written): ${JSON.stringify(written.text)}`);
    }
  }
  if (result.approvedButNotRendered.length) {
    console.log(`\n  NOTE: approved but no template paints it: ${result.approvedButNotRendered.join(', ')}`);
  }
  if (!Object.keys(result.editorial).length) {
    console.log('\nNothing to write. Every section held.\n');
    return;
  }

  // ── snapshot, to its OWN pool, BEFORE the write ───────────────────────────
  const stamp = approvedAt.replace(/[:.]/g, '-');
  const snapshotId = `${schoolId}-${stamp}`;
  const snapshot = {
    snapshotId, kind: 'cfb-editorial-approval',
    contributionId: ID, schoolId, reviewer: REVIEWER, takenAt: approvedAt,
    // the FULL prior doc, so a restore is a plain set() back to this
    priorSchool,
    priorHadEditorial: priorSchool.editorial !== undefined,
    sectionsApproved: Object.keys(result.editorial),
  };
  const dir = join(process.cwd(), 'scripts', 'snapshots');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `cfb-editorial.${snapshotId}.snapshot.json`);
  writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(`\nsnapshot -> ${file}`);

  if (!EXECUTE) {
    console.log(`would write ${SNAPSHOTS}/${snapshotId}`);
    console.log(`would merge editorial onto ${CFB_COLLECTIONS.schools}/${schoolId}: ${Object.keys(result.editorial).join(', ')}`);
    console.log(`would stamp reviewedBy/reviewedAt/sections on ${QUEUE}/${ID}`);
    console.log('\nDRY RUN. Nothing written. Re-run with --execute.\n');
    return;
  }

  await db.collection(SNAPSHOTS).doc(snapshotId).set(snapshot);
  console.log(`snapshot -> ${SNAPSHOTS}/${snapshotId} (own pool, never pruned)`);

  const batch = db.batch();
  // MERGE, not set: held sections stay absent and every machine-owned field on
  // the school doc is untouched. The Phase 2 writers carry `editorial` forward
  // through their own allowlist (src/lib/cfb/human-owned.ts), so a later
  // rebuild cannot undo this.
  batch.set(schoolRef, { editorial: result.editorial, updatedAt: approvedAt }, { merge: true });
  batch.set(ref, {
    status: 'reviewed',
    reviewedBy: REVIEWER,
    reviewedAt: approvedAt,
    sections: result.verdicts,
    approvedSections: Object.keys(result.editorial),
    heldSections: Object.entries(result.verdicts).filter(([, v]) => v.verdict === 'held').map(([k]) => k),
  }, { merge: true });
  await batch.commit();

  // read back: an approval that did not land is worse than one not attempted
  const after = (await schoolRef.get()).data() as Record<string, unknown>;
  const live = (after.editorial ?? {}) as Record<string, unknown>;
  const missing = Object.keys(result.editorial).filter((k) => live[k] === undefined);
  if (missing.length) die(`WROTE BUT DID NOT READ BACK: ${missing.join(', ')}. Restore from ${file}.`);
  console.log(`\nwrote ${Object.keys(result.editorial).join(', ')} to ${CFB_COLLECTIONS.schools}/${schoolId}, read back clean.`);
  console.log(`recorded reviewedBy/reviewedAt/sections on ${QUEUE}/${ID}.`);
  console.log(`\nNEXT: revalidate /cfb/${schoolId} and count the prose in the SERVED HTML (known-issues 33).\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
