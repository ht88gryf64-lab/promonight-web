/* eslint-disable no-console */
// Resolution-plumbing Firestore writes for the in-season arena PYV rollout.
// NOT copy — this only creates/repairs venue docs so getVenueForTeam (+ the
// venue-resolution-map) can resolve all 105 in-season teams.
//
// Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-arena-venue-fixes.ts            # dry-run (default)
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/populate-arena-venue-fixes.ts --execute  # writes
//
// Four changes (all verified in Phase 1/2 diagnosis):
//   1. CREATE venues/rocket-arena — Cleveland Cavaliers had no venue doc at all
//      (Category C). Built to match sibling NBA venue docs; no PYV copy fields.
//   2. venues/footprint-center.name -> "Mortgage Matchup Center" (Suns/Mercury
//      arena renamed fall 2025; drives the render-derived bag label). Slug kept.
//   3. venues/delta-center.team -> "Utah Mammoth" (renamed from Utah Hockey Club
//      for 2025-26). Corrects the doc's tenant field; also lets the NHL team
//      resolve via the primary query.
//   4. venues/crypto-com-arena.sharedTeams -> drop stale "lac-nba" (Clippers
//      left for Intuit Dome in 2024).
//
// Idempotent: re-running produces no diff once written.

import { db } from '../src/lib/firebase';

const ROCKET_ARENA = {
  name: 'Rocket Arena',
  team: 'Cleveland Cavaliers',
  sport: 'NBA',
  sportIcon: '🏀',
  league: 'NBA',
  teamId: 'cle-nba',
  address: '1 Center Court, Cleveland, OH 44115',
  lat: 41.4965,
  lng: -81.6882,
  primaryColor: '#860038',
  accentColor: '#FDBB30',
  hasAmenityData: false,
  amenityCount: 0,
};

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`[populate-arena-venue-fixes] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}\n`);
  let changes = 0;

  // 1. CREATE rocket-arena
  {
    const ref = db.collection('venues').doc('rocket-arena');
    const cur = await ref.get();
    console.log('--- venues/rocket-arena ---');
    if (cur.exists) {
      const same = JSON.stringify({ ...cur.data() }) === JSON.stringify(ROCKET_ARENA);
      console.log(same ? '  exists, identical -> no-op' : '  exists, DIFFERS -> would overwrite');
      if (!same) { changes++; if (execute) { await ref.set(ROCKET_ARENA, { merge: true }); console.log('  updated'); } }
    } else {
      changes++;
      console.log(`  + CREATE: ${JSON.stringify(ROCKET_ARENA)}`);
      if (execute) { await ref.set(ROCKET_ARENA); console.log('  created'); }
    }
    console.log('');
  }

  // 2. footprint-center.name
  await fieldFix('footprint-center', 'name', 'Mortgage Matchup Center', () => changes++, execute);
  // 3. delta-center.team
  await fieldFix('delta-center', 'team', 'Utah Mammoth', () => changes++, execute);

  // 4. crypto-com-arena.sharedTeams: drop "lac-nba"
  {
    const ref = db.collection('venues').doc('crypto-com-arena');
    const cur = (await ref.get()).data()!;
    const old = (cur.sharedTeams as string[] | undefined) ?? [];
    const next = old.filter((id) => id !== 'lac-nba');
    console.log('--- venues/crypto-com-arena.sharedTeams ---');
    if (JSON.stringify(old) === JSON.stringify(next)) {
      console.log(`  already ${JSON.stringify(next)} -> no-op`);
    } else {
      changes++;
      console.log(`  ~ CHANGE: ${JSON.stringify(old)} -> ${JSON.stringify(next)}`);
      if (execute) { await ref.set({ sharedTeams: next }, { merge: true }); console.log('  updated'); }
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`  changes ${execute ? 'written' : 'pending'}: ${changes}`);
  if (!execute) console.log('  DRY-RUN — re-run with --execute to write.');
  process.exit(0);
}

async function fieldFix(venueId: string, field: string, value: string, bump: () => void, execute: boolean) {
  const ref = db.collection('venues').doc(venueId);
  const cur = (await ref.get()).data()!;
  console.log(`--- venues/${venueId}.${field} ---`);
  if (cur[field] === value) {
    console.log(`  already ${JSON.stringify(value)} -> no-op`);
  } else {
    bump();
    console.log(`  ~ CHANGE: ${JSON.stringify(cur[field])} -> ${JSON.stringify(value)}`);
    if (execute) { await ref.set({ [field]: value }, { merge: true }); console.log('  updated'); }
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
