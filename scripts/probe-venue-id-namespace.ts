/* eslint-disable no-console */
// READ-ONLY. Do venues doc ids share a namespace with venueHubs slugs? The
// transit suppression list keys on hub slugs; wiring it to the venues consumers
// is only sound if the key means the same building in both corpora.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRANSIT_SUPPRESSED } from '../src/lib/venue-transit-suppression';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

async function main() {
  const [venues, hubs] = await Promise.all([
    db.collection('venues').get(),
    db.collection('venueHubs').get(),
  ]);
  const hubIds = new Set(hubs.docs.map((d) => d.id));
  const vIds = venues.docs.map((d) => d.id);
  const overlap = vIds.filter((id) => hubIds.has(id));
  console.log(`venues=${vIds.length} venueHubs=${hubIds.size} shared-id=${overlap.length}`);
  console.log(`venues ids that are NOT hub ids: ${vIds.length - overlap.length}`);
  console.log('sample venues ids:', vIds.slice(0, 10).join(' | '));

  // Which suppressed hubs have a venues doc at all, and does it carry transit?
  const supp = TRANSIT_SUPPRESSED.map((e) => e.hub);
  const byId = new Map(venues.docs.map((d) => [d.id, d.data()]));
  let present = 0, withTransit = 0;
  const hits: string[] = [];
  for (const h of supp) {
    const v = byId.get(h);
    if (!v) continue;
    present++;
    if (typeof v.publicTransit === 'string' && v.publicTransit.trim()) {
      withTransit++;
      hits.push(`${h}  team=${v.team}  transit="${String(v.publicTransit).slice(0, 90)}"`);
    }
  }
  console.log(`\nsuppressed hubs (${supp.length}): ${present} have a same-id venues doc, ${withTransit} of those publish transit`);
  hits.forEach((h) => console.log('  ' + h));

  // Name-based match for suppressed hubs with no same-id venues doc
  const missing = supp.filter((h) => !byId.has(h));
  console.log(`\nsuppressed hubs with NO same-id venues doc: ${missing.length}`);
  missing.forEach((m) => console.log('  ' + m));
}
main().catch((e) => { console.error(e); process.exit(1); });
