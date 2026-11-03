// Captures, through the web's own data layer, the 30 MLS team records, their
// park names and venue page links, for the MLS playoffs fixtures. Nothing is
// typed by hand. Read-only.
//
//   npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
//     src/lib/postseason/__fixtures__/capture-mls-clubs.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllTeams, getVenueForTeam } from '../../data';
import { getTeamVenueHubMap } from '../../venue-hub';

const FX = new URL('.', import.meta.url).pathname;
async function main() {
  const all = await getAllTeams();
  const teams = all.filter((t) => t.league === 'MLS').sort((a, b) => (a.id < b.id ? -1 : 1));
  const parks: Record<string, string> = {};
  for (const t of teams) {
    const v = await getVenueForTeam(t.id);
    if (v && v.name) parks[t.id] = v.name;
  }
  const hubs = await getTeamVenueHubMap();
  const venuePages: Record<string, { slug: string; displayName: string; indexable: boolean }> = {};
  for (const t of teams) {
    const h = hubs.get(t.id);
    if (h) venuePages[t.id] = { slug: h.slug, displayName: h.displayName, indexable: h.indexable };
  }
  writeFileSync(join(FX, 'clubs.mls.captured-20261103.json'), JSON.stringify({ capturedAt: new Date().toISOString(), teams, parks, venuePages }, null, 2) + '\n');
  console.log('MLS team records', teams.length, '| parks', Object.keys(parks).length, '| venue pages', Object.keys(venuePages).length);
  for (const t of teams) console.log(' ', t.id, '|', t.city, '|', t.name, '|', t.abbreviation, '|', parks[t.id] ?? '(no park)', '|', venuePages[t.id]?.indexable ? 'INDEXABLE' : venuePages[t.id] ? 'held' : '-');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
