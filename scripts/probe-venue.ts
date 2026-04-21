/* eslint-disable no-console */
import { getVenueForTeam, getTeamBySlug } from '../src/lib/data';

async function main() {
  const ids = [
    'minnesota-wild',
    'cleveland-cavaliers',
    'oklahoma-city-thunder',
    'denver-nuggets',
    'san-antonio-spurs',
    'buffalo-sabres',
  ];
  for (const id of ids) {
    const team = await getTeamBySlug(id);
    const venue = await getVenueForTeam(id);
    console.log(`${id.padEnd(28)}  team=${team ? `${team.city} ${team.name}` : 'null'}`);
    console.log(`${' '.repeat(28)}  venue=${venue ? venue.name : 'NULL'}${venue?.address ? ` (${venue.address})` : ''}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
