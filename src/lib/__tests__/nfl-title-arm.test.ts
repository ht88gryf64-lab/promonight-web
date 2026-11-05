// nfl-schedule-title-sep2026 (see src/lib/title-treatment.ts), the guard for a
// title experiment that must move exactly ten <title> strings and nothing else.
//
// RETIRED 2026-11-05 (serp-targeting ruling 7). Both title experiments ended
// without a recorded read, and every team page now serves the promotional-
// schedule title. The frozen tables stay as the record of what each arm served;
// the tests that pinned them byte-identical now assert that all fifty clubs left
// their experiment title for the new one. The frozen-surface and disjointness
// tests still hold: the hero subtitle and the description lead did not move.
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
import { seasonLabel } from '../seasons/season-window';
import {
  NFL_SCHEDULE_TITLE_SLUGS,
  NFL_SCHEDULE_TITLE_CONTROL_SLUGS,
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
// feed teamDisplayName, and league picks the season the year token names
// (seasonLabel, src/lib/seasons/windows.json, since the 2026-11-05 rollover).
// Every frozen club is an NFL arm club or an MLB one.
const leagueOf = (id: string) => (NFL_SCHEDULE_TITLE_SLUGS.has(id) || NFL_SCHEDULE_TITLE_CONTROL_SLUGS.has(id) ? "NFL" : "MLB");
const asTeam = (r: Frozen) => ({ id: r.id, city: r.city, name: r.name, league: leagueOf(r.id) }) as Team;
// The team title is emitted with title.absolute since 2026-11-05, so the layout
// suffix no longer applies. SUFFIX stays to read the frozen tables.
const rendered = (r: Frozen) => teamMetaTitle(asTeam(r), teamDisplayName(asTeam(r)));

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

// Every club in either experiment, both arms, now serves the cascade title:
// "{Full name} Promotional Schedule & Giveaways 2026", the nickname or the
// short "Promo Schedule" form only when the full form runs past 60.
const RETIRED = () => [...NFL_TREATMENT, ...NFL_CONTROL, ...MLB_FROZEN];
const PROMOTIONAL = /^(.+) (Promotional|Promo) Schedule & Giveaways 2026$/;

test("RETIRED: all fifty experiment clubs, both arms, left their experiment title", () => {
  assert.equal(NFL_TREATMENT.length, 10);
  assert.equal(NFL_CONTROL.length, 10);
  assert.equal(MLB_FROZEN.length, 30);
  for (const r of RETIRED()) {
    const t = rendered(r);
    assert.notEqual(`${t}${SUFFIX}`, r.title, `${r.id} still serves its experiment title`);
    const m = t.match(PROMOTIONAL);
    assert.ok(m, `${r.id}: ${t}`);
    const display = teamDisplayName(asTeam(r));
    assert.ok(m![1] === display || m![1] === r.name, `${r.id}: the name is the full name or the nickname, never cut: ${t}`);
  }
});

test("RETIRED: every one of the fifty fits 60 rendered characters with no suffix", () => {
  for (const r of RETIRED()) {
    const t = rendered(r);
    assert.ok(t.length <= TITLE_MAX, `${r.id} is ${t.length}: ${t}`);
    assert.ok(!t.endsWith(SUFFIX), r.id);
  }
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
test("the year comes from the windows, never the clock, and no title carries an em dash", () => {
  // Season rollover (ruling 2026-11-05): the year token is seasonLabel(league),
  // from src/lib/seasons/windows.json, the same for both arms on a given day.
  assert.equal(seasonLabel('NFL', '2026-11-05'), '2026');
  assert.equal(seasonLabel('MLB', '2026-11-05'), '2026');
  assert.equal(seasonLabel('MLB', '2027-02-07'), '2027', 'MLB names 2027 from the first day of its lead-in');
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
