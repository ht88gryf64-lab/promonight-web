/* eslint-disable no-console */
// READ-ONLY probe. Measures what Phase 1 changes across all 222 venueHubs by
// running the NEW lib functions against live data. No writes.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/probe-phase1-impact.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  dimsString,
  bagFaqAnswers,
  stripTrailingPeriod,
  isRestatement,
  displayVenueName,
} from '../src/lib/venue-hub';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

// The string Phase 1 deletes, reproduced so the before/after is measured rather
// than asserted.
function oldBagFaq(short: string, dimStr: string | null, notes: string | null): string {
  return [dimStr ? `${short} requires a clear bag no larger than ${dimStr}.` : `${short} enforces a clear bag policy.`, notes || '']
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function main() {
  const snap = await db.collection('venueHubs').get();
  const tSnap = await db.collectionGroup('tenants').get();
  const tenantsBySlug = new Map<string, any[]>();
  for (const td of tSnap.docs) {
    const parent = td.ref.parent.parent;
    if (!parent || parent.parent.id !== 'venueHubs') continue;
    const arr = tenantsBySlug.get(parent.id) ?? [];
    arr.push(td.data());
    tenantsBySlug.set(parent.id, arr);
  }

  let pages = 0;
  const bagCase = { true: 0, false: 0, nullDims: 0, nullNotes: 0, noData: 0, prohibited: 0 };
  let bagCopyChanged = 0;
  let clarityAdded = 0;
  let exceptionRendered = 0;
  let exceptionPresent = 0;
  let dimsZeroFixed = 0;
  let gateBoth = 0;
  let varianceSuppressed = 0;
  let varianceRetained = 0;
  const suppressedList: string[] = [];
  const retainedList: string[] = [];
  let dblBefore = 0;
  let dblAfter = 0;
  const dblPages = new Set<string>();

  for (const doc of snap.docs) {
    const d: any = doc.data();
    if (d.verified !== true) continue;
    pages++;
    const short = displayVenueName(d.name ?? '');
    const overlays = tenantsBySlug.get(doc.id) ?? [];

    // ── (a) bag FAQ ──
    const hub: any = {
      name: d.name,
      bagMaxDimensions: d.bagMaxDimensions ?? null,
      clearBagRequired: typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      bagsProhibited: typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null,
      bagPolicyNotes: d.bagPolicyNotes ?? null,
      bagPolicyUrl: d.bagPolicyUrl ?? null,
    };
    const oldDims = (() => {
      const dm = hub.bagMaxDimensions;
      if (!dm) return null;
      const u = dm.unit === 'cm' ? 'cm' : '"';
      const parts = [dm.w, dm.h];
      if (typeof dm.d === 'number') parts.push(dm.d);
      return parts.map((n: number) => `${n}${u}`).join(' x ');
    })();
    const newDims = dimsString(hub.bagMaxDimensions);
    if (oldDims !== newDims) dimsZeroFixed++;

    const hadBag =
      hub.bagMaxDimensions !== null || hub.clearBagRequired !== null || hub.bagsProhibited === true || !!hub.bagPolicyNotes;
    const hasBagFaq = hadBag || !!hub.bagPolicyUrl;
    if (hasBagFaq) {
      const exceptions = overlays.filter((t) => t.verified === true && t.bagPolicyException).map((t) => t.bagPolicyException as string);
      const next = bagFaqAnswers(hub, exceptions);
      const prev = hadBag ? oldBagFaq(short, oldDims, hub.bagPolicyNotes) : null;
      if (prev !== next.size) bagCopyChanged++;
      if (next.clarity) clarityAdded++;
      // "Rendered" means the exception prose actually survives into the answer;
      // one that merely restates bagPolicyNotes is suppressed, so count both.
      if (exceptions.length && hub.clearBagRequired === true) {
        exceptionPresent++;
        if (exceptions.some((e) => !(hub.bagPolicyNotes && isRestatement(hub.bagPolicyNotes, e.trim())))) exceptionRendered++;
      }

      if (hub.bagsProhibited === true) bagCase.prohibited++;
      else if (hub.clearBagRequired === true) bagCase.true++;
      else if (hub.clearBagRequired === false) bagCase.false++;
      else if (newDims) bagCase.nullDims++;
      else if (hub.bagPolicyNotes) bagCase.nullNotes++;
      else bagCase.noData++;
    }

    // ── (b) + (c) gates ──
    const gateTenants = overlays.filter((t) => t.verified === true && t.gatesOpen?.ruleText);
    for (const t of gateTenants) {
      const rule: string = t.gatesOpen.ruleText;
      const oldRow = `${rule}.${t.gateVariance ? ` ${t.gateVariance}.` : ''}`;
      const stripped = stripTrailingPeriod(rule);
      const variance = t.gateVariance && !isRestatement(stripped, t.gateVariance) ? stripTrailingPeriod(t.gateVariance) : null;
      const newRow = `${stripped}.${variance ? ` ${variance}.` : ''}`;
      if (/\.\.(?!\.)/.test(oldRow)) { dblBefore++; dblPages.add(doc.id); }
      if (/\.\.(?!\.)/.test(newRow)) dblAfter++;
      if (t.gateVariance) {
        gateBoth++;
        if (variance) { varianceRetained++; if (retainedList.length < 8) retainedList.push(`${doc.id}/${t.teamId}`); }
        else { varianceSuppressed++; if (suppressedList.length < 8) suppressedList.push(`${doc.id}/${t.teamId}`); }
      }
      // FAQ gate answer double period
      const oldFaq = `${rule}.`;
      const newFaq = `${stripped}.`;
      if (/\.\.(?!\.)/.test(oldFaq)) { dblBefore++; dblPages.add(doc.id); }
      if (/\.\.(?!\.)/.test(newFaq)) dblAfter++;
    }
  }

  console.log(`verified buildings (pages that render facts): ${pages}\n`);
  console.log('=== (a) bag FAQ ===');
  console.log(`  pages whose bag FAQ copy changes : ${bagCopyChanged}`);
  console.log(`  pages gaining "Does X require a clear bag?" : ${clarityAdded}`);
  console.log(`  pages with a tenant bag exception: ${exceptionPresent} (rendered ${exceptionRendered}, suppressed as restating notes ${exceptionPresent - exceptionRendered})`);
  console.log(`  dimsString zero-depth fix applied on: ${dimsZeroFixed}`);
  console.log(`  case split: true=${bagCase.true} false=${bagCase.false} null+dims=${bagCase.nullDims} null+notes=${bagCase.nullNotes} noData=${bagCase.noData} prohibited=${bagCase.prohibited}`);
  console.log('\n=== (b) gate variance ===');
  console.log(`  tenants carrying BOTH ruleText and gateVariance: ${gateBoth}`);
  console.log(`  suppressed as redundant : ${varianceSuppressed}`);
  console.log(`  retained as informative : ${varianceRetained}`);
  console.log(`  sample suppressed: ${suppressedList.join(', ')}`);
  console.log(`  sample retained  : ${retainedList.join(', ')}`);
  console.log('\n=== (c) double periods ===');
  console.log(`  rendered strings with ".." before: ${dblBefore} across ${dblPages.size} pages`);
  console.log(`  rendered strings with ".." after : ${dblAfter}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
