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

// Curl-verified dead links replaced with live official pages (2026-05-23).
const BAG_URL_OVERRIDES: Record<string, string> = {
  'enterprise-center': 'https://www.enterprisecenter.com/guest-services/arena-a-z-guide', // /arena-info/a-z-guide 404'd
  'madison-square-garden': 'https://www.msg.com/plan-your-visit',                          // /policies 404'd
};

// Display-name-only corrections (doc id + resolution mapping untouched).
const NAME_FIXES: Record<string, string> = {
  'amalie-arena': 'Benchmark International Arena', // renamed from Amalie Arena, 2025
};

const COPY_FIELDS = ['parkingInfo', 'publicTransit', 'accessibility', 'bagPolicyUrl', 'nearby'] as const;

function hasDash(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  for (const ch of s) { const c = ch.codePointAt(0)!; if (c === 0x2014 || c === 0x2013) return true; }
  return false;
}

function loadBatches(): Map<string, ArenaRecord> {
  const files = readdirSync(__dirname)
    .filter((f) => /^arena-plan-your-visit-batch.*\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error('no arena-plan-your-visit-batch*.json files found in scripts/');
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

function buildPayload(slug: string, rec: ArenaRecord): Record<string, string> {
  const p: Record<string, string> = {};
  if (rec.gatesOpen !== undefined) p.gatesOpen = rec.gatesOpen; // omitted for shared docs
  for (const f of COPY_FIELDS) {
    const v = f === 'bagPolicyUrl' ? (BAG_URL_OVERRIDES[slug] ?? rec.bagPolicyUrl) : rec[f];
    if (v === undefined) throw new Error(`${slug}: missing required field "${f}"`);
    p[f] = v as string;
  }
  if (NAME_FIXES[slug]) p.name = NAME_FIXES[slug];
  return p;
}

function diff(current: unknown, next: string): 'NEW' | 'CHANGED' | 'SAME' {
  if (current == null || current === '') return 'NEW';
  return current === next ? 'SAME' : 'CHANGED';
}

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[arena-pyv] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  const records = loadBatches();
  console.log(`[arena-pyv] venues: ${records.size}\n`);

  // Pre-flight: every venue doc must exist (we write by id), and no em/en dashes.
  const plans: { slug: string; shared: boolean; payload: Record<string, string>; current: Record<string, unknown> }[] = [];
  for (const [slug, rec] of records) {
    const snap = await db.collection('venues').doc(slug).get();
    if (!snap.exists) throw new Error(`venues/${slug} does not exist. Aborting before any writes.`);
    const payload = buildPayload(slug, rec);
    for (const [f, v] of Object.entries(payload)) {
      if (hasDash(v)) throw new Error(`${slug}.${f} contains an em/en dash. Aborting (no-dash guard).`);
    }
    plans.push({ slug, shared: rec.gatesOpen === undefined, payload, current: snap.data()! });
  }

  let writes = 0;
  const nameFixNotes: string[] = [];
  const bagSubNotes: string[] = [];

  for (const { slug, shared, payload, current } of plans) {
    console.log(`--- venues/${slug}${shared ? '  [SHARED]' : ''} ---`);
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
