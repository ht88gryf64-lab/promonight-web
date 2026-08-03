/* eslint-disable no-console */
// READ-ONLY. How long are bagPolicyNotes and tenant bagPolicyException in
// practice? Decides which string may be repeated across two FAQ answers for
// self-containment and which would bloat the page.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

const stats = (label: string, xs: number[]) => {
  if (!xs.length) return console.log(`${label}: none`);
  xs.sort((a, b) => a - b);
  console.log(`${label}: n=${xs.length} min=${xs[0]} median=${xs[Math.floor(xs.length / 2)]} p90=${xs[Math.floor(xs.length * 0.9)]} max=${xs[xs.length - 1]}`);
};

async function main() {
  const hubs = await db.collection('venueHubs').get();
  const verified = new Set(hubs.docs.filter((d) => d.data().verified === true).map((d) => d.id));
  const notes = hubs.docs
    .filter((d) => verified.has(d.id) && d.data().bagPolicyNotes)
    .map((d) => (d.data().bagPolicyNotes as string).trim().length);
  stats('bagPolicyNotes chars', notes);

  const tSnap = await db.collectionGroup('tenants').get();
  const exc: string[] = [];
  for (const td of tSnap.docs) {
    const parent = td.ref.parent.parent;
    if (!parent || parent.parent.id !== 'venueHubs' || !verified.has(parent.id)) continue;
    const t: any = td.data();
    if (t.verified === true && t.bagPolicyException) exc.push(String(t.bagPolicyException).trim());
  }
  stats('bagPolicyException chars', exc.map((e) => e.length));
  console.log('\nlongest 3 exceptions:');
  for (const e of [...exc].sort((a, b) => b.length - a.length).slice(0, 3)) console.log(`  (${e.length}) ${e}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
