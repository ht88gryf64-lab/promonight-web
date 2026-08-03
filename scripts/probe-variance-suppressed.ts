/* eslint-disable no-console */
// READ-ONLY. Dumps every tenant whose gateVariance the containment check
// SUPPRESSES, with both strings in full, so each suppression can be reviewed by
// hand. A false suppression silently deletes a fact from a live page.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stripTrailingPeriod, isRestatement } from '../src/lib/venue-hub';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

async function main() {
  const hubs = await db.collection('venueHubs').get();
  const verified = new Set(hubs.docs.filter((d) => d.data().verified === true).map((d) => d.id));
  const tSnap = await db.collectionGroup('tenants').get();

  const rows: Array<{ key: string; rule: string; variance: string }> = [];
  for (const td of tSnap.docs) {
    const parent = td.ref.parent.parent;
    if (!parent || parent.parent.id !== 'venueHubs' || !verified.has(parent.id)) continue;
    const t: any = td.data();
    if (t.verified !== true || !t.gatesOpen?.ruleText || !t.gateVariance) continue;
    const rule = stripTrailingPeriod(t.gatesOpen.ruleText);
    if (!isRestatement(rule, t.gateVariance)) continue;
    rows.push({ key: `${parent.id}/${t.teamId}`, rule, variance: t.gateVariance });
  }

  rows.sort((a, b) => a.key.localeCompare(b.key));
  console.log(`SUPPRESSED: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`--- ${r.key}`);
    console.log(`  RULE: ${r.rule}`);
    console.log(`  VAR : ${r.variance}\n`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
