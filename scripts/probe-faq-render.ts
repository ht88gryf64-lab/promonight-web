/* eslint-disable no-console */
// READ-ONLY. Renders the generated bag + gate copy for named buildings, exactly
// as the page will, so the gate spot-check can be read before a deploy.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { bagFaqAnswers, dimsString, stripTrailingPeriod, isRestatement, displayVenueName } from '../src/lib/venue-hub';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

const SLUGS = process.argv.slice(2);

async function main() {
  for (const slug of SLUGS) {
    const doc = await db.collection('venueHubs').doc(slug).get();
    if (!doc.exists) { console.log(`\n##### ${slug}: NOT FOUND\n`); continue; }
    const d: any = doc.data();
    const short = displayVenueName(d.name ?? '');
    const tenants = (await db.collection('venueHubs').doc(slug).collection('tenants').get()).docs
      .map((t) => t.data() as any)
      .filter((t) => t.verified === true);

    const hub: any = {
      name: d.name,
      bagMaxDimensions: d.bagMaxDimensions ?? null,
      clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      bagsProhibited: typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null,
      bagPolicyNotes: d.bagPolicyNotes ?? null,
      bagPolicyUrl: d.bagPolicyUrl ?? null,
    };
    const exceptions = tenants.filter((t) => t.bagPolicyException).map((t) => t.bagPolicyException as string);
    const bag = bagFaqAnswers(hub, exceptions);

    console.log(`\n##### ${slug}  (verified=${d.verified === true})`);
    console.log(`  DATA: clearBagRequired=${JSON.stringify(hub.clearBagRequired)} dims=${JSON.stringify(hub.bagMaxDimensions)} -> "${dimsString(hub.bagMaxDimensions)}" exceptions=${exceptions.length}`);
    console.log(`  Q1 What size bag can I bring into ${short}?`);
    console.log(`     ${bag.size ?? '(question omitted)'}`);
    console.log(`  Q2 Does ${short} require a clear bag?`);
    console.log(`     ${bag.clarity ?? '(question omitted)'}`);

    const gates = tenants.filter((t) => t.gatesOpen?.ruleText);
    for (const t of gates) {
      const rule = stripTrailingPeriod(t.gatesOpen.ruleText);
      const variance = t.gateVariance && !isRestatement(rule, t.gateVariance) ? stripTrailingPeriod(t.gateVariance) : null;
      console.log(`  GATES (${t.teamId}): ${rule}.${variance ? ` ${variance}.` : ''}`);
      if (t.gateVariance && !variance) console.log(`     [variance suppressed as redundant]`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
