/* eslint-disable no-console */
// Seed the washington-state cfbSchools doc (Phase 2 item 4 of the Rivalry Week
// hub build): Apple Cup's second side, previously the one untracked school in
// the 32-rivalry matchup registry, rendering as plain text + "Not tracked yet"
// on /cfb/rivalries/apple-cup.
//
// HARD DATA ONLY, per the verify contract (audit/cfb-stream-build-spec.md §4):
// every fact below carries two independent sources; no editorial fields are
// seeded (editorialStatus stays 'auto', traditionIds empty, no narrative
// anywhere).
//
//   name/shortName/mascot  en.wikipedia.org/wiki/Washington_State_Cougars_football
//                          + wsucougars.com (official athletics site)
//   conference 2026        Wikipedia infobox ("Pac-12 Conference") + official
//     = "Pac-12"           wsucougars.com 2026 schedule (Pac-12 Championship
//                          entry Dec 4, Pac-12 logos on conference games).
//                          String matches the boise-state doc exactly so the
//                          hub browse groups them together.
//   colors                 #981E32 crimson / #53565A gray from Wikipedia's
//                          college-color data (citing the WSU Athletics Brand
//                          Identity Guidelines) — the SAME extraction source
//                          the existing 86 docs match (washington #33006F/
//                          #E8D3A2 and boise-state #0033A0/#D64309 both equal
//                          that module's values). Crimson #981E32 is unanimous
//                          across sources; the gray hex varies by source
//                          (#5E6A71 teamcolorcodes, #4D4D4D university brand)
//                          so colorsHumanConfirmed stays false, matching every
//                          other doc.
//   venueId                '' — Martin Stadium (Pullman) has no cfbVenues doc;
//                          an empty id is the honest value (16 cfbGames docs
//                          already carry ''), the reader null-guards it, and
//                          the school page sits below the index floor (<8
//                          games) so it ships noindex until the corpus grows.
//
// Usage (dry-run by default; nothing is written without --execute):
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/cfb/seed-washington-state.ts [--execute]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CfbSchool } from '../../src/lib/cfb/types';

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
const db = getFirestore();

// colorsHumanConfirmed is stored on every existing doc but not declared on the
// CfbSchool interface; mirror the stored shape, not just the type.
const DOC: CfbSchool & { colorsHumanConfirmed: boolean } = {
  id: 'washington-state',
  name: 'Washington State',
  shortName: 'Washington State',
  mascot: 'Cougars',
  primaryColor: '#981E32',
  secondaryColor: '#53565A',
  colorsSource: 'https://en.wikipedia.org/wiki/Washington_State_Cougars_football',
  colorsHumanConfirmed: false,
  conferenceBySeason: { '2026': 'Pac-12' },
  venueId: '',
  traditionIds: [],
  editorialStatus: 'auto',
  updatedAt: new Date().toISOString(),
};

async function main() {
  const execute = process.argv.includes('--execute');
  const ref = db.collection('cfbSchools').doc(DOC.id);

  const existing = await ref.get();
  if (existing.exists) {
    console.error(`REFUSING: cfbSchools/${DOC.id} already exists. This seed never overwrites.`);
    process.exit(1);
  }

  console.log(`cfbSchools/${DOC.id} ${execute ? 'WRITE' : 'DRY RUN (pass --execute to write)'}`);
  console.log(JSON.stringify(DOC, null, 2));

  if (execute) {
    await ref.set(DOC);
    const check = await ref.get();
    console.log('written + read back:', check.exists);
    const count = await db.collection('cfbSchools').count().get();
    console.log('cfbSchools count now:', count.data().count);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
