/* eslint-disable no-console */
// READ-ONLY. Exact per-team-page effect of silencing venues.gatesOpen and
// venues.publicTransit, plus the three nearby withdrawals and the bag repoints.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { nearbySilenced, BAG_URL_REPOINTS } from '../src/lib/venue-corpus-silence';
import { VENUE_RESOLUTION_MAP } from '../src/lib/venue-resolution-map';
import { getVenueOverride } from '../src/lib/venue-overrides';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();

async function main() {
  const [teams, venues] = await Promise.all([db.collection('teams').get(), db.collection('venues').get()]);
  const byName = new Map<string, { id: string; d: any }>(); const byId = new Map<string, any>();
  for (const v of venues.docs) {
    byId.set(v.id, v.data());
    const t = v.data().team;
    if (typeof t === 'string' && !byName.has(t)) byName.set(t, { id: v.id, d: v.data() });
  }
  let before = 0, after = 0, goneNow = 0, goneBefore = 0;
  const newlyGone: string[] = [], stillHas: Record<number, number> = {};
  const lostNearby: string[] = [], repointed: string[] = [];
  for (const t of teams.docs) {
    const td = t.data();
    let hit = byName.get(`${td.city} ${td.name}`);
    if (!hit) { const m = VENUE_RESOLUTION_MAP[t.id]; if (m && byId.has(m)) hit = { id: m, d: byId.get(m) }; }
    if (!hit) continue;
    const ov = getVenueOverride(t.id), v = hit.d;
    const path = `/${String(td.league).toLowerCase()}/${t.id}`;
    // BEFORE this branch: gates + parking + transit + access + bag + nearby
    const b = [String(v.gatesOpen ?? '').trim(), v.parkingInfo ?? ov?.parkingInfo, v.publicTransit ?? ov?.publicTransit,
      v.accessibility ?? ov?.accessibility, v.bagPolicyUrl ?? ov?.bagPolicyUrl, v.nearby ?? ov?.nearby].filter(Boolean).length;
    // AFTER: parking + access + bag + nearby(unless silenced)
    const nearbyVal = nearbySilenced(hit.id) ? undefined : (v.nearby ?? ov?.nearby);
    const a = [v.parkingInfo ?? ov?.parkingInfo, v.accessibility ?? ov?.accessibility,
      v.bagPolicyUrl ?? ov?.bagPolicyUrl, nearbyVal].filter(Boolean).length;
    before += b; after += a;
    if (b === 0) goneBefore++;
    if (a === 0) { goneNow++; if (b > 0) newlyGone.push(`${path} (${hit.id}) rows ${b}->0`); }
    stillHas[a] = (stillHas[a] ?? 0) + 1;
    if (nearbySilenced(hit.id)) lostNearby.push(`${path} (${hit.id})`);
    if (BAG_URL_REPOINTS[hit.id]) repointed.push(`${path} (${hit.id})`);
  }
  console.log(`total rendered rows across all team pages: ${before} -> ${after}  (withdrawn: ${before - after})`);
  console.log(`\nCARD GONE ENTIRELY: was ${goneBefore}, now ${goneNow}   newly card-less: ${newlyGone.length}`);
  newlyGone.slice(0, 60).forEach((s) => console.log('  ' + s));
  console.log('\nrow-count distribution AFTER:');
  Object.entries(stillHas).sort((x, y) => Number(x[0]) - Number(y[0])).forEach(([n, c]) => console.log(`  ${n} rows: ${c} pages`));
  console.log(`\nNEARBY WITHDRAWN on ${lostNearby.length} team pages: ${lostNearby.join(', ')}`);
  console.log(`BAG POINTER REPOINTED on ${repointed.length} team pages: ${repointed.join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
