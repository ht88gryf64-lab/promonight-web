/* eslint-disable no-console */
// READ-ONLY. Exact per-team-page effect of the two removals in
// venue-info-block.tsx: the manufactured gate-time row, and ungated transit.
// Replicates getVenueForTeam's resolution (team-name query, then
// VENUE_RESOLUTION_MAP) so the counts are the ones users would see.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { venuesTransitSuppressed } from '../src/lib/venue-transit-suppression';
import { VENUE_RESOLUTION_MAP } from '../src/lib/venue-resolution-map';
import { getVenueOverride } from '../src/lib/venue-overrides';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

type Row = { team: string; slug: string; venue: string; before: string[]; after: string[] };

async function main() {
  const [teams, venues] = await Promise.all([
    db.collection('teams').get(),
    db.collection('venues').get(),
  ]);
  const byTeamName = new Map<string, { id: string; d: FirebaseFirestore.DocumentData }>();
  const byId = new Map<string, FirebaseFirestore.DocumentData>();
  for (const v of venues.docs) {
    byId.set(v.id, v.data());
    const t = v.data().team;
    if (typeof t === 'string' && !byTeamName.has(t)) byTeamName.set(t, { id: v.id, d: v.data() });
  }

  const rows: Row[] = [];
  let noVenueDoc = 0;
  for (const t of teams.docs) {
    const td = t.data();
    const fullName = `${td.city} ${td.name}`;
    let hit = byTeamName.get(fullName);
    if (!hit) {
      const mapped = VENUE_RESOLUTION_MAP[t.id];
      if (mapped && byId.has(mapped)) hit = { id: mapped, d: byId.get(mapped)! };
    }
    if (!hit) { noVenueDoc++; continue; }
    const ov = getVenueOverride(t.id);
    const v = hit.d;
    const gates = (v.gatesOpen ?? '').toString().trim();
    const parking = v.parkingInfo ?? ov?.parkingInfo;
    const transit = v.publicTransit ?? ov?.publicTransit;
    const access = v.accessibility ?? ov?.accessibility;
    const nearby = v.nearby ?? ov?.nearby;

    const before: string[] = ['Gate times']; // unconditional: real value OR fabricated
    if (parking) before.push('Parking');
    if (transit) before.push('Transit');
    if (access) before.push('Accessibility');
    if (nearby) before.push('Nearby');

    const after: string[] = [];
    if (gates) after.push('Gate times');
    if (parking) after.push('Parking');
    if (transit && !venuesTransitSuppressed(hit.id)) after.push('Transit');
    if (access) after.push('Accessibility');
    if (nearby) after.push('Nearby');

    rows.push({ team: t.id, slug: hit.id, venue: v.name, before, after });
  }

  const fabricated = rows.filter((r) => !r.after.includes('Gate times'));
  const cardGone = rows.filter((r) => r.after.length === 0);
  const lostTransit = rows.filter((r) => r.before.includes('Transit') && !r.after.includes('Transit'));
  const unchanged = rows.filter((r) => r.before.join() === r.after.join());

  console.log(`teams=${teams.size} resolved-to-a-venue-doc=${rows.length} no-venue-doc=${noVenueDoc}`);
  console.log(`\nFABRICATED GATE ROW TODAY (real gatesOpen absent): ${fabricated.length} team pages`);
  console.log(`  of those, the card had NOTHING else and now disappears: ${cardGone.length}`);
  console.log(`  of those, the card keeps other real rows: ${fabricated.length - cardGone.length}`);
  console.log(`\nTRANSIT WITHDRAWN by the suppression list: ${lostTransit.length} team pages`);
  lostTransit.forEach((r) => console.log(`  ${r.team.padEnd(26)} ${r.slug.padEnd(24)} rows ${r.before.length}->${r.after.length}`));
  console.log(`\nCARD DISAPPEARS ENTIRELY: ${cardGone.length} team pages`);
  cardGone.slice(0, 100).forEach((r) => console.log(`  ${r.team.padEnd(26)} ${r.venue}`));
  console.log(`\nUNCHANGED: ${unchanged.length} team pages`);

  // What do the survivors look like? distribution of row counts after
  const dist = new Map<number, number>();
  rows.forEach((r) => dist.set(r.after.length, (dist.get(r.after.length) ?? 0) + 1));
  console.log('\nrow-count distribution AFTER:');
  [...dist.entries()].sort((a, b) => a[0] - b[0]).forEach(([n, c]) => console.log(`  ${n} rows: ${c} pages`));
}
main().catch((e) => { console.error(e); process.exit(1); });
