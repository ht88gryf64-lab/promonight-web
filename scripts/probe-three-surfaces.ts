/* eslint-disable no-console */
// READ-ONLY. Which live surfaces render transit for the three buildings being
// silenced, so the blast radius is known before the entries land.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { VENUE_RESOLUTION_MAP } from '../src/lib/venue-resolution-map';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();
const TARGETS = ['coca-cola-coliseum', 'bank-of-america-stadium', 'sanford-stadium'];

async function main() {
  const [teams, venues, hubs] = await Promise.all([
    db.collection('teams').get(),
    db.collection('venues').get(),
    db.collection('venueHubs').get(),
  ]);
  const byName = new Map<string, string>();
  for (const v of venues.docs) {
    const t = v.data().team;
    if (typeof t === 'string' && !byName.has(t)) byName.set(t, v.id);
  }
  for (const id of TARGETS) {
    console.log(`\n=== ${id}`);
    const hub = hubs.docs.find((d) => d.id === id);
    if (hub) {
      const tenants = await db.collection('venueHubs').doc(id).collection('tenants').get();
      console.log(`  HUB tenants (venue page /venues/${id}): ${tenants.docs.map((t) => `${t.id}`).join(', ') || '(none)'}`);
      console.log(`  hub verified=${hub.data().verified}`);
    }
    // team pages that resolve to this venues doc, via either path
    const hits: string[] = [];
    for (const t of teams.docs) {
      const d = t.data();
      const full = `${d.city} ${d.name}`;
      if (byName.get(full) === id) hits.push(`${t.id} (name-match)`);
      else if (VENUE_RESOLUTION_MAP[t.id] === id) hits.push(`${t.id} (resolution-map)`);
    }
    console.log(`  TEAM PAGES rendering this venues doc: ${hits.length ? hits.join(', ') : '(none)'}`);
  }
  // sanity: does any team resolve to a venues doc named bank-of-america-stadium at all?
  console.log('\n--- Charlotte teams present? ---');
  teams.docs.filter((t) => /charlotte|carolina|panther|tempo|toronto/i.test(`${t.data().city} ${t.data().name}`))
    .forEach((t) => console.log(`  ${t.id}: "${t.data().city} ${t.data().name}" league=${t.data().league} -> venues doc: ${byName.get(`${t.data().city} ${t.data().name}`) ?? VENUE_RESOLUTION_MAP[t.id] ?? '(unresolved)'}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
