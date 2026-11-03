#!/usr/bin/env node
// Builds the MLS bracket fixtures from the PIPELINE'S OWN OUTPUT: its 2025
// MLS replay (lib/postseason/replay.js, the real ESPN payloads it carries)
// run step by step through its writer, runOnce, against its fake Firestore.
// The document stored after the step that stands at each instant below is
// captured whole, as the pipeline wrote it, and then, and only then:
//   - season 2025 becomes 2026 and every date and kickoff moves forward 364
//     days (52 weeks, so every weekday holds);
//   - the writer's placeholder timestamps ("TS12") become real instants: the
//     change stamp two and a half hours after the last kickoff that is final
//     (six hours before the instant when nothing is), the fetch stamp one
//     minute before the instant;
// Nothing else is edited. Read-only on the pipeline: it runs in memory.
// Built at promo-pipeline 9c995898 (feature/mls-postseason), with the seed
// file drafted from the 2025 standings as the pipeline's own tests draft it,
// so the fixed-seed slots are { slug, seed } as the writer fills them.
//
// Five states. "decision-day" is the bracket the morning after Decision Day,
// when ESPN has posted only the two Wild Card matches: the writer run once,
// on a fresh store, with the replay's first step cut to its Wild Card events.
// "early" is the replay's first step as it is: the Wild Card and the Round
// One dates posted, nothing played.
//
//   node src/lib/postseason/__fixtures__/generate-mls-2026.cjs [PIPELINE_DIR]
//
// PIPELINE_DIR defaults to /Users/mattkovalik/promonight/promo-pipeline-mls.
const fs = require('node:fs');
const path = require('node:path');

const PIPE = process.argv[2] || '/Users/mattkovalik/promonight/promo-pipeline-mls';
const OUT = __dirname;
const SHIFT = 364 * 86400000;
const req = (p) => require(path.join(PIPE, p));

const AT = {
  early: '2025-10-21T12:00:00Z',
  'decision-day': '2025-10-20T12:00:00Z',
  'round-one': '2025-11-03T12:00:00Z',
  'semis-done': '2025-11-26T12:00:00Z',
  final: '2025-12-08T12:00:00Z',
};

async function capture() {
  const M = req('lib/postseason/adapters/mls');
  const R = req('lib/postseason/replay');
  const { loadDescriptor } = req('lib/postseason/descriptor');
  const { validateSeedFile } = req('lib/postseason/seeds');
  const { runOnce } = req('lib/postseason/run');
  const { makeDb } = req('lib/postseason/__tests__/fake-firestore');
  const { createSnapshotStore } = req('lib/scanner/scanner-state');
  const { ESPN_MLS_TEAM_SLUG } = req('lib/postseason/mls-team-ids');
  const { draftSeedFile } = req('scripts/mls-seeds');
  const FX = path.join(PIPE, 'lib/postseason/__fixtures__');
  const load = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf-8'));
  const P25 = load('mls-2025-postseason.json');
  const D25 = M.retypeDescriptor(loadDescriptor('MLS', 2026), P25.typeIdsByIndex, 2025);
  const REG25 = load('mls-2025-regular-season.json');
  const seeds = validateSeedFile(
    draftSeedFile({ standings: REG25.standings, events: REG25.events, descriptor: D25, season: 2025, author: 'Fixture', today: '2025-10-19' }).file,
    D25,
    new Set(Object.values(ESPN_MLS_TEAM_SLUG)),
  ).seeds;
  const steps = R.mlsReplaySteps(P25, D25);
  const finals = P25.events
    .filter((e) => /^STATUS_(FULL_TIME|FINAL_AET|FINAL_PEN)$/.test(e.status.type.name))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id) < String(b.id) ? -1 : 1));
  // The step standing at an instant: every game that kicked off three hours
  // before it is final.
  const stepAt = Object.fromEntries(Object.entries(AT).map(([n, iso]) => [n, finals.filter((e) => Date.parse(e.date) + 3 * 3600e3 <= Date.parse(iso)).length]));
  let t = 0;
  const out = {};
  // The morning after Decision Day: only the Wild Card events are posted.
  {
    const db0 = makeDb();
    const wc = steps[0].events.filter((e) => (M.typeSpec(D25, e.season.type) || {}).round === 'wild_card');
    if (wc.length !== 2) throw new Error(`expected the two Wild Card events, found ${wc.length}`);
    const r = await runOnce({
      league: 'MLS', season: 2025, descriptor: D25, payload: { events: wc, summaries: {} },
      source: { kind: 'espn', urls: ['https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard'] },
      seeds, seedsSource: null, db: db0, execute: true, now: '2025-12-07T00:00:00.000Z', runId: 'replay-2025-decision-day',
      serverTimestamp: () => `TS${++t}`, snapshotStore: createSnapshotStore({ db: db0, league: 'MLS_POSTSEASON' }),
    });
    if (r.reasons && r.reasons.length) throw new Error(`decision day refused: ${r.reasons.join('; ')}`);
    out['decision-day'] = { doc: JSON.parse(JSON.stringify(db0._store.get('postseasonBrackets/MLS_2025'))), step: 'Wild Card events only' };
  }
  const db = makeDb();
  for (const st of steps) {
    const r = await runOnce({
      league: 'MLS', season: 2025, descriptor: D25, payload: { events: st.events, summaries: st.summaries },
      source: { kind: 'espn', urls: ['https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard'] },
      seeds, seedsSource: null, db, execute: true, now: '2025-12-07T00:00:00.000Z', runId: `replay-2025-step-${st.k}`,
      serverTimestamp: () => `TS${++t}`, snapshotStore: createSnapshotStore({ db, league: 'MLS_POSTSEASON' }),
    });
    if (r.reasons && r.reasons.length) throw new Error(`step ${st.k} refused: ${r.reasons.join('; ')}`);
    for (const [n, k] of Object.entries(stepAt)) if (n !== 'decision-day' && st.k === k) out[n] = { doc: JSON.parse(JSON.stringify(db._store.get('postseasonBrackets/MLS_2025'))), step: k };
  }
  return out;
}

const shiftIso = (iso) => new Date(Date.parse(iso) + SHIFT).toISOString().replace(/\.000Z$/, 'Z');
const shiftYmd = (ymd) => new Date(Date.parse(`${ymd}T12:00:00Z`) + SHIFT).toISOString().slice(0, 10);
const stamp = (ms) => ({ __firestoreTimestamp: new Date(ms).toISOString() });

capture().then((caught) => {
  for (const [name, { doc, step }] of Object.entries(caught)) {
    const at = Date.parse(AT[name]);
    let lastFinal = 0;
    for (const s of doc.series) for (const g of s.games) {
      if (g.status === 'final') lastFinal = Math.max(lastFinal, Date.parse(g.start));
      if (g.date) g.date = shiftYmd(g.date);
      if (g.start) g.start = shiftIso(g.start);
    }
    doc.season = 2026;
    doc.lastChangedAt = stamp((lastFinal ? lastFinal + 150 * 60e3 : at - 6 * 3600e3) + SHIFT);
    doc.lastFetchedAt = stamp(at - 60e3 + SHIFT);
    // Any other writer placeholder stamp ("TS12") becomes the change stamp.
    const fix = (v) => (Array.isArray(v) ? v.map(fix) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : typeof v === 'string' && /^TS\d+$/.test(v) ? doc.lastChangedAt : v);
    for (const k of Object.keys(doc)) if (k !== 'series') doc[k] = fix(doc[k]);
    // The writer fills every fixed-seed slot from the seed file.
    for (const s of doc.series) for (const x of [s.higher, s.lower]) if (x.placeholder !== undefined && x.seed !== null) throw new Error(`${name} ${s.seriesKey}: a seeded slot left as a placeholder`);
    const file = path.join(OUT, `MLS_2026.${name}.json`);
    fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
    console.log(`${path.basename(file)}: replay step ${step} | ${doc.series.map((s) => `${s.seriesKey}:${s.status}`).join(' ')}`);
  }
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
