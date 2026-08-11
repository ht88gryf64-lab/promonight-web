/* eslint-disable no-console */
// CFB Phase 1A data repair. Two defects, one pass, over a closed set of docs.
//
//   1. TOMBSTONE the redundant doc in each duplicate pair. Both schools publish
//      the same game and each names itself home, so the parser stored two docs
//      and every school page rendered the fixture twice.
//   2. WRITE neutralVenueHubSlug on the surviving doc of each neutral-site
//      fixture. cfbGames.venueId cannot express a neutral site: cfbVenues holds
//      one campus stadium per school and no neutral buildings, so the parser
//      leaves venueId empty for these by design (run-phase2.ts:83 and :99).
//
// Both fields are in HUMAN_OWNED_FIELDS, so run-phase2.ts carries them across a
// rebuild and clearCollections() refuses to wipe while they are present.
//
// Snapshots every doc it will touch BEFORE writing. Tombstones, never deletes.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/cfb/repair-neutral-and-dupes.ts              # DRY
//   ... scripts/cfb/repair-neutral-and-dupes.ts --execute  # writes

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { db } from '../../src/lib/firebase';
import { CFB_COLLECTIONS } from '../../src/lib/cfb/types';

const EXECUTE = process.argv.includes('--execute');
const SNAPSHOT = process.argv.find((a) => a.startsWith('--snapshot='))?.replace('--snapshot=', '')
  ?? '/private/tmp/claude-501/-Users-mattkovalik-promonight-web/346d5ecb-5f28-4438-a414-197bdd339388/scratchpad/p1aw-snapshot.json';

/** Duplicate pairs. `keep` survives, `tombstone` is hidden.
 *  Rule: (a) broadcast.confirmed, then (b) normalized "H:MM AM/PM" kickoff
 *  shape, then (c) the school the official sources designate as home. One
 *  documented deviation, marked below. */
const PAIRS: Array<{ keep: string; tombstone: string; why: string }> = [
  {
    keep: '2026-2026-08-29-north-carolina-tcu',
    tombstone: '2026-2026-08-29-tcu-north-carolina',
    why: 'DEVIATION from rule (c). (a) and (b) both tie. (c) designated home points at TCU (Aer Lingus College Football Classic, Dublin), but the TCU doc is verified:false AND stores "11:00 AM ET" when the real kickoff is 11:00 AM CT / noon ET, so it mislabels the zone. The UNC doc is verified:true with the correct noon ET. Keeping the TCU doc would render "Kickoff TBA" and a wrong time.',
  },
  {
    keep: '2026-2026-09-05-auburn-baylor',
    tombstone: '2026-2026-09-05-baylor-auburn',
    why: 'Rule (b): "2:30 PM" is the normalized shape, "2:30 p.m." is not. Agrees with verified (true vs false) and with the known one-hour zone error on the Baylor doc.',
  },
  {
    keep: '2026-2026-09-06-ole-miss-louisville',
    tombstone: '2026-2026-09-06-louisville-ole-miss',
    why: 'Rule (c): (a) and (b) tie and both are verified:true, so designated home decides. Ole Miss is the designated home team for the Music City Kickoff; the two kickoffs are the same instant in different zones, so no data quality is lost either way.',
  },
  {
    keep: '2026-2026-09-06-notre-dame-wisconsin',
    tombstone: '2026-2026-09-06-wisconsin-notre-dame',
    why: 'Rule (c): (a) and (b) tie and both are verified:true. ESPN and the Notre Dame release both state Notre Dame serves as the home team at Lambeau Field.',
  },
  {
    keep: '2026-2026-10-31-florida-georgia',
    tombstone: '2026-2026-10-31-georgia-florida',
    why: 'Rule (a): ABC confirmed beats TBD unconfirmed. Stated in the Phase 1A report.',
  },
  {
    keep: '2026-2026-10-31-navy-notre-dame',
    tombstone: '2026-2026-10-31-notre-dame-navy',
    why: 'Rule (a): confirmed beats unconfirmed on the same network string. Stated in the Phase 1A report.',
  },
  {
    keep: '2026-2026-12-12-navy-army',
    tombstone: '2026-2026-12-12-army-navy',
    why: 'Rule (b): "3:00 PM" is the normalized shape, "3:00 p.m." is not. Stated in the Phase 1A report.',
  },
  {
    keep: '2026-2026-09-19-kansas-arizona-state',
    tombstone: '2026-2026-09-19-kansas-arizona-state-university',
    why: 'NOT a home/away swap. Both docs have home=kansas; the away id drifted because kuathletics.com writes the long-form university name. Keep the doc whose away id resolves in cfbSchools, since the other renders "Arizona State University" through prettifySlug with no colors and no venue.',
  },
];

/** venueHubs doc id for each neutral fixture, keyed by the SURVIVING doc.
 *  These are venueHubs ids, never cfbVenues ids. */
const NEUTRAL_HUBS: Record<string, string> = {
  '2026-2026-09-05-auburn-baylor': 'mercedes-benz-stadium',
  '2026-2026-10-31-florida-georgia': 'mercedes-benz-stadium',
  '2026-2026-09-06-ole-miss-louisville': 'nissan-stadium',
  '2026-2026-09-06-notre-dame-wisconsin': 'lambeau-field',
  '2026-2026-09-19-cincinnati-miami-oh': 'tql-stadium',
  '2026-2026-09-19-virginia-west-virginia': 'bank-of-america-stadium',
  '2026-2026-10-31-navy-notre-dame': 'gillette-stadium',
  '2026-2026-12-12-navy-army': 'metlife-stadium',
};

/** Deliberately left empty. Their venues exist in no collection, and both
 *  fixtures are outside the 32-name matchup registry. */
const NEUTRAL_LEFT_EMPTY: Record<string, string> = {
  '2026-2026-08-29-north-carolina-tcu': 'Aviva Stadium, Dublin (no hub doc)',
  '2026-2026-09-19-kansas-arizona-state': 'Wembley Stadium, London (no hub doc)',
};

async function main() {
  console.log(`CFB Phase 1A repair [${EXECUTE ? 'EXECUTE' : 'DRY'}]\n`);

  const touched = [...PAIRS.map((p) => p.keep), ...PAIRS.map((p) => p.tombstone), ...Object.keys(NEUTRAL_HUBS)];
  const ids = [...new Set(touched)];

  // ── snapshot BEFORE anything ──
  const snaps: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const d = await db.collection(CFB_COLLECTIONS.games).doc(id).get();
    if (!d.exists) { missing.push(id); continue; }
    snaps[id] = d.data();
  }
  if (missing.length) {
    console.error(`ABORT: ${missing.length} doc(s) named in the plan do not exist:`);
    missing.forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), collection: CFB_COLLECTIONS.games, docs: snaps }, null, 2));
  console.log(`snapshot: ${ids.length} docs -> ${SNAPSHOT}\n`);

  // ── plan ──
  console.log('TOMBSTONES');
  for (const p of PAIRS) {
    const k = snaps[p.keep] as any;
    const t = snaps[p.tombstone] as any;
    const already = t.tombstoned === true;
    console.log(`  keep      ${p.keep}`);
    console.log(`            home=${k.homeSchoolId} away=${k.awaySchoolId} verified=${k.verified} kickoff="${k.kickoff?.time}" ${k.kickoff?.tz}`);
    console.log(`  tombstone ${p.tombstone}${already ? '  [ALREADY TOMBSTONED, no-op]' : ''}`);
    console.log(`            home=${t.homeSchoolId} away=${t.awaySchoolId} verified=${t.verified} kickoff="${t.kickoff?.time}" ${t.kickoff?.tz}`);
    console.log(`  why       ${p.why}\n`);
  }

  console.log('NEUTRAL VENUE HUB SLUGS');
  for (const [docId, slug] of Object.entries(NEUTRAL_HUBS)) {
    const g = snaps[docId] as any;
    const hub = await db.collection('venueHubs').doc(slug).get();
    const cur = g.neutralVenueHubSlug;
    console.log(`  ${docId}`);
    console.log(`     -> ${slug}   hubExists=${hub.exists}${cur ? `   (already set to "${cur}")` : ''}`);
    if (!hub.exists) { console.error(`     ABORT: venueHubs/${slug} does not exist`); process.exit(1); }
  }
  console.log('\nLEFT EMPTY BY DECISION');
  for (const [docId, why] of Object.entries(NEUTRAL_LEFT_EMPTY)) console.log(`  ${docId}: ${why}`);

  if (!EXECUTE) {
    console.log('\nDRY. No writes. Re-run with --execute to apply.');
    process.exit(0);
  }

  // ── write ──
  const batch = db.batch();
  for (const p of PAIRS) {
    batch.update(db.collection(CFB_COLLECTIONS.games).doc(p.tombstone), { tombstoned: true });
  }
  for (const [docId, slug] of Object.entries(NEUTRAL_HUBS)) {
    batch.update(db.collection(CFB_COLLECTIONS.games).doc(docId), { neutralVenueHubSlug: slug });
  }
  await batch.commit();
  console.log(`\nEXECUTED: ${PAIRS.length} tombstoned, ${Object.keys(NEUTRAL_HUBS).length} neutralVenueHubSlug written.`);
  console.log(`rollback: restore from ${SNAPSHOT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
