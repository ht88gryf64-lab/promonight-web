/* eslint-disable no-console */
// READ-ONLY. Full venues.publicTransit text for every building the suppression
// list would silence on the team pages, so each recorded reason can be checked
// against the claim the reader would actually lose.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRANSIT_SUPPRESSED } from '../src/lib/venue-transit-suppression';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

async function main() {
  const venues = await db.collection('venues').get();
  const V = new Map(venues.docs.map((d) => [d.id, d.data()]));
  for (const { hub, reason } of TRANSIT_SUPPRESSED) {
    const v = V.get(hub);
    const t = String(v?.publicTransit ?? '').trim();
    if (!t) continue;
    console.log(`\n${'='.repeat(78)}\n${hub}`);
    console.log(`REASON ON FILE: ${reason}`);
    console.log(`\nVENUES TEXT THE READER LOSES:\n${t}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
