/* eslint-disable no-console */
// Creates ONE venueHubs doc: Cotton Bowl Stadium, Fair Park, Dallas TX.
//
// WHY: the 2026 Red River Rivalry (Oklahoma vs Texas, 2026-10-10) is played
// here, and the building exists in NO collection today. cfbVenues holds only the
// 86 campus stadiums, and venueHubs has never carried it because it has no pro
// tenant. Without this doc the highest-demand matchup page in the family has no
// venue name, no coordinates, and no gates-and-bags step.
//
// It must clear venueHubIsIndexable (src/lib/venue-hub.ts:222-229): coordinates,
// verified:true, and at least two of (bag policy, parking, transit). All three
// are sourced first-party below, so it clears on 3 of 3.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/cfb/create-cotton-bowl-hub.ts              # DRY
//   ... scripts/cfb/create-cotton-bowl-hub.ts --execute  # writes

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { db } from '../../src/lib/firebase';

const EXECUTE = process.argv.includes('--execute');
const SLUG = 'cotton-bowl-stadium';
const SNAPSHOT = '/private/tmp/claude-501/-Users-mattkovalik-promonight-web/346d5ecb-5f28-4438-a414-197bdd339388/scratchpad/p1aw-cottonbowl-snapshot.json';
const NOW = new Date().toISOString();

const FAIR_PARK = 'https://www.fairparkdallas.com/cotton-bowl-stadium';
const FP_PARKING = 'https://www.fairparkdallas.com/visit/parking';
const FP_DIRECTIONS = 'https://www.fairparkdallas.com/visit/directions';
const BIGTEX_FB = 'https://bigtex.com/plan-your-visit/attractions-events/college-football/';
const BIGTEX_FAQ = 'https://bigtex.com/about-us/faq/';
const DART_MLK = 'https://www.dart.org/guide/transit-and-use/rail/rail-station-detail/mlk--jr--station';
const DART_FAIRPARK = 'https://www.dart.org/guide/transit-and-use/rail/rail-station-detail/fair-park-station';
const PARKING_MAP = 'https://www.fairparkdallas.com/assets/img/Fair-Park-Dallas-Large-Map_2022-080314fd07.jpg';

const doc = {
  slug: SLUG,
  name: 'Cotton Bowl Stadium',
  city: 'Dallas',
  state: 'Texas',

  // Coordinates are DERIVED, not venue-published. No official page (Fair Park,
  // City of Dallas, State Fair) publishes lat/lng; this is the OpenStreetMap
  // building-footprint centroid for way 27112448, corroborated to within about
  // 20 m by Wikipedia's coordinates API. The street address is first-party.
  lat: 32.7796,
  lng: -96.7596,
  coordsVerified: false,

  // Published as "more than 91,000", never as an exact integer, so no
  // false-precision number is recorded here.
  capacity: null,

  // No permanent tenant. This is a neutral-site building in our data, reached
  // from the matchup page via cfbGames.neutralVenueHubSlug rather than from any
  // team page, so getTeamVenueHubMap correctly skips it.
  tenants: [],

  clearBagRequired: true,
  bagMaxDimensions: { w: 12, h: 6, d: 12, unit: 'in' },
  bagPolicyUrl: FAIR_PARK,
  bagPolicyNotes:
    'Clear bag policy in effect for all events at Cotton Bowl Stadium. Approved: one clear plastic bag or tote up to 12 by 6 by 12 inches, a one-gallon clear resealable storage bag, or a non-clear clutch or purse no larger than 4.5 by 6.5 inches. Medical device bags are permitted and are searched at the gate. Prohibited: backpacks, coolers, hard-sided bags, cans, plastic bottles and thermoses. Note the surrounding State Fair grounds allow a larger 9 by 10 by 12 inch clear bag and soft-shell coolers, so a bag that clears the fairgrounds gate can still be turned away at the stadium gate. The stadium policy is the stricter one.',

  parkingLots: [
    { name: 'Lots 12A, 12AA, 12B, 12C', notes: 'Immediately east of the stadium, the closest cluster' },
    { name: 'Lots 3D, 3E, 3EE', notes: 'North and northwest of the stadium, off Nimitz and Washington' },
    { name: 'Lots 5A, 5B, 5C and 6A, 6B', notes: 'Inside Gates 5 and 6 on Robert B Cullum Blvd, the main entrance gates' },
    { name: 'Parry Lot', notes: 'Far west on Parry Ave, adjacent to DART Fair Park Station' },
    { name: 'Lot 15A', notes: 'Outermost east lot off S Haskell Ave; the walk-in lot for RV-area guests' },
  ],
  parkingLotMapUrl: PARKING_MAP,
  officialParkingUrls: [FP_PARKING, 'https://bigtex.com/rv-parking-information/'],

  publicTransit: {
    lines: ['DART Rail Green Line'],
    notes:
      'The DART Green Line is the only rail line serving Fair Park. MLK, Jr. Station (1412 S. Trunk Ave.) is the shortest walk to the stadium via Gate 6 and has about 200 free spaces at the adjacent J.B. Jackson, Jr. Transit Center, so it doubles as a park and ride. Fair Park Station (3710 Parry Ave.) serves the main Parry Avenue entrance and has no public parking. From downtown, transfer to the Green Line at Pearl/Arts District or Akard; Orange Line riders from DFW Airport transfer at Bachman.',
  },

  nearby:
    'Inside Fair Park. The 2026 Red River Rivalry on October 10 falls inside the State Fair of Texas (September 25 to October 18), so fairtime paid parking applies on game day rather than the free non-event-day rate, and parking gates open at 9:30 a.m.',

  sources: {
    clearBagRequired: BIGTEX_FB,
    bagMaxDimensions: FAIR_PARK,
    bagPolicyUrl: FAIR_PARK,
    bagPolicyNotes: FAIR_PARK,
    parkingLots: PARKING_MAP,
    parkingLotMapUrl: FP_PARKING,
    officialParkingUrls: FP_PARKING,
    publicTransit: FP_DIRECTIONS,
    nearby: BIGTEX_FAQ,
    capacity: FAIR_PARK,
  },

  verified: true,
  verifiedAt: NOW,
  verifyNotes:
    'Created for the 2026 Red River Rivalry. Bag policy confirmed on two first-party pages that agree: fairparkdallas.com (City of Dallas) gives the 12 by 6 by 12 inch clear-bag spec verbatim, and bigtex.com states "a clear bag policy is in effect for all events at Cotton Bowl Stadium within Fair Park". The 12 by 6 by 12 axis mapping to w/h/d follows the same convention as the other buildings in this collection and is INFERRED; the source states the dimensions unlabelled. Parking lots read directly off the official Fair Park map image linked from the parking page. Transit confirmed on Fair Park directions plus both DART station pages, which name the Green Line and list Cotton Bowl Stadium as a nearby destination for MLK, Jr. Station. COORDINATES ARE DERIVED, not venue-published: no official page publishes lat/lng, so this is the OpenStreetMap footprint centroid corroborated by Wikipedia, and coordsVerified is false. Capacity left null because the operator publishes only "more than 91,000". No 2026 Red River event page exists on fairparkdallas.com yet and no kickoff time is officially published, so neither was recorded.',
  updatedAt: NOW,
};

async function main() {
  console.log(`Cotton Bowl venueHubs doc [${EXECUTE ? 'EXECUTE' : 'DRY'}]\n`);

  const existing = await db.collection('venueHubs').doc(SLUG).get();
  console.log(`venueHubs/${SLUG} exists already: ${existing.exists}`);
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: NOW, slug: SLUG, existedBefore: existing.exists, before: existing.exists ? existing.data() : null }, null, 2));
  console.log(`snapshot -> ${SNAPSHOT}\n`);

  // Replicate venueHubIsIndexable (src/lib/venue-hub.ts:222-229) against the doc
  // ABOUT to be written, so a doc that would fail the floor is never created.
  const hasGeo = doc.lat !== null && doc.lng !== null;
  const hasBag = doc.clearBagRequired !== null || !!doc.bagMaxDimensions || !!doc.bagPolicyUrl || !!doc.bagPolicyNotes;
  const hasParking = doc.parkingLots.length > 0 || !!doc.parkingLotMapUrl;
  const hasTransit = !!doc.publicTransit && (doc.publicTransit.lines.length > 0 || !!doc.publicTransit.notes);
  const twoOfThree = [hasBag, hasParking, hasTransit].filter(Boolean).length;
  const indexable = hasGeo && twoOfThree >= 2 && doc.verified === true;

  console.log('INDEXING FLOOR CHECK (venue-hub.ts:222-229)');
  console.log(`  geo      ${hasGeo}  (${doc.lat}, ${doc.lng})`);
  console.log(`  verified ${doc.verified}`);
  console.log(`  bag      ${hasBag}`);
  console.log(`  parking  ${hasParking}`);
  console.log(`  transit  ${hasTransit}`);
  console.log(`  -> ${twoOfThree} of 3 fact groups, INDEXABLE = ${indexable}\n`);

  if (!indexable) {
    console.error('ABORT: the doc would not clear the indexing floor. Refusing to write it.');
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log(JSON.stringify(doc, null, 1).slice(0, 1800));
    console.log('\nDRY. No writes. Re-run with --execute to apply.');
    process.exit(0);
  }

  await db.collection('venueHubs').doc(SLUG).set(doc);
  // Point the Red River game at it now that the building exists.
  await db.collection('cfbGames').doc('2026-2026-10-10-oklahoma-texas').update({ neutralVenueHubSlug: SLUG });
  console.log(`EXECUTED: created venueHubs/${SLUG} and set neutralVenueHubSlug on 2026-2026-10-10-oklahoma-texas.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
