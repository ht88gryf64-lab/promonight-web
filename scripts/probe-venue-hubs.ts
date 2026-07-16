/* eslint-disable no-console */
import { db } from '../src/lib/firebase';

// READ-ONLY probe of the venueHubs collection to establish ground truth for the
// layout rebuild: the bag-label bug scope, long building names (title guard),
// and per-building tenant leagues (pro vs CFB-only title split).
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/probe-venue-hubs.ts [slug ...]

function displayVenueName(name: string): string {
  const idx = name.toLowerCase().lastIndexOf(' at ');
  return idx >= 0 ? name.slice(idx + 4).trim() : name;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const snap = await db.collection('venueHubs').get();
  console.log(`venueHubs docs: ${snap.size}\n`);

  type Row = {
    slug: string;
    name: string;
    display: string;
    verified: boolean;
    clearBagRequired: boolean | null;
    hasDims: boolean;
    dims: string | null;
    outsideFoodAllowed: boolean | null;
    leagues: string[];
    tenantCount: number;
  };
  const rows: Row[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const tenants: Array<{ league?: string }> = Array.isArray(d.tenants) ? d.tenants : [];
    const dims = d.bagMaxDimensions ?? null;
    rows.push({
      slug: doc.id,
      name: d.name ?? '(no name)',
      display: displayVenueName(d.name ?? ''),
      verified: d.verified === true,
      clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      hasDims: !!dims,
      dims: dims ? `${dims.w}x${dims.h}x${dims.d}${dims.unit ?? ''}` : null,
      outsideFoodAllowed: typeof d.outsideFoodAllowed === 'boolean' ? d.outsideFoodAllowed : null,
      leagues: [...new Set(tenants.map((t) => t.league).filter(Boolean))] as string[],
      tenantCount: tenants.length,
    });
  }

  // ── requested slugs, full dump ──
  const focus = argv.length ? argv : ['target-field', 'arrowhead-stadium', 'neyland-stadium'];
  console.log('=== FOCUS SLUGS (full bag/gate/title fields) ===');
  for (const slug of focus) {
    const doc = await db.collection('venueHubs').doc(slug).get();
    if (!doc.exists) { console.log(`\n${slug}: (MISSING)`); continue; }
    const d = doc.data()!;
    const tSnap = await db.collection('venueHubs').doc(slug).collection('tenants').get();
    console.log(`\n${slug}`);
    console.log(`  name: ${JSON.stringify(d.name)}  display: ${JSON.stringify(displayVenueName(d.name ?? ''))} (${displayVenueName(d.name ?? '').length} chars)`);
    console.log(`  city/state: ${d.city} / ${d.state}`);
    console.log(`  verified: ${d.verified === true}`);
    console.log(`  clearBagRequired: ${JSON.stringify(d.clearBagRequired)}`);
    console.log(`  bagMaxDimensions: ${JSON.stringify(d.bagMaxDimensions ?? null)}`);
    console.log(`  bagPolicyNotes: ${JSON.stringify((d.bagPolicyNotes ?? '').slice(0, 120))}`);
    console.log(`  bagPolicyUrl: ${JSON.stringify(d.bagPolicyUrl ?? null)}`);
    console.log(`  outsideFoodAllowed: ${JSON.stringify(d.outsideFoodAllowed)}  outsideFoodRules: ${JSON.stringify((d.outsideFoodRules ?? '').slice(0, 80))}`);
    console.log(`  publicTransit: ${JSON.stringify(d.publicTransit ?? null)}`);
    console.log(`  rideshareDropoff: ${JSON.stringify(d.rideshareDropoff ?? null)}`);
    console.log(`  parkingLots: ${(Array.isArray(d.parkingLots) ? d.parkingLots.length : 0)}  parkingLotMapUrl: ${JSON.stringify(d.parkingLotMapUrl ?? null)}`);
    console.log(`  tenants: ${JSON.stringify((Array.isArray(d.tenants) ? d.tenants : []).map((t: { teamId?: string; league?: string }) => `${t.league}:${t.teamId}`))}`);
    console.log(`  photoUrl: ${JSON.stringify(d.photoUrl ?? '(field absent)')}  photoAttribution: ${JSON.stringify(d.photoAttribution ?? '(field absent)')}`);
    for (const td of tSnap.docs) {
      const t = td.data();
      console.log(`    tenant ${td.id}: verified=${t.verified === true} gatesOpen=${JSON.stringify(t.gatesOpen ?? null)} gateVariance=${JSON.stringify(t.gateVariance ?? null)}`);
    }
  }

  // ── BUG SCOPE: buildings currently rendering "NO BAGS ALLOWED" ──
  // Current buggy label logic: clearBagRequired===false -> "NO BAGS ALLOWED".
  // That label renders in the capsule whenever a VERIFIED building has any bag
  // data (dims OR clearBagRequired!==null OR notes) and clearBagRequired===false.
  console.log('\n\n=== BUG SCOPE: verified buildings where clearBagRequired===false (today render "NO BAGS ALLOWED") ===');
  const buggy = rows.filter((r) => r.verified && r.clearBagRequired === false);
  console.log(`count: ${buggy.length}`);
  for (const r of buggy) {
    console.log(`  ${r.slug.padEnd(34)} dims=${r.dims ?? 'none'}  contradicts=${r.hasDims ? 'YES' : 'no-dims'}`);
  }

  // Distribution of clearBagRequired across verified buildings.
  const vr = rows.filter((r) => r.verified);
  console.log(`\nclearBagRequired distribution (verified, ${vr.length}):`);
  console.log(`  true : ${vr.filter((r) => r.clearBagRequired === true).length}`);
  console.log(`  false: ${vr.filter((r) => r.clearBagRequired === false).length}`);
  console.log(`  null : ${vr.filter((r) => r.clearBagRequired === null).length}`);
  console.log(`  withDims: ${vr.filter((r) => r.hasDims).length}   dims+clearFalse: ${vr.filter((r) => r.hasDims && r.clearBagRequired === false).length}`);

  // ── TITLE LENGTH GUARD: long display names ──
  // Pro title: "{display} Bag Policy, Parking & Food | 2026 Gameday Guide"
  // CFB title: "{display} Parking, Tailgating & Bag Policy | 2026 Gameday Guide"
  // Guard target: under ~60 chars BEFORE the brand suffix ("| 2026 Gameday Guide").
  const YEAR = 2026;
  const proHead = (n: string) => `${n} Bag Policy, Parking & Food`;
  const proDrop = (n: string) => `${n} Bag Policy & Parking`;
  const cfbHead = (n: string) => `${n} Parking, Tailgating & Bag Policy`;
  const cfbDrop = (n: string) => `${n} Parking & Bag Policy`;
  console.log('\n\n=== TITLE LENGTH GUARD (head before " | ' + YEAR + ' Gameday Guide", target <=60) ===');
  const isCfbOnly = (r: Row) => r.leagues.length > 0 && r.leagues.every((l) => l === 'CFB');
  const flagged = rows
    .map((r) => {
      const cfb = isCfbOnly(r);
      const full = cfb ? cfbHead(r.display) : proHead(r.display);
      const dropped = cfb ? cfbDrop(r.display) : proDrop(r.display);
      return { r, cfb, fullLen: full.length, droppedLen: dropped.length, full, dropped };
    })
    .filter((x) => x.fullLen > 60)
    .sort((a, b) => b.fullLen - a.fullLen);
  console.log(`buildings tripping guard: ${flagged.length}`);
  for (const x of flagged) {
    console.log(`  ${x.r.slug.padEnd(38)} ${x.cfb ? 'CFB' : 'PRO'} full=${x.fullLen} "${x.full}"`);
    console.log(`  ${' '.repeat(38)} drop=${x.droppedLen} "${x.dropped}"${x.droppedLen > 60 ? '  <-- STILL OVER' : ''}`);
  }

  // longest display names overall for reference
  console.log('\nTop 12 longest display names:');
  [...rows].sort((a, b) => b.display.length - a.display.length).slice(0, 12).forEach((r) => {
    console.log(`  ${String(r.display.length).padStart(3)}  ${r.display}  (${r.slug}) [${r.leagues.join(',')}]`);
  });

  // League split summary
  console.log('\n=== LEAGUE SPLIT ===');
  console.log(`  CFB-only buildings: ${rows.filter(isCfbOnly).length}`);
  console.log(`  has any pro tenant: ${rows.filter((r) => r.leagues.some((l) => l !== 'CFB')).length}`);
  console.log(`  no tenants: ${rows.filter((r) => r.tenantCount === 0).length}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
