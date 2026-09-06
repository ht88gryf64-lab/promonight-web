// nfl-schedule-title-sep2026 (see src/lib/title-treatment.ts), the guard for a
// title experiment that must move exactly ten <title> strings and nothing else.
//
// THE TABLES BELOW ARE FROZEN LITERALS, captured 2026-09-05 from the module as it
// stood before the NFL arm was added, on the same day, against live Firestore
// display names. They are written out rather than re-derived so that an edit to
// title-treatment.ts fails here instead of quietly agreeing with itself. Same-day
// matters: the strings embed a hardcoded 2026, so a table captured across a season
// bump would fail for a reason that is not a defect.
//
// What this file proves, in the order the brief cares about:
//   1. the ten NFL treatment titles carry the new form and every one fits 60 chars
//   2. the ten NFL CONTROL titles are byte-identical to what they were
//   3. all thirty MLB titles, BOTH ctr-diagnostic arms, are byte-identical
//   4. the surfaces the brief freezes did not move for any of the twenty, checked
//      at the mapper rather than at a render path
//   5. the arms are disjoint, so no club is in two live experiments at once
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Team } from "../types";
import { teamDisplayName } from "../promo-helpers";
import {
  NFL_SCHEDULE_TITLE_SLUGS,
  NFL_SCHEDULE_TITLE_CONTROL_SLUGS,
  NFL_TITLE_SEASON_YEAR,
  TITLE_SEASON_YEAR,
  TREATMENT_SLUGS,
  isNflScheduleTitleTeam,
  isTitleTreatmentTeam,
  teamMetaTitle,
  teamTitleSubtitle,
  titleExperimentArm,
} from "../title-treatment";

const SUFFIX = " | PromoNight"; // src/app/layout.tsx title.template
const TITLE_MAX = 60;

interface Frozen { id: string; city: string; name: string; title: string }

// The team shape the title path actually touches: id decides the arm, city+name
// feed teamDisplayName. Nothing else in Team reaches a title.
const asTeam = (r: Frozen) => ({ id: r.id, city: r.city, name: r.name }) as Team;
const rendered = (r: Frozen) =>
  `${teamMetaTitle(asTeam(r), teamDisplayName(asTeam(r)))}${SUFFIX}`;

/** The ten treatment clubs and the exact <title> each must now serve. */
const NFL_TREATMENT: Frozen[] = [
  { id: "baltimore-ravens", city: "Baltimore", name: "Ravens", title: "Baltimore Ravens 2026 Schedule & Giveaways | PromoNight" }, // 55
  { id: "chicago-bears", city: "Chicago", name: "Bears", title: "Chicago Bears 2026 Schedule & Giveaways | PromoNight" }, // 52
  { id: "cincinnati-bengals", city: "Cincinnati", name: "Bengals", title: "Cincinnati Bengals 2026 Schedule & Giveaways | PromoNight" }, // 57
  { id: "dallas-cowboys", city: "Dallas", name: "Cowboys", title: "Dallas Cowboys 2026 Schedule & Giveaways | PromoNight" }, // 53
  { id: "detroit-lions", city: "Detroit", name: "Lions", title: "Detroit Lions 2026 Schedule & Giveaways | PromoNight" }, // 52
  { id: "kansas-city-chiefs", city: "Kansas City", name: "Chiefs", title: "Kansas City Chiefs 2026 Schedule & Giveaways | PromoNight" }, // 57
  { id: "new-york-giants", city: "New York", name: "Giants", title: "New York Giants 2026 Schedule & Giveaways | PromoNight" }, // 54
  { id: "philadelphia-eagles", city: "Philadelphia", name: "Eagles", title: "Philadelphia Eagles 2026 Schedule & Giveaways | PromoNight" }, // 58
  { id: "pittsburgh-steelers", city: "Pittsburgh", name: "Steelers", title: "Pittsburgh Steelers 2026 Schedule & Giveaways | PromoNight" }, // 58
  { id: "san-francisco-49ers", city: "San Francisco", name: "49ers", title: "San Francisco 49ers 2026 Schedule & Giveaways | PromoNight" }, // 58
];

/** The ten held-out clubs. These strings must not move. */
const NFL_CONTROL: Frozen[] = [
  { id: "atlanta-falcons", city: "Atlanta", name: "Falcons", title: "Atlanta Falcons Promos & Giveaways 2026 | PromoNight" },
  { id: "buffalo-bills", city: "Buffalo", name: "Bills", title: "Buffalo Bills Promos & Giveaways 2026 | PromoNight" },
  { id: "denver-broncos", city: "Denver", name: "Broncos", title: "Denver Broncos Promos & Giveaways 2026 | PromoNight" },
  { id: "los-angeles-chargers", city: "Los Angeles", name: "Chargers", title: "Los Angeles Chargers Promos & Giveaways 2026 | PromoNight" },
  { id: "los-angeles-rams", city: "Los Angeles", name: "Rams", title: "Los Angeles Rams Promos & Giveaways 2026 | PromoNight" },
  { id: "miami-dolphins", city: "Miami", name: "Dolphins", title: "Miami Dolphins Promos & Giveaways 2026 | PromoNight" },
  { id: "minnesota-vikings", city: "Minnesota", name: "Vikings", title: "Minnesota Vikings Promos & Giveaways 2026 | PromoNight" },
  { id: "new-york-jets", city: "New York", name: "Jets", title: "New York Jets Promos & Giveaways 2026 | PromoNight" },
  { id: "seattle-seahawks", city: "Seattle", name: "Seahawks", title: "Seattle Seahawks Promos & Giveaways 2026 | PromoNight" },
  { id: "tampa-bay-buccaneers", city: "Tampa Bay", name: "Buccaneers", title: "Tampa Bay Buccaneers Promos & Giveaways 2026 | PromoNight" },
];

/** All thirty MLB clubs, both ctr-diagnostic-sep2026 arms. These must not move. */
const MLB_FROZEN: Frozen[] = [
  { id: "arizona-diamondbacks", city: "Arizona", name: "Diamondbacks", title: "Arizona Diamondbacks Promos & Giveaways 2026 | PromoNight" },
  { id: "atlanta-braves", city: "Atlanta", name: "Braves", title: "Atlanta Braves Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "baltimore-orioles", city: "Baltimore", name: "Orioles", title: "Baltimore Orioles Promos & Giveaways 2026 | PromoNight" },
  { id: "boston-red-sox", city: "Boston", name: "Red Sox", title: "Boston Red Sox Promos & Giveaways 2026 | PromoNight" },
  { id: "chicago-cubs", city: "Chicago", name: "Cubs", title: "Chicago Cubs Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "chicago-white-sox", city: "Chicago", name: "White Sox", title: "Chicago White Sox Promos & Giveaways 2026 | PromoNight" },
  { id: "cincinnati-reds", city: "Cincinnati", name: "Reds", title: "Cincinnati Reds Promos & Giveaways 2026 | PromoNight" },
  { id: "cleveland-guardians", city: "Cleveland", name: "Guardians", title: "Cleveland Guardians Promos & Giveaways 2026 | PromoNight" },
  { id: "colorado-rockies", city: "Colorado", name: "Rockies", title: "Colorado Rockies Promos & Giveaways 2026 | PromoNight" },
  { id: "detroit-tigers", city: "Detroit", name: "Tigers", title: "Detroit Tigers Promos & Giveaways 2026 | PromoNight" },
  { id: "houston-astros", city: "Houston", name: "Astros", title: "Houston Astros Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "kansas-city-royals", city: "Kansas City", name: "Royals", title: "Kansas City Royals Promos & Giveaways 2026 | PromoNight" },
  { id: "los-angeles-angels", city: "Los Angeles", name: "Angels", title: "Los Angeles Angels Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "los-angeles-dodgers", city: "Los Angeles", name: "Dodgers", title: "Los Angeles Dodgers Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "miami-marlins", city: "Miami", name: "Marlins", title: "Miami Marlins Promos & Giveaways 2026 | PromoNight" },
  { id: "milwaukee-brewers", city: "Milwaukee", name: "Brewers", title: "Milwaukee Brewers Promos & Giveaways 2026 | PromoNight" },
  { id: "minnesota-twins", city: "Minnesota", name: "Twins", title: "Minnesota Twins Promos & Giveaways 2026 | PromoNight" },
  { id: "new-york-mets", city: "New York", name: "Mets", title: "New York Mets Promos & Giveaways 2026 | PromoNight" },
  { id: "new-york-yankees", city: "New York", name: "Yankees", title: "New York Yankees Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "oakland-athletics", city: "Oakland", name: "Athletics", title: "Oakland Athletics Promos & Giveaways 2026 | PromoNight" },
  { id: "philadelphia-phillies", city: "Philadelphia", name: "Phillies", title: "Philadelphia Phillies Promos & Giveaways 2026 | PromoNight" },
  { id: "pittsburgh-pirates", city: "Pittsburgh", name: "Pirates", title: "Pittsburgh Pirates Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "san-diego-padres", city: "San Diego", name: "Padres", title: "San Diego Padres Promos & Giveaways 2026 | PromoNight" },
  { id: "san-francisco-giants", city: "San Francisco", name: "Giants", title: "San Francisco Giants Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "seattle-mariners", city: "Seattle", name: "Mariners", title: "Seattle Mariners Promos & Giveaways 2026 | PromoNight" },
  { id: "st-louis-cardinals", city: "St. Louis", name: "Cardinals", title: "St. Louis Cardinals Promos & Giveaways 2026 | PromoNight" },
  { id: "tampa-bay-rays", city: "Tampa Bay", name: "Rays", title: "Tampa Bay Rays Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "texas-rangers", city: "Texas", name: "Rangers", title: "Texas Rangers Promos & Giveaways 2026 | PromoNight" },
  { id: "toronto-blue-jays", city: "Toronto", name: "Blue Jays", title: "Toronto Blue Jays Giveaways & Theme Nights 2026 | PromoNight" },
  { id: "washington-nationals", city: "Washington", name: "Nationals", title: "Washington Nationals Promos & Giveaways 2026 | PromoNight" },
];

test("the ten NFL treatment clubs serve the schedule title", () => {
  assert.equal(NFL_TREATMENT.length, 10);
  for (const r of NFL_TREATMENT) {
    assert.ok(isNflScheduleTitleTeam(asTeam(r)), r.id);
    assert.equal(rendered(r), r.title, r.id);
  }
});

// 153 of this site titles are already flagged too long and Google is rewriting 52.
// A title Google rewrites measures nothing, so fitting the budget is not a nicety
// here, it is the precondition for the read being worth anything. Headroom is thin:
// the three 19-character display names land on 58.
test("every NFL treatment title fits the 60-character budget", () => {
  for (const r of NFL_TREATMENT) {
    const t = rendered(r);
    assert.ok(t.length <= TITLE_MAX, `${r.id} is ${t.length}: ${t}`);
  }
});

test("the ten NFL control clubs are byte-identical", () => {
  assert.equal(NFL_CONTROL.length, 10);
  for (const r of NFL_CONTROL) {
    assert.equal(isNflScheduleTitleTeam(asTeam(r)), false, r.id);
    assert.equal(rendered(r), r.title, r.id);
  }
});

// The overlapping MLB experiment reads on 2026-10-01. If any of these thirty moved,
// that read is spoiled and this change is the reason.
test("all thirty MLB titles are byte-identical, both arms", () => {
  assert.equal(MLB_FROZEN.length, 30);
  assert.equal(MLB_FROZEN.filter((r) => TREATMENT_SLUGS.has(r.id)).length, 10);
  for (const r of MLB_FROZEN) assert.equal(rendered(r), r.title, r.id);
});

// Gated at the mapper, not at a render path: an exclusion on one render path is not
// an exclusion. teamTitleSubtitle is what the visible hero prints under the <h1>;
// isTitleTreatmentTeam is not only a title predicate, it also decides whether the
// meta description grows a "Next {team} theme night" lead (page.tsx:151). Both are
// surfaces the brief freezes, so both are pinned for all twenty clubs.
test("the frozen surfaces did not move for any of the twenty NFL clubs", () => {
  for (const r of [...NFL_TREATMENT, ...NFL_CONTROL]) {
    const t = asTeam(r);
    assert.equal(teamTitleSubtitle(t), "Promos & Giveaways 2026", r.id);
    assert.equal(isTitleTreatmentTeam(t), false, r.id);
  }
});

test("the arms are disjoint and correctly labelled", () => {
  const treat = [...NFL_SCHEDULE_TITLE_SLUGS];
  const ctrl = [...NFL_SCHEDULE_TITLE_CONTROL_SLUGS];
  assert.equal(treat.length, 10);
  assert.equal(ctrl.length, 10);
  assert.deepEqual(treat.filter((s) => TREATMENT_SLUGS.has(s)), []);
  assert.deepEqual(ctrl.filter((s) => TREATMENT_SLUGS.has(s)), []);
  assert.deepEqual(treat.filter((s) => NFL_SCHEDULE_TITLE_CONTROL_SLUGS.has(s)), []);
  for (const r of NFL_TREATMENT) {
    assert.equal(titleExperimentArm(asTeam(r)), "nfl-schedule-treatment", r.id);
  }
  for (const r of NFL_CONTROL) {
    assert.equal(titleExperimentArm(asTeam(r)), "nfl-schedule-control", r.id);
  }
});

// Two standing repo rules, made enforceable rather than remembered. The year is
// hardcoded because an auto-rolling one flips every title to the next season at
// midnight on Jan 1, months before that season data exists; scripts/audit-title-lengths.ts
// and scripts/check-metadata-dedupe.ts both already drifted, so this is a demonstrated
// failure mode. Em dashes are banned in user-facing copy.
test("the year is hardcoded and no title carries an em dash", () => {
  assert.equal(NFL_TITLE_SEASON_YEAR, 2026);
  assert.equal(TITLE_SEASON_YEAR, 2026);
  const src = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "title-treatment.ts"),
    "utf8",
  );
  // Comments are stripped first: this module's prose NAMES getFullYear in order
  // to forbid it, so a raw match on the file would fail on the rule's own wording.
  // What must be absent is a call in the code.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /getFullYear/);
  for (const r of [...NFL_TREATMENT, ...NFL_CONTROL, ...MLB_FROZEN]) {
    assert.ok(!rendered(r).includes("\u2014"), r.id);
  }
});
