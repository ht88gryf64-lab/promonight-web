// The mutation harness for the predictions guards. A guard counts only if
// removing it fails a test: each case below edits one guard out of the
// source, runs the tests that are meant to catch it, and expects a failure.
// The source is restored after every case, whatever happens.
//
//   node scripts/playoffs/predictions-mutations.mjs
//
// Not part of `npm test` (it edits source files while it runs). A rewritten
// guard must keep its case here passing, with a harness at least as strict.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const P = 'src/lib/postseason/predictions.ts';
const D = 'src/lib/postseason/data.ts';
const T_PRED = 'src/lib/postseason/__tests__/predictions.test.ts';
const T_DATA = 'src/lib/postseason/__tests__/data.test.ts';
const T_FAIL = 'src/app/playoffs/__tests__/predictions-failure.test.tsx';
const T_RENDER = 'src/components/playoffs/__tests__/predictions-render.test.tsx';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Failure isolation (data.ts) ----
  ['read failure rethrown', D, "  } catch {\n    return { state: 'unavailable', reason: 'read-failed' };", "  } catch (e) {\n    throw e;", [T_DATA, T_FAIL]],
  ['missing document not reported as missing', D, "if (!snap.exists) return { state: 'unavailable', reason: 'missing' };", "if (!snap.exists) throw new Error('x');", [T_DATA, T_FAIL]],
  ['refused document not reported as refused', D, "if (!predicted) return { state: 'unavailable', reason: 'refused' };", '', [T_DATA, T_FAIL]],
  ['fingerprint check removed', D, "if (!fingerprintsMatchLock(predicted)) return { state: 'unavailable', reason: 'fingerprint-mismatch' };", '', [T_DATA, T_FAIL]],
  ['assembly exception escapes', D, "    reason = e instanceof DisabledSignal ? 'disabled' : 'build-failed';", '    throw e;', [T_DATA, T_FAIL]],
  ['switch ignored', D, '    if (predictionsDisabled(league)) throw new DisabledSignal();\n', '', [T_DATA]],
  ['failure not logged', D, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);', '', [T_DATA, T_FAIL]],
  ['failure logged with contents', D, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);', 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason} predictedBrackets/${league}_2026`);', [T_DATA]],
  ['page data no longer one read per render', D, 'export const getLeaguePageData = cache(async', 'export const getLeaguePageData = (async', [T_FAIL]],
  ['real bracket stops throwing on a refused document', D, "if (!bracket) throw new Error(`[postseason] ${docId(league)} is not in a shape the web reads`);", "if (!bracket) return { state: 'missing' };", [T_DATA]],
  // ---- The lock ----
  ['lock compares four of five', P, "return (Object.keys(want) as (keyof Fingerprints)[]).every((k) => p.fingerprints[k] === want[k]);", "return (['corpus', 'params', 'descriptor', 'slugMap'] as (keyof Fingerprints)[]).every((k) => p.fingerprints[k] === want[k]);", [T_PRED, T_FAIL]],
  ['unpinned season passes', P, '  if (!want) return false;', '  if (!want) return true;', [T_PRED]],
  // ---- Mapper refusals (predictions.ts) ----
  ['target unchecked', P, "if (data.target !== 'lock' || !hasTimestamp(data.lockedAt)) return null;", 'if (!hasTimestamp(data.lockedAt)) return null;', [T_PRED]],
  ['lockedAt unchecked', P, "if (data.target !== 'lock' || !hasTimestamp(data.lockedAt)) return null;", "if (data.target !== 'lock') return null;", [T_PRED]],
  ['simRuns unchecked', P, '  if (!simRuns || !computedAt) return null;', '  if (!computedAt) return null;', [T_PRED]],
  ['instant takes any string', P, "if (!s || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?(Z|[+-]\\d{2}:\\d{2})$/.test(s)) return null;", 'if (!s) return null;', [T_PRED]],
  ['freeze order unchecked', P, 'if (!frozenAt || Date.parse(frozenAt) >= Date.parse(computedAt)) return null;', 'if (!frozenAt) return null;', [T_PRED]],
  ['freeze commit unchecked', P, '  if (!text(prov.engineCommitAtFreeze)) return null;\n', '', [T_PRED]],
  ['core identical unchecked', P, "    if (!isObject(f) || f.identical !== true) return null;", '    if (!isObject(f)) return null;', [T_PRED]],
  ['core blobs unchecked', P, '    if (!a || a !== f.blobAtCompute) return null;', '', [T_PRED]],
  ['empty core list accepted', P, '  if (!Array.isArray(prov.coreFiles) || prov.coreFiles.length === 0) return null;', '  if (!Array.isArray(prov.coreFiles)) return null;', [T_PRED]],
  ['sha accepts upper case', P, 'const SHA256 = /^[0-9a-f]{64}$/;', 'const SHA256 = /^[0-9a-f]{64}$/i;', [T_PRED]],
  ['sha accepts a prefix', P, 'const SHA256 = /^[0-9a-f]{64}$/;', 'const SHA256 = /[0-9a-f]{64}$/;', [T_PRED]],
  ['conference unchecked', P, '  if (v.conference !== null && text(v.conference) === null) return null;\n', '', [T_PRED]],
  ['same club both sides', P, '  if (!higher || !lower || higher.slug === lower.slug) return null;', '  if (!higher || !lower) return null;', [T_PRED]],
  ['pick outside the pair', P, '  if (pick !== higher.slug && pick !== lower.slug) return null;', '  if (!pick) return null;', [T_PRED]],
  ['chance under even', P, "if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;", "if (typeof p !== 'number' || !Number.isFinite(p) || p >= 1) return null;", [T_PRED]],
  ['certain pick', P, "if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;", "if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5) return null;", [T_PRED]],
  ['chance type', P, "if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;", 'if (Number(p) < 0.5 || Number(p) >= 1) return null;', [T_PRED]],
  ['length range', P, '  if (!length || length < Math.ceil(bestOf / 2) || length > bestOf) return null;', '  if (!length) return null;', [T_PRED]],
  ['coin flip type', P, "  if (typeof v.coinFlip !== 'boolean') return null;\n", '', [T_PRED]],
  ['champion unchecked', P, "  if (!champion || series.filter((s) => s.round === last.round).length !== 1 || last.pick !== champion) return null;", '  if (!champion) return null;', [T_PRED]],
  ['title odds range', P, "    if (!slug || typeof odds !== 'number' || !Number.isFinite(odds) || odds < 0 || odds > 1) return null;", '    if (!slug) return null;', [T_PRED]],
  ['duplicate keys', P, '    if (!s || keys.has(s.seriesKey)) return null;', '    if (!s) return null;', [T_PRED]],
  // ---- Scoring (NCAA rule) ----
  ['busted early ignored', P, "else outcome = eliminated.has(p.pick) ? 'busted' : 'alive';", "else outcome = 'alive';", [T_PRED, T_RENDER]],
  ['decided slot counted as alive', P, "if (decided) outcome = realWinner === p.pick ? 'correct' : 'busted';", "if (decided) outcome = realWinner === p.pick ? 'correct' : 'alive';", [T_PRED]],
  ['dimmed ignores elimination', P, 'dimmed = predictedPair.some((s) => eliminated.has(s)) || realClubs.some((s) => !predictedPair.includes(s));', 'dimmed = realClubs.some((s) => !predictedPair.includes(s));', [T_PRED, T_RENDER]],
  ['dimmed ignores the real slot', P, 'dimmed = predictedPair.some((s) => eliminated.has(s)) || realClubs.some((s) => !predictedPair.includes(s));', 'dimmed = predictedPair.some((s) => eliminated.has(s));', [T_PRED]],
  ['decided matchup never dimmed', P, '      dimmed = !(realClubs.length === 2 && predictedPair.every((s) => realClubs.includes(s)));', '      dimmed = false;', [T_PRED, T_RENDER]],
  ['busted early counted', P, '  const counted = scored.filter((s) => s.decided);', "  const counted = scored.filter((s) => s.decided || s.outcome === 'busted');", [T_PRED]],
  ['champion out not seen', P, "  else status = eliminatedClubs(bracket).has(predicted.champion) ? 'out' : 'alive';", "  else status = 'alive';", [T_PRED]],
  ['join accepts a missing key', P, '    if (!real || real.round !== p.round || real.conference !== p.conference) return null;', '    if (!real) continue;', [T_PRED]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
  });

// The tests pass untouched, or nothing below means anything.
const base = run([T_PRED, T_DATA, T_FAIL, T_RENDER]);
if (base.status !== 0) {
  console.error('the tests fail before any mutation; fix that first');
  process.exit(2);
}

let caught = 0;
const missed = [];
for (const [name, file, from, to, tests] of CASES) {
  const src = readFileSync(file, 'utf-8');
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.log(`STALE   ${name}: the guard text occurs ${n} times in ${file}; update the case`);
    missed.push(name);
    continue;
  }
  writeFileSync(file, src.replace(from, to));
  try {
    const r = run(tests);
    if (r.status !== 0) {
      caught++;
      console.log(`CAUGHT  ${name}`);
    } else {
      missed.push(name);
      console.log(`MISSED  ${name}`);
    }
  } finally {
    writeFileSync(file, src);
  }
}
console.log(`\n${caught} of ${CASES.length} mutations caught`);
process.exit(missed.length ? 1 : 0);
