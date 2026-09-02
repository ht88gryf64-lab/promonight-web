/* eslint-disable no-console */
// Writes the venue's IANA time zone onto the venue RECORD, so both repos read
// one source and the render-side map (src/lib/cfb/venue-timezones.ts) becomes
// the fallback rather than the record.
//
//   cfbVenues/{id}.timezone           86 campus stadiums (CFB_VENUE_TIMEZONES)
//   venueHubs/{slug}.timezone          the 8 neutral-site buildings the 2026
//                                      cfbGames reference (CFB_NEUTRAL_HUB_TIMEZONES)
//
// Each write also sets `timezoneSource`, a plain string naming the map and its
// generation date, as a sibling field: NOT under venueHubs `sources`, which is
// the URL-provenance map read by the provenance probes and must stay URLs only.
// `updatedAt` is not touched on either collection (same discipline as the
// pipeline's cfbVenues hygiene passes).
//
// The 51 home schools in CFB_UNTRACKED_HOME_TIMEZONES have no venue doc to
// carry the field (50 untracked opponents; Washington State is tracked but was
// seeded without a venue). They are reported, not written: there is no record
// to write to, so the render map stays the only source for those games.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/cfb/populate-venue-timezones.ts              # DRY: diff only
//   ... scripts/cfb/populate-venue-timezones.ts --execute  # snapshot, write, read back
//
// Discipline: dry-run default; --execute snapshots the FULL before-state of every
// doc it will touch to scripts/snapshots/ BEFORE any write; merge-writes only the
// two fields; refuses to overwrite an existing DIFFERENT timezone (that is a
// conflict for a human, not a script); reads back and verifies after writing.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../../src/lib/firebase';
import { CFB_COLLECTIONS } from '../../src/lib/cfb/types';
import { CFB_VENUE_TIMEZONES, CFB_NEUTRAL_HUB_TIMEZONES, CFB_UNTRACKED_HOME_TIMEZONES } from '../../src/lib/cfb/venue-timezones';

const execute = process.argv.includes('--execute');
const SOURCE = 'src/lib/cfb/venue-timezones.ts (generated 2026-09-02 from cfbVenues lat/lng; mirrors scripts/cfb/lib/schools-2026.ts venueTz)';

type Plan = { collection: string; id: string; current: string | null; target: string; action: 'set' | 'skip-same' | 'CONFLICT' | 'MISSING-DOC'; name: string | null };

async function plan(collection: string, map: Record<string, string>): Promise<{ plans: Plan[]; before: Record<string, unknown> }> {
  const plans: Plan[] = [];
  const before: Record<string, unknown> = {};
  for (const [id, target] of Object.entries(map)) {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) { plans.push({ collection, id, current: null, target, action: 'MISSING-DOC', name: null }); continue; }
    const d = snap.data() ?? {};
    before[`${collection}/${id}`] = d;
    const current = typeof d.timezone === 'string' ? d.timezone : null;
    const action: Plan['action'] = current === null ? 'set' : current === target ? 'skip-same' : 'CONFLICT';
    plans.push({ collection, id, current, target, action, name: typeof d.name === 'string' ? d.name : null });
  }
  return { plans, before };
}

async function main() {
  console.log(`mode: ${execute ? 'EXECUTE' : 'DRY RUN (no writes)'}\n`);
  const venues = await plan(CFB_COLLECTIONS.venues, CFB_VENUE_TIMEZONES);
  const hubs = await plan('venueHubs', CFB_NEUTRAL_HUB_TIMEZONES);
  const all = [...venues.plans, ...hubs.plans];

  console.log('collection | id | current | target | action');
  for (const p of all) console.log(`${p.collection} | ${p.id} | ${p.current ?? '(none)'} | ${p.target} | ${p.action}`);
  const count = (a: Plan['action']) => all.filter((p) => p.action === a).length;
  console.log(`\ncfbVenues: ${venues.plans.length} mapped; venueHubs: ${hubs.plans.length} mapped`);
  console.log(`set=${count('set')} skip-same=${count('skip-same')} conflict=${count('CONFLICT')} missing-doc=${count('MISSING-DOC')}`);

  // The venueless home schools: which have any doc at all to carry the field?
  console.log('\nvenueless home schools (CFB_UNTRACKED_HOME_TIMEZONES): no cfbVenues doc by construction; cfbSchools doc?');
  let withSchoolDoc = 0;
  for (const [id, tz] of Object.entries(CFB_UNTRACKED_HOME_TIMEZONES)) {
    const s = await db.collection(CFB_COLLECTIONS.schools).doc(id).get();
    const v = s.exists && typeof s.data()?.venueId === 'string' && s.data()!.venueId ? s.data()!.venueId : null;
    if (s.exists) withSchoolDoc++;
    console.log(`  ${id} | ${tz} | cfbSchools doc: ${s.exists ? 'YES' : 'no'} | venueId: ${v ?? '(none)'}`);
  }
  console.log(`  ${Object.keys(CFB_UNTRACKED_HOME_TIMEZONES).length} schools, ${withSchoolDoc} with a cfbSchools doc, 0 with a venue doc: nothing to write the field to.`);

  if (count('CONFLICT') > 0) { console.log('\nREFUSING: a stored timezone differs from the map on at least one doc. Resolve by hand.'); process.exit(2); }
  if (!execute) { console.log('\nDRY RUN complete. Re-run with --execute to write.'); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(process.cwd(), 'scripts', 'snapshots');
  mkdirSync(dir, { recursive: true });
  const snapPath = join(dir, `venue-timezones.${stamp}.snapshot.json`);
  writeFileSync(snapPath, JSON.stringify({ takenAt: new Date().toISOString(), before: { ...venues.before, ...hubs.before } }, null, 2));
  console.log(`\nsnapshot: ${Object.keys(venues.before).length + Object.keys(hubs.before).length} docs -> ${snapPath}`);

  const targets = all.filter((p) => p.action === 'set');
  let batch = db.batch(); let n = 0; let written = 0;
  for (const p of targets) {
    batch.set(db.collection(p.collection).doc(p.id), { timezone: p.target, timezoneSource: SOURCE }, { merge: true });
    n++; written++;
    if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
  console.log(`wrote timezone + timezoneSource on ${written} docs (merge, no updatedAt)`);

  // read back
  let ok = 0, bad: string[] = [];
  for (const p of targets) {
    const d = (await db.collection(p.collection).doc(p.id).get()).data() ?? {};
    if (d.timezone === p.target && d.timezoneSource === SOURCE) ok++; else bad.push(`${p.collection}/${p.id}`);
  }
  console.log(`read-back: ${ok}/${targets.length} carry the expected fields${bad.length ? `; MISMATCH: ${bad.join(', ')}` : ''}`);
  if (bad.length) process.exit(1);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
