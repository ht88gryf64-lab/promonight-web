/* eslint-disable no-console */
// READ-ONLY. What changes when the published view is applied at the mapper.
// Compares, per hub per claim field, whether the value survives TODAY'S
// per-consumer gating (as the venue page applies it) against the view's.
// venue-hub imports `server-only`, which throws outside a server component.
// Stub it the way the unit tests do, before anything pulls it in.
import Module from 'node:module';
const origLoad = (Module as any)._load;
(Module as any)._load = function (req: string, ...rest: unknown[]) {
  if (req === 'server-only') return {};
  return origLoad.call(this, req, ...rest);
};

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance, isReachableUrl } from '../src/lib/venue-field-exclusions';
import { transitSuppressed } from '../src/lib/venue-transit-suppression';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();
const filled = (v: unknown) => Array.isArray(v) ? v.length > 0 : !(v === null || v === undefined || (typeof v === 'string' && !v.trim()));

// How the VENUE PAGE gates each field today, transcribed from its own code.
const TODAY: Record<string, (h: any) => boolean> = {
  // Dotted sub-keys count: several hubs vouch as publicTransit.lines /
  // publicTransit.notes with no flat key. An earlier version of this baseline
  // checked only the flat key and reported 3 false "now published" cells, which
  // production contradicts: kidd-brewer and secu already render their transit.
  publicTransit: (h) => h.verified && filled(h.publicTransit) && (hasProvenance(h.sources, 'publicTransit') || hasSubProvenance(h.sources, 'publicTransit', 'notes') || hasSubProvenance(h.sources, 'publicTransit', 'lines')) && !fieldExcluded(h.slug, 'transit') && !transitSuppressed(h.slug),
  parkingLots: (h) => h.verified && filled(h.parkingLots) && hasProvenance(h.sources, 'parkingLots') && !fieldExcluded(h.slug, 'parking') && !subFieldExcluded(h.slug, 'parking', 'parkingLots'),
  bagMaxDimensions: (h) => h.verified && filled(h.bagMaxDimensions) && hasProvenance(h.sources, 'bagMaxDimensions') && !fieldExcluded(h.slug, 'bag'),
  clearBagRequired: (h) => h.verified && h.clearBagRequired !== null && hasProvenance(h.sources, 'clearBagRequired') && !fieldExcluded(h.slug, 'bag'),
  bagsProhibited: (h) => h.verified && h.bagsProhibited !== null && hasProvenance(h.sources, 'bagsProhibited') && !fieldExcluded(h.slug, 'bag'),
  bagPolicyNotes: (h) => h.verified && filled(h.bagPolicyNotes) && hasProvenance(h.sources, 'bagPolicyNotes') && !fieldExcluded(h.slug, 'bag') && !subFieldExcluded(h.slug, 'bag', 'notes'),
  accessibility: (h) => h.verified && filled(h.accessibility) && hasProvenance(h.sources, 'accessibility') && !fieldExcluded(h.slug, 'accessibility'),
  nearby: (h) => h.verified && filled(h.nearby) && hasProvenance(h.sources, 'nearby') && !fieldExcluded(h.slug, 'nearby'),
  rideshareDropoff: (h) => h.verified && filled(h.rideshareDropoff) && hasProvenance(h.sources, 'rideshareDropoff') && !fieldExcluded(h.slug, 'rideshare'),
  outsideFoodRules: (h) => h.verified && filled(h.outsideFoodRules) && hasProvenance(h.sources, 'outsideFoodRules') && !fieldExcluded(h.slug, 'outsideFood'),
  food: (h) => h.verified && filled(h.food) && hasProvenance(h.sources, 'food') && !fieldExcluded(h.slug, 'food'),
  venueAccessRestrictions: (h) => h.verified && filled(h.venueAccessRestrictions) && hasProvenance(h.sources, 'venueAccessRestrictions'),
  // `allowed` alone is a renderable fact ("Tailgating allowed"), so a hub with
  // only that populated still publishes. The first baseline required rules or a
  // timeWindow and reported 6 false cells; production renders all six.
  tailgating: (h) => h.verified && (filled(h.tailgating?.rules) || filled(h.tailgating?.timeWindow) || h.tailgating?.allowed !== null && h.tailgating?.allowed !== undefined) && (hasProvenance(h.sources, 'tailgating') || Object.keys(h.sources ?? {}).some((k: string) => k.startsWith('tailgating.'))) && !fieldExcluded(h.slug, 'tailgating'),
  bagPolicyUrl: (h) => h.verified && isReachableUrl(h.bagPolicyUrl) && !fieldExcluded(h.slug, 'bag'),
  parkingLotMapUrl: (h) => h.verified && isReachableUrl(h.parkingLotMapUrl) && !fieldExcluded(h.slug, 'parking') && !subFieldExcluded(h.slug, 'parking', 'parkingLotMapUrl'),
  officialParkingUrls: (h) => h.verified && (h.officialParkingUrls ?? []).some(isReachableUrl) && !fieldExcluded(h.slug, 'parking') && !subFieldExcluded(h.slug, 'parking', 'officialParkingUrls'),
};

async function main() {
  const { toVenueHub } = await import('../src/lib/venue-hub');
  const { publishedView } = await import('../src/lib/venue-published-view');
  const snap = await db.collection('venueHubs').get();
  const diffs: Record<string, { gained: string[]; lost: string[] }> = {};
  let hubs = 0, cells = 0;
  for (const doc of snap.docs) {
    hubs++;
    const d = doc.data();
    const tSnap = await db.collection('venueHubs').doc(doc.id).collection('tenants').get();
    const overlays = tSnap.docs.map((td) => { const t = td.data(); return { teamId: t.teamId, league: t.league, displayName: t.displayName ?? t.teamId, gatesOpen: t.gatesOpen ?? null, gateVariance: t.gateVariance ?? null, tailgateWindow: t.tailgateWindow ?? null, bagPolicyException: t.bagPolicyException ?? null, verified: t.verified === true, sources: (() => { const o: any = {}; const raw = t.sources; if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) { if (typeof v === 'string') o[k] = v; else if (Array.isArray(v) && typeof v[0] === 'string') o[k] = v[0]; } return o; })() }; }) as any;
    const raw = toVenueHub(doc.id, d, overlays);
    const view = publishedView(raw);
    for (const [f, today] of Object.entries(TODAY)) {
      cells++;
      const before = today(raw);
      const after = filled((view as any)[f]);
      if (before === after) continue;
      diffs[f] ??= { gained: [], lost: [] };
      (after ? diffs[f].gained : diffs[f].lost).push(doc.id);
    }
  }
  console.log(`hubs: ${hubs}   field-cells compared: ${cells}`);
  const total = Object.values(diffs).reduce((a, x) => a + x.gained.length + x.lost.length, 0);
  console.log(`CELLS THAT CHANGE STATE: ${total}\n`);
  for (const [f, x] of Object.entries(diffs)) {
    if (x.lost.length) console.log(`  ${f}: NOW WITHHELD on ${x.lost.length} -> ${x.lost.slice(0, 8).join(', ')}${x.lost.length > 8 ? ', ...' : ''}`);
    if (x.gained.length) console.log(`  ${f}: NOW PUBLISHED on ${x.gained.length} -> ${x.gained.slice(0, 8).join(', ')}${x.gained.length > 8 ? ', ...' : ''}`);
  }
  if (!total) console.log('  none. The view matches what the venue page already applied, on every hub and every field.');
}
main().catch((e) => { console.error(e); process.exit(1); });
