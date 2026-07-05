/* eslint-disable no-console */
// WNBA GAME DAY venue populator. Writes the six game-day fields to the ten
// previously-empty WNBA venue docs (2 standalone expansion arenas + 8 shared
// NBA/NHL buildings). Sibling of populate-arena-plan-your-visit.ts, but purpose
// built for this batch with a snapshot-before-write step for full reversibility.
//
// Source of every value: docs/wnba-gameday-venue-research.md (verbatim). Data
// lives in scripts/wnba-gameday-venues.json (one key per venue doc id).
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-wnba-gameday-venues.ts            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-wnba-gameday-venues.ts --execute  # snapshot + write
//
// Write discipline:
//   - Payload is EXACTLY the six game-day fields. Base fields (name, team,
//     address, lat, lng, sport, league, teamId, colors, sharedTeams) are never
//     in the payload, so a merge-write cannot clobber them.
//   - venues/{id}.set(payload, { merge: true }) — idempotent, additive.
//   - gatesOpen is written on 9 of 10 docs. The two NHL co-tenant buildings
//     (crypto-com-arena / Kings, climate-pledge-arena / Kraken) OMIT gatesOpen
//     so VenueInfoBlock's per-league fallback supplies correct "puck drop"
//     wording on the hockey page; their WNBA pages fall to the 90-minute
//     fallback. The other 8 carry gatesOpen ("tip-off" is correct for the
//     basketball co-tenants).
//   - --execute snapshots each doc's FULL prior state to scripts/snapshots/
//     before any write, so every change is reversible from disk.
//   - No em/en dashes: hard guard aborts before any write.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { db } from '../src/lib/firebase';

const GAME_FIELDS = ['gatesOpen', 'parkingInfo', 'publicTransit', 'accessibility', 'bagPolicyUrl', 'nearby'] as const;
type GameField = (typeof GAME_FIELDS)[number];
const ALLOWED = new Set<string>(GAME_FIELDS);
// gatesOpen is optional (omitted on the two NHL co-tenant docs); the other five
// are required on every doc in the batch.
const REQUIRED_FIELDS = ['parkingInfo', 'publicTransit', 'accessibility', 'bagPolicyUrl', 'nearby'] as const;

interface Record6 {
  venue?: string; // annotation only, never written
  gatesOpen?: string;
  parkingInfo?: string;
  publicTransit?: string;
  accessibility?: string;
  bagPolicyUrl?: string;
  nearby?: string;
}

function hasDash(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c === 0x2014 || c === 0x2013) return true; // em dash, en dash
  }
  return false;
}

function buildPayload(id: string, rec: Record6): Partial<Record<GameField, string>> {
  const p: Partial<Record<GameField, string>> = {};
  // gatesOpen: optional. Write only when the record supplies a non-empty value.
  if (rec.gatesOpen !== undefined) {
    if (typeof rec.gatesOpen !== 'string' || rec.gatesOpen.trim().length === 0) {
      throw new Error(`${id}: gatesOpen present but empty. Omit the key entirely to skip it.`);
    }
    p.gatesOpen = rec.gatesOpen;
  }
  for (const f of REQUIRED_FIELDS) {
    const v = rec[f];
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new Error(`${id}: missing/empty required field "${f}"`);
    }
    p[f] = v;
  }
  return p;
}

function diff(current: unknown, next: string): 'NEW' | 'CHANGED' | 'SAME' {
  if (current == null || current === '') return 'NEW';
  return current === next ? 'SAME' : 'CHANGED';
}

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[wnba-gameday] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

  const raw = JSON.parse(
    readFileSync(join(__dirname, 'wnba-gameday-venues.json'), 'utf8')
  ) as Record<string, Record6>;
  const records = Object.entries(raw).filter(([k]) => !k.startsWith('_'));
  console.log(`[wnba-gameday] venues in batch: ${records.length}\n`);

  // Pre-flight: doc must exist, payload builds, no dashes, payload keys are a
  // subset of the six allowed fields (defense against base-field clobber).
  const plans: { id: string; payload: Partial<Record<GameField, string>>; current: FirebaseFirestore.DocumentData }[] = [];
  for (const [id, rec] of records) {
    const snap = await db.collection('venues').doc(id).get();
    if (!snap.exists) throw new Error(`venues/${id} does not exist. Aborting before any writes.`);
    const payload = buildPayload(id, rec);
    for (const [f, v] of Object.entries(payload)) {
      if (!ALLOWED.has(f)) throw new Error(`${id}: payload field "${f}" is not a game-day field. Aborting.`);
      if (hasDash(v)) throw new Error(`${id}.${f} contains an em/en dash. Aborting (no-dash guard).`);
    }
    plans.push({ id, payload, current: snap.data()! });
  }

  // Snapshot BEFORE any write (execute only). Full prior doc state -> disk.
  if (execute) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapPath = join(__dirname, 'snapshots', `wnba-gameday-pre-${stamp}.json`);
    const snapshot = Object.fromEntries(plans.map((p) => [p.id, p.current]));
    writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
    console.log(`[wnba-gameday] snapshot written: ${snapPath}\n`);
  }

  let writes = 0;
  for (const { id, payload, current } of plans) {
    console.log(`--- venues/${id} ---`);
    let changed = false;
    for (const f of GAME_FIELDS) {
      if (!(f in payload)) {
        console.log(`      omitted ${f} (falls back to per-league default at render)`);
        continue;
      }
      const val = payload[f]!;
      const status = diff(current[f], val);
      if (status !== 'SAME') changed = true;
      const marker = status === 'NEW' ? '+ NEW    ' : status === 'CHANGED' ? '~ CHANGED' : '  same   ';
      const old = status === 'CHANGED' ? `  (old: ${JSON.stringify(current[f]).slice(0, 40)})` : '';
      console.log(`    ${marker} ${f}: ${JSON.stringify(val)}${old}`);
    }
    if (changed) writes++;
    if (execute && changed) {
      await db.collection('venues').doc(id).set(payload, { merge: true });
      console.log(`    -> wrote venues/${id}`);
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`  venues in batch:  ${plans.length}`);
  console.log(`  docs ${execute ? 'written' : 'to write'}:    ${writes}`);
  if (!execute) console.log('\n[wnba-gameday] DRY-RUN complete. Re-run with --execute to snapshot + write.');
  else console.log('\n[wnba-gameday] EXECUTE complete.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
