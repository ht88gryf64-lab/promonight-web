/* eslint-disable no-console */
// READ-ONLY. The 7 `venues` ids with no matching venueHubs id are per-team
// suffixed docs for shared buildings. A suppression keyed on the canonical slug
// does not reach them, so they are a blind spot for every slug-keyed gate.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRANSIT_SUPPRESSED } from '../src/lib/venue-transit-suppression';
import { VENUE_RESOLUTION_MAP } from '../src/lib/venue-resolution-map';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

async function main() {
  const [venues, hubs, teams] = await Promise.all([
    db.collection('venues').get(),
    db.collection('venueHubs').get(),
    db.collection('teams').get(),
  ]);
  const hubIds = new Set(hubs.docs.map((d) => d.id));
  const supp = new Set(TRANSIT_SUPPRESSED.map((t) => t.hub));
  const byName = new Map<string, string>();
  for (const v of venues.docs) {
    const t = v.data().team;
    if (typeof t === 'string' && !byName.has(t)) byName.set(t, v.id);
  }
  const pageFor = (vid: string) => teams.docs.filter((t) => {
    const d = t.data();
    return byName.get(`${d.city} ${d.name}`) === vid || VENUE_RESOLUTION_MAP[t.id] === vid;
  }).map((t) => t.id);

  const orphans = venues.docs.filter((d) => !hubIds.has(d.id));
  console.log(`venues docs with NO matching venueHubs id: ${orphans.length}\n`);
  for (const o of orphans) {
    const d = o.data();
    // does its canonical base slug sit on the suppression list?
    const base = o.id.replace(/-(panthers|jets|giants|rams|chargers|clippers|lakers|islanders|devils|sparks|liberty|dc|nets)$/, '');
    const t = String(d.publicTransit ?? '').trim();
    console.log(`--- ${o.id}`);
    console.log(`    team field: "${d.team}"   team pages: ${pageFor(o.id).join(', ') || '(none)'}`);
    console.log(`    base slug "${base}" is a hub: ${hubIds.has(base)}   base is SUPPRESSED: ${supp.has(base)}`);
    console.log(`    transit: ${t ? `"${t.slice(0, 200)}"` : '(none)'}`);
  }

  // The real question: any suffixed doc whose BASE is suppressed but which the gate misses
  const missed = orphans.filter((o) => {
    const base = o.id.replace(/-[a-z]+$/, '');
    return supp.has(base) && String(o.data().publicTransit ?? '').trim();
  });
  console.log(`\nSUFFIXED DOCS PUBLISHING TRANSIT WHOSE BASE IS SUPPRESSED (gate misses these): ${missed.length}`);
  missed.forEach((m) => console.log(`  ${m.id} -> pages ${pageFor(m.id).join(', ')}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
