/* eslint-disable no-console */
// Gate 3b of the affiliate attribution fixes (audit/affiliate-attribution-audit.md,
// ranked item 10): remove the SeatGeek brand name from the seeded Plan Your
// Visit parking prose on the 5 MLS venues that name it. SeatGeek was declined
// twice as an affiliate partner; user-facing copy should not name it as a
// purchase channel. The removals are mechanical ("or SeatGeek" / "SeatGeek or"
// dropped), leaving the venue logistics facts intact.
//
// Protocol (per the operator's instruction):
//   - dry-run by default: prints per-venue before/after, writes NOTHING.
//   - --execute: snapshots the CURRENT Firestore parkingInfo of every target
//     doc to scripts/snapshots/seatgeek-pyv-snapshot-<ISO>.json BEFORE any
//     write, then updates parkingInfo only (merge, no field or doc is ever
//     deleted; restore = re-write the snapshot values).
//   - Each edit is anchored on an exact expected substring of the LIVE doc
//     text. A doc whose text no longer contains its anchor (already edited,
//     or drifted since the 2026-07 seed) is reported and SKIPPED, never
//     pattern-matched loosely.
//
// The companion edit to scripts/arena-plan-your-visit-mls-west.json (same
// replacements at the source) keeps a future seeder re-run from reintroducing
// the name.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/remove-seatgeek-pyv-prose.ts             # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/remove-seatgeek-pyv-prose.ts --execute   # snapshot, then write

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { db } from '../src/lib/firebase';

// Exact-substring anchors, keyed by Firestore venues/{slug} doc id (none of
// the five is affected by the seeder's SLUG_REMAP).
const EDITS: Record<string, { find: string; replace: string }> = {
  'q2-stadium': {
    find: 'through the Austin FC app or SeatGeek',
    replace: 'through the Austin FC app',
  },
  'toyota-stadium': {
    find: 'through the FC Dallas app or SeatGeek',
    replace: 'through the FC Dallas app',
  },
  'dignity-health-sports-park': {
    find: 'through the LA Galaxy app or SeatGeek',
    replace: 'through the LA Galaxy app',
  },
  'snapdragon-stadium': {
    find: 'through the San Diego FC app or SeatGeek',
    replace: 'through the San Diego FC app',
  },
  'paypal-park': {
    find: 'via SeatGeek or ParkMobile',
    replace: 'via ParkMobile',
  },
};

const execute = process.argv.includes('--execute');

async function main() {
  const plans: Array<{ slug: string; before: string; after: string }> = [];
  const skips: string[] = [];
  const snapshot: Record<string, { parkingInfo: string }> = {};

  for (const [slug, edit] of Object.entries(EDITS)) {
    const doc = await db.collection('venues').doc(slug).get();
    if (!doc.exists) {
      skips.push(`${slug}: venues doc MISSING, skipped`);
      continue;
    }
    const before = doc.data()?.parkingInfo;
    if (typeof before !== 'string' || before.length === 0) {
      skips.push(`${slug}: parkingInfo absent/empty, skipped`);
      continue;
    }
    if (!before.includes(edit.find)) {
      const already = before.includes('SeatGeek')
        ? 'still contains "SeatGeek" but NOT the expected anchor (drifted text; needs a human look)'
        : 'no longer contains "SeatGeek" (already clean)';
      skips.push(`${slug}: anchor not found; live text ${already}; skipped`);
      continue;
    }
    const after = before.replace(edit.find, edit.replace);
    if (after.includes('SeatGeek')) {
      skips.push(`${slug}: post-edit text would STILL contain "SeatGeek"; skipped for a human look`);
      continue;
    }
    snapshot[slug] = { parkingInfo: before };
    plans.push({ slug, before, after });
  }

  console.log(`\n${execute ? 'EXECUTE' : 'DRY-RUN'}: ${plans.length} venue(s) to edit, ${skips.length} skipped\n`);
  for (const p of plans) {
    console.log(`── ${p.slug}`);
    console.log(`  BEFORE: ...${excerpt(p.before)}...`);
    console.log(`  AFTER:  ...${excerpt(p.after)}...`);
  }
  for (const s of skips) console.log(`SKIP  ${s}`);

  if (!execute) {
    console.log('\nDry-run only. Re-run with --execute to snapshot and write.');
    return;
  }
  if (plans.length === 0) {
    console.log('\nNothing to write.');
    return;
  }

  const dir = join(__dirname, 'snapshots');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `seatgeek-pyv-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), field: 'parkingInfo', docs: snapshot }, null, 2));
  console.log(`\nSnapshot written: ${file}`);

  for (const p of plans) {
    await db.collection('venues').doc(p.slug).set({ parkingInfo: p.after }, { merge: true });
    console.log(`WROTE venues/${p.slug}.parkingInfo`);
  }

  // Post-write verification: re-read every doc and confirm the edit landed.
  for (const p of plans) {
    const now = (await db.collection('venues').doc(p.slug).get()).data()?.parkingInfo;
    const ok = typeof now === 'string' && now === p.after && !now.includes('SeatGeek');
    console.log(`${ok ? 'VERIFIED' : 'VERIFY FAILED'} venues/${p.slug}`);
    if (!ok) process.exitCode = 1;
  }
}

function excerpt(text: string): string {
  const i = Math.max(0, text.toLowerCase().indexOf('advance') - 20);
  return text.slice(i, i + 160).replace(/\n/g, ' ');
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
