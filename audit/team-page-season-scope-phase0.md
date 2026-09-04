# Team page season-scope defect: Phase 0 audit

Read-only. 2026-09-04. No edits to src/. Worktree `/Users/mattkovalik/promonight-web-season-scope`,
branch `feature/team-page-season-scope` off `main` (9e8e53f). Zero subagents.

Evidence: full read of the team route and its ten helpers; a read-only Firestore census of all
169 teams and 5,056 dated promo rows; four cache-busting production curls; GSC and Ahrefs
through the Getpromonight project (id 9957864).

---

## 0. Execution shape and worktree state

`git worktree list` at start:

    /Users/mattkovalik/promonight-web           2fad473 [fix/conflict-row-pointer]   <- NHL venue session
    /Users/mattkovalik/promonight-web-faqfix    3f4f575 (detached HEAD)
    /Users/mattkovalik/promonight-web-fix       8c8d5e6 [fix/redaction-corpus-scope]
    /Users/mattkovalik/promonight-web-nhlhub    36329a4 [feature/nhl-hub-held]
    /Users/mattkovalik/promonight-web-spine     ff3e073 [feature/nhl-spine-ingest]
    /Users/mattkovalik/promonight-web-statrow   9e8e53f [main]
    /Users/mattkovalik/promonight-web-utah      7655e4e [audit/utah-mammoth]

The main checkout holds the NHL venue session on `fix/conflict-row-pointer` with 25 untracked
`audit/` and `outputs/` paths. Not touched, not stashed, no branch switch.

**File overlap with NHL venue work: NONE.** That branch changed exactly two files,
`src/lib/venue-claim.ts` and `src/lib/__tests__/venue-claim-provenance.test.ts`. Neither is in
this task's blast radius.

Fetch budget: 4 of 12 used. `tsc --noEmit` baseline in this worktree: clean.

---

## 1. Where every count is derived

One derivation, at `src/app/[sport]/[team]/page.tsx:299-303`:

    const { upcoming: upcomingPromos } = splitPromosByDate(promos);
    const upcomingCounts = countPromosByType(upcomingPromos);

`getTeamPromos` (`src/lib/data.ts:159`) reads the **entire** `teams/{id}/promos` subcollection
with no date filter. **Full-season data is already in memory at render time. The fix needs no new
query and costs zero additional Firestore reads.**

Every claim surface receives `upcomingPromos` / `upcomingCounts`:

| Surface | File | What it asserts | Scope actually used |
|---|---|---|---|
| Hero stat tiles | `redesign/StatScoreboard.tsx` | 4 category numbers | upcoming |
| Games tile | same | `gameContexts.length` | **full season, all 163 games** |
| Category chips | `redesign/SeasonExplorer.tsx:52` | per-type counts | upcoming |
| Promo patterns prose | `authority-stats.tsx:110-112` | "N events across 81 home games" | upcoming over season |
| Giveaway section | `team-content-sections.tsx:268,293` | "N giveaway nights scheduled for the 2026 season" | upcoming |
| Theme section | `team-content-sections.tsx:360` | "N theme nights ... during the 2026 season" | upcoming |
| Kids section | `team-content-sections.tsx:487,508` | "N kids and family events ... in 2026" | upcoming |
| Food section | `team-content-sections.tsx:427` | "N food deal events" | upcoming |
| FAQ answers | `promo-helpers.ts:374-432, 504` | counts inside "in the 2026 season" | upcoming |
| FAQPage schema | `json-ld.tsx:104` | same strings, machine readable | upcoming |
| Completed subline | `season-label.ts:98` via `promo-list.tsx:214` | "79 completed events this season" | past |

The hero already mixes scopes: **four upcoming-only promo tiles sit beside a full-season Games
tile reading 163.** That is the defect in miniature, inside one component.

### The standing ruling this contradicts

`src/lib/promo-helpers.ts:229-231` states the rule the current code enforces:

> a count that reaches DOM, schema, or FAQ text is a CLAIM, and a claim may only describe promos
> a visitor can still attend. All-time counts stay available, but only behind a label that says
> archive.

`src/app/[sport]/[team]/page.tsx:284-298` goes further and refuses to compute an all-time total
at all, calling a second variable at that level "how the original bug happened."

That ruling was a fix for a real bug: counts were all-time while the list filtered by date, so
137 of 144 populated pages advertised a number the list beneath contradicted. **The ruling is
half right.** Its true content is "the label must match the population." The current code
satisfies that for the hero and breaks it everywhere the word "season" appears. Reversing to
all-time counts under "coming up" phrasing would re-break it in the other direction. Any fix has
to move labels and populations together, and the gate should adopt that as the rule rather than
either extreme.

---

## 2. Defect 1: season vs upcoming scope. CONFIRMED.

Live `/mlb/los-angeles-dodgers`, cache-busting curl 2026-09-04:

    hero          6 Giveaways, 11 Theme Nights, 1 Food Deals, 1 Kids & Family, 163 Games
    promo list    19 upcoming events  /  "Show all 19 upcoming promos"
    archive       COMPLETED 2026 PROMOS, "79 completed events this season", "Show 76 more"
    prose         "The Los Angeles Dodgers have 11 theme nights scheduled at Dodger Stadium
                   during the 2026 season."
    FAQ + schema  "have 19 promotional events coming up in the 2026 season, including
                   6 giveaway nights, 11 theme nights, 1 food deal event, 1 kids/family event"

Firestore for the same team: **98 dated rows across 73 distinct dates, 19 upcoming, 79 past,
50 giveaway rows across 49 distinct giveaway dates.** The brief's "roughly 98 events" matches
exactly. The brief's "33 giveaway dates" does not match our own typing, which returns 49 to 50;
see section 8.

The FAQ sentence is not merely understated, it is self-contradicting: "19 promotional events
coming up in the 2026 season" reads as the season total to a crawler and a skimming human, and
ships that reading inside FAQPage structured data.

---

## 3. Defect 2: mixed-scope derived stats. CONFIRMED. Worst of the four.

`src/components/authority-stats.tsx:110-112`. The component is passed `upcomingPromos` as
`promos` (call sites: `RedesignTeamPage.tsx:339`, `page.tsx:472`) and multiplies it against a
hardcoded full-season denominator at `authority-stats.tsx:16-23`:

    const HOME_GAMES_BY_LEAGUE = { MLB: 81, NBA: 41, NFL: 9, NHL: 41, MLS: 17, WNBA: 20 };
    const ratio = (promos.length / homeGames).toFixed(1);                       // line 63
    const distinctPromoDates = new Set(promos.map(p => p.date)).size;           // line 67
    const pctHomeGames = Math.round((distinctPromoDates / homeGames) * 100);    // line 69-71

Live output today:

    "The Los Angeles Dodgers have 19 promotional events scheduled across 81 MLB home games
     in 2026, averaging 0.2 promos per home game. Roughly 15% of home dates at Dodger Stadium
     have at least one scheduled promotion."

Season-correct values from Firestore: 98 events, 73 distinct promo dates, 1.2 promos per home
game, 90% of home dates. Every number in that paragraph is wrong as written, and the sentence
explicitly says "in 2026" while counting only rows after 2026-09-04.

Two further consequences of the same call:

- `authority-stats.tsx:47` returns `null` when `promos.length < 15`. The block is disappearing
  from pages as their upcoming set decays. 59 of 169 pages have zero upcoming right now, and
  many more sit under 15.
- `period` at line 49 comes from `seasonSpan(promos.map(p => p.date))`, so the phrase narrows to
  the remaining window instead of the season the sentence claims.

---

## 4. Defect 3: meta description auto-generation. CONFIRMED. No exclusion list exists.

`src/app/[sport]/[team]/page.tsx:161-199`. Takes the next three chronological upcoming promos,
prefixed "Upcoming {team} promos:", or on the ten CTR-treatment teams a named next theme night
followed by "More upcoming promos:".

Live today: `"Next Los Angeles Dodgers theme night: Dodgers Date Night on Sep 4. More upcoming
promos: Sep 4 - Dodgers Date Night Hoodie."`

**There is no promo-type or title exclusion list anywhere in the repo.** The only adjacent
classifier is `isPurchaseGated` (`promo-helpers.ts:217`) matching `PURCHASE_GATED_RE`
(line 185-186). It does **not** catch "Early Entry", whose description reads "Early entry ticket
option allowing fans early access to the stadium" and matches none of the alternatives. Today
"Early Entry" renders with a "Theme Nights" badge.

Corpus size of the specific complaint: **"Early Entry" is 5 rows total, 4 of them upcoming, all
on the Dodgers.** Narrow in the corpus, landing on the highest-impression page on the site.

The broader class is larger. Screening every team's lead-three against `PURCHASE_GATED_RE` plus
an obvious non-promo prefix set flags **24 of 169 teams**, though many are genuine promos whose
copy merely mentions a ticket package (for example "Barbie Game Day Ticket Package",
"Theme Night Ticket: KPop Demon Hunters Night"). A useful exclusion list needs to be authored
deliberately, not derived from the existing gated regex.

---

## 5. Defect 4: away-game content ordering. CONFIRMED, with one correction to the brief.

`src/components/redesign/CalendarGrid.tsx:415-445`. Every game day inside a 30-day / 35-item
prerender window gets a `GameExpand` block server-rendered into the HTML, home and away
interleaved by date, with the **opponent's** promos on away rows.

**Correction: these blocks carry the HTML `hidden` attribute and are closed by default
(`selectedDate` starts null). A human visitor does not see them.** The brief's reading of them as
"the first large content block" holds for extracted text, reader mode, and crawler DOM, not for
the rendered page.

Measured on the live Dodgers HTML:

- 23 hidden day blocks server-rendered.
- Away-game content occupies visible-text lines 305 to 734 of 1090, ahead of "UPCOMING PROMOS"
  at line 735. Roughly half the extractable text precedes the team's own promo list.
- Named opponent promos in that region today: Marlins Hello Kitty Day, Marlins Japanese Heritage
  Celebration, Reds Thirsty Thursdays, Reds Bark in the Park, Giants Fiesta Gigantes.
- The Dodgers' own upcoming promos are rendered **twice**, once inside the day blocks and once in
  the promo list below.

What controls it: the `PRERENDER_WINDOW_DAYS = 30` / `PRERENDER_MAX = 35` constants at
`CalendarGrid.tsx:96-97`, and the fact that `gameCtxsByDate` is built from all `gameContexts`
without a home filter. `getGamesForTeam` (`data.ts:825-826`) short-circuits for every league but
MLB and NFL, so this defect exists on 62 pages only.

---

## 6. Census: how many pages are affected

Read-only Firestore sweep of all 169 team docs and their promo subcollections, 2026-09-04,
`tombstoned !== true`, dated rows only.

| League | Teams | Season rows | Upcoming | Past | Coverage | Pages with past>0 | Pages up=0 | Pages with 0 rows |
|---|---|---|---|---|---|---|---|---|
| MLB | 30 | 2,614 | 540 | 2,074 | **20.7%** | 30 | 0 | 0 |
| NHL | 32 | 1,301 | 739 | 562 | 56.8% | 31 | 9 | 1 |
| MLS | 30 | 433 | 187 | 246 | 43.2% | 29 | 2 | 1 |
| NBA | 30 | 330 | 0 | 330 | **0%** | 26 | 30 | 4 |
| WNBA | 15 | 237 | 38 | 199 | **16.0%** | 15 | 1 | 0 |
| NFL | 32 | 141 | 123 | 18 | 87.2% | 11 | 17 | 17 |
| **Total** | **169** | **5,056** | **1,627** | **3,429** | **32.2%** | **142** | **59** | **23** |

**142 of 169 team pages currently publish a count smaller than the season they name.**
23 pages have no promos at all and the fix is a no-op there.

Season phase as of today:

- **MLB**: late season, all rows in 2026 (Mar 25 to Sep 27). Worst affected league, and the one
  carrying the site's impressions.
- **WNBA**: late season, all 2026 (Apr 25 to Sep 24).
- **MLS**: mid to late season, runs to Nov 7.
- **NFL**: just started (Aug 13 to Jan 10, 2027), 87% coverage. **This league breaks in January**,
  exactly as the brief predicted.
- **NHL**: 2026-27 season ahead, but the archive holds the finished 2025-26 season.
- **NBA**: off-season with no 2026-27 schedule published. Zero upcoming across all 30 clubs.

### The finding that constrains the design: there is no season

`Promo` (`src/lib/types.ts:76-114`) carries **`date` and no season field.** A season cannot be
computed, only a calendar-year span of the rows in hand. And the corpora genuinely straddle
seasons:

| League | Rows by calendar year | Multi-year pages |
|---|---|---|
| MLB | 2026: 2,614 | 0 / 30 |
| WNBA | 2026: 237 | 0 / 15 |
| MLS | 2025: 13, 2026: 420 | 1 / 30 |
| NFL | 2026: 132, 2027: 9 | 6 / 32 |
| NBA | 2025: 122, 2026: 208 | 16 / 30 |
| NHL | 2025: 260, 2026: 662, 2027: 379 | **29 / 32** |

52 teams have multi-year archives. Four NBA pages (Hawks, Celtics, Trail Blazers, Kings) carry
**only 2025 rows** under a title that says 2026, and already render "COMPLETED 2025 PROMOS" on a
page titled "...2026".

So "season total" is well defined for MLB, WNBA and MLS and is **not well defined for NHL, NBA or
most of NFL**. On a Red Wings page, summing 30 completed 2025-26 rows with 85 upcoming 2026-27
rows produces a number that describes no season at all. A naive "lead with the season total"
would replace an understatement with a category error on 52 pages.

`src/lib/season-label.ts` already encodes the right discipline: `completedSubline` keeps the
phrase "this season" only for a single-year archive and drops it otherwise. Reuse that predicate
rather than inventing a season model.

---

## 7. Are completed events in the SSR HTML? Mostly NO.

The brief assumed they are. They are not, on the live light variant.

`src/components/redesign/LazyPromoRows.tsx:64` renders rows only when `open` is true. The comment
at lines 10-15 is explicit: the rows are passed as data and mounted client-side after the toggle,
deliberately, to keep MLB pages under Bing's 1 MB HTML ceiling. `promo-list.tsx:352-360` puts the
whole collapsed archive behind it.

What IS server-rendered: the count in the button label ("Show 76 more completed promos"), the
"79 completed events this season" subline, and at most three lifted completed bobblehead rows
(`promo-list.tsx:227-230`, `RESALE_LIFT_VISIBLE = 3`). The same lazy treatment applies to
upcoming promos beyond the first 10.

**This is therefore both a presentation fix and a page-weight decision, not a data fix.**

Measured on the live Dodgers HTML:

    total                          732,902 bytes  (0.70 MB)
    script / RSC flight            402,132 bytes  (55%)
    non-script DOM                 330,770 bytes
    per completed row              ~4,009 B DOM + ~2,469 B flight = ~6,478 B
    76 collapsed rows uncollapsed  ~492,000 B
    projected total                ~1,225,000 bytes = 1.17 MB

**Uncollapsing the full completed archive as proposed would push the Dodgers page over the 1 MB
ceiling the collapse exists to respect**, and the Twins (120 completed rows) would be far worse.
The proposal needs a bounded row count, not a full expansion. See section 10.

---

## 8. A risk the brief did not raise: our giveaway count is broader than the SERP's

Dodgers: 50 giveaway rows by `countPromosByType`, of which **7 are purchase-gated** by
`PURCHASE_GATED_RE` (for example "Dodgers Date Night Hoodie", "Korean Heritage Jersey",
"Nurses Night Jacket"). Corpus-wide, **268 of 1,631 giveaway rows (16.4%) are purchase-gated.**

Today this is invisible because the published number is 6. Leading with a season figure of 50
publishes a giveaway count materially higher than MLB.com or a Ticketmaster blog post would give
for the same club, on the exact query where we are trying to win the snippet. The repo already
holds the defensible predicate for the bobblehead case (`strictBobbleheadGiveaways`,
`promo-helpers.ts:194-214`, which excludes purchase-gated rows). The gate should decide whether a
headline season giveaway count uses the raw type or a purchase-gated-excluded count, because
switching to season totals is what makes this matter.

---

## 9. Blast radius on other surfaces

**JSON-LD (`json-ld.tsx`): affected, partly.**
- FAQPage answers carry the upcoming-only counts inside "in the 2026 season" phrasing. Same
  defect, machine readable. Must move with the visible FAQ (one generator, `generateTeamFAQs`).
- `Event` entities are upcoming-only and that is **correct**; emitting past events as
  schema.org Events would be a regression. Do not widen them.
- `WebPage` carries no counts.

**Aggregators: not affected.** `/promos/*` and `/best-promos` label their scope honestly
("No upcoming theme nights are currently tracked", and `/best-promos` has an explicit retro
capsule for a finished season). `/promos/bobbleheads` calls `splitPromosByDate` and labels both
halves.

**/team-rankings: not affected.** `app/team-rankings/page.tsx:96-100` uses
`getTopPromosPerTeam(todayYMD)` and presents itself as a live upcoming ranking.

**League hubs: separate surface, not in this task's scope.** See section 11.

---

## 10. Interactions to protect. Do not touch these.

1. **`hasNoUpcoming` is a layout gate, not a claim.** `RedesignTeamPage.tsx:118-122` derives it
   from `upcomingCounts` and it drives three things: the `ScheduleBlock` vs `SeasonExplorer` swap
   (`showSchedule`, line 123), the `DivisionRivals` mount at `order-[12]` vs `order-[41]`
   (lines 143-149), and the mobile order weave. **It must stay upcoming-derived.** If a
   season-scoped counts variable is introduced, feeding it to this gate would silently relocate
   the rivals grid on 59 pages and swap the calendar for the schedule block. This is the single
   most likely way to break the breakout-internal-linking work by accident.

2. **`hasNoPromosAtAll`** (line 122) already reads `promos.length`, the full array. Correct as is.

3. **Capture trigger**: `CaptureTriggerHost` takes `team` and `gameContexts` only, no counts.
   Untouched by any change here. `lib/capture/*` not in scope.

4. **Analytics**: `TeamPageTracker promoCount={promos.length}` (`RedesignTeamPage.tsx:181`) already
   sends the **all-time** count. It is inside the 2026-08-07T16:59:27Z instrumentation boundary.
   Do not change it, and note that the tracker and the visible hero have disagreed since that
   boundary was set.

5. **eBay resale lift** (`promo-list.tsx:227-230`) depends on the first three completed
   bobblehead rows being server-rendered. Any change to the completed section must preserve it.

---

## 11. Also investigated: is the hub outranking team pages?

**The premise does not survive first-party data.**

Ahrefs (2026-09-01, exact URL `getpromonight.com/mlb`) attributes 16 team-specific query families
to the hub, including "dodger promotions" (2,500/mo, pos 13), "dodgers giveaways 2026"
(2,400/mo, pos 19), "angels promotions" (900/mo, pos 11), "sf giants promotions" (700/mo, pos 9),
"white sox promotional schedule" (500/mo, pos 2) and "cleveland guardians giveaways" (250/mo,
pos 3).

GSC for the same site says otherwise. Over 2026-07-01 to 2026-08-25:

- `/mlb` took **250 impressions and 4 clicks in total**, 42 keywords, average position 10.9.
- "dodgers promotional schedule" resolved to **`/mlb/los-angeles-dodgers`**, not the hub:
  1,877 impressions, 8 clicks, 0.43% CTR, position 7.6.
- Every team-specific query in the top 30 by clicks resolved to a **team page**. No `/mlb` row
  appears.

Conclusion: Ahrefs' `best_position_url` attribution is not corroborated by Google's own data. The
hub is not cannibalising team pages in any volume that matters. **No hub work is warranted from
this finding.** The Dodgers cluster is served by the Dodgers page, which is exactly why the
snippet on that page is worth fixing.

### The evidence that does support the thesis

Site CTR-by-position baseline, GSC, same window:

    pos 3  15.25%     pos 5  7.09%     pos 7  3.14%
    pos 4  11.12%     pos 6  4.67%     pos 8  4.48%

Late-season MLB pages (16% to 29% of their season published) against that baseline:

| Query | Pos | Actual CTR | Baseline | Ratio |
|---|---|---|---|---|
| guardians promotional schedule | 3.23 | 1.67% | ~15.3% | **0.11x** |
| cleveland guardians promotional schedule | 3.33 | 1.76% | ~15.3% | 0.12x |
| orioles giveaways | 4.17 | 1.50% | ~11.1% | 0.13x |
| orioles giveaway schedule | 4.46 | 0.65% | ~11.1% | **0.06x** |
| white sox giveaways | 4.74 | 1.87% | ~9% | 0.21x |
| white sox promotional schedule | 5.25 | 0.58% | ~7.1% | 0.08x |
| dodgers promotional schedule | 7.61 | 0.43% | ~3.1% | 0.14x |

Full-season pages (NFL pre-season, WNBA) against the same baseline:

| Query | Pos | Actual CTR | Baseline | Ratio |
|---|---|---|---|---|
| rams giveaways 2026 | 3.06 | 27.64% | 15.25% | **1.81x** |
| rams promotions | 3.20 | 26.09% | ~15.3% | 1.71x |
| indiana fever promotional schedule | 2.04 | 48.00% | 45.6% | 1.05x |
| atlanta dream promotional schedule | 1.00 | 75.00% | 32.8% | 2.29x |
| ny giants promotional schedule 2026 | 2.38 | 38.46% | ~45.6% | 0.84x |
| rams promotional schedule 2026 | 1.89 | 34.38% | ~45.6% | 0.75x |

Pages showing most of their season hit or beat the site's own CTR curve. Pages showing 16% to 29%
of their season undershoot it by 5x to 17x.

**Confound, stated plainly:** the underperforming set is high-volume head terms with rich SERPs
(Ticketmaster blog, MLB.com, People Also Ask) and the overperforming set is low-volume,
near-navigational long tail, differing by one to two orders of magnitude in volume. CTR falls
with volume independently of content. The 5x to 17x gap is therefore an **upper bound** on what
content-match can recover, not a forecast. The direction is consistent across seven high-volume
queries and four clubs, which is what makes it worth acting on.

---

## 12. Recommendation on the open question

**Counts and schema move to the season. The default VIEW stays upcoming-first.**

They are not in tension. A fan arriving in September wants what is left; Google and a first-time
visitor want to know we have the whole season. Both are served by a page that **states the season
truthfully and orders the list by what is next.** The current page fails the first and does the
second, so only the statements need to move.

Concretely, for the gate to accept or amend:

1. **Lead with the season figure, keep upcoming as the second clause.** "98 promotions in the 2026
   season, 19 still to come" is true, is the answer to the head query, and is better than either
   number alone. The hero stat tiles become season counts; a subline carries the upcoming count.
   This also ends the hero's existing contradiction with the full-season Games tile.

2. **Derived stats computed season over season.** `AuthorityStats` takes the full array. Its
   `< 15` bail then stops eating the block as seasons progress.

3. **Say "season" only where the data supports it.** Reuse `seasonSpan`. Where the archive is
   single-year, "the 2026 season" is correct. Where it spans years (52 teams, 29 of 32 NHL clubs),
   state both numbers without the season noun, the way `completedSubline` already does. Do not
   invent a season model.

4. **Bounded uncollapse, not full.** Full expansion breaches the 1 MB ceiling (section 7). Raise
   the server-rendered completed count to a bounded N (12 to 15 looks affordable at roughly
   6.5 KB per row, about 78 to 98 KB against 267 KB of headroom on the worst page) and keep the
   remainder behind the expander with its count in the label. Measure per league before fixing N.

5. **Meta description: author an exclusion list.** `isPurchaseGated` does not do this job. A small
   explicit title/type exclusion set is the honest fix, and it must be a deliberate list, not the
   gated regex.

6. **Away-game ordering: move the team's own promos ahead of the calendar's hidden day blocks in
   DOM order**, or exclude away days from the SSR prerender window. Both are cheap. This is the
   only one of the four defects that also reduces page weight.

7. **Do not feed season counts to `hasNoUpcoming`.** Section 10.1.

---

## 13. Two scheduling constraints the brief did not account for

1. **A live A/B test covers the Dodgers.** `src/lib/title-treatment.ts` runs experiment
   `ctr-diagnostic-sep2026`, started 2026-09-03, **four-week read date 2026-10-01**. The ten
   treatment slugs include `los-angeles-dodgers`, `atlanta-braves`, `chicago-cubs`,
   `new-york-yankees`, `san-francisco-giants`, `houston-astros`, `los-angeles-angels`,
   `toronto-blue-jays`, `tampa-bay-rays`, `pittsburgh-pirates`. Shipping a content and snippet
   change to MLB team pages before 2026-10-01 **contaminates the read**, and the Dodgers page is
   both the flagship example in this brief and a treatment unit. Options for the gate: hold the
   MLB slice until 2026-10-01 and ship the other five leagues now; ship everything and accept the
   experiment is void; or ship to control teams only, which is worse than either.

2. **Raptive review is open as of Sept 2.** This change adds no pages, no routes and no thin
   content, and it makes existing pages more accurate and longer, which is the safe direction.
   The one item that could read as a mid-review structural change is the bounded uncollapse in
   recommendation 4, since it materially increases rendered content on 142 pages. Worth flagging
   as a deliberate accuracy fix in any Raptive correspondence rather than shipping it silently.

---

## 14. Proposed execution shape for the build phase

**Subagents: 0 for implementation.** This is roughly eight files behind one derivation change and
a copy pass. It is a for-loop, not a shard. Verification is a single script plus six sampled
curls, per the brief.

**Optional: 3 subagents for one adversarial review pass** before the consequential diff, on three
distinct lenses: (a) does any count still disagree with the rows beside it on a multi-year
archive, (b) does the diff move `hasNoUpcoming`, the rivals mount, the capture trigger or the
analytics payload, (c) page-weight regression per league against 1 MB. Cheap, and it targets the
three ways this change can go wrong silently. Requesting the gate's ruling rather than spawning.

---

## Stopping here

No files under `src/` modified. Awaiting the gate on section 12, and specifically on the MLB
timing question in section 13.1.

---

# Addendum, 2026-09-04: corrections and the build gate

Three adversarial reviewers ran against the build. Two of my Phase 0 numbers were
wrong and are corrected here rather than left in the record above.

## Correction 1: the per-row byte cost was overstated 1.93x

Phase 0 section 7 put a completed row at **6,478 B** (4,009 DOM + 2,469 flight).
Both halves were wrong.

React Flight **deduplicates**. A collapsed row is not serialized as an object
inside `LazyPromoRows`' props; it is a path pointer into `gameContexts`, which
already carries every promo:

```
"$4b:props:children:3:props:children:props:gameContexts:140:promos:0"
```

Measured on the served Dodgers payload (72 `self.__next_f.push` chunks,
345,489 B unescaped):

| item | measured |
|---|---|
| 76 collapsed rows, total | **5,264 B**, about 68 B each |
| one promo object, serialized once | 605 B |
| server-rendered row element, no resale slot | 389 B flight |
| DOM per completed row | ~3,030 B without the 862 B eBay CTA block |

**Marginal cost of moving one row from collapsed to server-rendered:
~3,030 B DOM + 389 B flight - 68 B reclaimed pointer = ~3,350 B.**

My 2,469 B flight figure would have made 79 rows 195 KB, more than half the
entire 345 KB flight payload. And my 4,009 B DOM figure was taken from lifted
resale rows, which carry a CTA block the eight new rows deliberately do not.

Consequence: my claim that expanding the Dodgers archive "projects to about
1.17 MB, over the ceiling" recomputes to **998 KB, just under**. The conclusion
survives on the Twins (1,221 KB) and Rangers (1,158 KB), but the Dodgers example
did not support it.

## Correction 2: the heaviest page is not the Twins

Phase 0 named `mlb/minnesota-twins` at 819,655 B as the ceiling case. A full
169-page sweep found:

| bytes | page |
|---|---|
| **846,229** | **mlb/texas-rangers** |
| 819,655 | mlb/minnesota-twins |
| 800,512 | mlb/miami-marlins |
| 787,316 | mlb/seattle-mariners |
| 772,271 | nhl/detroit-red-wings |

`mlb/texas-rangers` is the heaviest page on the site and was in neither my table
nor the code comment. 25 of the 26 heaviest pages are MLB.

## Correction 3: the ISR flip mechanism

Phase 0 and the first version of `MLB_SEASON_SCOPE_START` both said MLB pages
would pick the change up "on their next ISR revalidation within 24 hours, no
redeploy." Wrong twice: ISR regeneration is **request-triggered**, so a page
nobody visits never regenerates, and it is **stale-while-revalidate**, so the
first request after expiry still serves the old HTML. 24 hours is a floor, not a
ceiling, and the flip would be staggered and unbounded above.

Written up as a dated operational step in
`docs/runbook-2026-10-01-mlb-season-scope.md`.

## The change is net negative on page weight

Restricting the calendar's prerender window to home days removes far more than
the eight rows add. Measured hidden `GameExpand` blocks in served HTML:

| page | blocks | home bytes | away bytes removed |
|---|---|---|---|
| mlb/texas-rangers | 21 | 125,126 | **98,021** |
| mlb/minnesota-twins | 22 | 75,194 | **140,019** |
| mlb/los-angeles-dodgers | 22 | 81,919 | **112,493** |

Worst projected post-change page, `mlb/texas-rangers`:

| case | result |
|---|---|
| home dates in window, trim applies | ~776 KB, **74.0%** of 1 MiB |
| road-trip floor fires, zero calendar saving | ~879 KB, **83.9%** |
| on the actual Oct 1 flip day, window empty | **~600-650 KB** |

Nothing exceeds 1 MB in any case. Minimum headroom on the most pessimistic
assumption is about 16%.

## The Oct 1 finding that forced a design change

**All 30 MLB clubs carry zero promo rows dated on or after 2026-10-01.** The
latest row in the league is 2026-09-27; 15 clubs end there.

So MLB never renders the mid-season shape this change was designed around. On
the day the hold lifts, every MLB page is already season-complete. Under the
originally approved copy that would have published four zero tiles and "no
upcoming promos" on a cluster carrying roughly 26,000 monthly impressions, which
is worse than the understatement it replaced.

The claim now has three states:

| state | copy |
|---|---|
| a. in season, some left | `98 promotions in the 2026 season, 19 still to come` |
| b. nothing left | `98 promotions in the 2026 season` |
| c. no resolvable season | the upcoming-only fallback, unchanged |

State (b) carries **no forward clause**. "All completed" answers an availability
question nobody asked and turns a season record into a notice of emptiness.
Timing is not dropped, it moves to the row labels, which say it once next to the
things it describes. The promo-list heading becomes `2026 SEASON PROMOS` under
"The full season" instead of `UPCOMING PROMOS` over a line saying there are none.

What state (b) must never become is a claim that the record is complete. Zero
upcoming rows means our data holds nothing ahead. It does not mean the season is
over, and it does not mean we captured every event.

Verified by rendering the Dodgers page against live Firestore with the date
pinned to 2026-10-02:

```
HERO NOTE: "98 promotions in the 2026 season"
tiles: give=50 theme=38 food=3 kids=7   (unfixed code at that date: 0/0/0/0)
"7 of the 50 giveaways require a ticket package."
```

## Position: should state (b) surface the NEXT season?

**No, and the question is pointing at a different bug.**

MLB bobblehead calendars publish January to February, so a page will carry a
complete 2026 season plus a partial 2027 one. In that window
`resolveSeasonScope` sees `spansYears` and returns null, so **the feature
silently switches itself off** and the page reverts to the upcoming-only claim,
exactly when it is most valuable. That is the safe direction, absence over a
wrong total, but it is not a good resting state and nothing announces it.

So the work is not "add next season to state (b)". It is to make the resolver
able to pick ONE season when two are present. The minimal honest rule stays
data-derived rather than assumed: when the rows split into two calendar years
and every upcoming row sits in the later one, resolve to the later year, claim
that season, and leave the earlier year as the labelled archive. The split is
observed, not modelled, so it does not reintroduce the season model
`season-label.ts` refuses to build.

Do not build it yet. Build it from a January measurement of how many teams
actually land in that shape and how the rows divide, because if the two seasons
interleave rather than split cleanly the rule does not hold and the fallback is
still correct.

## Build gate status

- `tsc --noEmit` clean. **775 tests pass, 0 fail.**
- **No production build.** `npm run build` fails on this machine with 60s
  Firestore timeouts, and it is not this change: I built `main` in the same
  worktree and it failed identically, on `/mls/atlanta-united`, `/venues`,
  `/about` and `/llms.txt`, routes this branch does not touch.
- **No preview deploy.** The CLI deploy was refused with
  `readyStateReason: "The deployment was blocked because the commit author
  doesn't have permission to create deployments for this project"` and
  `seatBlock: {blockCode: TEAM_ACCESS_REQUIRED}`. Cause: `git user.email` is
  unset, so every commit in this repo, main included, is authored
  `mattkovalik@Matts-MacBook-Air.local`, which matches no Vercel seat. Not a
  pause, not a spend limit, not a billing failure: plan pro, status active,
  overdue null, team not blocked, and the only spend control on the account is
  `analyticsSpendLimitInDollars: 500`.
- Note for whenever a preview does deploy: the project has
  `ssoProtection: all_except_custom_domains`, so anonymous cache-busting curl
  against a preview will be walled, the same trap recorded in
  `audit/cfb-phase3-gate.md`.

---

# Gate verification, preview deploy 2026-09-04

Preview: `promonight-bmkb4jukb-btj8tk69dk-7318s-projects.vercel.app`
(`dpl_CCr86mMyHoyRjdx6DgXiDwwENo4N`, READY). Fetched with `vercel curl`, which
carries the protection bypass; the project has
`ssoProtection: all_except_custom_domains`, so anonymous curl is walled.

**This deploy is also the green production build.** Vercel built all 551 pages
successfully. The local `npm run build` failure is environmental and was proven
so by building `main` in the same worktree, which failed identically.

## The four claim states, at the render

| page | state | what it publishes |
|---|---|---|
| `nfl/seattle-seahawks` | season | tiles 1/12/0/2 + 17 Games; "15 promotions in the 2026 season, 13 still to come"; FAQ "promotional events in the 2026 season, including 1 giveaway night, 12 theme nights, 2 kids/family events" |
| `wnba/minnesota-lynx` | season | tiles 17/9/5/2 (was 3/1/1/0); "33 promotions in the 2026 season, 5 still to come"; "11 of the 17 giveaways require a ticket package" |
| `nhl/detroit-red-wings` | remaining | tiles unchanged 6/72/4; FAQ "promotional events still to come **between October 2026 and April 2027**", no season noun; archive "COMPLETED 2025 TO 2026 PROMOS", "30 completed events, October 2025 to April 2026" |
| `mlb/los-angeles-dodgers` | **held** | tiles 6/11/1/1 + 163 Games; "19 promotional events **coming up in the 2026 season**"; "79 completed events this season"; heading "UPCOMING PROMOS"; expander "Show 76 more completed promos" |

Every Dodgers string is what production serves today. MLB is unchanged.

## Page weight, corrected ~3,350 B/row

| league | page | before | after | delta | % of 1 MiB |
|---|---|---|---|---|---|
| MLB | texas-rangers (heaviest on site) | 846,229 | 836,588 | -9,641 | **79.8%** |
| MLB | los-angeles-dodgers | 733,752 | 723,736 | -10,016 | 69.0% |
| NHL | detroit-red-wings | 772,271 | 757,778 | -14,493 | 72.3% |
| MLS | san-diego-fc | 370,401 | 393,855 | **+23,454** | 37.6% |
| NFL | seattle-seahawks | 300,082 | 294,189 | -5,893 | 28.1% |
| WNBA | minnesota-lynx | - | 264,942 | - | 25.3% |
| NBA | new-york-knicks | 149,253 | 147,214 | -2,039 | 14.0% |

Nothing approaches 1 MB; the worst page sits at 79.8% and got lighter.
`mls/san-diego-fc` is the one that grew, and it is the expected shape: a
season-resolved page gaining 8 server-rendered completed rows. +23,454 B over 8
rows is ~2,930 B each, against the predicted ~3,350 B, the gap explained by the
absent eBay CTA blocks in this environment. **The old 6,478 B figure would have
predicted +51,824 B, more than double the truth.**

The MLB pages shrank despite being held. That is date and environment drift, not
a code change: production HTML was rendered up to a day earlier (one or two more
upcoming rows in the SSR set) and carries eBay CTA blocks this preview does not.
Byte identity across a day boundary is not a clean test; the string-level
comparison above is, and it passed.

## Rivals grid did not move

Every `order-*` slot compared production against preview:

```
MLB dodgers      order-[41] 2->2   order-[12] 0->0   "Around the division" 2->2
                 order-[10] 2->2   order-[11] 0->0   order-[42] 2->2   order-[43] 2->2
NHL red-wings    identical on all seven
```

## capture_prompt_shown still fires

Verified in the BUILT client bundle served by the team page
(`/_next/static/chunks/3894-ea39473352c3e5ab.js`), not only in source. The
capture engine's TriggerSignal list ships intact:

```js
u = ["away_game_expanded","game_tap","promo_card_tap"],
d = {away_game_expanded:3, promo_card_tap:2, game_tap:1},
c = {away_game_expanded:2, game_tap:4, promo_card_tap:3}
```

`capture_prompt_shown`, `away_game_expanded` and `game_tap` are all present, and
no prerender identifier appears anywhere near the handler, so the signal path is
independent of the prerender-window change.

The away-day trim behaves as intended on `nfl/seattle-seahawks`, where the
league gate is open:

| | production | preview |
|---|---|---|
| hidden day blocks | 5 | **3** |
| away detail headers ("At {venue}") | 2 | **0** |
| away hotel CTAs | 4 | **2** |
| **away calendar cells** | **2** | **2** |
| away legend swatch | 1 | 1 |

Away days keep their calendar cells and stay clickable; only their hidden SSR
detail was trimmed, and it lazy-mounts on click. The button-count delta
(57 to 56) reconciles exactly: minus 2 away-block share buttons, minus 1
expander that no longer renders because the archive is fully shown, plus 2 new
completed-row share buttons.

## Bounded completed rows

| page | SSR completed rows | expander |
|---|---|---|
| nfl/seattle-seahawks | 0 -> **2** | "Show 2 completed promos" -> none (no remainder) |
| wnba/minnesota-lynx | -> **8** | "Show 20 more completed promos" (8 + 20 = 28) |
| mlb/los-angeles-dodgers (held) | 3 -> **3** | "Show 76 more completed promos", unchanged |
| nhl/detroit-red-wings (remaining) | 1 -> **1** | "Show 29 more completed promos", unchanged |

The cap holds at 8, fallback and held pages are untouched, and no page renders
more than 11 server-rendered completed rows.
