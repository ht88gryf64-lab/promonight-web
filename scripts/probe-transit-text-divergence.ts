/* eslint-disable no-console */
// READ-ONLY. The suppression list's reasons were researched against venueHubs
// transit text. Wiring the same key into the venues consumers only withholds
// the right thing if the two corpora carry the same claim. Where they diverge,
// the hub-derived reason may not describe what the venues doc actually says.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRANSIT_SUPPRESSED } from '../src/lib/venue-transit-suppression';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function main() {
  const [venues, hubs] = await Promise.all([
    db.collection('venues').get(),
    db.collection('venueHubs').get(),
  ]);
  const V = new Map(venues.docs.map((d) => [d.id, d.data()]));
  const H = new Map(hubs.docs.map((d) => [d.id, d.data()]));

  console.log('=== suppressed hubs that publish transit in `venues` ===');
  for (const { hub } of TRANSIT_SUPPRESSED) {
    const v = V.get(hub);
    if (!v || !norm(v.publicTransit)) continue;
    const h = H.get(hub);
    const ht = norm(h?.transitNotes ?? h?.publicTransit ?? h?.transit?.notes);
    const vt = norm(v.publicTransit);
    const same = ht && ht === vt;
    console.log(`\n--- ${hub}`);
    console.log(`  venues: ${vt.slice(0, 220)}`);
    console.log(`  hub   : ${ht ? ht.slice(0, 220) : '(hub carries no transit prose)'}`);
    console.log(`  IDENTICAL TEXT: ${same ? 'yes' : 'NO — independent strings'}`);
  }

  console.log('\n\n=== candidates for extension: do these carry hub transit too? ===');
  for (const id of ['nationals-park', 'mercedes-benz-stadium', 'great-american-ball-park', 'kauffman-stadium', 'ball-arena', 'dicks-sporting-goods-park', 'dignity-health-sports-park', 'bmo-stadium', 'saputo-stadium']) {
    const v = V.get(id); const h = H.get(id);
    const ht = norm(h?.transitNotes ?? h?.publicTransit ?? h?.transit?.notes);
    console.log(`\n--- ${id}  (venues doc: ${v ? 'yes' : 'NO'}, hub doc: ${h ? 'yes' : 'NO'})`);
    console.log(`  venues: ${norm(v?.publicTransit).slice(0, 260) || '(none)'}`);
    console.log(`  hub   : ${ht.slice(0, 260) || '(none)'}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
