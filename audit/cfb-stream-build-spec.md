# PromoNight /cfb Stream — Locked Build Spec

**Created:** 2026-06-12 · **Status:** Locked for build · **Branch base:** off `cfb-data-spike` findings
**Predecessor docs:** `audit/cfb-stream-spike.md` (extraction probe + schema proposal + verification pass)

This is the single source of truth for building the CFB data stream and `/cfb` hub. It carries the spike + verification findings into the build thread. Read it first, build nothing that contradicts it without logging the decision.

---

## 1. What was decided and why

The spike + verification pass settled the open questions. The build follows from them directly.

**Gate cleared.** MLB travel-planner thesis validated (away-game expansion 28.6% recent / 19.6% cumulative, above the 20% threshold). `/cfb` is greenlit.

**Two-tier data economics.** Hard data (schedule, venue, colors, major rivalries) is pipeline-automatable across all 134 FBS. Soft data (theme designations, traditions, tailgating, rivalry lore) is manual editorial, and the cost per school *rises* down the fame curve. Confirmed empirically: Boise had the freshest schedule of the four sample schools and the thinnest soft layer.

**Extractor confidence is worthless without independent verification.** The verify pass: 104 claims, 88 verified, 7 downgraded, 8 false. ~15% of HIGH-rated claims failed, and the wrong claims were rated HIGH too. An independent verify stage is permanent pipeline architecture, not a one-time check.

---

## 2. Scope (locked)

**Pipeline wide, editorial narrow.**

- **Pipeline (hard data):** run for all schools in the anchor list and beyond as bandwidth allows. It scales without human time, so there is no reason to starve it. Every covered school gets an auto-generated page with schedule, venue, colors, rivalry facts.
- **Editorial (soft data):** the 25-school wedge below. A school becomes a *real destination page* (theme narratives, tradition copy, tailgating, rivalry lore) only after its editorial pass. Editorial bandwidth is the gate, confirmed at 25 schools for the fall window.

A school graduates from "auto page" to "destination page" when editorial lands. This is the expansion mechanism: no re-architecture to add schools later, just more editorial passes.

### The 25-school anchor list

Fixed now so slugs do not churn against a moving AP poll. Top-25 weekly movement becomes a ranking *badge* on pages that already exist, never a gate on which pages exist.

| Conf (2026) | Schools |
|---|---|
| SEC | Alabama, Georgia, LSU, Tennessee, Texas, Oklahoma, Auburn, Florida, Texas A&M, Ole Miss |
| Big Ten | Ohio State, Michigan, Penn State, Oregon, USC, Wisconsin, Nebraska |
| ACC | Clemson, Florida State, Miami, North Carolina |
| Big 12 | Utah, Kansas State, Oklahoma State |
| Independent | Notre Dame |

25 schools. Every program with national search volume and travel-heavy fanbases. Stable regardless of how the season breaks.

**Tier-2 expansion set** (next editorial waves if the wedge proves out): Washington, Texas Tech, Iowa, Michigan State, Missouri, Kansas, South Carolina, Arizona State, SMU, Indiana, and the rest of Power 4 from there.

---

## 3. Schema (locked)

Three decisions resolved from the spike's open questions:

1. **Fork `cfbGame`, do not extend the shared `Game` type.** CFB's realignment churn, neutral sites, and flex-finale quirks stay out of the type the pro pages depend on. Accept the ~20% duplication; it is exactly the divergent part that would cause pain if coupled.
2. **Conference is season-scoped.** `conferenceBySeason` map, never a flat field. Boise is Pac-12 for 2026, not Mountain West. Non-negotiable.
3. **`cfbTradition` is top-level**, not a school subcollection. The homepage theme-games rail needs cross-school tradition queries ("all whiteouts this week"), which a subcollection cannot serve cleanly.

### Collections

```
cfbSchools/{schoolId}              // tennessee, kansas-state, notre-dame, boise-state, ...
  name, shortName, mascot
  primaryColor, secondaryColor, colorsSource
  conferenceBySeason: { "2026": "SEC" | "Independent" | "Pac-12" | ... }
  venueId
  traditionIds: []                 // refs into cfbTraditions
  editorialStatus: "auto" | "destination"   // gates page treatment
  updatedAt

cfbVenues/{venueId}
  name, city, state
  capacity                         // CFB needs this; repo Venue has no capacity field
  lat, lng
  homeSchoolId, sharedSchoolIds: []
  tailgating, parking, transit, gatesOpenRule    // prose, editorial
  source, updatedAt

cfbGames/{gameId}                  // e.g. 2026-w5-tennessee-texas
  season: 2026, week, date, status
  homeSchoolId, awaySchoolId
  neutralSite: bool, venueId
  kickoff: { time, tz, tbd: bool, windowFlex: string|null }
  broadcast: { network, confirmed: bool }
  conferenceGame: bool | null      // null for independents, HARD-GATED (see anti-hallucination spec)
  rivalryId: ref | null
  themeDesignations: [             // pipeline attaches when announced
    { traditionId, displayName, source, confidence, announcedAt }
  ]
  source, fetchedAt
  verified: bool                   // false until the verify pass confirms; gates production display

cfbRivalries/{rivalryId}           // relational, spans two schools
  name: "Sunflower Showdown"
  schoolIds: ["kansas-state", "kansas"]    // array-contains query "rivalries for school X"
  trophy: "Governor's Cup" | null
  seriesStartYear: 1902            // SPLIT from trophy creation (verify pass caught the conflation)
  trophyCreatedYear: int | null
  dormant: bool                    // Boise-Idaho is dormant in 2026; persist anyway
  narrative: "<editorial>"
  source, updatedAt

cfbTraditions/{traditionId}        // top-level (homepage rail)
  schoolId
  name: "Checker Neyland"
  kind: "themeGame" | "rivalry" | "entrance" | "other"
  dressCode: string | null
  narrative: "<editorial>"
  recurring: bool
  editoriallySeeded: bool
  source, updatedAt
```

### Fields with no promo-schema equivalent (do not force the mapping)

`homeSchoolId`/`awaySchoolId`/`neutralSite` (two-sided games), `conferenceGame`/`conferenceBySeason` (season-versioned), `rivalryId` + trophy/years (relational, multi-decade), `themeDesignations[]` + tradition narrative/dressCode (Promo.type:'theme' has none of this), `kickoff.windowFlex`/`tbd` + broadcast.confirmed (rolling reveals), venue `capacity`.

**The one trap:** never map a CFB theme game to `Promo.type:'theme'`. It silently discards dress code, tradition narrative, recurrence, and rivalry linkage. They share the word "theme" and nothing else.

---

## 4. Anti-hallucination spec (verify contract)

The verify pass is part of the stream's **definition of done**. No CFB data is trusted for production without it. Same class of hard rule as "every affiliate feature dual-emits to PostHog before it ships."

`cfbGames.verified` starts `false`. A game does not display in production until an independent pass confirms value AND that the cited source carries that value.

Five failure modes the pass caught, each with its guard:

| Failure mode | Example caught | Pipeline guard |
|---|---|---|
| Timezone conversion | Boise 6 kickoffs +2h, all rated HIGH | Verify kickoffs against the **home school's** official site with explicit tz. Never infer or convert blind. Store tz with time. |
| Derived-field hallucination | ND week off-by-one (double-counted bye); ND conferenceGame=yes (it is independent) | Hard-gate derived fields by rule, do not extract. Independent = zero conference games, full stop. Week computed from schedule, not read. |
| Entity conflation | originYear mixed series-start with trophy-creation | Split fields: `seriesStartYear` ≠ `trophyCreatedYear`. |
| Outright fabrication | "Dooley-Fulmer Trophy" (does not exist) | Mandatory independent second source. Single-source claims cannot reach `verified: true`. |
| Mis-citation | Correct TN/Texas time, wrong (stale) source | Store the source that actually carries the value, not a plausible adjacent URL. Verify the citation, not just the value. |

**Rule:** treat every extractor HIGH as UNVERIFIED until independently confirmed. The HIGH rating carries no signal.

---

## 5. Pipeline vs editorial split (honest)

| Field group | Source | Owner |
|---|---|---|
| Schedule core (date/opp/home-away/venue/week/conf) | official + Wikipedia + ESPN | Pipeline (Haiku) + verify |
| Kickoff/TV when announced (+ tbd/windowFlex) | official + conference + TV partner | Pipeline, rolling re-fetch + verify |
| Venue capacity/lat-lng, school colors | Wikipedia / official brand | Pipeline (Haiku) + verify |
| Rivalry name/trophy/years/pairing | Wikipedia | Pipeline (Sonnet) + verify |
| Theme-game DESIGNATION (which 2026 game) | official news (summer + in-season) | Pipeline when announced, else NF + verify |
| Rivalry narrative, venue tailgating/travel prose | fan/official prose | **Editorial (paraphrased)** |
| Theme/tradition NARRATIVE + dress code | editorial knowledge, blogs | **Manual editorial seeding** |

Pipeline cost is bounded Claude Code time. Editorial cost is your time, and it is the real timeline gate.

---

## 6. Editorial seeding template (per school)

This is what an "editorial pass" concretely means. One per wedge school. Fill from the research layer (paraphrased, original, never reproduced).

```
School: __________
[ ] Theme game narratives (each announced 2026 designation):
    name, dress code, the tradition behind it, why it matters — 2-3 original sentences each
[ ] Marquee rivalry narrative(s): origin, what's at stake, trophy story — paraphrased, original
[ ] Venue gameday: tailgating culture, parking reality, transit, gate timing — original prose
[ ] One "why you go" paragraph: the editorial soul of the page, first-person-credible
[ ] Color/brand sanity check against official brand source
[ ] Sources logged (for paraphrase provenance, not reproduction)
```

**Copyright discipline:** the research layer (SB Nation, 247, On3, independents, Reddit) is paraphrase-only and human-mediated. SB Nation blocks ClaudeBot, 247 paywalls, Reddit blocks fetch. None is a scrape target. Wikipedia (CC-BY-SA) is the one safe-to-reuse-with-attribution structured source.

---

## 7. Stream design

### Source list (priority order)

1. **Official athletics site** — schedule, designations, official logistics. Structured, generally crawlable (check each robots.txt).
2. **Wikipedia** ("2026 [School] football team", stadium, rivalry pages) — schedule, venue, rivalry, colors. CC-BY-SA, most reproducible across all 134 FBS.
3. **ESPN / Sports Reference (CFB)** — structured cross-check, fallback when official is JS-rendered.
4. **Conference + TV-partner releases** (SEC/Big Ten/Big 12/ACC, NBC/CBS/ESPN/Fox/CW) — kickoff windows + TV, roll out over summer and ~12 days pre-game.
5. **Fan sites — RESEARCH LAYER ONLY** — paraphrase-only, human-mediated, editorial seeding. Permitted-use constraints in spike Part 4.

### Two extraction prompts, not one

- **Schedule parser:** structured-table extraction, high precision, **Haiku**, typed rows out. Anti-hallucination hardening first-class: future kickoff/TV/designations default to TBD/NF, never invented. `source` URL + `confidence` required output fields.
- **Context extractor:** theme/tradition/rivalry, **Sonnet**, mandatory `announcedFor2026 ∈ {yes, no-historical-only, NF}` disambiguation. Trap cases: ND "The Shirt" (apparel, not gameday), Boise basketball white-out (wrong sport), K-State "Senior Day" (roster ceremony, not a fan theme).

### Cron cadence

- **Offseason / structural:** weekly full-schedule refresh.
- **In-season near-term sweep:** 2-3x/week over the next 2-3 weeks' games to catch rolling kickoff/TV reveals (~12 days out) and theme designations.
- **Event-driven:** re-fetch a school on official-site news. IndexNow dual-endpoint on deploy (shared infra pattern).
- **Verify stage runs on every write.** No exceptions.

---

## 8. Build phases (gated)

Each phase stops at a gate. Nothing goes live before review. Branch-only, `--no-ff` merges, one commit per logical step, adversarial self-review before each gate.

**Phase 1 — Schema + pipeline skeleton (no UI).**
Stand up the five collections. Build the schedule parser (Haiku) + verify stage for the 4 spike schools only. Gate: `cfbGames.verified` populating correctly, the five anti-hallucination guards demonstrably firing (re-run the Boise timezone case and confirm it is caught). Stop and report.

**Phase 2 — Pipeline to 25 (hard data).**
Run schedule + venue + colors + rivalry facts across all 25, verify pass on each. Gate: a coverage + verification report (per school: claims, verified, downgraded, flagged-for-human). No page is built yet. Stop and report.

**Phase 3 — Auto pages + theming engine.**
Build `/cfb` route, team theming from `cfbSchools` colors (CSS variables on route root, localStorage persistence — same pattern as the mockup), auto-generated school pages from verified hard data. Gate: visual review of ~5 schools across different palettes. Stop and report.

**Phase 4 — Editorial pass, marquee-first.**
You seed the editorial template, schools flip `editorialStatus: auto → destination`. Order by search volume / fanbase travel. Gate: per-school review before each flips live. Rolling, not one gate.

**Phase 5 — Hub homepage + rails.**
Theme-games rail, road-trip rail, rivalry watch, this-Saturday slate (the mockup). Wire affiliate CTAs (Booking, tickets) with surface tagging (`web_cfb_*`) dual-emitting to PostHog + GA4 before they ship. Gate: analytics firing confirmed, then live.

Phases 1-3 are pipeline/Claude Code time. Phase 4 is your editorial time and sets the real calendar. Phase 5 is the payoff surface.

---

## 9. Timeline against 25 schools

- **Now → late June:** Phases 1-2. Schema + pipeline + verify to 25, hard data. Claude Code time.
- **Early July:** Phase 3. Auto pages + theming. Reviewable destination shells.
- **July → mid-August:** Phase 4. Editorial pass, 25 schools at your confirmed bandwidth. This is the gate; it fits the window.
- **Mid → late August:** Phase 5. Hub homepage + rails + affiliate wiring, before season kickoff (late Aug).

Late August ships 25 real destination pages plus a hub, with the pipeline already covering more schools as auto pages behind them.

### Watch-outs that compete for the same window

- Mediavine Journey review July 3 (separate track, minimal overlap).
- NFL data completeness is the dominant 6-month forecast lever and NFL season also starts in fall. `/cfb` editorial and NFL data-build both want fall bandwidth. Sequence deliberately.
- Verify pass is now permanent per-school cost. Bounded, but real. Do not skip it under timeline pressure; the Boise timezone bug is what skipping looks like in production.

---

## 10. Definition of done (stream)

A CFB school is production-ready when:
1. Hard data extracted AND independently verified (`verified: true`).
2. The five anti-hallucination guards passed.
3. For *destination* status: editorial template filled, paraphrased and original, sources logged.
4. Colors sanity-checked against official brand.
5. Page reviewed at the phase gate before going live.

No CFB data goes live before we love it.
