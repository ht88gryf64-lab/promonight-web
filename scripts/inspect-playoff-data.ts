/* eslint-disable no-console */
/**
 * Inspection harness for the new playoff data-layer functions.
 * Run with: npx tsx --env-file=.env.local scripts/inspect-playoff-data.ts
 */
import {
  getPlayoffConfig,
  getActivePlayoffTeams,
  getPlayoffPromosForTeam,
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

  // Section 5 read every playoff promo through getAllPlayoffPromos, which
  // existed only for the old /playoffs page and was removed with it.

  process.exit(0);
}

main().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
