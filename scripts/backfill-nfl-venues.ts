/* eslint-disable no-console */
// One-shot backfill for the 6 NFL venue docs missing from Firestore as of
// the Phase 1.5 probe on 2026-05-15. Mirrors the existing NFL venue-doc
// shape (see Rams / Giants / Vikings reference docs in `venues`).
//
// Dry-run by default. Pass --execute to write.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/backfill-nfl-venues.ts            # dry-run
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/backfill-nfl-venues.ts --execute  # writes
//
// Shape per doc (matches Rams / Giants reference exactly):
//   name, address, team (display name), sport: 'NFL', sportIcon: '🏈',
//   primaryColor, accentColor, lat, lng, hasAmenityData: false,
//   amenityCount: 0, league: 'NFL', teamId (league-suffixed short id),
//   sharedTeams?: string[] (for SoFi / MetLife shared-venue pairs).
//
// Colors are sourced from the Team doc (primaryColor / secondaryColor on
// the Team object are already converted from ARGB to hex by data.ts);
// the value is uppercased to match the existing venue-doc convention.
//
// Doc-id pattern: `{venue-slug}-{nfl-nickname}` for every backfill doc.
// Four of the six target venue slugs are already occupied by MLS docs for
// the MLS team that shares the stadium (Charlotte FC at BoA, Chicago Fire
// at Soldier, NE Revolution at Gillette, Sounders at Lumen); the other two
// are already occupied by the NFL co-tenant (Rams at SoFi, Giants at
// MetLife). The team-nickname suffix avoids overwrite on all six and
// stays consistent across the set. Lookup keys on team display name, not
// doc id, so the suffix has no functional effect on travel CTAs.
//
// Shared-venue notes (lat/lng to the decimal):
//   los-angeles-chargers + SoFi: matches Rams doc (33.9535, -118.3392).
//   new-york-jets + MetLife: matches Giants doc (40.8135, -74.0745).
//   The four MLS co-tenant docs also already have these lat/lng values.
//
// Pre-flight in --execute mode rejects any docId that already exists, so
// a re-run after a partial completion is safe (no overwrites).

import { db } from '../src/lib/firebase';
import { getTeamBySlug } from '../src/lib/data';

interface BackfillEntry {
  teamSlug: string;
  docId: string;
  venueName: string;
  address: string;
  lat: number;
  lng: number;
  teamIdShort: string;
  sharedTeamIds?: string[];
}

const ENTRIES: BackfillEntry[] = [
  {
    teamSlug: 'carolina-panthers',
    docId: 'bank-of-america-stadium-panthers',
    venueName: 'Bank of America Stadium',
    address: '800 S Mint St, Charlotte, NC 28202',
    lat: 35.2258,
    lng: -80.8528,
    teamIdShort: 'car-nfl',
    sharedTeamIds: ['clt-mls'],
  },
  {
    teamSlug: 'chicago-bears',
    docId: 'soldier-field-bears',
    venueName: 'Soldier Field',
    address: '1410 Special Olympics Dr, Chicago, IL 60605',
    lat: 41.8623,
    lng: -87.6167,
    teamIdShort: 'chi-nfl',
    sharedTeamIds: ['chi-mls'],
  },
  {
    teamSlug: 'new-england-patriots',
    docId: 'gillette-stadium-patriots',
    venueName: 'Gillette Stadium',
    address: '1 Patriot Pl, Foxborough, MA 02035',
    lat: 42.0909,
    lng: -71.2643,
    teamIdShort: 'ne-nfl',
    sharedTeamIds: ['ne-mls'],
  },
  {
    teamSlug: 'seattle-seahawks',
    docId: 'lumen-field-seahawks',
    venueName: 'Lumen Field',
    address: '800 Occidental Ave S, Seattle, WA 98134',
    lat: 47.5952,
    lng: -122.3316,
    teamIdShort: 'sea-nfl',
    sharedTeamIds: ['sea-mls'],
  },
  {
    teamSlug: 'los-angeles-chargers',
    docId: 'sofi-stadium-chargers',
    venueName: 'SoFi Stadium',
    address: '1001 S Stadium Dr, Inglewood, CA 90301',
    lat: 33.9535,
    lng: -118.3392,
    teamIdShort: 'lac-nfl',
    sharedTeamIds: ['lar-nfl'],
  },
  {
    teamSlug: 'new-york-jets',
    docId: 'metlife-stadium-jets',
    venueName: 'MetLife Stadium',
    address: '1 MetLife Stadium Dr, East Rutherford, NJ 07073',
    lat: 40.8135,
    lng: -74.0745,
    teamIdShort: 'nyj-nfl',
    sharedTeamIds: ['nyg-nfl'],
  },
];

function uppercaseHex(hex: string): string {
  if (!hex.startsWith('#')) return hex.toUpperCase();
  return `#${hex.slice(1).toUpperCase()}`;
}

async function main() {
  const execute = process.argv.includes('--execute');

  console.log(`[backfill-nfl-venues] mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log('');

  const prepared: Array<{ docId: string; teamSlug: string; data: Record<string, unknown> }> = [];

  for (const entry of ENTRIES) {
    const team = await getTeamBySlug(entry.teamSlug);
    if (!team) {
      throw new Error(`Team doc not found for slug "${entry.teamSlug}". Aborting before any writes.`);
    }
    const display = `${team.city} ${team.name}`;

    const data: Record<string, unknown> = {
      name: entry.venueName,
      address: entry.address,
      team: display,
      sport: 'NFL',
      sportIcon: '🏈',
      primaryColor: uppercaseHex(team.primaryColor),
      accentColor: uppercaseHex(team.secondaryColor),
      lat: entry.lat,
      lng: entry.lng,
      hasAmenityData: false,
      amenityCount: 0,
      league: 'NFL',
      teamId: entry.teamIdShort,
    };
    if (entry.sharedTeamIds) data.sharedTeams = entry.sharedTeamIds;

    prepared.push({ docId: entry.docId, teamSlug: entry.teamSlug, data });

    console.log(`--- ${entry.teamSlug} -> venues/${entry.docId} ---`);
    console.log(JSON.stringify(data, null, 2));
    console.log('');
  }

  if (!execute) {
    console.log(`[backfill-nfl-venues] dry-run complete. ${prepared.length} docs would be written.`);
    console.log('[backfill-nfl-venues] re-run with --execute to write.');
    process.exit(0);
  }

  // Refuse to clobber: each docId must not already exist.
  for (const { docId } of prepared) {
    const existing = await db.collection('venues').doc(docId).get();
    if (existing.exists) {
      throw new Error(`venues/${docId} already exists. Refusing to overwrite. Aborting.`);
    }
  }

  for (const { docId, teamSlug, data } of prepared) {
    await db.collection('venues').doc(docId).set(data);
    console.log(`[backfill-nfl-venues] wrote venues/${docId} (${teamSlug})`);
  }

  console.log('');
  console.log(`[backfill-nfl-venues] wrote ${prepared.length} venue docs`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
