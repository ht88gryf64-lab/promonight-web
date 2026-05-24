/* eslint-disable no-console */
// Venue-keyed "Plan Your Visit" writer for in-season arenas (NBA/NHL/WNBA/MLS).
// Sibling of scripts/populate-plan-your-visit.ts (MLB), but keyed by VENUE slug
// (Firestore venues doc id) rather than team slug, because shared arenas are one
// building doc serving multiple co-tenants. Re-runnable: merges every
// scripts/arena-plan-your-visit-batch*.json, so each new authoring batch ships
// on the next run.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-arena-plan-your-visit.ts            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-arena-plan-your-visit.ts --execute  # writes
//
// Record shape (flat Firestore fields, written 1:1 to venues/{slug}):
//   gatesOpen (single-tenant ONLY), parkingInfo, publicTransit, accessibility,
//   bagPolicyUrl (plain string; label is render-derived from venue.name), nearby.
//   Plus a `venue` display-name annotation that is NOT written.
//
// SHARED docs (multi-tenant, e.g. madison-square-garden, ball-arena) carry NO
// gatesOpen key in the JSON. We OMIT the field entirely (never write an empty
// string) so VenueInfoBlock's per-league fallback supplies each co-tenant's gate
// cadence (NBA "before tipoff", NHL "before puck drop").
//
// Keys starting with "_" (e.g. _notes) are metadata and never written.
//
// Phase-3 curl-verify substitutions (dead/404 -> live official page), Mariners
// precedent: see BAG_URL_OVERRIDES. Display-name-only fix (slug untouched), same
// class as White Sox / footprint-center: see NAME_FIXES.
//
// Idempotent: writes use venues/{slug}.set(payload, { merge: true }).

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../src/lib/firebase';

interface ArenaRecord {
  venue?: string;
  gatesOpen?: string;
  parkingInfo?: string;
  publicTransit?: string;
  accessibility?: string;
  bagPolicyUrl?: string;
  nearby?: string;
}

// Curl-verified dead links replaced with live official pages. Keyed by the
// ACTUAL Firestore slug (post-remap). The 20 MLS/WNBA entries below replace
// 404s found in the Step 3 curl-verify pass (mostly team /stadium/bag-policy
// paths that do not exist; substituted with the live team stadium/gameday hub
// or the venue's own site, same hub precedent as the Mariners MLB fix).
const BAG_URL_OVERRIDES: Record<string, string> = {
  // NBA/NHL batch (PR #20)
  'enterprise-center': 'https://www.enterprisecenter.com/guest-services/arena-a-z-guide',
  'madison-square-garden': 'https://www.msg.com/plan-your-visit',
  // WNBA
  'wintrust-arena': 'https://www.wintrustarena.com/plan-your-visit',
  // MLS East
  'audi-field': 'https://www.dcunited.com/matchday/bag-policy',
  'saputo-stadium': 'https://www.cfmontreal.com/en/stadium',
  'geodis-park': 'https://www.nashvillesc.com/geodispark/know-before-you-go',
  'bmo-field': 'https://www.bmofield.com/plan-your-visit',
  // MLS West
  'dicks-sporting-goods-park': 'https://www.coloradorapids.com/gameday',
  'toyota-stadium': 'https://www.fcdallas.com/stadium',
  'shell-energy-stadium': 'https://www.houstondynamofc.com/gameday',
  'dignity-health-sports-park': 'https://www.lagalaxy.com/stadium',
  'bmo-stadium': 'https://www.lafc.com/stadium',
  'allianz-field': 'https://www.mnufc.com/stadium',
  'providence-park': 'https://www.providencepark.com/',
  'snapdragon-stadium': 'https://www.sandiegofc.com/stadium',
  'paypal-park': 'https://www.sjearthquakes.com/fans/',
  'childrens-mercy-park': 'https://www.sportingkc.com/stadium',
  'bc-place': 'https://www.whitecapsfc.com/matchday',
  // MLS/NFL shared
  'bank-of-america-stadium': 'https://www.bankofamericastadium.com/',
  'soldier-field': 'https://www.chicagofirefc.com/matchday',
  'gillette-stadium': 'https://www.gillettestadium.com/a-to-z-guide/',
  'lumen-field': 'https://www.soundersfc.com/stadium',
};

// Batch JSON key -> actual Firestore venue slug (Step 0 diagnostic). Source
// files stay as authored; we remap the write target here.
const SLUG_REMAP: Record<string, string> = {
  'nu-stadium': 'chase-stadium',                  // Inter Miami (relocated; doc id is still chase-stadium)
  'inter-co-stadium': 'exploria-stadium',         // Orlando City
  'america-first-field': 'americas-first-field',  // Real Salt Lake (doc slug carries the "s")
  'citypark': 'energizer-park',                   // St. Louis City SC
};

// Non-PYV doc fields to (re)write, keyed by ACTUAL Firestore slug. Mostly
// display-name corrections (slug + resolution mapping untouched). chase-stadium
// also gets the Nu Stadium address + coords: Inter Miami moved Fort Lauderdale
// -> Miami (Apr 2026), and stale coords would point SpotHero / hotel CTAs at
// the wrong city.
const DOC_FIELD_FIXES: Record<string, Record<string, string | number>> = {
  'amalie-arena': { name: 'Benchmark International Arena' },
  'entertainment-sports-arena': { name: 'CareFirst Arena' },
  'lower-com-field': { name: 'ScottsMiracle-Gro Field' },
  'red-bull-arena': { name: 'Sports Illustrated Stadium' },
  'exploria-stadium': { name: 'Inter&Co Stadium' },
  'americas-first-field': { name: 'America First Field' },
  'chase-stadium': { name: 'Nu Stadium', address: '1900 NW 37th Ave, Miami, FL 33125', lat: 25.7965, lng: -80.2178 },
};

const COPY_FIELDS = ['parkingInfo', 'publicTransit', 'accessibility', 'bagPolicyUrl', 'nearby'] as const;

function hasDash(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  for (const ch of s) { const c = ch.codePointAt(0)!; if (c === 0x2014 || c === 0x2013) return true; }
  return false;
}

function loadBatches(): Map<string, ArenaRecord> {
  const files = readdirSync(__dirname)
    .filter((f) => /^arena-plan-your-visit-.*\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error('no arena-plan-your-visit-*.json files found in scripts/');
  console.log(`[arena-pyv] merging ${files.length} batch file(s): ${files.join(', ')}`);
  const merged = new Map<string, ArenaRecord>();
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(__dirname, f), 'utf8')) as Record<string, unknown>;
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('_')) continue; // metadata, not a venue
      merged.set(key, val as ArenaRecord); // later batch wins on slug collision
    }
  }
  return merged;
}

function buildPayload(writeSlug: string, rec: ArenaRecord): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (rec.gatesOpen !== undefined) p.gatesOpen = rec.gatesOpen; // omitted for shared docs
  for (const f of COPY_FIELDS) {
    const v = f === 'bagPolicyUrl' ? (BAG_URL_OVERRIDES[writeSlug] ?? rec.bagPolicyUrl) : rec[f];
    if (v === undefined) throw new Error(`${writeSlug}: missing required field "${f}"`);
    p[f] = v as string;
  }
  const fixes = DOC_FIELD_FIXES[writeSlug];
  if (fixes) Object.assign(p, fixes); // name (+ address/lat/lng for chase-stadium)
  return p;
}

function diff(current: unknown, next: string | number): 'NEW' | 'CHANGED' | 'SAME' {
  if (current == null || current === '') return 'NEW';
  return current === next ? 'SAME' : 'CHANGED';
}

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[arena-pyv] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  const records = loadBatches();
  console.log(`[arena-pyv] venues: ${records.size}\n`);

  // Pre-flight: every venue doc must exist (we write by id), and no em/en dashes.
  const plans: { slug: string; batchKey: string; shared: boolean; payload: Record<string, string | number>; current: Record<string, unknown> }[] = [];
  for (const [batchKey, rec] of records) {
    const writeSlug = SLUG_REMAP[batchKey] ?? batchKey;
    const snap = await db.collection('venues').doc(writeSlug).get();
    if (!snap.exists) throw new Error(`venues/${writeSlug} (batch key "${batchKey}") does not exist. Aborting before any writes.`);
    const payload = buildPayload(writeSlug, rec);
    for (const [f, v] of Object.entries(payload)) {
      if (hasDash(v)) throw new Error(`${writeSlug}.${f} contains an em/en dash. Aborting (no-dash guard).`);
    }
    plans.push({ slug: writeSlug, batchKey, shared: rec.gatesOpen === undefined, payload, current: snap.data()! });
  }

  let writes = 0;
  const nameFixNotes: string[] = [];
  const bagSubNotes: string[] = [];

  for (const { slug, batchKey, shared, payload, current } of plans) {
    const remapNote = batchKey !== slug ? `  (remapped from "${batchKey}")` : '';
    console.log(`--- venues/${slug}${shared ? '  [SHARED]' : ''}${remapNote} ---`);
    if (shared) console.log('    gatesOpen: omitted (shared doc, per-league fallback supplies gate cadence)');
    let changed = false;
    for (const [field, val] of Object.entries(payload)) {
      const status = diff(current[field], val);
      if (status !== 'SAME') changed = true;
      const marker = status === 'NEW' ? '+ NEW    ' : status === 'CHANGED' ? '~ CHANGED' : '  same   ';
      const old = status === 'CHANGED' ? `  (old: ${JSON.stringify(current[field]).slice(0, 40)})` : '';
      console.log(`    ${marker} ${field}: ${JSON.stringify(val).slice(0, 84)}${old}`);
      if (field === 'bagPolicyUrl' && BAG_URL_OVERRIDES[slug]) bagSubNotes.push(`${slug} -> ${val}`);
      if (field === 'name') nameFixNotes.push(`${slug}: name ${status} ${JSON.stringify(current[field])} -> ${JSON.stringify(val)}`);
    }
    if (changed) writes++;
    if (execute && changed) { await db.collection('venues').doc(slug).set(payload, { merge: true }); console.log(`    -> wrote venues/${slug}`); }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`  venues planned:   ${plans.length} (${plans.filter((p) => p.shared).length} shared, ${plans.filter((p) => !p.shared).length} single-tenant)`);
  console.log(`  docs ${execute ? 'written' : 'to write'}:    ${writes}`);
  console.log(`  bag-URL substitutions: ${bagSubNotes.length ? bagSubNotes.join('; ') : 'none'}`);
  console.log(`  name fixes:            ${nameFixNotes.length ? nameFixNotes.join('; ') : 'none'}`);
  if (!execute) console.log('\n[arena-pyv] DRY-RUN complete. Re-run with --execute to write.');
  else console.log('\n[arena-pyv] EXECUTE complete.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
