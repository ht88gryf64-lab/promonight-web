# NHL League Build: Thread Handoff

**Created:** 2026-08-18
**Purpose:** carry state into a dedicated thread for the NHL scanner build. Read this first, then the companion docs. Nothing here is theoretical; every number came from a read-only probe run today.

---

## 1. Why NHL, why now

NHL is the next league build, ahead of the homepage redesign and ahead of NBA. Three independent reasons converged on the same answer today:

**The discovery window is open right now and it closes.** NHL clubs publish 2026-27 promo schedules mid-July through late August. A probe of 7 clubs today found 4 already live at their legacy URLs (Bruins, Sabres, Red Wings, Panthers), with the Red Wings flip tied to a July 27 on-sale. Last season's publication bracket ran Jul 2 to Sep 18. The scanner framework names schedule-publish as the highest-value scan window; missing it means re-discovering stale pages in December.

**NHL fills a real hole.** The corpus has a winter collapse:

| Month | Upcoming promos | Split |
|---|---|---|
| 2026-10 | 98 | MLS 72, NFL 26 |
| 2026-11 | 50 | NFL 26, MLS 24 |
| 2026-12 | 28 | NFL only |
| 2027-01 | 6 | NFL only |
| 2027-02 | 0 | none |
| 2027-03 | 0 | none |

Against today's 1,100+ upcoming, that is a ~40x collapse with two literally empty months. An NHL Oct-to-April corpus covers exactly that span.

**Search volume already pointed here.** NHL promo search volume substantially exceeds NBA (Penguins 500/mo vs Lakers 60/mo). NHL was already the identified post-football build priority; the winter data hole put a date on it.

**NBA sequences itself for free.** NBA publishes late September through late October. No probed club has a full 2026-27 schedule up, several legacy URLs are stale or 404, and most pages are JS shells. The strongest signal is the Pistons' Aug 13 release promising the complete promo schedule in "early October." A sweep before late September would mostly find shells. Do NHL first, NBA after its window opens. This is the same WNBA-then-MLS ordering that already worked.

---

## 2. Starting state, honestly

NHL sits one step before where every shipped league started:

- **No source map.** This is the first deliverable.
- **A legacy 32-entry team config from April**, unverified, never run. Treat it as a hypothesis to test, not a source of truth.
- **Registry stub is `wired: false`**, so the orchestrator refuses to run it.
- **No runner, no workflow, no calibrated patterns.**

In its favor:

- The v2 core in `lib/scanner/` is league-agnostic and reused unchanged (firecrawl-fetch, multi-url-fetch, scan-core#processTeam, promo-identity, verify-promo, promo-diff, collapse-recurring, promo-writer, recurring-writer, scanner-state, hold-summary).
- Scoring extends trivially. `HOME_GAMES` already carries NHL: 41, `scorePromo` is a pure function of doc fields, and hand-seeded promos provably score (the Fever promos are in the scored WNBA pool).
- nhl.com pages are mostly server-rendered, which should make this cleaner than MLS.

**Cost anchors from prior builds:** WNBA went sweep-commit to autonomous cron in ~9 days, MLS in ~16. NFL's 32-club discovery sweep cost 247 Firecrawl credits, so 32 NHL clubs should be order-of-250. NHL is the easier engine build of the two remaining leagues.

---

## 3. Companion docs to read

In `promo-pipeline`:

- **`docs/scanner-framework.md`** — the ground-truth reference. Section 14 is the quick-start checklist for a new league. Section 7 is the build sequence that worked. Section 6 is the safety properties and how to prove them on a new league.
- **`docs/mls-wnba-source-map.md`** — the shape the NHL source map should take, and the lessons from that sweep.
- **`docs/multi-league-scanner-architecture.md`** — the runner-extraction plan and per-league scheduling.
- **`docs/scoring-dedup-debt.md`** — filed debt in `backfill-scoring.js`. Do not consolidate it during this build.

---

## 4. Phase 0: the discovery sweep (start here)

Read-only across all 32 NHL clubs. No config changes, no Firestore writes, no cron changes, no runner build.

**Deliverable:** `docs/nhl-source-map.md`, in the same shape as the WNBA and MLS map. Per team: working promo URL, page shape, render-confirmed content with dated and promo-ref counts, config type, and any trap or note. Every team classified as usable, borderline, or genuinely-none, with a documented reason. No unexamined gaps.

**Method notes carried from prior sweeps:**

- **nhl.com soft-404s return HTTP 200.** Status codes cannot detect dead URLs. Confirm on content, not status. The Wild's URL is known to have moved.
- **Use a wide path vocabulary from the first pass.** The broad WNBA and MLS sweep used a finite guess list (`/themes`, `/promotions`) and under-found; a deep re-discovery later recovered two teams whose paths were not in the list. Do not repeat that.
- **Include `/schedule` annotation extraction in the first pass**, not as a follow-up. That pattern recovered Inter Miami as a sole source and upgraded Minnesota United.
- **Throttle concurrency for the Firecrawl tier.** Hobby is 5 concurrent; a wide fan-out 429-storms on free.

**Also report, since publication is in progress:**

- How many clubs have a 2026-27 schedule live today versus a stale prior-season page
- For clubs without one, any stated or evidenced timing
- Whether a re-sweep is needed and roughly when

---

## 5. Build sequence after the map

Follow `scanner-framework.md` section 14, adapted:

1. Write `team-configs/nhl.js` from the map. Explicit `promoUrls` per team, `active: false` plus a revisit note for no-source teams. No shared default URL.
2. Build `scan-nhl.js` reusing the shared `lib/scanner` core, modeled on `scan-mlb.js` or `scan-wnba.js`.
3. Calibrate the pattern sets from a sample of NHL pages: game-label denylist, edible-noun list, giveaway-item nouns.
4. Taxonomy sanity-check against `{giveaway, theme, food, kids}`. Apply the out-of-scope discipline in section 8 of the framework: specialty ticket packages, recognition nights, and presenting-sponsor tags are NOT promo-calendar content.
5. Dry-run validate all teams (coverage, sane diff, zero-extraction flags).
6. Single-team `--execute` watched, then full-league `--execute`, then a second dry-run to confirm hash-skip collapses volume.
7. Wire the revalidation hook and an NHL-scoped scheduled workflow, seasonally toggled.
8. **Append the scoring step.** This is new since the last league build: option C scoring rides the scan workflows. Add `node scripts/backfill-scoring.js --league=NHL --execute` after the scan step, plus the scored-surfaces revalidate step, matching what MLB, WNBA, and MLS already carry. NHL must also be flipped to `active: true` in `league-registry.json`, which is currently `false`.

---

## 6. Non-negotiables

From the framework and from house convention:

- **Do not act on information the run does not have.** Hash-skip, absent-streak, floor-guard, snapshot-first, tombstone-not-delete. Every guard is an application of this.
- **Dry-run default, `--execute` gated.** Never make the first live write a full-league run.
- **Branch-only**, `feature/*` off main, `--no-ff` merges, no force-push. The human authorizes every push to main.
- **Diagnose before fix.** Read-only audit precedes implementation at every phase gate. Stop and report before consequential changes.
- **Verify at write AND render.** Read-back from Firestore plus a cache-busting curl. Never `web_fetch` for verification; the CDN serves stale.
- **Adversarial self-review before consequential diffs.**
- **No hardcoded numbers** in DOM, schema, or FAQ. Every count derives from one source function.
- **No em dashes anywhere**, including code, comments, and commit messages.

---

## 7. Known traps specific to this build

- **Soft-404s at HTTP 200.** Stated above, worth repeating; it is the single most likely way this sweep produces a false map.
- **The legacy April config is unverified.** It has never run. Its URLs may be stale, and the NBA half of that same vintage is full of rotating season-stamped news URLs that the NFL map flagged as an anti-pattern.
- **Publication is mid-wave.** Some clubs will flip during the build. Plan a re-sweep of the not-yet-published set rather than treating a first-pass "none" as final. The Red Sox lesson cuts both ways: re-test borderline and none teams later.
- **Out-of-scope discipline.** If you find yourself mentally reframing content to make it fit a category, that is the signal it is out of scope.

---

## 8. Parked work, for context only

None of this belongs in the NHL thread. Listed so the new thread knows what exists and does not touch it.

- **Homepage redesign** (`promonight-web`, `feature/homepage-redesign`): ticket-stub card and both rails built, gated, preview-verified, rebased onto main. Nothing wired into the homepage. `docs/homepage-redesign-target.html` is the design reference. Parked deliberately; nothing rots.
- **`/best-promos` empty state**: the page renders "The 0 best-scored sports promo nights of 2026 are ranked below" and blames the visitor's filter when no filter can help. Goes live November 8 when MLS's last scored promo passes. Small branch, needs to ship before then, independent of NHL.
- **Contrast sweep**: filed list of token-on-self-tint failures across RedesignPromoRow, GameExpand, scored-promo-card, HubThisWeek, HubTodayPromos, world-cup rows, HeroTonightCard on dark, and team-card. Mechanical now that the ink lives in `CategoryMeta`.
- **`/about` rewrite**: currently reads as though the app is primary and the web is a funnel, which is backwards. Read-only audit prompt drafted, not yet run.
- **Font stretch decision**: `rd-display` and `rd-numerals` are live at natural width after the `--font-rd` fix. Activating the 125% expanded cut is a deferred visual call.

---

## 9. Open the new thread with

> This thread is dedicated to the NHL league build in `promo-pipeline`. Read the attached handoff for current state and sequencing, then read `docs/scanner-framework.md` section 14 and `docs/mls-wnba-source-map.md` before starting. Begin with the Phase 0 discovery sweep across all 32 clubs, read-only, producing `docs/nhl-source-map.md`. Stop and report with the map before writing any config.
