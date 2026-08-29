/* eslint-disable no-console */
// READ-ONLY. Field-scoped silencing gates a FIELD. It does not gate a CLAIM
// CLASS. MSG's parkingInfo ends "Transit is the better call here, since the
// arena sits directly above Penn Station" - a transit assertion that survived
// the transit silencing because it lives in the parking field. This finds every
// instance of that shape across both corpora.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();

// A marker is a phrase that only makes sense as a claim of that class. Bare
// nouns ("bus", "parking") are excluded: they appear legitimately everywhere.
const CLASS_MARKERS: Record<string, RegExp> = {
  transit: /\b(?:[A-Z][\w'.-]* (?:Line|Station)\b|Metro(?:Rail|Link|rail)?\b|subway|light rail|streetcar|commuter rail|LRT\b|SkyTrain|MetroLink|BART|MARTA|SEPTA|LIRR|Metro-North|GO Transit|the \d+ train|[Rr]oute \d+|Bus \d+|park-and-ride|park and ride)/,
  gateTime: /\b(?:gates?|doors?)\s+(?:typically\s+)?open\b|\bopens?\s+\d+\s*(?:to\s*\d+\s*)?(?:minutes?|hours?|hrs?)\s+(?:before|prior)/i,
  bag: /\bclear bag\b|\bbag polic|\bbags? (?:are )?(?:not )?(?:permitted|allowed|prohibited)|\b\d+\s*(?:"|inch|in\b)\s*x\s*\d+/i,
};
// Which classes are NATIVE to which field. Anything else is cross-class.
const NATIVE: Record<string, string[]> = {
  publicTransit: ['transit'], transitNotes: ['transit'],
  parkingInfo: [], parkingLots: [], rideshare: ['transit'],
  gatesOpen: ['gateTime'], entryNotes: ['gateTime', 'bag'],
  accessibility: [], nearby: [], tailgating: [],
  bagPolicyNotes: ['bag'], foodPolicy: [],
};

async function main() {
  const hits: { coll: string; doc: string; field: string; cls: string; m: string; text: string }[] = [];
  for (const coll of ['venues', 'venueHubs']) {
    const snap = await db.collection(coll).get();
    for (const d of snap.docs) {
      const data = d.data();
      for (const [field, native] of Object.entries(NATIVE)) {
        const strs: string[] = [];
        const walk = (v: unknown) => {
          if (typeof v === 'string') strs.push(v);
          else if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === 'object') Object.values(v as object).forEach(walk);
        };
        walk(data[field]);
        for (const s of strs) {
          for (const [cls, re] of Object.entries(CLASS_MARKERS)) {
            if (native.includes(cls)) continue;
            const m = s.match(re);
            if (!m) continue;
            const i = Math.max(0, (m.index ?? 0) - 80);
            hits.push({ coll, doc: d.id, field, cls, m: m[0], text: s.slice(i, i + 200).replace(/\s+/g, ' ') });
          }
        }
      }
    }
  }
  const byPair: Record<string, number> = {};
  for (const h of hits) byPair[`${h.cls} in ${h.field}`] = (byPair[`${h.cls} in ${h.field}`] ?? 0) + 1;
  console.log(`CROSS-CLASS CLAIMS: ${hits.length} across ${new Set(hits.map((h) => h.coll + '/' + h.doc)).size} docs`);
  console.log('by shape:', JSON.stringify(byPair, null, 1));
  for (const cls of ['transit', 'gateTime', 'bag']) {
    const set = hits.filter((h) => h.cls === cls);
    console.log(`\n===== ${cls.toUpperCase()} claims outside a ${cls} field: ${set.length}`);
    for (const h of set.slice(0, 40)) console.log(`  ${h.coll}/${h.doc}.${h.field}  [${h.m}]\n      "${h.text}"`);
    if (set.length > 40) console.log(`  ... and ${set.length - 40} more`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
