/* eslint-disable no-console */
// READ-ONLY. Before/after for the tenant display name resolution, across every
// verified building, so the CFB slug leak can be counted rather than asserted.
import { getVenueHub, resolveTenantTeamLinks } from '../src/lib/venue-hub';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}

async function main() {
  const snap = await getFirestore().collection('venueHubs').get();
  const slugs = snap.docs.map((d) => d.id).sort();
  let changedPages = 0;
  let changedTenants = 0;
  let unresolved = 0;
  const samples: string[] = [];

  for (const slug of slugs) {
    const hub = await getVenueHub(slug);
    if (!hub) continue;
    const links = await resolveTenantTeamLinks(hub);
    const m = new Map(links.map((l) => [l.teamId, l.name]));
    let pageChanged = false;
    for (const t of hub.tenantOverlays) {
      // Mirrors the component: only a displayName that IS the slug is replaced.
      const after = t.displayName === t.teamId ? m.get(t.teamId) : undefined;
      if (after === undefined) {
        // Falls back to the stored value. Counted so a silent regression on a
        // tenant that does not resolve is visible rather than assumed away.
        if (t.displayName && t.displayName[0] === t.displayName[0].toLowerCase()) unresolved++;
        continue;
      }
      if (after !== t.displayName) {
        changedTenants++;
        pageChanged = true;
        if (samples.length < 10) samples.push(`${slug}: "${t.displayName}" -> "${after}"`);
      }
    }
    if (pageChanged) changedPages++;
  }

  console.log(`buildings: ${slugs.length}`);
  console.log(`pages whose tenant names change: ${changedPages}`);
  console.log(`tenant names corrected: ${changedTenants}`);
  console.log(`still lowercase because the tenant did not resolve: ${unresolved}`);
  console.log('samples:');
  for (const s of samples) console.log(`  ${s}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
