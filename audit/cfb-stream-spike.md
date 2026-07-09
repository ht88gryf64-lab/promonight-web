# CFB Data Extraction + Schema Design Spike

**Date:** 2026-06-12 · **Branch:** `cfb-data-spike` · **Type:** read-only diagnostic spike (no Firestore writes, no UI, no pipeline changes)
**Sample schools:** Tennessee (SEC), Kansas State (Big 12), Notre Dame (Independent), Boise State (Pac-12 — see realignment note)
**Method:** fetch-first web extraction (official athletics sites, Wikipedia, Sports Reference, ESPN) via 4 parallel agents, then an independent verification pass.

> **Verification status (read this first).** The automated independent-verification pass was interrupted by an account session limit, so the per-school verify agents did not complete. I manually verified the two highest-risk claims — Tennessee's Checker Neyland / Texas kickoff and Boise State's 2026 conference — and both held. **Every other value below is reported as the extractor found it, but specific kickoff times, TV networks, and theme-game designations should be treated as UNVERIFIED**, and several "HIGH" ratings the extractor emitted are downgraded here (see Adversarial Review #1). This interruption is itself a finding: extraction agents systematically over-rate confidence, so an independent verify pass is not optional for this stream.

---

## Executive summary

1. **Two data tiers with very different economics.** *Hard* data (schedule rows, venue basics, team colors, major-rivalry facts) is HIGH-confidence, structured, and reproducible across all 134 FBS schools via official sites + Wikipedia + ESPN → **Haiku-automatable pipeline**. *Soft* data (theme-game designations, traditions, tailgating/travel logistics, rivalry lore) is sparse, prose-bound, often on access-restricted or copyright fan sites → **manual editorial seeding**.
2. **The G5 "cliff" is in the soft tier, not the schedule.** Boise State's 2026 schedule was actually *more* complete than Tennessee's (new-Pac-12 publicity got TV/times out early). The cliff showed up in theme games (none announced), tradition documentation, and fan-site depth.
3. **Conference is season-scoped, not a static team attribute.** Boise State is in the **Pac-12 for 2026** (joins July 1, 2026) — the brief's "Mountain West" label is already stale. Realignment churn (Texas→SEC, Boise→Pac-12) means the schema must version conference by season.
4. **The CFB `game` entity is a superset of the repo's existing `Game` type — NOT the promo schema.** The genuinely CFB-native entities are *theme/tradition* and *rivalry*. Do **not** force CFB theme games into `Promo.type:'theme'` (see Adversarial #3).
5. **Fan sites are a research layer, not a pipeline source.** SB Nation (Vox) blocks ClaudeBot in robots.txt; 247Sports/CBS paywalls and protects its API; Reddit blocks automated fetch outright; On3 permits editorial crawl but disallows its boards. The content we'd actually want from them (tradition/tailgating/rivalry color) is exactly the prose that's blocked, paywalled, or copyrighted → paraphrase-only, human-mediated.

---

# PART 1 — Extraction probe

Confidence legend: **HIGH** = structured/official; **MED** = needed parsing/single secondary source; **LOW** = inferred/single-source; **NF** = not found / not yet announced.
Method legend: **H** = Haiku-automatable · **S** = needs Sonnet · **E** = manual editorial.
Ratings below are *re-rated by me* where the extractor was over-confident; the "extractor said" deltas are called out in Adversarial #1.

## 1A. Tennessee Volunteers (SEC)

**Schedule** — core fields (date/opponent/home-away/venue/week/conf) **HIGH/H** from utsports.com + Wikipedia + ESPN. Kickoff/TV: only the opener window + Texas are confirmed; the rest are flex windows or TBD.

| Date | Opp | H/A | Kickoff | TV | Conf | Conf rating |
|---|---|---|---|---|---|---|
| 09-05 | Furman | H | (reported 3:30 ET) | (SECN+) | no | MED — *unverified exact time* |
| 09-12 | Georgia Tech | A | (reported 7:00 ET) | (ESPN) | no | MED — *unverified* |
| 09-19 | Kennesaw State | H | (reported 7:45 ET) | (SECN) | no | MED — *unverified* |
| 09-26 | **Texas** | H | **12:00 ET ✅** | **ABC/ESPN ✅** | yes | **HIGH — verified (utsports 6/10)** |
| 10-03 | Auburn | H | flex 3:30-4:30 / 6-8 | TBD | yes | HIGH date / NF time |
| 10-10 | Arkansas | A | flex | TBD | yes | HIGH date / NF time |
| 10-17 | Alabama | H | flex | TBD | yes | HIGH date / NF time |
| 10-24 | South Carolina | A | TBD | TBD | yes | HIGH date / NF time |
| 11-07 | Kentucky | H | night ✅ | TBD | yes | HIGH date, night confirmed |
| 11-14 | Texas A&M | A | flex | TBD | yes | HIGH date / NF time |
| 11-21 | LSU | H | TBD | TBD | yes | HIGH date / NF time |
| 11-28 | Vanderbilt | A | TBD | TBD | yes | HIGH date / NF time |

- **Venue** — Neyland Stadium, Knoxville; cap **102,455**; lat/lng 35.9530 / -83.9217. **HIGH/H** (Wikipedia/official). Tailgating/parking/transit logistics: rich but **prose, MED/E** (knoxvillestadium.com).
- **Theme games** — **Checker Neyland vs Texas, Sept 26 — HIGH, VERIFIED ✅** (utsports 6/10; "Checker Neyland game"). Also announced for 2026: Salute to Service (Kennesaw 9/19), Champions Weekend (Auburn 10/3), 102nd Homecoming (Kentucky 11/7), Senior Day (LSU 11/21) — **MED/E**, single official-designation source, unverified individually. Dress-code/tradition narrative is **E** (editorial).
- **Rivalries** — Third Saturday in October vs Alabama (1901), Kentucky (1893), Vanderbilt (1892), Georgia Tech renewed (1902). **HIGH/H** via Wikipedia. ⚠️ The "Dooley-Fulmer Trophy / Third Saturday in November" label for Vanderbilt looks conflated — **flag LOW, needs verify** (no widely-recognized TN-Vandy trophy).
- **Colors** — #FF8200 / #FFFFFF. **HIGH/H** (teamcolorcodes; cross-checks to official).
- **Source quality:** excellent across the board (blue-blood, deep official + secondary coverage).

## 1B. Kansas State Wildcats (Big 12)

**Schedule** — full 12 games **HIGH/H** from kstatesports.com + Big 12 + ESPN. First three game times/TV reportedly announced 5/27 (ESPN+, TNT/Max, ESPN2) — **MED, unverified**; conference games TBD.

| Date | Opp | H/A | Kickoff | TV | Conf |
|---|---|---|---|---|---|
| 09-05 | Nicholls | H | (6:00 CT) | (ESPN+) | no |
| 09-12 | Washington State | H | (11:00 CT) | (TNT/Max) | no |
| 09-19 | Tulane | H | (11:00 CT) | (ESPN2) | no |
| 09-26 | Cincinnati | A | TBD | TBD | yes |
| 10-10 | Houston | H | TBD | TBD | yes |
| 10-17 | Kansas | H | TBD | TBD | yes |
| 10-24 | Arizona State | A | TBD | TBD | yes |
| 10-31 | Colorado | A | TBD | TBD | yes |
| 11-07 | Oklahoma State | H | TBD | TBD | yes |
| 11-14 | TCU | A | TBD | TBD | yes |
| 11-21 | Arizona | H | TBD | TBD | yes |
| 11-28 | Iowa State | A | TBD | TBD | yes |

- **Venue** — Bill Snyder Family Stadium, Manhattan; cap **50,000**; 39.20194 / -96.59389. **HIGH/H**. Logistics prose **MED/E** (REVELxp tailgate partner, lots open 5h pre-kick).
- **Theme games** — **NONE announced for 2026 (NF).** ⚠️ The extractor's structured output for this field was *corrupted* (empty array plus a malformed second array stuffed into the note claiming a "Senior Day"); treat as **no confirmed theme designations** as of mid-June. Recurring traditions (Fort Riley Day, Harley Day, Band Day) exist historically but aren't tied to 2026 games — **E**.
- **Rivalries** — Sunflower Showdown vs Kansas (Governor's Cup, 1902) **HIGH**; Farmageddon vs Iowa State (1917) **HIGH**; Colorado (1912) **MED**. Method **H** (Wikipedia/ESPN).
- **Colors** — #512888 / #FFFFFF. **HIGH/H**.
- **Source quality:** solid but a notch below Tennessee — official + Wikipedia good; less secondary editorial depth; the data artifact shows mid-tier extraction is more fragile.

## 1C. Notre Dame Fighting Irish (Independent)

**Schedule** — 12 games **HIGH/H** from fightingirish.com. The independent/NBC structure actually *helps*: ND home game times are announced early via the NBC package (reported, **MED**, unverified). Away games TBD.

| Date | Opp | H/A | Kickoff | TV | Note |
|---|---|---|---|---|---|
| 09-06 | Wisconsin | N | (7:30 ET) | (NBC/Peacock) | **Shamrock Series @ Lambeau** |
| 09-12 | Rice | H | (3:30) | (NBC) | |
| 09-19 | Michigan State | H | (7:30) | (NBC) | Megaphone Trophy |
| 09-26 | Purdue | A | TBD | TBD | Shillelagh Trophy |
| 10-03 | North Carolina | A | TBD | TBD | |
| 10-10 | Stanford | H | (3:30) | (NBC) | Legends Trophy |
| 10-17 | BYU | A | TBD | TBD | |
| 10-31 | Navy | N | (12:00) | (ABC/ESPN) | @ Gillette (neutral) ⚠️ unverified site |
| 11-07 | Miami | H | (7:30) | (NBC) | |
| 11-14 | Boston College | H | (3:30) | (NBC) | Frank Leahy Bowl |
| 11-21 | SMU | H | (7:30) | (NBC) | |
| 11-28 | Syracuse | A | TBD | TBD | |

*No conference-game column: ND is independent — this is itself a schema signal (the `conferenceGame` boolean is null/N-A for independents).*

- **Venue** — Notre Dame Stadium; cap **77,622**; 41.698357 / -86.234016. **HIGH/H**. Logistics (propane-only, RV $150-275, Game Day Express shuttle) **MED/E**.
- **Theme games** — **Shamrock Series vs Wisconsin @ Lambeau — HIGH/H** (a real, distinctive ND tradition: annual neutral-site game with special uniforms; logo released for 2026). "The Shirt" is a **pre-season apparel tradition, not a gameday theme (no-historical-only, MED)** — good example of the announced-vs-historical disambiguation the extractor must make.
- **Rivalries** — trophy-rich: Megaphone (Michigan State, 1949), Shillelagh (Purdue, 1957), Legends (Stanford, 1989), Rip Miller (Navy), Frank Leahy Bowl (Boston College). **HIGH/H** for the trophy facts. Several ND rivalries carry trophies — strong test of the rivalry/trophy model.
- **Colors** — #0C2340 / #C99700. **HIGH/H** (official onmessage.nd.edu brand).
- **Source quality:** deep (national brand); independent status means *no conference schedule page*, but the official site + NBC announcements more than compensate.

## 1D. Boise State Broncos (Pac-12 — **not** Mountain West for 2026)

**Schedule** — 11 confirmed + 1 flex finale, **HIGH/H** from broncosports.com + ESPN. Notably, **TV/times for most games are already published** (new-Pac-12 CW/USA/CBS deal announced 5/27) — the *most* complete kickoff/TV of the four. **Conference verified ✅: Boise joins the rebuilt Pac-12 on July 1, 2026.**

| Date | Opp | H/A | Kickoff | TV | Conf |
|---|---|---|---|---|---|
| 09-05 | Oregon | A | 3:30 | CBS | no |
| 09-12 | Memphis | H | 6:00 | USA | no |
| 09-19 | South Dakota | H | 10:00 | CBSSN | no |
| 09-26 | Western Michigan | A | TBD | TBD | no |
| 10-03 | Utah State | H | 5:30 | CBSSN | yes |
| 10-10 | Fresno State | A | 8:30 | The CW | yes (Milk Can) |
| 10-24 | Washington State | A | 4:00 | USA | yes |
| 10-31 | Texas State | H | 8:00 | The CW | no |
| 11-07 | Colorado State | A | 6:00 | USA | yes |
| 11-14 | Oregon State | H | 6:00 | USA | yes |
| 11-21 | San Diego State | H | 9:30 | USA | yes |
| 11-28 | TBA Pac-12 (flex) | A | TBD | TBD | yes |

*The flex finale (opponent decided ≤6 days out) is a Pac-12 structural quirk the schema must tolerate: a game with a known week/season but null opponent/venue until late.*

- **Venue** — Albertsons Stadium ("the blue turf"), Boise; cap **36,387**; 43.603 / -116.196. **HIGH/H**. Logistics **MED/E**.
- **Theme games** — **NONE for football (NF/LOW).** Only a *basketball* white-out surfaced — exactly the kind of false-positive the extractor must avoid promoting to a football theme. Method **E**.
- **Rivalries** — Milk Can vs Fresno State (1977) **HIGH**, *on the 2026 schedule*; Governor's Trophy vs Idaho (1971) **HIGH** but **NOT played in 2026** (dormant) — demonstrates rivalry ≠ game flag.
- **Colors** — #0033A0 / #D64309. **HIGH/H** (official boisestate.edu/brand).
- **Source quality:** schedule/venue/colors **excellent and current**; soft data (theme/tradition/fan depth) thin. The realignment made the *hard* data fresh, masking nothing on schedule — the thinness is editorial.

---

# PART 2 — Schema recommendation (CFB-native Firestore)

## Top-level entities (and why each)

| Entity | Top-level? | Justification |
|---|---|---|
| **`cfbSchool`** | ✅ collection | Stable identity (name, mascot, colors, current venue). But **conference must be season-scoped** (realignment) — store `conferenceBySeason` map, not a flat field. |
| **`cfbVenue`** | ✅ collection | Reused across co-tenant/neutral games; owns its own logistics (capacity, lat/lng, tailgating prose, gate rule). Mirrors the repo's existing `venues` pattern. |
| **`cfbGame`** | ✅ collection | The per-game schedule row. Highest volume; queried by week/date/school. (Superset of the repo `Game` type — see Adversarial #3.) |
| **`cfbRivalry`** | ✅ collection | **Relational — spans two schools.** Must not be a per-team field (see below). |
| **`cfbTradition`** | ✅ collection (or `cfbSchool/{id}/traditions` subcollection) | The durable, editorially-seeded narrative of a theme/tradition (e.g. "Checker Neyland": history, dress code, recurrence). Separated from the volatile per-season *designation*. |

**theme_game is deliberately NOT its own top-level collection.** A "theme game" is two things glued together: (a) a *recurring tradition* (durable, editorial) and (b) a *per-season designation* (which 2026 game it lands on — volatile, pipeline-attachable). Modeling it as one entity would force you to re-seed the whole narrative every year. Instead:
- `cfbTradition` holds the durable narrative (manual editorial).
- `cfbGame.themeDesignations[]` holds the lightweight per-season link `{traditionId, displayName, source, confidence, announcedAt}` the pipeline attaches when a school announces it.

## CFB fields with NO promo-schema equivalent (and why not to force them)

| CFB field | Why it has no promo home |
|---|---|
| `homeSchoolId` / `awaySchoolId` / `neutralSite` | Promos are single-team events; CFB games are two-sided with neutral-site cases (Shamrock Series, ND-Navy @ Gillette). |
| `conferenceGame` / `conferenceBySeason` | No conference concept in promos; and it's *season-versioned* due to realignment. |
| `rivalryId` + trophy/originYear | Promos have no relational, cross-team, multi-decade construct. |
| `themeDesignations[]` + `cfbTradition.dressCode/narrative/recurring` | `Promo.type:'theme'` is a stadium giveaway/event with `title/description`; it has **no dress code, no tradition narrative, no recurrence-instance, no rivalry linkage**. |
| `kickoff.windowFlex` / `tbd` + TV `confirmed` | Promos don't model "announced as a window, not a time" or rolling TV reveals. |
| venue `capacity`, tailgating/travel prose | The repo `Venue` has lat/lng/parking but **no `capacity`**; CFB needs it. |

## Rivalries (relational model)

A rivalry spans two schools and persists whether or not it's played in a given year (Boise-Idaho is dormant in 2026). Model it as its own collection, referenced by the games of *both* schools:

```
cfbRivalries/{rivalryId}
  name: "Sunflower Showdown"
  schoolIds: ["kansas-state", "kansas"]   // array → array-contains query "rivalries for school X"
  trophy: "Governor's Cup" | null
  originYear: 1902
  dormant: false
  narrative: "<editorial>"                 // manual seed
```
A `cfbGame` for that matchup carries `rivalryId: "<id>"`; both schools' game docs point to the same rivalry doc (no duplication, no per-team rivalry array that drifts).

## Proposed collection shapes (abbreviated)

```
cfbSchools/{schoolId}            // tennessee, kansas-state, notre-dame, boise-state
  name, shortName, mascot, primaryColor, secondaryColor
  conferenceBySeason: { "2026": "SEC" | "Independent" | "Pac-12" }
  venueId, traditionIds[]        // or traditions subcollection
  colorsSource, updatedAt

cfbVenues/{venueId}
  name, city, state, capacity, lat, lng
  homeSchoolId, sharedSchoolIds[]
  tailgating, parking, transit, gatesOpenRule   // prose, editorial/MED
  source, updatedAt

cfbGames/{gameId}                // e.g. 2026-w4-tennessee-texas
  season: 2026, week, date, status
  homeSchoolId, awaySchoolId, neutralSite, venueId
  kickoff: { time, tz, tbd, windowFlex }
  broadcast: { network, confirmed }
  conferenceGame: bool | null    // null for independents
  rivalryId?: ref
  themeDesignations?: [{ traditionId, displayName, source, confidence, announcedAt }]
  source, fetchedAt, verified: bool

cfbRivalries/{rivalryId}         // see above
cfbTraditions/{traditionId}      // schoolId, name, kind, dressCode?, narrative, recurring, editoriallySeeded, source
```

## Pipeline-populated vs editorial-seeded (honest split)

| Field group | Source | Who |
|---|---|---|
| Schedule core (date/opp/home-away/venue/week/conf) | official + Wikipedia + ESPN | **Pipeline (Haiku)** |
| Kickoff/TV when announced (+ `tbd`/`windowFlex`) | official + conference + TV-partner | **Pipeline**, rolling re-fetch |
| Venue capacity/lat-lng, school colors | Wikipedia / official brand | **Pipeline (Haiku)** |
| Rivalry name/trophy/originYear | Wikipedia | **Pipeline (Haiku/Sonnet)** |
| Rivalry narrative, venue tailgating/travel prose | fan/official prose | **Editorial (paraphrased)** |
| **Theme-game DESIGNATION (which game)** | official news, often summer/in-season | **Pipeline when announced**, else NF |
| **Theme-game / tradition NARRATIVE + dress code** | editorial knowledge, blogs | **Manual editorial seeding** ← be honest: this is real, recurring human work |

---

# PART 3 — Stream design

## Source list (priority order)

1. **Official athletics site** (`utsports.com`, `kstatesports.com`, `fightingirish.com`, `broncosports.com`) — schedule, game designations, official logistics. HIGH, structured, generally crawlable (check each robots.txt).
2. **Wikipedia** ("2026 \<School\> football team", stadium, rivalry pages) — schedule, venue, rivalry, colors. HIGH, structured, **CC-BY-SA (safe to reuse with attribution)** — the single most reproducible source across all 134 FBS.
3. **ESPN / Sports Reference (CFB)** — structured schedule/scores cross-check; good fallback when an official page is JS-rendered.
4. **Conference sites + TV-partner releases** (SEC/Big 12/Pac-12, NBC/CBS/ESPN/CW) — kickoff windows + TV, which roll out over the summer and ~12 days pre-game.
5. **Fan sites — RESEARCH LAYER ONLY** (SB Nation, 247Sports, On3, independent blogs, Reddit) — paraphrase-only, human-mediated, for theme/tradition/tailgating editorial seeding. See Part 4 for the permitted-use constraints.

## Power-4 vs Boise (G5) source quality

At the **hard-data layer there is no meaningful cliff** — official + Wikipedia + ESPN gave complete schedule/venue/colors for all four, and Boise's were the *freshest* (new-Pac-12 publicity). The divergence is entirely in the **soft layer**: theme/tradition documentation and fan-site depth thin out for the G5 program.

**Implication for the long tail (G5 / full 134 FBS):** the pipeline (hard data) scales cleanly — every FBS school has a Wikipedia season page, a stadium page, and an ESPN schedule. But the **editorial seeding cost per school is *higher* for G5, not lower**: fewer secondary outlets means less material to even paraphrase from, so a Boise-tier school needs more original first-party research per theme/tradition than a Tennessee. The 25-school wedge budget should not assume "less famous = less work" — it's inverted for soft data.

## Extraction-prompt differences vs the promo extractor

- **Two prompts, not one.** (a) A *schedule parser* — structured-table extraction, high precision, **Haiku**, outputs typed rows. (b) A *context extractor* — theme/tradition/rivalry, **Sonnet**, with mandatory `announcedFor2026 ∈ {yes, no-historical-only, NF}` disambiguation (the ND "The Shirt" and Boise basketball white-out are the trap cases).
- **Anti-hallucination hardening is first-class.** Future kickoff/TV/designations must **default to TBD/NF and never be invented**; `source` URL and `confidence` are required output fields. *This spike proved the need:* the extractor rated nearly everything HIGH, including unconfirmed times — an independent verify pass is mandatory, not optional.
- The promo extractor is item-centric ("what's being given away, when"); the CFB extractor is relationship-centric (two schools, rivalry linkage, season-scoped conference) and must reconcile a `tbd`/`windowFlex` kickoff state the promo schema never needs.

## Cron cadence

- **Offseason / structural:** weekly full-schedule refresh is plenty (schedules rarely change).
- **In-season near-term sweep:** 2–3×/week pass over the **next 2–3 weeks' games** to catch rolling kickoff-time/TV reveals (announced ~12 days out) and theme-game designations (drop in summer and in-season).
- **Event-driven:** re-fetch a school on official-site news (designation announcements). IndexNow on deploy (shared infra pattern).

---

# PART 4 — Fan-site source catalog

Permitted-use facts I fetched directly: **SB Nation/Vox** robots.txt (`rockytoptalk.com`) *allows GPTBot + Google but disallows ClaudeBot/CCBot* (`Disallow: /`, `/sp/` exception) — network-wide. **On3** robots blocks only xAI/Grok explicitly; public editorial falls under a permissive `*` rule, **but `/boards/` (the forums) are disallowed**. **247Sports/CBS** restricts user/account/API/JSON endpoints and paywalls premium ("VIP") content (per the Notre Dame catalog). **Reddit** refused automated fetch entirely (consistent with its well-known crawler lockdown).

> **Copyright constraint (applies to every row below):** this catalog rates *sources*, it does not extract their content. Any fan-site material that informs our pages must be **paraphrased and original — never reproduced**. Most useful content here is opinion/editorial prose under copyright; treat these as research inputs for human-written pages, not as scrape targets.

| School | Site | Platform | Theme | Trad. | Tailgate | Rivalry | Structure | Permitted use | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Tennessee** | Rocky Top Talk | SB Nation | MED | HIGH | MED | HIGH | prose | robots **blocks ClaudeBot** | RESEARCH_LAYER |
| | Rocky Top Insider | independent | MED | MED | LOW | MED | prose | check per-site | RESEARCH_LAYER |
| | VolReport/GoVols247 | 247Sports | HIGH (news) | LOW | NA | MED | structured+paywall | restricts API, paywalls | RESEARCH_LAYER |
| **Kansas State** | Bring On The Cats | SB Nation | MED | HIGH | MED | HIGH | prose | robots **blocks ClaudeBot** | RESEARCH_LAYER |
| | GoPowercat | 247Sports | MED | LOW | NA | MED | structured+paywall | restricts API, paywalls | RESEARCH_LAYER |
| | Jug of Snyder / K-StateFans | independent / forum | LOW | MED | MED | MED | prose / forum | check per-site; forums = ToS risk | RESEARCH_LAYER / SKIP (forum) |
| **Notre Dame** | One Foot Down | SB Nation | MED | HIGH | HIGH | MED | prose | robots **blocks ClaudeBot** | RESEARCH_LAYER |
| | Irish Illustrated | 247Sports | HIGH (news) | LOW | NA | MED | structured+paywall | restricts API/user, paywalls | RESEARCH_LAYER |
| | Irish Sports Daily | independent | MED | LOW | NA | LOW | structured | most permissive (Crawl-delay 5) | RESEARCH_LAYER |
| **Boise State** | OBNUG | SB Nation | MED | HIGH | MED | MED | prose | robots **blocks ClaudeBot** | RESEARCH_LAYER |
| | Bronco Nation News | 247Sports | MED | LOW | NA | LOW | structured+paywall | restricts API, paywalls | RESEARCH_LAYER |
| | broncofans.net | independent forum | LOW | MED | LOW | LOW | forum | ToS risk | SKIP |
| **All four** | r/Vols, r/KStateFootball, r/notredame, r/BroncoSports | Reddit | MED | MED | MED | MED | forum | **fetch blocked; ToS prohibits scraping** | SKIP (research-only, manual reading) |

**Cross-school summary**
- **Pipeline or research layer?** Overwhelmingly **research layer.** The factual/structured data fan sites carry (schedules, scores) we already get cleaner from official/Wikipedia/ESPN; what's *unique* to them — theme/tradition/tailgating/rivalry color — is prose that is variously robots-blocked (SB Nation for ClaudeBot, Reddit), paywalled (247Sports), or copyright-protected. None qualifies as a clean PIPELINE_SOURCE for our needs.
- **Does depth track fame?** **Yes.** Tennessee and Notre Dame have multi-outlet ecosystems (SB Nation + 247 + On3 + independents + active subreddits). Kansas State is solid mid-tier. **Boise State is the thinnest** — OBNUG is a genuinely good SB Nation blog, but it's effectively *the one* dedicated outlet; 247/On3 staff G5 lightly; the independent option is a small forum.
- **Implication for the 25-school wedge editorial workload:** theme games + traditions are **not pipeline-extractable** and the fan-site research layer that would speed editorial seeding is **thinner exactly where you'd most need it** (G5 / long tail). Budget for real, recurring human editorial work, front-loaded on traditions (durable) and refreshed in-season for designations — and expect **per-school soft-data cost to rise, not fall, as you move down the FBS fame curve.**

---

# Adversarial self-review

**(1) Challenge the HIGH confidence ratings — reproducible across 134 FBS, or only easy for famous programs?**
The extractor over-rated: it stamped **HIGH on nearly everything**, including unconfirmed kickoff times sourced to Wikipedia (Tennessee weeks 1–3) and a "Senior Day" it hallucinated into a corrupted Kansas State field. Re-rated honestly, HIGH is justified and **FBS-reproducible** only for the *hard tier*: schedule core fields, venue capacity/lat-lng, team colors, and **major** rivalry facts — every FBS school has a Wikipedia season page, stadium page, and ESPN schedule. HIGH is **not** reproducible for kickoff/TV this far out (correctly TBD), theme-game designations (sparse; only well-documented at famous programs), tailgating depth (prose, uneven), or **obscure rivalries** (a G5 trophy game has far thinner sourcing than Third Saturday in October). Net: the "easy HIGH" tier holds across 134 schools; the context tier degrades sharply with fame. My one verified HIGH that *held under challenge* (Tennessee/Texas noon) shows the rating can be right — but only an independent check, not the extractor's self-report, can tell which.

**(2) Challenge the schema — over-engineered entities, or under-modeled relationships?**
- *Over-engineering risk caught:* I declined to make `theme_game` a top-level entity; it's split into a durable `cfbTradition` (editorial) + a volatile `themeDesignations[]` on the game (pipeline). Making it a standalone collection would force annual re-seeding of narrative.
- *Under-modeling risk caught:* `cfbRivalry` is its own relational collection with `schoolIds[]`, **not** a per-team field — because Boise-Idaho proved a rivalry persists (and must be queryable) even when not played in a given year, and a per-team array would duplicate and drift.
- *Remaining judgment call:* `cfbTradition` as top-level vs a school subcollection is a toss-up; I'd start as a subcollection and promote only if cross-school tradition queries appear.

**(3) Is anything secretly the promo schema with renamed fields?**
The honest catch: **`cfbGame` is ~80% the repo's existing `Game` type** (`homeTeamSlug/awayTeamSlug`→`homeSchoolId/awaySchoolId`, `week`, `broadcast.network`, `timeTbd`, `venueName`, `season/seasonType`). It is **not** the *promo* schema — but it *is* Game-schema-with-CFB-additions, and pretending otherwise would be dishonest. Per the brief CFB stays a separate stream, so I keep `cfbGames` distinct, but flag that the team should consciously decide whether to *extend* `Game` rather than fork it. The truly novel, no-existing-equivalent entities are `cfbRivalry` and `cfbTradition`. **The one trap to avoid:** forcing CFB theme games into `Promo.type:'theme'`. They look similar (both "theme") but the promo type is a stadium giveaway/event with `title/description/highlight/recurring` and **zero** support for dress code, tradition narrative, recurrence-instance, or rivalry linkage — the mapping would silently discard everything CFB-native.

**(4) Did Boise State reveal a source-quality cliff the three Power-4 schools hid?**
**Not where expected.** At the hard-data layer Boise *out-performed* the P4 schools — its full TV/kickoff slate was already published (new-Pac-12 + CW/USA deal), versus Tennessee's still-flexed SEC windows. The cliff is real but lives in the **soft/editorial layer**: zero announced football theme games (only a basketball white-out, a false-positive trap), lighter tradition documentation, and a one-deep fan ecosystem (OBNUG). A second, subtler cliff: **realignment scrambles Boise's relational data** — its Idaho rivalry is dormant and its Fresno rivalry moved into the new conference — which is exactly why conference must be season-scoped and rivalries modeled independent of the schedule. So the naive expectation ("G5 = worse schedule data") was wrong; the correct finding is "G5 = comparable hard data, materially thinner soft data and more realignment churn."

---

## Appendix — data-quality issues found (for the eventual pipeline)

- **Confidence inflation:** extractor defaults to HIGH; needs a calibrated rubric + mandatory independent verify pass.
- **Corrupted structured output (Kansas State theme games):** empty array plus a malformed JSON string in the note field — schema validation + a single-shape output contract would prevent this.
- **Source/claim mismatch (Tennessee Texas time):** value correct (noon) but cited to a stale May designation, not the June 10 time release — the pipeline must store the *source that actually carries the value*, not a plausible-looking adjacent URL.
- **Stale framing input (Boise = "Mountain West"):** even the task brief was a realignment cycle behind — conference must be season-versioned and never trusted from a label.
- **Verification gap:** the independent verify pass was cut off by a session limit; re-running it (resume the `wpjowojau` workflow — extracts are cached) is the recommended next step before any of this data is trusted for production.

---

# Verification Pass Results

*Appended 2026-06-12. Method: resumed the cached `wpjowojau` workflow (`wf_911f411d-cff`) — extract stage returned from cache; the verify stage was rewritten to an adversarial, falsify-first, class-by-class check and ran live. Each verify agent re-fetched **independent** primary sources (home-school official sites, opponent athletics sites, Wikipedia, governor's office press releases — not the extractor's cited URLs). I also ran my own first-hand checks on the two sharpest targets. This pass is adversarial: a claim earned VERIFIED only when an independent fetch confirmed the value; kickoff/TV that couldn't be confirmed as officially announced was DOWNGRADED to TBD.*

## Tally

| School | Claims checked | VERIFIED | DOWNGRADED | FALSIFIED |
|---|---|---|---|---|
| Tennessee | 16 | 14 | 0 | 1 |
| Kansas State | 21 | 21* | 0 | 0 |
| Notre Dame | 28 | 22 | 5 | 1 |
| Boise State | 39 | 31 | 2 | 6 |
| **Total** | **104** | **88** | **7** | **8** |

\* includes a "Senior Day" the verifier VERIFIED as a theme game; I override that to **not-a-theme-game** (see self-check) — so K-State has **0 confirmed fan theme games**, as my own check found.

≈ **85% of claims survived independent check, ~15% failed (downgraded or false)** — and crucially, *the failures were rated HIGH by the extractor too.*

## What the pass caught (the failures that matter)

| Claim | Extractor rating | Independent finding | Verdict | Source(s) actually checked |
|---|---|---|---|---|
| **Boise kickoff times (6 games)** | HIGH | **Systematic +2h error**: Oregon 3:30→1:30, Memphis 6:00→4:00, S.Dakota 10:00→8:00, Colo St 6:00→4:00, Oregon St 6:00→4:00, SDSU 9:30→7:30 (all MT) | **FALSIFIED** | Wikipedia 2026 BSU + goducks/goyotes/csurams/osubeavers official sites |
| **ND North Carolina = conferenceGame** | HIGH | ND is **FBS Independent → zero conference games**; UNC falsely flagged | **FALSIFIED** | ESPN + Wikipedia 2026 ND |
| **ND week numbers (Miami/BC/SMU/Syracuse)** | HIGH | Off-by-one (10–13 should be 9–12); extractor double-counted the bye | **DOWNGRADED** | ESPN 2026 ND schedule |
| **TN-Vanderbilt "Dooley-Fulmer Trophy / Third Sat. in November"** | HIGH | **No such trophy exists**; rivalry is officially un-named/un-trophied; "Third Saturday" = the *Alabama* rivalry | **FALSIFIED** | Wikipedia TN-Vandy + Saturday Down South |
| **Milk Can `originYear` 1977** | HIGH | 1977 = series start; **trophy created 2005** | **DOWNGRADED** | Wikipedia BSU-Fresno rivalry |
| **Governor's Trophy `originYear` 1971** | HIGH | 1971 = series; **trophy created 2001** (dormant until 2031) | **DOWNGRADED** | gov.idaho.gov + Wikipedia |
| **K-State "Senior Day" as theme game** | (verifier-introduced) | Generic roster ceremony, not a fan theme; extractor's `themeGames` was correctly empty | **OVERRIDDEN → drop** | my own check + kstatesports |

## Survivors (high-trust, FBS-reproducible)

Schedule core (date/opponent/home-away/venue) — **VERIFIED across all 4 schools**. TV networks — reliable. Conference affiliation — all 4 verified (incl. Boise = Pac-12, ND = Independent). Colors, venue basics — verified. **Real theme games verified:** Tennessee's full slate (Checker Neyland/Texas + Salute to Service + Champions Weekend + Homecoming + Senior Day, all on the 247Sports designations article) and Notre Dame's Shamrock Series @ Lambeau; "The Shirt" correctly held as historical-apparel-only. Major rivalry names/trophies/pairings verified (Megaphone, Shillelagh, Legends, Frank Leahy Bowl, Sunflower Showdown/Governor's Cup, Farmageddon). Governor's Trophy dormant-in-2026 status verified (next meeting 2031).

## Per-class calibration

- **Schedule core:** reliable (1 ND conference-game falsification, 4 ND week downgrades — both *derived* fields, not source-copied facts).
- **Kickoff times:** **worst class.** Boise's were systematically 2h wrong and rated HIGH. Do not trust without re-fetch + explicit timezone handling.
- **TV networks:** reliable.
- **Theme games:** real ones verified; corrupted/none cases correctly resolved to none.
- **Rivalries:** names/pairings/trophies reliable; `originYear` is ambiguous (series vs trophy) → 2 downgrades + 1 outright fabrication.
- **Conference:** all verified.

## Calibrated verdict on extractor reliability (feeds the anti-hallucination spec)

**The extractor's HIGH rating carries almost no signal.** It was applied uniformly; ~85% of HIGH claims were correct, but the ~15% that were wrong were *also* HIGH — there is no internal way to tell them apart. Failure modes observed:
1. **Timezone conversion** (Boise +2h, systematic, 6 games) — the highest-volume error.
2. **Derived-field hallucination** — ND `conferenceGame=yes` on an independent; ND week off-by-one from a double-counted bye.
3. **Entity conflation** — rivalry series-start vs trophy-creation year.
4. **Outright fabrication** — the Dooley-Fulmer Trophy.
5. **Mis-citation** — correct value, wrong source (Tennessee week 1–3 times are real but were cited to Wikipedia, not the official 5/27 release that carries them).

**Pipeline requirements this implies:** (1) normalize + re-verify every kickoff time against the **home-school official site** with explicit tz, never accept ESPN-rendered times verbatim; (2) **hard-gate derived fields** — `conferenceGame` from a conference-membership table (not inference), `week` from date math (not source copy); (3) split rivalry origin into `seriesStartYear` + `trophyYear`; (4) treat the extractor's confidence as *unverified* until an independent second source confirms; (5) store the source that **actually carries** each value, audited.

## Do NOT trust for production without a human/second-source look

- **All Boise State kickoff times** (systematic +2h; re-pull from official school sites).
- **Notre Dame `conferenceGame` flags** (independent → force all to non-conference) and **week numbers** (recompute from dates).
- **Tennessee-Vanderbilt "Dooley-Fulmer Trophy"** — delete; fabricated.
- **All rivalry `originYear` values** — disambiguate series vs trophy.
- **Any kickoff time** the extractor rated HIGH without an independent official-source confirmation.
- **K-State "Senior Day"** — a generic designation, not a theme game; do not model as one.

## Adversarial self-check (independence)

Every VERIFIED verdict traces to an **independent fetch this run**, not the extractor's cache: the agents retrieved e.g. `goducks.com`, `goyotes.com`, `osubeavers.com`, `csurams.com`, `gov.idaho.gov`, `gillettestadium.com`, `riceowls.com`, plus Wikipedia season pages; I personally fetched the TN-Vandy trophy and K-State theme-game sources. None of the extractor's own cited URLs were used as the *sole* basis for any VERIFIED.

I also did **not** take my own verifier at face value in two places: (a) it VERIFIED a K-State "Senior Day" as a theme game — I overrode it to *drop*, because a senior-day roster ceremony is not a fan theme and the extractor's `themeGames` field was correctly empty; (b) Tennessee's week 1–3 kickoff times are genuinely announced (news corroboration), so they stay VERIFIED, but I flag that the extractor **mis-cited** them to Wikipedia rather than the official release — value right, provenance wrong. Both adjustments are reflected in the tally note above.
