/* eslint-disable no-console */
// Populate the flat "Plan Your Visit" venue fields on the `venues` collection
// for all 30 MLB teams, and migrate the Twins out of the TS override file.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-plan-your-visit.ts            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-plan-your-visit.ts --execute  # writes
//
// ── Phase 1 findings (why this writes flat fields, not a planYourVisit object) ─
// There is no `planYourVisit` object anywhere in Firestore. The render path
// (src/lib/data.ts getVenueForTeam + src/components/venue-info-block.tsx) reads
// FLAT fields off the `venues` collection: gatesOpen, parkingInfo, publicTransit,
// accessibility, bagPolicyUrl, nearby — with src/lib/venue-overrides.ts as a
// read-time fallback (`data.x ?? override?.x`). So this script writes those flat
// fields onto each team's venue doc. The venue doc is located the same way the
// app does: query `venues where team == "{city} {name}"`.
//
// ── Source data ───────────────────────────────────────────────────────────────
// scripts/mlb-plan-your-visit.json — 29 researched/verified records (every MLB
// team except the Twins), keyed by a short `teamSlug`. Field mapping:
//   gateTimes      -> gatesOpen
//   parking        -> parkingInfo
//   transit        -> publicTransit
//   accessibility  -> accessibility
//   bagPolicy.url  -> bagPolicyUrl
//   bagPolicy.label-> (dropped; the bag-policy link label is render-derived from
//                      venue.name as "Official {venue.name} bag policy")
//   nearby         -> nearby
//
// ── Phase 2 (bag-policy URL verification, 2026-05-23) ──────────────────────────
// curled every bagPolicy.url. 28/29 returned 200 (Dodgers & Rays via a normal
// redirect to a live page). The Mariners URL (.../mariners/ballpark/information)
// returned 404 and is replaced below with the live standard guide path
// (.../mariners/ballpark/information/guide, 200 — the same shape Astros / Mets /
// Reds / White Sox use). See BAG_URL_OVERRIDES.
//
// ── Twins migration ────────────────────────────────────────────────────────────
// The Twins are NOT in the source JSON; their copy currently lives in
// src/lib/venue-overrides.ts and only `gatesOpen` is in Firestore (as the broken
// "1:30 PM before game time"). This script writes the Twins' six fields to
// venues/target-field so Firestore is the single source of truth for all 30
// teams. Em dashes in the Twins parking + nearby copy are stripped (-> period +
// capitalized next word, matching the JSON convention). gatesOpen is corrected
// to verified Target Field gate-open times. The redundant Twins block in
// venue-overrides.ts is removed in a SEPARATE step, only after an --execute run
// and a render read-back confirm the page is identical.
//
// ── venue.name fix ──────────────────────────────────────────────────────────────
// The bag-policy label is render-derived from venue.name, so a stale name is a
// silent content bug. Phase 1 swept all 29 Firestore venue.name values against
// the JSON; one was stale: Guaranteed Rate Field -> Rate Field (renamed 2025).
// Fixed below (display name only; the doc slug is left untouched because the
// team lookup keys on the display-name query). See VENUE_NAME_FIXES.
//
// Idempotency: writes use venues/{id}.set(payload, { merge: true }); re-running
// produces no diff once written.

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../src/lib/firebase';

export interface SourceRecord {
  teamSlug: string;
  venue: string;
  planYourVisit: {
    gateTimes: string;
    parking: string;
    transit: string;
    accessibility: string;
    bagPolicy: { label: string; url: string };
    nearby: string;
  };
}

// JSON short slug -> Firestore team doc id. Verified 1:1 in Phase 1.
export const SLUG_MAP: Record<string, string> = {
  yankees: 'new-york-yankees', dodgers: 'los-angeles-dodgers', cubs: 'chicago-cubs',
  redsox: 'boston-red-sox', cardinals: 'st-louis-cardinals', rays: 'tampa-bay-rays',
  orioles: 'baltimore-orioles', bluejays: 'toronto-blue-jays', guardians: 'cleveland-guardians',
  tigers: 'detroit-tigers', royals: 'kansas-city-royals', whitesox: 'chicago-white-sox',
  astros: 'houston-astros', angels: 'los-angeles-angels', mariners: 'seattle-mariners',
  rangers: 'texas-rangers', athletics: 'oakland-athletics', braves: 'atlanta-braves',
  marlins: 'miami-marlins', mets: 'new-york-mets', nationals: 'washington-nationals',
  phillies: 'philadelphia-phillies', brewers: 'milwaukee-brewers', pirates: 'pittsburgh-pirates',
  reds: 'cincinnati-reds', dbacks: 'arizona-diamondbacks', rockies: 'colorado-rockies',
  padres: 'san-diego-padres', giants: 'san-francisco-giants',
};

// Phase 2 dead/replaced bag-policy URLs (json slug -> replacement). Only the
// mariners URL 404'd; everything else is written as-researched.
export const BAG_URL_OVERRIDES: Record<string, string> = {
  mariners: 'https://www.mlb.com/mariners/ballpark/information/guide',
};

// venue.name display-name corrections (json slug -> name). Slug left untouched.
export const VENUE_NAME_FIXES: Record<string, string> = {
  whitesox: 'Rate Field',
};

// The Twins record, migrated from src/lib/venue-overrides.ts. Em dashes stripped
// in parkingInfo + nearby; gatesOpen corrected from "1:30 PM before game time".
export const TWINS_FIELDS = {
  gatesOpen:
    'Gates open 1 hour before first pitch for Monday through Thursday evening games, 1.5 hours before for weekday afternoon games, and 2 hours before for Friday through Sunday games.',
  parkingInfo:
    'Target Field ramps sell out on giveaway and marquee dates. Pre-paid parking is the safest bet. Reserve a spot in advance rather than circling the ramps.',
  publicTransit:
    'METRO Blue and Green lines stop at Target Field Station, directly connected to the stadium. Northstar commuter rail also terminates at the stadium.',
  accessibility:
    'Target Field is fully ADA-accessible with wheelchair seating throughout, elevators to every level, and accessible parking in Ramp A.',
  bagPolicyUrl: 'https://www.mlb.com/twins/ballpark/information/guide#bag-policy',
  nearby:
    'The North Loop and Warehouse District are steps from the ballpark. Try Modist Brewing, The Freehouse, or Red Cow for pregame bites.',
};

// Flat venue fields this script manages.
const MANAGED_FIELDS = [
  'gatesOpen', 'parkingInfo', 'publicTransit', 'accessibility', 'bagPolicyUrl', 'nearby',
] as const;

interface WritePlan {
  jsonSlug: string;
  teamSlug: string;          // Firestore team doc id
  displayName: string;       // "{city} {name}"
  venueId: string;           // Firestore venues/{id}
  current: Record<string, unknown>;
  payload: Record<string, string>;   // managed fields (+ name for fixes)
}

export function buildPayloadFromRecord(rec: SourceRecord): Record<string, string> {
  const bagUrl = BAG_URL_OVERRIDES[rec.teamSlug] ?? rec.planYourVisit.bagPolicy.url;
  return {
    gatesOpen: rec.planYourVisit.gateTimes,
    parkingInfo: rec.planYourVisit.parking,
    publicTransit: rec.planYourVisit.transit,
    accessibility: rec.planYourVisit.accessibility,
    bagPolicyUrl: bagUrl,
    nearby: rec.planYourVisit.nearby,
  };
}

export async function resolveVenue(teamSlug: string): Promise<{ displayName: string; venueId: string; current: Record<string, unknown> }> {
  const teamDoc = await db.collection('teams').doc(teamSlug).get();
  if (!teamDoc.exists) throw new Error(`team doc "${teamSlug}" not found`);
  const t = teamDoc.data()!;
  const displayName = `${t.city} ${t.name}`;
  const vSnap = await db.collection('venues').where('team', '==', displayName).get();
  if (vSnap.empty) throw new Error(`no venue doc for team=="${displayName}" (${teamSlug})`);
  if (vSnap.size > 1) throw new Error(`${vSnap.size} venue docs match team=="${displayName}" (${teamSlug}) — ambiguous`);
  return { displayName, venueId: vSnap.docs[0].id, current: vSnap.docs[0].data() };
}

function diffField(current: unknown, next: string): 'NEW' | 'CHANGED' | 'SAME' {
  if (current == null || current === '') return 'NEW';
  return current === next ? 'SAME' : 'CHANGED';
}

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[populate-plan-your-visit] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}\n`);

  const records: SourceRecord[] = JSON.parse(
    readFileSync(join(__dirname, 'mlb-plan-your-visit.json'), 'utf8'),
  );
  if (records.length !== 29) throw new Error(`expected 29 source records, got ${records.length}`);

  // ── Pre-flight: resolve every team to a single venue doc before any write. ──
  const plans: WritePlan[] = [];

  for (const rec of records) {
    const teamSlug = SLUG_MAP[rec.teamSlug];
    if (!teamSlug) throw new Error(`no slug mapping for "${rec.teamSlug}"`);
    const { displayName, venueId, current } = await resolveVenue(teamSlug);
    const payload = buildPayloadFromRecord(rec);
    if (VENUE_NAME_FIXES[rec.teamSlug]) payload.name = VENUE_NAME_FIXES[rec.teamSlug];
    plans.push({ jsonSlug: rec.teamSlug, teamSlug, displayName, venueId, current, payload });
  }

  // Twins (not in JSON): migrate from venue-overrides.ts.
  {
    const { displayName, venueId, current } = await resolveVenue('minnesota-twins');
    plans.push({
      jsonSlug: 'twins', teamSlug: 'minnesota-twins', displayName, venueId, current,
      payload: { ...TWINS_FIELDS },
    });
  }

  // ── Report per-team diff. ──
  let docsWithChanges = 0;
  let docsUnchanged = 0;
  const fieldFixNotes: string[] = [];

  for (const p of plans) {
    const fieldStatuses: string[] = [];
    let changed = false;
    for (const [field, next] of Object.entries(p.payload)) {
      const status = diffField(p.current[field], next);
      if (status !== 'SAME') changed = true;
      const marker = status === 'NEW' ? '+ NEW    ' : status === 'CHANGED' ? '~ CHANGED' : '  same   ';
      // Show old value only for CHANGED (so the broken Twins gatesOpen / stale
      // White Sox name are visible in the diff).
      const oldStr = status === 'CHANGED' ? `\n${' '.repeat(13)}old: ${JSON.stringify(p.current[field])}` : '';
      fieldStatuses.push(`    ${marker} ${field}: ${JSON.stringify(next).slice(0, 88)}${oldStr}`);
      if (field === 'bagPolicyUrl' && BAG_URL_OVERRIDES[p.jsonSlug]) {
        fieldFixNotes.push(`${p.jsonSlug}: bagPolicyUrl replaced (Phase 2 404) -> ${next}`);
      }
      if (field === 'name') {
        fieldFixNotes.push(`${p.jsonSlug}: venue.name ${status} ${JSON.stringify(p.current[field])} -> ${JSON.stringify(next)}`);
      }
    }
    if (changed) docsWithChanges += 1; else docsUnchanged += 1;
    console.log(`--- ${p.jsonSlug.padEnd(11)} venues/${p.venueId}  (team="${p.displayName}")  ${changed ? 'WRITE' : 'no-op'} ---`);
    console.log(fieldStatuses.join('\n'));

    if (execute && changed) {
      await db.collection('venues').doc(p.venueId).set(p.payload, { merge: true });
      console.log(`    -> wrote ${Object.keys(p.payload).length} fields to venues/${p.venueId}`);
    }
    console.log('');
  }

  // ── Summary. ──
  console.log('=== Summary ===');
  console.log(`  Teams planned:        ${plans.length} (29 JSON + 1 Twins)`);
  console.log(`  Docs with changes:    ${docsWithChanges}`);
  console.log(`  Docs unchanged:       ${docsUnchanged}`);
  console.log(`  Bag-URL / name fixes:`);
  for (const n of fieldFixNotes) console.log(`    - ${n}`);
  const twinsPlan = plans.find((p) => p.jsonSlug === 'twins')!;
  const twinsGate = diffField(twinsPlan.current.gatesOpen, TWINS_FIELDS.gatesOpen);
  console.log(`  Twins normalization:  gatesOpen ${twinsGate} (old: ${JSON.stringify(twinsPlan.current.gatesOpen)}), em dashes stripped in parkingInfo + nearby, 6 fields migrated to venues/${twinsPlan.venueId}`);
  console.log('');
  if (!execute) {
    console.log(`[populate-plan-your-visit] DRY-RUN complete. Re-run with --execute to write.`);
  } else {
    console.log(`[populate-plan-your-visit] EXECUTE complete. Wrote ${docsWithChanges} venue docs.`);
    console.log(`  NEXT: read-back spot-check, confirm Twins page renders identically, then remove the Twins block from src/lib/venue-overrides.ts.`);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
