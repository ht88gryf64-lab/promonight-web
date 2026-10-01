// The mutation harness for the predictions guards. A guard counts only if
// removing it fails a test: each case below edits one guard out of the
// source, runs the tests that are meant to catch it, and expects a failure.
//
// IT NEVER TOUCHES THIS TREE. The sources, scripts and configs are copied to
// a temporary directory (node_modules linked), and every mutation is made
// there. A build running from this tree at the same time sees nothing, and
// an interrupted run leaves nothing behind but the temporary copy.
//
//   node scripts/playoffs/predictions-mutations.mjs
//
// Not part of `npm test` (it is slow). A rewritten guard must keep its case
// here passing, with a harness at least as strict.
import { readFileSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const WORK = mkdtempSync(join(tmpdir(), 'pn-mutations-'));
for (const f of ['src', 'scripts', 'tsconfig.json', 'tsconfig.test.json', 'package.json']) cpSync(join(REPO, f), join(WORK, f), { recursive: true });
symlinkSync(join(REPO, 'node_modules'), join(WORK, 'node_modules'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

const P = 'src/lib/postseason/predictions.ts';
const L = 'src/lib/postseason/predictions-lock.ts';
const D = 'src/lib/postseason/data.ts';
const C = 'src/components/playoffs/Predictions.tsx';
const T_PRED = 'src/lib/postseason/__tests__/predictions.test.ts';
const T_DATA = 'src/lib/postseason/__tests__/data.test.ts';
const T_FAIL = 'src/app/playoffs/__tests__/predictions-failure.test.tsx';
const T_RENDER = 'src/components/playoffs/__tests__/predictions-render.test.tsx';
const T_ROUTES = 'src/app/playoffs/__tests__/routes.test.tsx';

const MAPPER_GATE = '  if (!lockedAt || !simRuns || !computedAt || Date.parse(computedAt) > Date.parse(lockedAt)) return null;';
const CHANCE = "  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;";
const COIN = "  if (typeof v.coinFlip !== 'boolean' || v.coinFlip !== (p <= COIN_FLIP_HIGH)) return null;";
const JOIN = '    if (!real || real.round !== p.round || real.conference !== p.conference || real.bestOf !== p.bestOf) return null;';
const DIM = '      dimmed = predictedPair.some((s) => eliminated.has(s)) || realClubs.some((s) => !predictedPair.includes(s));';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Failure isolation (data.ts) ----
  ['read failure rethrown', D, "  } catch {\n    return { state: 'unavailable', reason: 'read-failed' };", '  } catch (e) {\n    throw e;', [T_DATA, T_FAIL]],
  ['missing document not reported as missing', D, "if (!snap.exists) return { state: 'unavailable', reason: 'missing' };", "if (!snap.exists) throw new Error('x');", [T_DATA, T_FAIL]],
  ['refused document not reported as refused', D, "if (!predicted) return { state: 'unavailable', reason: 'refused' };", '', [T_DATA, T_FAIL]],
  ['lock check removed', D, "  if (lock !== 'ok') return { state: 'unavailable', reason: lock };\n", '', [T_DATA, T_FAIL]],
  ['read timeout removed', D, 'await withTimeout(db.getAll(ref, { fieldMask: PREDICTED_FIELDS }), predictionsReadTimeoutMs());', 'await db.getAll(ref, { fieldMask: PREDICTED_FIELDS });', [T_DATA]],
  ['assembly exception escapes', D, "    reason = e instanceof DisabledSignal ? 'disabled' : 'build-failed';", '    throw e;', [T_DATA, T_FAIL]],
  ['switch ignored', D, '    if (predictionsDisabled(league)) throw new DisabledSignal();\n', '', [T_DATA]],
  ['failure not logged', D, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);', '', [T_DATA, T_FAIL]],
  ['failure logged with contents', D, 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);', 'console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason} predictedBrackets/${league}_2026`);', [T_DATA]],
  ['page data no longer one read per render', D, 'export const getLeaguePageData = cache(async', 'export const getLeaguePageData = (async', [T_FAIL]],
  ['real bracket stops throwing on a refused document', D, "if (!bracket) throw new Error(`[postseason] ${docId(league)} is not in a shape the web reads`);", "if (!bracket) return { state: 'missing' };", [T_DATA]],
  // ---- The lock ----
  ['lock compares four of five', P, 'return (Object.keys(want) as (keyof Fingerprints)[]).every((k) => p.fingerprints[k] === want[k]);', "return (['corpus', 'params', 'descriptor', 'slugMap'] as (keyof Fingerprints)[]).every((k) => p.fingerprints[k] === want[k]);", [T_PRED, T_FAIL]],
  ['unpinned season passes', P, '  if (!want) return false;', '  if (!want) return true;', [T_PRED]],
  ['content lock passes anything', L, "return want && lockedContentSha256(p) === want ? 'ok' : 'content-mismatch';", "return 'ok';", [T_PRED, T_DATA, T_FAIL]],
  ['content lock drops the title odds', L, '    titleOdds: p.titleOdds.map((o) => [o.slug, o.odds]),\n', '', [T_PRED]],
  ['content lock drops the chances', L, '      s.pickProbability,\n', '', [T_PRED]],
  ['content lock drops the pairings', L, '      s.lower.slug,\n', '', [T_PRED]],
  ['content lock drops the run count', L, '    simRuns: p.simRuns,\n', '', [T_PRED]],
  // ---- Mapper refusals (predictions.ts) ----
  ['target unchecked', P, "  if (data.target !== 'lock') return null;\n", '', [T_PRED]],
  ['lockedAt unchecked', P, MAPPER_GATE, '  if (!simRuns || !computedAt) return null;', [T_PRED]],
  ['compute after lock accepted', P, MAPPER_GATE, '  if (!lockedAt || !simRuns || !computedAt) return null;', [T_PRED]],
  ['simRuns unchecked', P, MAPPER_GATE, '  if (!lockedAt || !computedAt || Date.parse(computedAt) > Date.parse(lockedAt)) return null;', [T_PRED]],
  ['instant takes any shape', P, '  if (!m) return null;\n  const ms = Date.parse(s as string);', '  const ms = Date.parse(s as string);\n  if (!m) return Number.isNaN(ms) ? null : new Date(ms).toISOString();', [T_PRED]],
  ['instant rolls impossible dates over', P, '  return iso.slice(0, m[1].length) === m[1] ? iso : null;', '  return iso;', [T_PRED]],
  ['freeze order unchecked', P, 'if (!frozenAt || Date.parse(frozenAt) >= Date.parse(computedAt)) return null;', 'if (!frozenAt) return null;', [T_PRED]],
  ['freeze commit unchecked', P, '  if (!text(prov.engineCommitAtFreeze)) return null;\n', '', [T_PRED]],
  ['core file count unchecked', P, '  if (!Array.isArray(prov.coreFiles) || prov.coreFiles.length !== CORE_FILES.length) return null;', '  if (!Array.isArray(prov.coreFiles) || prov.coreFiles.length === 0) return null;', [T_PRED]],
  ['core file paths unchecked', P, '    if (!path || !(CORE_FILES as readonly string[]).includes(path) || seen.has(path)) return null;\n', '', [T_PRED]],
  ['core identical unchecked', P, '    if (!isObject(f) || f.identical !== true) return null;', '    if (!isObject(f)) return null;', [T_PRED]],
  ['core blobs unchecked', P, '    if (!a || a !== f.blobAtCompute) return null;', '', [T_PRED]],
  ['sha accepts upper case', P, 'const SHA256 = /^[0-9a-f]{64}$/;', 'const SHA256 = /^[0-9a-f]{64}$/i;', [T_PRED]],
  ['sha accepts a prefix', P, 'const SHA256 = /^[0-9a-f]{64}$/;', 'const SHA256 = /[0-9a-f]{64}$/;', [T_PRED]],
  ['conference unchecked', P, '  if (v.conference !== null && text(v.conference) === null) return null;\n', '', [T_PRED]],
  ['same club both sides', P, '  if (!higher || !lower || higher.slug === lower.slug) return null;', '  if (!higher || !lower) return null;', [T_PRED]],
  ['pick outside the pair', P, '  if (pick !== higher.slug && pick !== lower.slug) return null;', '  if (!pick) return null;', [T_PRED]],
  ['chance under even', P, CHANCE, "  if (typeof p !== 'number' || !Number.isFinite(p) || p >= 1) return null;", [T_PRED]],
  ['certain pick', P, CHANCE, "  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5) return null;", [T_PRED]],
  ['chance type', P, CHANCE, '  if (Number(p) < 0.5 || Number(p) >= 1) return null;', [T_PRED]],
  ['length range', P, '  if (!length || length < Math.ceil(bestOf / 2) || length > bestOf) return null;', '  if (!length) return null;', [T_PRED]],
  ['coin flip unchecked', P, COIN + '\n', '', [T_PRED]],
  ['coin flip not tied to the chance', P, COIN, "  if (typeof v.coinFlip !== 'boolean') return null;", [T_PRED]],
  ['champion unchecked', P, '  if (!champion || series.filter((s) => s.round === last.round).length !== 1 || last.pick !== champion) return null;', '  if (!champion) return null;', [T_PRED]],
  ['title odds range', P, "    if (!slug || typeof odds !== 'number' || !Number.isFinite(odds) || odds < 0 || odds > 1) return null;", '    if (!slug) return null;', [T_PRED]],
  ['title odds name any club, twice', P, '    if (!clubsHere.has(slug) || titleOdds.some((t) => t.slug === slug)) return null;\n', '', [T_PRED]],
  ['duplicate keys', P, '    if (!s || keys.has(s.seriesKey)) return null;', '    if (!s) return null;', [T_PRED]],
  ['a rounded certain pick reads 100%', P, "  if (n > 99) return 'Over 99%';\n", '', [T_PRED]],
  // ---- Scoring (NCAA rule) and the join ----
  ['busted early ignored', P, "else outcome = eliminated.has(p.pick) ? 'busted' : 'alive';", "else outcome = 'alive';", [T_PRED, T_RENDER]],
  ['decided slot counted as alive', P, "if (decided) outcome = realWinner === p.pick ? 'correct' : 'busted';", "if (decided) outcome = realWinner === p.pick ? 'correct' : 'alive';", [T_PRED]],
  ['dimmed ignores elimination', P, DIM, '      dimmed = realClubs.some((s) => !predictedPair.includes(s));', [T_PRED, T_RENDER]],
  ['dimmed ignores the real slot', P, DIM, '      dimmed = predictedPair.some((s) => eliminated.has(s));', [T_PRED]],
  ['decided matchup never dimmed', P, '      dimmed = !(realClubs.length === 2 && predictedPair.every((s) => realClubs.includes(s)));', '      dimmed = false;', [T_PRED, T_RENDER]],
  ['busted early counted', P, '  const counted = scored.filter((s) => s.decided);', "  const counted = scored.filter((s) => s.decided || s.outcome === 'busted');", [T_PRED]],
  ['champion out not seen', P, "  else status = eliminatedClubs(bracket).has(predicted.champion) ? 'out' : 'alive';", "  else status = 'alive';", [T_PRED]],
  ['join accepts a missing key', P, JOIN, '    if (!real) continue;', [T_PRED]],
  ['join ignores the series length', P, JOIN, '    if (!real || real.round !== p.round || real.conference !== p.conference) return null;', [T_PRED]],
  ['join ignores the conference', P, JOIN, '    if (!real || real.round !== p.round || real.bestOf !== p.bestOf) return null;', [T_PRED]],
  ['round unchecked', P, '  if (!seriesKey || !round || !bestOf) return null;', '  if (!seriesKey || !bestOf) return null;', [T_PRED]],
  ['title odds NaN accepted', P, "    if (!slug || typeof odds !== 'number' || !Number.isFinite(odds) || odds < 0 || odds > 1) return null;", "    if (!slug || typeof odds !== 'number' || odds < 0 || odds > 1) return null;", [T_PRED]],
  ['title-odds row shape unchecked', P, '    if (!isObject(o)) return null;\n    const slug = text(o.slug);', '    const slug = text(o.slug);', [T_PRED]],
  ['read timeout default of minutes', D, '  return Number.isFinite(v) && v > 0 ? v : 4000;', '  return Number.isFinite(v) && v > 0 ? v : 400000;', [T_DATA]],
  ['lock day taken from the compute', P, '    bracketLockedOn: easternLongDate(predicted.lockedAt),', '    bracketLockedOn: easternLongDate(predicted.computedAt),', [T_PRED]],
  ['title-odds caption claims every club', P, '      titleOdds.length < clubCount\n', '      false\n', [T_PRED]],
  ['view join failure called a missing club', P, "    if (!seriesId || !round) return 'no-join';", "    if (!seriesId || !round) return 'no-team-record';", [T_PRED]],
  ['caption counts the stored list', P, '      titleOdds.length < clubCount\n        ? `The ${titleOdds.length} most likely champions of ${clubCount}.`', '      titleOdds.length < predicted.titleOdds.length\n        ? `The ${titleOdds.length} most likely champions of ${predicted.titleOdds.length}.`', [T_PRED]],
  ['fingerprints claimed for every input', C, 'Each is a SHA-256 fingerprint of something that was locked: four of the inputs and the locked bracket file.', 'SHA-256 fingerprints of what was locked. A change to any input, or to the published bracket, would change its fingerprint.', [T_ROUTES]],
  ['every fingerprint called a file', C, 'The bracket format and the\n        locked bracket file are fingerprinted as files, the other three as their locked data written out in a fixed order.', 'All five are fingerprinted as files.', [T_ROUTES]],
  // ---- The client boundary ----
  ['a hash handed to the predicted bracket', C, '<PredictedBracket league={league} leagueSlug={leagueSlug} season={season} rounds={view.rounds} />', "<PredictedBracket league={league} leagueSlug={leagueSlug} season={season} rounds={view.rounds} {...{ leak: 'e4bcaddb1f2acebf37ece2f2c8f32d136609bd93469a30c8e5da104a6bd17a8d' }} />", [T_RENDER]],
  // ---- The test walker itself: each self-check must fail without its branch ----
  ['walker scans only the old three directories', T_RENDER, "const roots = [new URL('../../', import.meta.url), new URL('../../../app/', import.meta.url), new URL('../../../hooks/', import.meta.url)];", "const roots = [new URL('../', import.meta.url), new URL('../../analytics/', import.meta.url), new URL('../../ads/', import.meta.url)];", [T_RENDER]],
  ['walker does not unwrap forwardRef', T_RENDER, '    else if (x.render) x = x.render as typeof x;\n', '', [T_RENDER]],
  ['walker does not unwrap memo', T_RENDER, '    if (x.type) x = x.type as typeof x;\n    else if', '    if', [T_RENDER]],
  ['walker does not expand a server memo', T_RENDER, "  if (typeof inner === 'function') {\n    visit((inner as", '  if (false) {\n    visit((inner as', [T_RENDER]],
  ['walker skips client children', T_RENDER, '      visit(children as ReactNode, client, hits, `${path} > ${name}`, true);\n', '', [T_RENDER]],
  ['walker sees only hashes', T_RENDER, '    const key = seriesKeyIn(v);\n    if (key) return `series key ${key}`;\n    if (SHORT_KEYS.has(v)) return `series key ${v}`;\n    for (const b of BANNED_VALUES) if (v.includes(b)) return `banned value ${b}`;\n', '', [T_RENDER]],
  ['a series key handed to the predicted bracket', C, '<PredictedBracket league={league} leagueSlug={leagueSlug} season={season} rounds={view.rounds} />', "<PredictedBracket league={league} leagueSlug={leagueSlug} season={season} rounds={view.rounds} {...{ debug: { key: 'AL-WC-A' } }} />", [T_RENDER]],
  ['chances not dated by their inputs', C, ' The\n        chances come from regular-season results alone, so they take no account of postseason games already played when the bracket was\n        locked.', '', [T_ROUTES]],
  // ---- Copy ----
  ['length described as the most common length', C, 'its length is how many games the pick most often took to win it.', 'its length is the matchup&apos;s most common length.', [T_ROUTES]],
  ['engine-wide unchanged claim', C, ', with the rating, simulation and bracket code unchanged since the inputs were locked.', ', with the engine code unchanged since the lock.', [T_ROUTES]],
  ['two-day lock said as one', C, '          {view.computedOn === view.bracketLockedOn\n', '          {true\n', [T_RENDER]],
  ['chance described over every run', C, 'in the simulated\n          postseasons where that matchup came up,', 'in those simulated\n          postseasons,', [T_RENDER]],
  ['"at lock" left undefined', C, ' Every chance and title odd on this page is as\n          it stood when the bracket was locked.', '', [T_ROUTES]],
];

const run = (files) =>
  spawnSync('node', ['--import', 'tsx', '--experimental-test-module-mocks', '--test', ...files], {
    cwd: WORK,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.test.json' },
    encoding: 'utf-8',
    // A mutation that makes a test hang is a failure too, but it must not
    // hold the run: two minutes, then the case is reported as a hang.
    timeout: 120000,
  });

// The tests pass untouched, or nothing below means anything.
const base = run([T_PRED, T_DATA, T_FAIL, T_RENDER, T_ROUTES]);
if (base.status !== 0) {
  console.error('the tests fail before any mutation; fix that first');
  process.exit(2);
}

let caught = 0;
const missed = [];
for (const [name, rel, from, to, tests] of CASES) {
  const file = join(WORK, rel);
  const src = readFileSync(file, 'utf-8');
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.log(`STALE   ${name}: the guard text occurs ${n} times in ${rel}; update the case`);
    missed.push(name);
    continue;
  }
  writeFileSync(file, src.replace(from, to));
  try {
    const r = run(tests);
    if (r.status !== 0) {
      caught++;
      console.log(`CAUGHT  ${name}${r.error ? ' (by a hang, cut at two minutes)' : ''}`);
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
