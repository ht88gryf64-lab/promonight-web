// Captures, through the web's own data layer, the team records, park names
// and venue page links the playoffs fixtures need. Nothing is typed by hand:
// teams are what getAllTeams returns, parks are what getVenueForTeam returns,
// venue pages are what getTeamVenueHubMap returns.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllTeams, getVenueForTeam } from '../../data';
import { getTeamVenueHubMap } from '../../venue-hub';

const FX = new URL('.', import.meta.url).pathname;
async function main() {
  const slugs = new Set<string>();
  for (const f of readdirSync(FX).filter((n) => /^(MLB|WNBA)_.*\.json$/.test(n))) {
    const d = JSON.parse(readFileSync(join(FX, f), 'utf-8'));
    for (const s of d.series) for (const slot of [s.higher, s.lower]) if (slot.slug) slugs.add(slot.slug);
  }
  const all = await getAllTeams();
  const teams = all.filter((t) => slugs.has(t.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const missing = [...slugs].filter((s) => !teams.some((t) => t.id === s));
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
  writeFileSync(join(FX, 'clubs.captured-20260929.json'), JSON.stringify({ capturedAt: new Date().toISOString(), teams, parks, venuePages }, null, 2) + '\n');
  console.log('clubs in fixtures', slugs.size, '| team records', teams.length, '| missing', missing.join(',') || 'none', '| parks', Object.keys(parks).length, '| venue pages', Object.keys(venuePages).length);
  for (const t of teams) {
    const v = venuePages[t.id];
    console.log(' ', t.id, '|', parks[t.id] ?? '(no park)', '|', v ? `${v.slug} "${v.displayName}" ${v.indexable ? 'INDEXABLE' : 'held'}` : '(no venue page)');
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
