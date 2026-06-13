/* eslint-disable no-console */
// Deterministic gate proof: run all 5 guards against the documented known-bad
// data from the spike's verify pass. No network, no LLM. If any guard does NOT
// fire on its known-bad case, the build is broken. Run: npx tsx scripts/cfb/gate-fixtures.ts

import { computeWeeks, gateConferenceGame } from '../../src/lib/cfb/rules';
import {
  guardTimezone, guardDerivedFields, guardEntityConflation, guardSecondSource, guardCitation,
} from './lib/guards';
import {
  BOISE_KICKOFF_FIXTURE, ND_SCHEDULE_FIXTURE, RIVALRY_FIXTURE, FABRICATION_FIXTURE, MISCITATION_FIXTURE,
} from './lib/schools';

let pass = 0, fail = 0;
const check = (label: string, fired: boolean, detail: string) => {
  console.log(`  ${fired ? '✓ FIRED' : '✗ MISSED'}  ${label}${detail ? ' — ' + detail : ''}`);
  fired ? pass++ : fail++;
};

console.log('GUARD #1 — Timezone (Boise +2h kickoffs, all rated HIGH):');
for (const f of BOISE_KICKOFF_FIXTURE) {
  const r = guardTimezone(f.date, f.parser, f.correct);
  check(`${f.game} ${f.parser.time}→${f.correct.time}`, !r.ok, r.flag ?? '');
}

console.log('\nGUARD #2 — Derived-field gate (Notre Dame, independent):');
const ruleWeeks = computeWeeks(ND_SCHEDULE_FIXTURE);
for (const g of ruleWeeks) {
  const ruleConf = gateConferenceGame(g.homeTeam, g.awayTeam);
  const r = guardDerivedFields(
    { conferenceGame: g.extractorConferenceGame, week: g.extractorWeek },
    ruleConf,
    g.week,
    g.extractorConferenceGame,
  );
  const opp = g.homeTeam === 'notre-dame' ? g.awayTeam : g.homeTeam;
  // Only report the games that SHOULD be flagged (UNC conf, post-bye weeks).
  const shouldFlag = g.extractorConferenceGame === true || g.extractorWeek !== g.week;
  if (shouldFlag) check(`vs ${opp} (${g.date})`, !r.ok, r.flag ?? '');
}
// Confirm ND conferenceGame all gate to null:
const allNull = ruleWeeks.every((g) => gateConferenceGame(g.homeTeam, g.awayTeam) === null);
check('ALL Notre Dame games conferenceGame=null (independent)', allNull, allNull ? 'rule forces null regardless of source' : 'LEAK: some game not null');

console.log('\nGUARD #3 — Entity conflation (rivalry origin years):');
for (const f of RIVALRY_FIXTURE) {
  const r = guardEntityConflation({ trophy: f.trophy, seriesStartYear: null, trophyCreatedYear: null, conflatedOriginYear: f.conflatedOriginYear });
  check(`${f.name}`, !r.ok, r.flag ?? '');
}

console.log('\nGUARD #4 — Second source / fabrication (Dooley-Fulmer):');
{
  const r = guardSecondSource(FABRICATION_FIXTURE.sources);
  check(FABRICATION_FIXTURE.claim, !r.ok, r.flag ?? '');
}

console.log('\nGUARD #5 — Mis-citation (TN/Texas time cited to stale May URL):');
{
  // Deterministic proof uses the known answer (cited URL does not carry the
  // value); run-phase1 re-checks this live by fetching the URL.
  const r = guardCitation(false);
  check(`${MISCITATION_FIXTURE.value} cited to ${MISCITATION_FIXTURE.citedUrl.split('/').slice(-1)[0]}`, !r.ok, r.flag ?? '');
}

console.log(`\n=== GATE PROOF: ${pass} guards fired, ${fail} missed ===`);
process.exit(fail === 0 ? 0 : 1);
