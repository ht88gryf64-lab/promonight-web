/* eslint-disable no-console */
/**
 * CFB venue capacity backfill — corroborate + write.
 *
 * Combines SOURCE 1 (deterministic Wikipedia infobox capacity, from the
 * Phase-2-resolved venue page) with SOURCE 2 (an independent OFFICIAL athletics/
 * stadium page, researched per venue). Stores capacity ONLY when both sources
 * corroborate within tolerance; otherwise leaves capacity NULL and flags. Same
 * 2-source discipline as rivalry tags — a wrong capacity is the venue-panel
 * equivalent of a wrong kickoff.
 *
 * Usage (dry — writes plan JSON, no Firestore write):
 *   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
 *     scripts/cfb/backfill-venue-capacity.ts <source1.json> <source2.json> <plan-out.json>
 * Add --execute to write cfbVenues.capacity (+ audit trail) for corroborated venues.
 */
import { db } from '@/lib/firebase';
import { CFB_COLLECTIONS } from '@/lib/cfb/types';
import * as fs from 'fs';

type S1 = { id: string; name: string; homeSchoolId?: string; wikiUrl?: string; cap: number | null; how?: string };
type S2 = { v: string; officialCap: number | null; officialUrl: string | null; quote: string | null; sourceType: string; isFootballStadium: boolean; confidence: 'high' | 'med' | 'low'; notes?: string };

const TOL_PCT = 0.03; // expansion-year tolerance
const TOL_ABS = 1500;

function corroborate(wiki: number | null, s2: S2 | undefined) {
  if (wiki == null) return { verdict: 'no-source1', cap: null as number | null, reason: 'no Wikipedia capacity parsed' };
  if (!s2 || s2.officialCap == null) return { verdict: 'no-source2', cap: null, reason: 'no independent official source found' };
  if (s2.isFootballStadium === false) return { verdict: 'source2-not-football', cap: null, reason: `source 2 not the football stadium (${s2.notes || ''})` };
  const off = s2.officialCap;
  const diff = Math.abs(wiki - off);
  const pct = diff / Math.max(wiki, off);
  const agree = pct <= TOL_PCT || diff <= TOL_ABS;
  if (!agree) return { verdict: 'disagree', cap: null, reason: `wiki ${wiki} vs official ${off} differ ${diff} (${(pct * 100).toFixed(1)}%) — do NOT average` };
  if (s2.confidence === 'low') {
    // A 'low' source-2 confidence is about the SOURCE's officialness, not the
    // number. When the two independent figures agree TIGHTLY, the corroboration
    // still holds; require a tight match (<= max(0.5%, 300)). Loose agreement
    // with a low-confidence source stays flagged for a human.
    const tight = diff <= Math.max(Math.round(0.005 * Math.max(wiki, off)), 300);
    if (tight) return { verdict: 'verified', cap: wiki, reason: `wiki ${wiki} == official ${off} (tight ${diff}, source-2 conf low)` };
    return { verdict: 'low-confidence', cap: null, reason: `agree loosely (${wiki}~${off}, ${diff}) but source-2 conf low — needs human` };
  }
  // Verified. Store the Wikipedia value (deterministic, current), corroborated by the official source.
  return { verdict: 'verified', cap: wiki, reason: `wiki ${wiki} corroborated by official ${off} (${(pct * 100).toFixed(1)}% diff)` };
}

async function main() {
  const [s1Path, s2Path, outPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const execute = process.argv.includes('--execute');
  const s1: S1[] = JSON.parse(fs.readFileSync(s1Path, 'utf8'));
  const s2: S2[] = JSON.parse(fs.readFileSync(s2Path, 'utf8'));
  const s2By = new Map(s2.map((x) => [x.v, x]));

  const plan = s1.map((r) => {
    const src2 = s2By.get(r.id);
    const c = corroborate(r.cap, src2);
    return {
      venueId: r.id, name: r.name, schoolId: r.homeSchoolId,
      wikiCap: r.cap, wikiUrl: r.wikiUrl, wikiHow: r.how,
      officialCap: src2?.officialCap ?? null, officialUrl: src2?.officialUrl ?? null,
      officialQuote: src2?.quote ?? null, officialConfidence: src2?.confidence ?? null,
      isFootball: src2?.isFootballStadium ?? null,
      verdict: c.verdict, storeCapacity: c.cap, reason: c.reason,
    };
  });

  fs.writeFileSync(outPath, JSON.stringify(plan, null, 2));
  const by = (v: string) => plan.filter((p) => p.verdict === v).length;
  console.log(`Backfill plan: ${plan.length} venues`);
  console.log(`  verified (will populate): ${by('verified')}`);
  console.log(`  no-source2:               ${by('no-source2')}`);
  console.log(`  disagree:                 ${by('disagree')}`);
  console.log(`  source2-not-football:     ${by('source2-not-football')}`);
  console.log(`  low-confidence:           ${by('low-confidence')}`);
  console.log(`  no-source1:               ${by('no-source1')}`);
  console.log('\n--- FLAGGED (left null) ---');
  plan.filter((p) => p.verdict !== 'verified').forEach((p) => console.log(`  ${p.venueId.slice(0, 30).padEnd(31)} [${p.verdict}] ${p.reason}`));

  if (!execute) { console.log('\n(dry run — no writes. Add --execute to populate.)'); return; }

  console.log('\n--- EXECUTING writes ---');
  const at = new Date().toISOString();
  let wrote = 0;
  for (const p of plan.filter((x) => x.verdict === 'verified' && x.storeCapacity != null)) {
    await db.collection(CFB_COLLECTIONS.venues).doc(p.venueId).update({
      capacity: p.storeCapacity,
      capacityVerified: true,
      capacitySources: [p.wikiUrl, p.officialUrl].filter(Boolean),
      capacityVerifiedAt: at,
    });
    wrote++;
    if (wrote % 10 === 0) console.log(`  ...${wrote} written`);
  }
  console.log(`Done: wrote capacity to ${wrote} venues.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
