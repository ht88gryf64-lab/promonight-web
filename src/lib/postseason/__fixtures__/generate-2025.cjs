// Builds stored-shape bracket documents from the pipeline's captured 2025
// payloads, through the pipeline's own adapters and buildDocument. Run from a
// promo-pipeline checkout. Nothing here is hand-authored except the two write
// stamps, which the real writer sets from the server clock at write time.
const fs = require("fs"); const path = require("path");
const P = process.env.PIPELINE; const OUT = process.env.OUT;
const R = require(path.join(P, "lib/postseason/replay"));
const { normalizeMlb } = require(path.join(P, "lib/postseason/adapters/mlb"));
const { normalizeWnba } = require(path.join(P, "lib/postseason/adapters/wnba"));
const { buildDocument } = require(path.join(P, "lib/postseason/document"));
const { validateSeedFile } = require(path.join(P, "lib/postseason/seeds"));
const { MLB_TEAM_SLUG } = require(path.join(P, "lib/postseason/mlb-team-ids"));
const { ESPN_WNBA_TEAM_SLUG, WNBA_TEAM_TZ } = require(path.join(P, "lib/postseason/wnba-team-ids"));
const F = path.join(P, "lib/postseason/__fixtures__");
const load = (f) => JSON.parse(fs.readFileSync(path.join(F, f), "utf-8"));
const MLB_D = { ...require(path.join(P, "lib/postseason/formats/mlb-2026.json")), season: 2025 };
const WNBA_D = { ...require(path.join(P, "lib/postseason/formats/wnba-2026.json")), season: 2025 };
const slugM = (id) => MLB_TEAM_SLUG[id], slugW = (id) => ESPN_WNBA_TEAM_SLUG[id], tz = (s) => WNBA_TEAM_TZ[s];
const seedM = load("seeds-mlb-2025.json"), seedW = load("seeds-wnba-2025.json");
const SEEDS_M = validateSeedFile(seedM, MLB_D, new Set(Object.values(MLB_TEAM_SLUG))).seeds;
const SEEDS_W = validateSeedFile(seedW, WNBA_D, new Set(Object.values(ESPN_WNBA_TEAM_SLUG))).seeds;
const normM = (p) => normalizeMlb(p, { descriptor: MLB_D, slugOf: slugM, seeds: SEEDS_M });
const normW = (ev) => normalizeWnba(ev, { descriptor: WNBA_D, slugOf: slugW, tzOf: tz, seeds: SEEDS_W });
const stamp = (iso) => ({ __firestoreTimestamp: iso });
function lastStart(bracket) { let m = null; for (const s of bracket.series) for (const g of s.games) if (g.status === "final" && g.start && (!m || g.start > m)) m = g.start; return m; }
function write(name, r, seedFile, seedName, source, note) {
  if (!r.ok) throw new Error(name + " refused: " + r.refusals.join("; "));
  const doc = buildDocument({ bracket: r.bracket, seedsSource: { file: seedName, authoredBy: seedFile.authoredBy, authoredOn: seedFile.authoredOn }, runId: "fixture-" + name, source, validatedSeedSha256: null });
  // The writer stamps these from the server clock. Here: four hours after the
  // start of the last final game in the document, or the first scheduled
  // start when nothing is final yet.
  const ls = lastStart(r.bracket);
  const at = new Date(Date.parse(ls || r.bracket.series[0].games[0].start) + 4 * 3600 * 1000).toISOString();
  doc.lastFetchedAt = stamp(at); doc.lastChangedAt = stamp(at); doc.lastRevalidatedSha256 = doc.bracketSha256;
  fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(doc, null, 2) + "\n");
  const st = {}; for (const s of doc.series) st[s.status] = (st[s.status] || 0) + 1;
  console.log(name, JSON.stringify(st), "games", doc.series.reduce((n, s) => n + s.games.length, 0), "stamp", at, note || "");
  return doc;
}
const mlbPayload = load("mlb-2025-postseason.json");
const wnbaEvents = load("wnba-2025-postseason-events.json").events;
const srcM = { kind: "statsapi", urls: ["fixture: promo-pipeline lib/postseason/__fixtures__/mlb-2025-postseason.json"] };
const srcW = { kind: "espn-scoreboard", urls: ["fixture: promo-pipeline lib/postseason/__fixtures__/wnba-2025-postseason-events.json"] };
write("MLB_2025.final", normM(mlbPayload), seedM, "seeds-mlb-2025.json", srcM, "(real final payload)");
write("WNBA_2025.final", normW(wnbaEvents), seedW, "seeds-wnba-2025.json", srcW, "(real final payload)");
const MS = R.mlbReplaySteps(mlbPayload, MLB_D);
const WS = R.wnbaReplaySteps(wnbaEvents, WNBA_D, SEEDS_W, { slugOf: slugW, tzOf: tz });
// Print a table of steps so a mixed state can be chosen by what it contains.
MS.forEach((st, k) => { const b = normM(st).bracket; const f = b.series.filter((s) => s.status === "final").map((s) => s.seriesKey); const l = b.series.filter((s) => s.status === "live").map((s) => s.seriesKey); if ([8, 9, 10, 11, 12, 14, 16, 20, 24].includes(k)) console.log("MLB step", k, "final:", f.join(","), "| live:", l.join(",")); });
WS.forEach((st, k) => { const b = normW(st).bracket; const f = b.series.filter((s) => s.status === "final").map((s) => s.seriesKey); const l = b.series.filter((s) => s.status === "live").map((s) => s.seriesKey); if ([6, 8, 9, 10, 12, 14].includes(k)) console.log("WNBA step", k, "final:", f.join(","), "| live:", l.join(",")); });
const pickM = Number(process.env.MLB_STEP || 12), pickW = Number(process.env.WNBA_STEP || 10);
write("MLB_2025.replay-step-" + pickM, normM(MS[pickM]), seedM, "seeds-mlb-2025.json", srcM, "(replay step, synthesized per replay.js)");
write("WNBA_2025.replay-step-" + pickW, normW(WS[pickW]), seedW, "seeds-wnba-2025.json", srcW, "(replay step, synthesized per replay.js)");
