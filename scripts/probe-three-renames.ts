/* eslint-disable no-console */
// READ-ONLY. Scope check for the three partially-wrong renames before they are
// silenced. The renames were applied to venueHubs, so the defect is hub-side,
// but a venues doc for the same building carries an independent string that
// must be read before it is silenced or left alone.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRANSIT_SUPPRESSED } from '../src/lib/venue-transit-suppression';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();
const TARGETS = ['coca-cola-coliseum', 'bank-of-america-stadium', 'sanford-stadium'];

async function main() {
  const already = new Set(TRANSIT_SUPPRESSED.map((t) => t.hub));
  for (const id of TARGETS) {
    const [h, v] = await Promise.all([
      db.collection('venueHubs').doc(id).get(),
      db.collection('venues').doc(id).get(),
    ]);
    console.log(`\n${'='.repeat(78)}\n${id}   already listed: ${already.has(id)}`);
    console.log(`  venueHubs doc: ${h.exists ? 'yes' : 'NO'}   venues doc: ${v.exists ? 'yes' : 'NO'}`);
    if (h.exists) {
      const t = h.data()!.publicTransit;
      console.log(`  HUB transit: ${JSON.stringify(t, null, 2)?.slice(0, 900)}`);
      const src = h.data()!.sources ?? {};
      const key = Object.keys(src).find((k) => k.startsWith('publicTransit') || k === 'transit');
      console.log(`  HUB source key: ${key ?? '(none)'} -> ${key ? JSON.stringify(src[key]) : ''}`);
    }
    if (v.exists) {
      console.log(`  VENUES transit: ${JSON.stringify(v.data()!.publicTransit ?? null)}`);
      console.log(`  VENUES team: ${v.data()!.team}`);
    }
    // which team pages render this building?
    const teams = await db.collection('teams').get();
    const hits = teams.docs.filter((t) => {
      const d = t.data();
      return v.exists && v.data()!.team === `${d.city} ${d.name}`;
    }).map((t) => t.id);
    console.log(`  team pages via venues doc: ${hits.length ? hits.join(', ') : '(none)'}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
