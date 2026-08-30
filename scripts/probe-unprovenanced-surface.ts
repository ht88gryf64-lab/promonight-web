/* eslint-disable no-console */
// READ-ONLY. How many CLAIMS does the site still publish with no provenance?
// A claim is a stored sentence or value asserting a fact about a building. A
// POINTER (a link) asserts nothing and is excluded. Counts what RENDERS today,
// after every gate, not what is stored.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance } from '../src/lib/venue-field-exclusions';
import { transitSuppressed } from '../src/lib/venue-transit-suppression';
import { nearbySilenced, redactClause } from '../src/lib/venue-corpus-silence';
import { VENUE_RESOLUTION_MAP } from '../src/lib/venue-resolution-map';
import { getVenueOverride } from '../src/lib/venue-overrides';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();
const has = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;

async function main() {
  // ── 1. venues corpus, as rendered on team pages
  const [teams, venues, hubs] = await Promise.all([
    db.collection('teams').get(), db.collection('venues').get(), db.collection('venueHubs').get(),
  ]);
  const byName = new Map<string, { id: string; d: any }>(); const byId = new Map<string, any>();
  for (const v of venues.docs) { byId.set(v.id, v.data()); const t = v.data().team; if (typeof t === 'string' && !byName.has(t)) byName.set(t, { id: v.id, d: v.data() }); }
  const VENUES_CLAIMS = ['parkingInfo', 'accessibility', 'nearby'] as const;
  let venuesClaims = 0; const venuesPages = new Set<string>(); const venuesByField: Record<string, number> = {};
  let venuesPointers = 0;
  for (const t of teams.docs) {
    const td = t.data();
    let hit = byName.get(`${td.city} ${td.name}`);
    if (!hit) { const m = VENUE_RESOLUTION_MAP[t.id]; if (m && byId.has(m)) hit = { id: m, d: byId.get(m) }; }
    if (!hit) continue;
    const ov = getVenueOverride(t.id);
    for (const f of VENUES_CLAIMS) {
      let val = (hit.d as any)[f] ?? (ov as any)?.[f];
      if (f === 'nearby' && nearbySilenced(hit.id)) val = undefined;
      val = redactClause(hit.id, f, val as string | undefined, 'venues');
      if (has(val)) { venuesClaims++; venuesByField[f] = (venuesByField[f] ?? 0) + 1; venuesPages.add(t.id); }
    }
    if (has((hit.d as any).bagPolicyUrl ?? (ov as any)?.bagPolicyUrl)) venuesPointers++;
  }
  console.log('=== venues corpus (pro team pages) ===');
  console.log(`  UNPROVENANCED CLAIMS RENDERED: ${venuesClaims}, across ${venuesPages.size} team pages`);
  console.log(`  by field: ${JSON.stringify(venuesByField)}`);
  console.log(`  (pointers, which assert nothing: ${venuesPointers} bag links)`);
  console.log(`  the venues collection stores NO sources map on any doc: ${venues.docs.every((d) => !d.data().sources)}`);

  // ── 2. venueHubs, as rendered
  const HUB_CLAIMS: [string, (h: any) => unknown, string][] = [
    ['publicTransit', (h) => h.publicTransit?.notes ?? h.publicTransit, 'transit'],
    ['parkingLots', (h) => (h.parkingLots ?? []).length ? h.parkingLots : null, 'parking'],
    ['bagPolicyNotes', (h) => h.bagPolicyNotes, 'bag'],
    ['accessibility', (h) => h.accessibility, 'accessibility'],
    ['nearby', (h) => h.nearby, 'nearby'],
    ['tailgating', (h) => h.tailgating?.rules ?? h.tailgating?.timeWindow, 'tailgating'],
    ['rideshareDropoff', (h) => h.rideshareDropoff, 'rideshare'],
    ['outsideFoodRules', (h) => h.outsideFoodRules, 'outsideFood'],
    ['food', (h) => h.food, 'food'],
  ];
  let hubProv = 0, hubNoProv = 0; const hubGapDetail: string[] = [];
  for (const doc of hubs.docs) {
    const d = doc.data();
    if (d.verified !== true) continue;
    const sources = d.sources && typeof d.sources === 'object' ? d.sources : {};
    for (const [field, get, exField] of HUB_CLAIMS) {
      const v = get(d);
      if (!has(v) && !(Array.isArray(v) && v.length)) continue;
      if (fieldExcluded(doc.id, exField as any)) continue;
      if (field === 'publicTransit' && transitSuppressed(doc.id)) continue;
      const prov = hasProvenance(sources as any, field) || hasSubProvenance(sources as any, field, 'notes') || hasSubProvenance(sources as any, field, 'rules');
      if (prov) hubProv++; else { hubNoProv++; if (hubGapDetail.length < 12) hubGapDetail.push(`${doc.id}.${field}`); }
    }
  }
  console.log('\n=== venueHubs corpus (venue pages, /cfb, /nfl) ===');
  console.log(`  rendered claims WITH provenance   : ${hubProv}`);
  console.log(`  populated-but-unsourced (withheld): ${hubNoProv}   <- these do NOT render; the gate holds`);
  console.log(`  sample of withheld: ${hubGapDetail.slice(0, 8).join(', ')}`);

  // ── 3. other corpora that publish prose
  const promos = await db.collection('promos').where('tombstoned', '!=', true).count().get().catch(() => null);
  console.log('\n=== other corpora ===');
  const teamDocs = teams.docs;
  const teamProse = teamDocs.filter((t) => has(t.data().description) || has(t.data().blurb)).length;
  console.log(`  teams collection prose fields (description/blurb): ${teamProse} docs`);
  console.log(`  promos collection (descriptions render verbatim on every surface): ${promos ? promos.data().count : 'count unavailable'} live docs`);
  console.log('  venue-overrides.ts: hardcoded prose in code, no source and no date');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
