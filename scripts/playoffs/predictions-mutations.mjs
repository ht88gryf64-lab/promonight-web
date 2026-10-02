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
const T_HUB = 'src/components/playoffs/__tests__/render.test.tsx';
const T_META = 'src/lib/postseason/__tests__/metadata.test.ts';
const S = 'src/lib/postseason/standing.ts';
const T_STAND = 'src/lib/postseason/__tests__/standing.test.ts';
const T_VIEW = 'src/lib/postseason/__tests__/view.test.ts';

const MAPPER_GATE = '  if (!lockedAt || !simRuns || !computedAt || Date.parse(computedAt) > Date.parse(lockedAt)) return null;';
const CHANCE = "  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0.5 || p >= 1) return null;";
const COIN = "  if (typeof v.coinFlip !== 'boolean' || v.coinFlip !== (p <= COIN_FLIP_HIGH)) return null;";
const JOIN = '    if (!real || real.round !== p.round || real.conference !== p.conference || real.bestOf !== p.bestOf) return null;';
// The methodology's markup, read from the source so the cases below move
// with it. Each is checked to occur exactly once like any other `from`.
const C_SRC = readFileSync(join(REPO, C), 'utf-8');
const between = (a, b) => {
  const i = C_SRC.indexOf(a);
  const j = C_SRC.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`markers not found: ${a} / ${b}`);
  return C_SRC.slice(i + a.length, j);
};
const BACKTEST_P = '<p data-backtest' + between('<p data-backtest', '</p>') + '</p>';
const MID = between(BACKTEST_P, '<details data-methodology-detail') + '<details data-methodology-detail className="group mt-4 border-t border-rd-line pt-3">\n';
const DETAIL_BODY = between('</summary>\n', '      </details>');
const FINGERPRINTS_DL = '        <dl data-fingerprints' + between('        <dl data-fingerprints', '</dl>') + '</dl>';
const DIM = '      dimmed = predictedPair.some((s) => eliminated.has(s)) || realClubs.some((s) => !predictedPair.includes(s));';

/** [name, file, from, to, tests]. `from` must occur exactly once. */
const CASES = [
  // ---- Failure isolation (data.ts) ----
  ['read failure rethrown', D, "  } catch {\n    return { state: 'unavailable', reason: 'read-failed' };", '  } catch (e) {\n    throw e;', [T_DATA, T_FAIL]],
  ['missing document not reported as missing', D, "if (!snap.exists) return { state: 'unavailable', reason: 'missing' };", "if (!snap.exists) throw new Error('x');", [T_DATA, T_FAIL]],
  ['refused document not reported as refused', D, "if (!predicted) return { state: 'unavailable', reason: 'refused' };", '', [T_DATA, T_FAIL]],
  ['lock check removed', D, "  if (lock !== 'ok') return { state: 'unavailable', reason: lock };\n", '', [T_DATA, T_FAIL]],
  ['read timeout removed', D, 'await withTimeout(db.getAll(ref, { fieldMask: PREDICTED_FIELDS }), predictionsReadTimeoutMs());', 'await db.getAll(ref, { fieldMask: PREDICTED_FIELDS });', [T_DATA]],
  // The league page's catch; the team line has its own (team-picks-mutations.mjs).
  ['assembly exception escapes', D, "    reason = e instanceof DisabledSignal ? 'disabled' : 'build-failed';\n  }\n  console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);", "    throw e;\n  }\n  console.error(`${PREDICTIONS_UNAVAILABLE} league=${league} reason=${reason}`);", [T_DATA, T_FAIL]],
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
  ['lock day taken from the compute', P, '  const bracketLockedOn = easternLongDate(predicted.lockedAt);', '  const bracketLockedOn = easternLongDate(predicted.computedAt);', [T_PRED]],
  ['title-odds caption claims every club', P, '      titleOdds.length < clubCount\n', '      false\n', [T_PRED]],
  ['view join failure called a missing club', P, "    if (!seriesId || !round) return 'no-join';", "    if (!seriesId || !round) return 'no-team-record';", [T_PRED]],
  ['caption counts the stored list', P, '      titleOdds.length < clubCount\n        ? `The ${titleOdds.length} most likely champions of ${clubCount}.`', '      titleOdds.length < predicted.titleOdds.length\n        ? `The ${titleOdds.length} most likely champions of ${predicted.titleOdds.length}.`', [T_PRED]],
  ['fingerprints claimed for every input', C, 'Each is a SHA-256 fingerprint of something that was locked: four of the inputs and the locked bracket file.', 'SHA-256 fingerprints of what was locked. A change to any input, or to the published bracket, would change its fingerprint.', [T_ROUTES]],
  ['every fingerprint called a file', C, 'The bracket format and the\n          locked bracket file are fingerprinted as files, the other three as their locked data written out in a fixed order.', 'All five are fingerprinted as files.', [T_ROUTES]],
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
  ['"before Game 1" always printed', C, "{view.lockedBeforeGame1 ? ', before Game 1' : ''}", "{', before Game 1'}", [T_RENDER]],
  ['a client component imports a value from predictions.ts', 'src/components/playoffs/PredictedBracket.tsx', "import type { PickOutcome, PickRoundView, PickSeriesView, PickSideView } from '@/lib/postseason/predictions';", "import { type PickOutcome, type PickRoundView, type PickSeriesView, type PickSideView, percent } from '@/lib/postseason/predictions';\nvoid percent;", [T_RENDER]],
  // ---- Copy ----
  ['length described as the most common length', C, 'its length is how many games the pick most often took to win it.', 'its length is the matchup&apos;s most common length.', [T_ROUTES]],
  // Each of these two adds the banned wording beside the true sentence, so
  // only its own negative guard can catch it.
  ['engine-wide unchanged claim', C, BACKTEST_P, BACKTEST_P.replace('{view.backtest}', '{view.backtest} The engine code is unchanged since the lock.'), [T_ROUTES]],
  ['simulation framing dropped', C, 'PromoNight Predicts is a simulation, not a staff pick. ', '', [T_ROUTES]],
  ['write-once and fixed-seed claim dropped', C, '. The locked bracket is written once and never changed, and the simulation runs from a fixed seed, so the same inputs always give\n            the same bracket.', '.', [T_ROUTES, T_RENDER]],
  ['the false "computed once" claim back', C, BACKTEST_P, BACKTEST_P.replace('{view.backtest}', '{view.backtest} The bracket was computed once.'), [T_ROUTES]],
  ['staff or expert framing in the intro', C, 'PromoNight Predicts picks every series with a simulation', 'Our experts and PromoNight Predicts pick every series with a simulation', [T_ROUTES]],
  ['"computer" back on the pick label', 'src/components/playoffs/PredictedBracket.tsx', "PromoNight&apos;s pick:", "Computer&apos;s pick:", [T_ROUTES]],
  ['"computer" back on the scorecard', C, '>Predicted champion<', '>Computer&apos;s champion<', [T_ROUTES]],
  // These three add the banned word beside the true copy, so only the
  // "no computer" guard can catch them.
  ['"computer" back on the hub line', 'src/components/playoffs/PredictionsCard.tsx', '<li key={l.league} data-predictions-league', '<li key={l.league} title="Computer&apos;s champion" data-predictions-league', [T_ROUTES]],
  ['the won line reads as a past prediction', 'src/components/playoffs/PredictionsCard.tsx', ' to win it all, and they did`;', ' won it all`;', [T_HUB]],
  ['"computer" back in the meta description', 'src/lib/postseason/metadata.ts', "with a simulation's locked pick for every series", "with a computer simulation's locked pick for every series", [T_META]],
  ['the hub never told the champion is out', P, '      championName: view.scorecard.championName,\n      championStatus: card.champion.status,', "      championName: view.scorecard.championName,\n      championStatus: 'alive' as const,", [T_HUB]],
  ['the hub claims an eliminated champion will win', 'src/components/playoffs/PredictionsCard.tsx', "  if (l.championStatus === 'out') return `PromoNight Predicts picked ${l.championName} to win it all`;\n", '', [T_HUB]],
  ['the old section heading as the heading\'s title', C, '<h2 id="predictions-heading" className', '<h2 id="predictions-heading" title="The Computer&apos;s Bracket" className', [T_ROUTES]],
  ['two-day lock said as one', C, '            {view.computedOn === view.bracketLockedOn\n', '            {true\n', [T_RENDER]],
  ['chance described over every run', C, 'in the simulated\n            postseasons where that matchup came up,', 'in those simulated\n            postseasons,', [T_RENDER]],
  ['"at lock" left undefined', C, ' Every percentage on this page is as\n            it stood when the bracket was locked.', '', [T_ROUTES]],
  // ---- The methodology in two layers (WEB4, 2026-10-02) ----
  ['"title odd" back in the at-lock sentence', C, ' Every percentage on this page is as', ' Every percentage and title odd on this page is as', [T_ROUTES, T_RENDER]],
  ['summary date hard-coded', P, "summary: `PromoNight's picks were locked on ${bracketLockedOn} from", "summary: `PromoNight's picks were locked on September 30, 2026 from", [T_PRED]],
  ['summary date taken from the input freeze', P, "summary: `PromoNight's picks were locked on ${bracketLockedOn} from", "summary: `PromoNight's picks were locked on ${easternLongDate(predicted.frozenAt)} from", [T_PRED, T_ROUTES]],
  ['summary says "before Game 1" (builder)', P, "from regular-season results only. They never change.`,", "from regular-season results only${frozenBeforeFirstGame(bracket, predicted.frozenAt) ? ', before Game 1' : ''}. They never change.`,", [T_PRED]],
  ['summary says "before Game 1" (component)', C, '<p data-methodology-summary>{view.summary}</p>', "<p data-methodology-summary>{view.lockedBeforeGame1 ? view.summary.replace(' from', ', before Game 1, from') : view.summary}</p>", [T_RENDER, T_ROUTES]],
  ['summary line removed', C, '        <p data-methodology-summary>{view.summary}</p>\n', '', [T_RENDER, T_ROUTES]],
  ['detail open by default', C, '<details data-methodology-detail className=', '<details open data-methodology-detail className=', [T_RENDER]],
  ['detail content removed', C, DETAIL_BODY, '', [T_RENDER, T_ROUTES]],
  ['fingerprints outside the detail', C, FINGERPRINTS_DL + '\n      </details>', '      </details>\n' + FINGERPRINTS_DL, [T_RENDER]],
  ['fingerprints duplicated beside the summary', C, '<p data-methodology-summary>{view.summary}</p>', '<p data-methodology-summary>{view.summary}</p>{view.fingerprints.map((f) => <code key={f.label}>{f.value}</code>)}', [T_RENDER, T_ROUTES]],
  ['backtest hidden in the detail', C, BACKTEST_P + MID, MID + BACKTEST_P, [T_RENDER]],
  // ---- Where things stand, the games list, TBD slots, percentage labels (WEB4 addendum) ----
  ['standing: wrong leader', S, '  const lead = a.wins > b.wins ? a : b;', '  const lead = a.wins < b.wins ? a : b;', [T_STAND]],
  ['standing: wrong winner of a final series', S, '    const w = a.won ? a : b.won ? b : null;', '    const w = b.won ? a : a.won ? b : null;', [T_STAND]],
  ['standing: stale score, one game behind', S, "the ${trail.label} ${lead.wins}-${trail.wins}`", "the ${trail.label} ${lead.wins - 1}-${trail.wins}`", [T_STAND]],
  ['standing: plural verb on a singular nickname', S, "verb(lead.label, 'lead', 'leads')", "'lead'", [T_STAND, T_ROUTES]],
  ['standing: stale final score', S, '`the ${w.label} beat the ${l.label} ${w.wins}-${l.wins}`', '`the ${w.label} beat the ${l.label} ${w.wins - 1}-${l.wins}`', [T_STAND]],
  ['standing: champion score swapped', S, 'beating the ${l.fullName} ${w.wins}-${l.wins}.`', 'beating the ${l.fullName} ${l.wins}-${w.wins}.`', [T_STAND]],
  ['standing: freshness word on the next game', S, '} Next game: ${gameText(next)}.`', '} Next game today: ${gameText(next)}.`', [T_STAND]],
  ['standing: freshness word on the round', S, "parts.push(`${view.rounds[i].label}: ${clauses.join('; ')}.`);", "parts.push(`Live: ${view.rounds[i].label}: ${clauses.join('; ')}.`);", [T_STAND]],
  ['standing: "right now" between rounds', S, "`Next round: ${round.label}.`", "`Right now: ${round.label}.`", [T_STAND]],
  ['standing: a game behind the clock offered as next', S, "r.start !== null && Date.parse(r.start) >= now.getTime();", "r.start !== null;", [T_STAND]],
  ['standing: an earlier untimed, postponed or suspended game ignored', S, '    if (key(r) <= key(next)) return null;\n', '', [T_STAND]],
  ['standing: a simultaneous start named', S, '    if (key(r) <= key(next)) return null;', '    if (key(r) < key(next)) return null;', [T_STAND]],
  ['standing: an undated game in a round being played never blocks', S, '      if (r.sure) return null;', '      if (false) return null;', [T_STAND]],
  ['standing: an undated game in a later round blocks', S, '      if (r.sure) return null;\n      continue;', '      return null;', [T_STAND]],
  ['standing: later rounds treated as being played', S, '[[sure, true], [later, false]]', '[[sure, true], [later, true]]', [T_STAND]],
  ['standing: leftover rows of a finished series counted', S, "      if (s.status === 'final') continue;\n      const unplayed", '      const unplayed', [T_STAND]],
  ['standing: a later round offers the opener', S, '.filter((r) => r.sure && ahead(r))', '.filter((r) => ahead(r))', [T_STAND]],
  ['standing: a series with no game listed ignored', S, "      if (isSure && unplayed.length === 0 && !s.games.some((g) => g.state === 'live')) return null;\n", '', [T_STAND]],
  ['standing: game order inside a series ignored', S, '    if (r.s === next.s && r.g.gameNumber < next.g.gameNumber) return null;\n', '', [T_STAND]],
  ['standing: a later round under way never said', S, '.filter((i) => i > at && seriesOf(i).some(started))', '.filter(() => false)', [T_STAND]],
  ['standing: a game with no time sorts last on its day', S, "`${r.day} ${r.start ?? ''}`", "`${r.day} ${r.start ?? '~'}`", [T_STAND]],
  ['standing: a game in progress counts as missing', S, " && !s.games.some((g) => g.state === 'live')) return null;", ") return null;", [T_STAND]],
  ['standing: a game in progress does not start a round', S, " || s.games.some((g) => g.state === 'final' || g.state === 'live');", " || s.games.some((g) => g.state === 'final');", [T_STAND]],
  ['games list: a started game still listed as upcoming', 'src/lib/postseason/view.ts', '    if (g.startsAt && Date.parse(g.startsAt) < now.getTime()) continue;\n', '', [T_VIEW]],
  ['standing: "awaits" always plural', S, "verb(club.label, 'await', 'awaits')", "'await'", [T_STAND]],
  ['standing: only scheduled games count as unplayed', S, "const UNPLAYED = new Set(['scheduled', 'postponed', 'suspended']);", "const UNPLAYED = new Set(['scheduled']);", [T_STAND]],
  ['standing: later rounds never block', S, '  const next = nextGame(played.flatMap(seriesOf), after(at, played), startOf, now);', '  const next = nextGame(played.flatMap(seriesOf), [], startOf, now);', [T_STAND]],
  ['standing: a series waiting on an opponent skipped', S, "    return `the ${club.label} ${verb(club.label, 'await', 'awaits')} ${whom}`;", "    return 'unset';", [T_STAND]],
  ['standing: unset matchups left unsaid', S, "    if (unset > 0) clauses.push(unset === 1 ? 'one matchup is to be set' : `${unset} matchups are to be set`);\n", '', [T_STAND]],
  ['standing: "N matchup is" for several', S, '`${unset} matchups are to be set`', '`${unset} matchup is to be set`', [T_STAND]],
  ['standing: "still" back in the unset clause', S, "'one matchup is to be set'", "'one matchup is still to be set'", [T_STAND]],
  ['games list: Show-all label not "Show N more games"', 'src/components/playoffs/HomeGames.tsx', "label={`Show ${games.rest.length} more ", "label={`Show all ${games.primary.length + games.rest.length} ", [T_HUB]],
  ['standing: half a summary when a series is unreadable', S, '      if (c === null) return null;', '      if (c === null) continue;', [T_STAND]],
  ['standing: a placeholder phase still prints', S, '  if (at < 0) return null;', '  if (at < 0) return `Next round: ${view.phase.roundLabel}.`;', [T_STAND]],
  ['games list: a dated "Time TBD" game hidden', 'src/lib/postseason/view.ts', '    if (g.day < today || g.day > weekEnd) continue;', '    if (!g.timed) continue;\n    if (g.day < today || g.day > weekEnd) continue;', [T_VIEW, T_HUB]],
  ['games list: league heading reverted', 'src/components/playoffs/PlayoffsLeague.tsx', 'heading="Upcoming playoff games"', 'heading="Home games this week"', [T_HUB]],
  ['games list: hub heading reverted', 'src/components/playoffs/PlayoffsHub.tsx', 'heading="Upcoming playoff games"', 'heading="Next home games"', [T_HUB]],
  ['games list: "home games" back in the hub intro', 'src/components/playoffs/PlayoffsHub.tsx', 'with the upcoming playoff games and the parks', 'with the home games coming up next and the parks', [T_HUB]],
  ['TBD slot text below AA', 'src/components/playoffs/SeriesCard.tsx', 'bg-rd-cream/60 px-2.5', 'bg-rd-ink-faint/30 px-2.5', [T_HUB]],
  ['TBD slot loses its dashed outline', 'src/components/playoffs/SeriesCard.tsx', 'rounded-md border border-dashed border-rd-line-strong bg-rd-cream/60', 'rounded-md border border-rd-line-strong bg-rd-cream/60', [T_HUB]],
  ['"at lock" back on a pick', 'src/components/playoffs/PredictedBracket.tsx', '`, ${s.chanceLabel} to win series.`', '`, ${s.chanceLabel} at lock.`', [T_RENDER]],
  ['"at lock" back on the title odds', C, '          Title odds\n        </h3>', '          Title odds at lock\n        </h3>', [T_RENDER]],
  ['title odds lose "to win title"', P, "oddsLabel: `${percent(o.odds)} to win title`", 'oddsLabel: percent(o.odds)', [T_PRED, T_RENDER]],
  ['title with predictions not Matt\'s wording', 'src/lib/postseason/metadata.ts', '`${season} ${league} Playoffs: Bracket, Schedule and Predictions`', '`${season} ${league} Playoff Bracket and Predictions`', [T_META, T_ROUTES]],
  ['standing rendered as a child of the article', 'src/components/playoffs/PlayoffsLeague.tsx', '<BracketControlsProvider initialRound', '{body.standing ? <p data-standing>{body.standing}</p> : null}\n        <BracketControlsProvider initialRound', [T_HUB]],
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
const base = run([T_PRED, T_DATA, T_FAIL, T_RENDER, T_ROUTES, T_HUB, T_META, T_STAND, T_VIEW]);
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
