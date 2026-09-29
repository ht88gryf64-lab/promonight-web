// Captures, through the web's own data layer, the team records and park names
// the playoffs fixtures need. Nothing is typed by hand: teams are what
// getAllTeams returns, parks are what getVenueForTeam returns.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllTeams, getVenueForTeam } from '../../data';

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
  writeFileSync(join(FX, 'clubs.captured-20260929.json'), JSON.stringify({ capturedAt: new Date().toISOString(), teams, parks }, null, 2) + '\n');
  console.log('clubs in fixtures', slugs.size, '| team records', teams.length, '| missing', missing.join(',') || 'none', '| parks', Object.keys(parks).length);
  for (const t of teams) console.log(' ', t.id, '|', t.abbreviation, '|', t.city, '|', t.name, '|', parks[t.id] ?? '(no park)');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
