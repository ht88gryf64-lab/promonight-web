/* eslint-disable no-console */
// READ-ONLY. Sensitivity check on the 0.8 word-overlap threshold: shows every
// RETAINED pair whose numbers are fully contained, ranked by word overlap, so
// the threshold can be seen to sit in a gap rather than mid-cluster.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stripTrailingPeriod, isRestatement } from '../src/lib/venue-hub';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

// Mirrors the private helpers in venue-hub.ts so the score can be reported.
const stem = (w: string) => w.replace(/(?:ings?|ers?|es|s)$/, '');
const words = (s: string) => new Set([...s.toLowerCase().matchAll(/[a-z]{4,}/g)].map((m) => stem(m[0])));
const nums = (s: string) => new Set([...s.toLowerCase().matchAll(/\d+(?:[.:]\d+)?/g)].map((m) => m[0]));

async function main() {
  const hubs = await db.collection('venueHubs').get();
  const verified = new Set(hubs.docs.filter((d) => d.data().verified === true).map((d) => d.id));
  const tSnap = await db.collectionGroup('tenants').get();

  const rows: Array<{ key: string; score: number; newNums: string[]; variance: string }> = [];
  for (const td of tSnap.docs) {
    const parent = td.ref.parent.parent;
    if (!parent || parent.parent.id !== 'venueHubs' || !verified.has(parent.id)) continue;
    const t: any = td.data();
    if (t.verified !== true || !t.gatesOpen?.ruleText || !t.gateVariance) continue;
    const rule = stripTrailingPeriod(t.gatesOpen.ruleText);
    if (isRestatement(rule, t.gateVariance)) continue; // retained only

    const rw = words(rule);
    const vw = words(t.gateVariance);
    let hit = 0;
    for (const w of vw) if (rw.has(w)) hit++;
    const rn = nums(rule);
    const newNums = [...nums(t.gateVariance)].filter((n) => !rn.has(n));
    rows.push({ key: `${parent.id}/${t.teamId}`, score: vw.size ? hit / vw.size : 1, newNums, variance: t.gateVariance });
  }

  rows.sort((a, b) => b.score - a.score);
  console.log(`RETAINED: ${rows.length}. Threshold is 0.8 word overlap, gated on full number containment.\n`);
  for (const r of rows.slice(0, 12)) {
    console.log(`${r.score.toFixed(2)}  ${r.newNums.length ? `new numbers [${r.newNums.join(', ')}]` : 'NO new numbers'}  ${r.key}`);
    if (!r.newNums.length) console.log(`        VAR: ${r.variance}`);
  }
  const noNew = rows.filter((r) => !r.newNums.length).length;
  console.log(`\nretained with NO new number (kept on word overlap alone): ${noNew}`);
  console.log(`retained carrying at least one new number: ${rows.length - noNew}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
