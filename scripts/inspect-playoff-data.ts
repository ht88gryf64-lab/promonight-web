/* eslint-disable no-console */
/**
 * Inspection harness for the new playoff data-layer functions.
 * Run with: npx tsx --env-file=.env.local scripts/inspect-playoff-data.ts
 */
import {
  getPlayoffConfig,
  getActivePlayoffTeams,
  getPlayoffPromosForTeam,
  getAllPlayoffPromos,
  isTeamInPlayoffs,
} from '../src/lib/data';
import type { PlayoffPromo } from '../src/lib/types';

const hr = (label: string) =>
  console.log('\n' + '═'.repeat(70) + '\n  ' + label + '\n' + '═'.repeat(70));

const trunc = (s: string | null | undefined, n: number) =>
  !s ? '—' : s.length <= n ? s : s.slice(0, n - 1) + '…';

async function main() {
  // ── 1. getPlayoffConfig ──────────────────────────────────────────────
  hr('1. getPlayoffConfig()');
  const config = await getPlayoffConfig();
  if (!config) {
    console.log('NULL — appConfig/playoffs doc is missing');
    process.exit(1);
  }
  console.log({
    playoffsActive: config.playoffsActive,
    nbaActive: config.nbaActive,
    nhlActive: config.nhlActive,
    nbaRound: config.nbaRound,
    nhlRound: config.nhlRound,
    activeTeamIds_count: config.activeTeamIds.length,
    activeTeamIds_sample: config.activeTeamIds.slice(0, 5),
    eliminatedTeamIds_count: config.eliminatedTeamIds.length,
    lastScanDate: config.lastScanDate,
    updatedAt: config.updatedAt,
  });

  // ── 2. getActivePlayoffTeams ─────────────────────────────────────────
  hr('2. getActivePlayoffTeams()');
  const activeTeams = await getActivePlayoffTeams();
  console.log(`Returned ${activeTeams.length} hydrated team objects`);
  for (const t of activeTeams.slice(0, 4)) {
    console.log(
      `  [${t.league}] ${t.city} ${t.name} (${t.id}) · round=${t.round} · colors=${t.primaryColor}/${t.secondaryColor}`,
    );
  }
  console.log(`  ... and ${Math.max(0, activeTeams.length - 4)} more`);

  // ── 3. isTeamInPlayoffs ──────────────────────────────────────────────
  hr('3. isTeamInPlayoffs()');
  const truthyProbe = await isTeamInPlayoffs('minnesota-wild', config);
  const falseyProbe = await isTeamInPlayoffs('chicago-cubs', config);
  console.log(`  minnesota-wild      → ${truthyProbe}  (expected true)`);
  console.log(`  chicago-cubs (MLB)  → ${falseyProbe}  (expected false)`);

  // ── 4. getPlayoffPromosForTeam ───────────────────────────────────────
  hr('4. getPlayoffPromosForTeam("cleveland-cavaliers")');
  const clePromos = await getPlayoffPromosForTeam('cleveland-cavaliers');
  console.log(`Returned ${clePromos.length} promos for Cavs`);
  for (const p of clePromos.slice(0, 3)) {
    console.log(
      `  [${p.type}] ${p.title}  (recurring=${p.recurring}, date=${p.date ?? 'null'})`,
    );
    console.log(`     team: ${p.team.city} ${p.team.name} · venue: ${p.venue?.name ?? 'null'}`);
    console.log(`     desc: ${trunc(p.description, 120)}`);
    console.log(`     source: ${trunc(p.source, 80)}`);
  }

  // ── 5. getAllPlayoffPromos ───────────────────────────────────────────
  hr('5. getAllPlayoffPromos()');
  const all = await getAllPlayoffPromos();
  console.log(`Config loaded: ${!!all.config}`);
  console.log(`Total promos: ${all.totalPromos}`);
  console.log(`Total teams with promos: ${all.totalTeams}`);
  console.log(`NBA teams: ${all.byLeague.NBA.length}`);
  console.log(`NHL teams: ${all.byLeague.NHL.length}`);

  // Type & recurring coverage across the full set
  const allPromos: PlayoffPromo[] = [
    ...all.byLeague.NBA.flatMap((g) => g.promos),
    ...all.byLeague.NHL.flatMap((g) => g.promos),
  ];
  const typeCounts: Record<string, number> = {};
  let dated = 0;
  let recurring = 0;
  let highlight = 0;
  for (const p of allPromos) {
    typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;
    if (p.date) dated++;
    if (p.recurring) recurring++;
    if (p.highlight) highlight++;
  }
  console.log('\n  Coverage across full result:');
  console.log(`    type counts:       ${JSON.stringify(typeCounts)}`);
  console.log(`    dated promos:      ${dated}`);
  console.log(`    recurring promos:  ${recurring}`);
  console.log(`    highlight=true:    ${highlight}`);

  // One example per type + one recurring + one dated (user requested spot-check)
  hr('    SPOT-CHECK: one example per type + dated/recurring');
  const pickByType: Record<string, PlayoffPromo | undefined> = {};
  for (const p of allPromos) if (!pickByType[p.type]) pickByType[p.type] = p;
  const firstDated = allPromos.find((p) => p.date);
  const firstRecurring = allPromos.find((p) => p.recurring);
  const firstHighlight = allPromos.find((p) => p.highlight);

  const printOne = (label: string, p: PlayoffPromo | undefined) => {
    if (!p) return console.log(`  ${label}: (NONE FOUND)`);
    console.log(`  ${label}:`);
    console.log(`     teamId:      ${p.teamId} (${p.teamAbbr}, ${p.league})`);
    console.log(`     title:       ${p.title}`);
    console.log(`     type:        ${p.type}`);
    console.log(`     date:        ${p.date ?? 'null (recurring)'}`);
    console.log(`     gameInfo:    ${trunc(p.gameInfo, 60)}`);
    console.log(`     recurring:   ${p.recurring} · detail: ${trunc(p.recurringDetail, 60)}`);
    console.log(`     highlight:   ${p.highlight}`);
    console.log(`     description: ${trunc(p.description, 120)}`);
  };
  printOne('type=giveaway ', pickByType.giveaway);
  printOne('type=theme    ', pickByType.theme);
  printOne('type=food     ', pickByType.food);
  printOne('type=event    ', pickByType.event);
  printOne('first dated   ', firstDated);
  printOne('first recurrng', firstRecurring);
  printOne('first highlght', firstHighlight);

  process.exit(0);
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
