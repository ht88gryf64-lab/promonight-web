/* eslint-disable no-console */
import { getVenueForTeam, getTeamBySlug } from '../src/lib/data';

// Default probe list — sample of leagues whose venue-doc coverage we have
// historically wanted to spot-check. When CLI args are passed, those slugs
// replace the default list. Usage:
//   tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     scripts/probe-venue.ts <slug> [slug ...]
const DEFAULT_SLUGS = [
  'minnesota-wild',
  'cleveland-cavaliers',
  'oklahoma-city-thunder',
  'denver-nuggets',
  'san-antonio-spurs',
  'buffalo-sabres',
];

async function main() {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const ids = argv.length > 0 ? argv : DEFAULT_SLUGS;

  let teamHits = 0;
  let venueHits = 0;
  let coordHits = 0;
  const missing: string[] = [];

  for (const id of ids) {
    const team = await getTeamBySlug(id);
    const venue = await getVenueForTeam(id);
    const hasCoords =
      !!venue &&
      typeof venue.lat === 'number' &&
      typeof venue.lng === 'number' &&
      Number.isFinite(venue.lat) &&
      Number.isFinite(venue.lng) &&
      venue.lat !== 0 &&
      venue.lng !== 0;
    if (team) teamHits += 1;
    if (venue) venueHits += 1;
    if (hasCoords) coordHits += 1;
    if (!team || !venue || !hasCoords) missing.push(id);

    const teamLabel = team ? `${team.city} ${team.name}` : 'null';
    const venueLabel = venue
      ? `${venue.name}${hasCoords ? ` (${venue.lat}, ${venue.lng})` : ' [NO COORDS]'}`
      : 'NULL';
    console.log(`${id.padEnd(28)}  team=${teamLabel}`);
    console.log(`${' '.repeat(28)}  venue=${venueLabel}${venue?.address ? ` (${venue.address})` : ''}`);
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`  Slugs probed:     ${ids.length}`);
  console.log(`  Teams resolved:   ${teamHits} / ${ids.length}`);
  console.log(`  Venues found:     ${venueHits} / ${ids.length}`);
  console.log(`  With lat/lng:     ${coordHits} / ${ids.length}`);
  if (missing.length > 0) {
    console.log(`  Missing/partial:  ${missing.join(', ')}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
