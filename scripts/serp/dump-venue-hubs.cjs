// READ-ONLY dump of venueHubs + their tenants overlays, for scripts/serp/venue-view-baseline.tsx.
// Run: node --env-file=.env.local scripts/serp/dump-venue-hubs.cjs <out.json>
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
const db = getFirestore();
(async () => {
  const hubs = await db.collection('venueHubs').get();
  const t = await db.collectionGroup('tenants').get();
  const out = { hubs: {}, tenants: {} };
  const conv = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && x._seconds !== undefined ? new Date(x._seconds * 1000).toISOString() : x)));
  for (const d of hubs.docs) out.hubs[d.id] = conv(d.data());
  for (const d of t.docs) {
    if (!d.ref.path.startsWith('venueHubs/')) continue;
    const p = d.ref.parent.parent.id;
    (out.tenants[p] ||= []).push({ id: d.id, ...conv(d.data()) });
  }
  require('fs').writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log('hubs', hubs.size, 'tenant docs', t.size);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
