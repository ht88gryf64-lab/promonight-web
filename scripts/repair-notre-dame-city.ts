/* eslint-disable no-console */
// One-field repair: cfbVenues/notre-dame-stadium.city holds the leaked wikitext
// row "| coordinates         =" (audit/cfb-matchup-architecture.md, closure note
// 2026-08-14). Nothing user-facing renders the raw field (venueCity() shields
// it), but the stored value is junk. Repair target: "South Bend", the
// hand-verified value from src/lib/cfb/venue-cities.ts:78.
//
// Protocol: dry-run default; --execute snapshots the current value to
// scripts/snapshots/ BEFORE writing, merge-writes city only (nothing deleted),
// then re-reads to verify.
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { db } from '../src/lib/firebase';

const SLUG = 'notre-dame-stadium';
const EXPECTED_JUNK_RE = /^\|\s*coordinates\s*=\s*$/;
const REPAIR_VALUE = 'South Bend';
const execute = process.argv.includes('--execute');

async function main() {
  const ref = db.collection('cfbVenues').doc(SLUG);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`${SLUG} doc missing`);
  const before = doc.data()?.city;
  console.log(`current city: ${JSON.stringify(before)}`);
  if (typeof before !== 'string' || !EXPECTED_JUNK_RE.test(before.trim())) {
    console.log('ABORT: current value does not match the expected wikitext junk anchor; nothing written.');
    return;
  }
  console.log(`repair: ${JSON.stringify(before)} -> ${JSON.stringify(REPAIR_VALUE)}`);
  if (!execute) {
    console.log('Dry-run only. Re-run with --execute to snapshot and write.');
    return;
  }
  const dir = join(__dirname, 'snapshots');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `notre-dame-city-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), doc: `cfbVenues/${SLUG}`, field: 'city', before }, null, 2));
  console.log(`Snapshot written: ${file}`);
  await ref.set({ city: REPAIR_VALUE }, { merge: true });
  const now = (await ref.get()).data()?.city;
  console.log(`${now === REPAIR_VALUE ? 'VERIFIED' : 'VERIFY FAILED'}: city is now ${JSON.stringify(now)}`);
  if (now !== REPAIR_VALUE) process.exitCode = 1;
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
