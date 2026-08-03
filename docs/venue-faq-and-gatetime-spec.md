# Venue FAQ Fix + Gate Time Data: Build Spec

**Created:** 2026-07-31 · **Status:** Locked for build · **Repos:** `promonight-web`, `promo-pipeline`
**Purpose:** Carry state into a dedicated build thread. Read this first. Every number is from a live GSC, GA4, or PostHog pull.

---

## 1. Why this matters now

Two things are true at once. Venue pages are accumulating serious impression volume, and they convert at essentially zero. The one place they DO convert is the logistics long-tail, and the template that serves that long-tail currently states a falsehood.

**GSC, last 7 days (through 2026-07-29):**

| Venue page | Impressions | Clicks | Position |
|---|---|---|---|
| Dodger Stadium | 827 | **0** | 10.6 |
| Citizens Bank Park | 787 | **0** | 11.2 |
| Oracle Park | 624 | **0** | 10.4 |
| Fenway Park | 459 | **0** | 12.8 |
| Target Field | 440 | **0** | 10.7 |
| Comerica Park | 413 | **0** | 10.6 |
| Coors Field | 397 | **0** | 10.8 |
| Guaranteed Rate Field | 4,576 | 10 | 9.6 |
| Busch Stadium | 4,724 | 9 | 9.3 |

Venue pages total roughly **23,000 impressions and 36 clicks** for the week, about 4-5 percent of all site impressions at 0.16 percent CTR. They are now the single largest drag on blended site CTR.

**Diagnosis (settled, do not relitigate):** those impressions land on navigational stadium-name queries where position 10-13 is invisible under the maps pack, official team sites, and ticket carousels. That SERP is not winnable. Parking head terms are worse: owned end to end by booking aggregators including SpotHero, who is our own affiliate partner.

**What IS winnable, with live proof:**

- `can i bring food into truist park` — **position 1**
- `what time do gates open at citizens bank park` — position 7.8
- `coors field permitted items` — position 7.5

The logistics long-tail works. It is hundreds of small, seasonal, high-intent queries across every venue crossed with bag policy, gate times, permitted items, re-entry, and food. That is the entire venue thesis, and it depends on the FAQ block being correct and populated.

**GA4 corroboration (engagement rate, Jul 22-28):** venue pages split hard. Camden Yards 80 percent engaged, Stanford Stadium 80, Citizens Bank Park 75, PNC 75, Daikin 75, Truist 427s average session, Busch 656s. But **Target Field, Oracle Park, American Family Field, Great American Ball Park all show 0 percent engagement and 0.0s duration.** Four venues at literal zero is a pattern, not noise, and Target Field is the page carrying the template bug below.

---

## 2. Bug 1: the clear-bag FAQ template (CRITICAL, fix first)

### What is wrong

On `/venues/target-field` the FAQ answer opens:

> "Target Field requires a clear bag no larger than 16 x 16 x 8."

The page body two lines later correctly states that single-compartment bags up to 16x16x8 are permitted **including purses, tote bags, drawstring bags, and diaper bags**.

**Target Field does not require a clear bag.** Clear bags are one permitted option among many. The FAQ contradicts the body of the same page.

### Why it is the highest-priority item on this list

1. It sits inside **FAQPage schema**, which is the block most likely to be extracted into AI Overviews and featured snippets. The wrong claim is the one most likely to be surfaced and cited.
2. It is on the **single highest-value query cluster** in the venue thesis. Bag policy is roughly 130k monthly searches at KD 0-6.
3. It appears to be a hardcoded template string of the shape `"{venue} requires a clear bag no larger than {dims}"` prepended to the real policy text, so it likely **propagates across every non-clear-bag venue**: most MLB, MLS, and WNBA. NFL venues are genuinely clear-bag league-wide, so those may read correctly by coincidence, which is exactly why this went unnoticed.
4. It violates our own extraction discipline: asserting a policy no source states.

### Required fix

The FAQ answer must be generated from the actual policy data, not from a fixed string. Three cases minimum:

- **Clear bag required** (most NFL, some CFB): state the requirement and dimensions, plus the small-clutch exception where one exists.
- **Size limit only, bag type unrestricted** (Target Field and most MLB): state the size limit and explicitly name what IS permitted. Do not use the phrase "clear bag" as a requirement.
- **No published policy** (`null`): say the venue has not published a bag policy and link to the official source. Never infer.

### Scope of the audit

Phase 0 must determine how many venues are affected before any edit. Check every venue where the tenant or building doc indicates a non-clear-bag policy and confirm what the rendered FAQ actually says. Report the count and the list.

---

## 3. Bugs 2-4: smaller page defects (same file, fix together)

Found on `/venues/target-field`, verify whether each propagates.

**Duplicated gate sentence.** The "Getting In" section states gate times twice in slightly different wording, back to back. Looks like a `rule` field and a `summary` field both rendering. Pick one.

**Double periods.** `"Friday-Sunday games.."` appears three times. Trailing period in the Firestore data plus one appended by the template. Fix in the template, not by mutating stored data.

**og:url points to the homepage** rather than the venue URL. Canonical is correct so this is cosmetic, but it affects social sharing. Same class as the `/playoffs` and `/follow` openGraph bugs already logged in SITE-AUDIT section 6.

---

## 4. Gate time data: current state

### Already written, NOT merged

Branch `feature/venue-overlay-topup`, commit `fcd51f8`. Overlay-only, building facts untouched, read-back 8/8, building verified flags untouched. 8 of 14 gate-time gaps filled:

| Team | League | Gate time | Extras |
|---|---|---|---|
| new-england-revolution | MLS | 60 min | Season Member early entry |
| atlanta-united | MLS | 90 min | Supporters tailgate 4h |
| seattle-sounders | MLS | 60 min | - |
| chicago-fire | MLS | 90 min | $40 matchday parking, Gate 0 variance |
| charlotte-fc | MLS | early-entry | building still noindex until its top-up |
| minnesota-lynx | WNBA | 60 min | bag exception |
| toronto-tempo | WNBA | 75 min | - |
| chicago-sky | WNBA | 60 min | parking price, variance |

Each carries an affirmative-statement source URL, team-identity-checked, adversarially verified.

**The 8 gate times are in Firestore but NOT flushed to live pages.** No revalidation has run. Merging plus revalidate is what lights them up.

### The 6 not filled

- **NBA, all 3** (warriors, lakers, timberwolves): genuinely unpublished. nba.com/<team> states no door time, nor did the arena sites in the earlier lane. Revisit only if a better source appears.
- **WNBA valkyries, sparks**: likely genuine or thin. Valkyries are brand new, sparks swept thin with map=0.
- **MLS new-york-city-fc**: a **fixable miss**. nycfc.com's matchday hub only linked to entry-info and a-z sub-pages that were not scraped. A targeted sub-page re-sweep would likely find it, making it 9/14.

State recorded in `docs/venue-sweep-overlay-state.md`.

### Also queued, untouched

- Rename reconciliation: red-bull / exploria / lower-com confirm, plus chase-stadium Miami to Fort Lauderdale.
- Below-floor top-ups: saputo manual MLS source, bank-of-america parking and transit re-sweep.

---

## 5. CFB: the 61 held buildings

### Current coverage

222 canonical buildings, 255 tenant subdocs. MLB 30 swept / 29 verified. NFL 30 / 27. WNBA, MLS, NBA-shared 39 / 38 indexed. **CFB 86 swept / 21 verified, with 61 held.**

The 61 were held because 2026 Sidearm gameday guides had not published at sweep time.

### That premise now looks wrong

A direct check on 2026-07-31 found evergreen gameday hubs published and current across a sample:

- **Iowa** `hawkeyesports.com/footballgameday`: gates 90 min prior, premium 2 hours, 2026 season program referenced, cashless, parking page
- **Stanford**: gameday central, parking lots open 5 hours prior, bag drop, ADA shuttle
- **Virginia**: gates 90 min, clear bag with 4.5 x 6.5 clutch exception, screening locations
- **Alabama** (`uagameday.com`), **Clemson**, **Tennessee**, **LSU**, **Kentucky**, **NC State**: all carrying current bag and gate content

### The trap that caused the hold

These are not dated news articles. They are permanent URLs like `/footballgameday` that schools maintain year round and update in place. **Sidearm bakes the creation date into the path.** Confirmed example: UTRGV's gameday page sits at `/sports/2025/5/20/football-gameday.aspx`, a 2025 date in the URL, while the content references the 2026 season.

Any freshness rule keyed on URL date or article date will falsely reject a current page. That is almost certainly what held the 59 buildings sourced from pre-2026 Sidearm articles.

### Required change to the re-sweep

1. **Target the evergreen hub** (`/footballgameday`, `/football-gameday`, `/gameday`) rather than news articles.
2. **Replace the season-year freshness check with content-based verification.** Does the page reference the 2026 season, current gate rules, current policy. Never judge freshness by URL or article date.
3. **Split by field volatility.** Harvest now: bag policy, gate-time rules, prohibited items, re-entry, screening. Defer to a late-August top-up: per-game parking prices, tailgate maps, lot assignments. Texas explicitly states 2026 tailgating and parking info arrives later in summer.

**Caveat to carry:** the sample was roughly 8 schools, not 61. This is a strong signal to re-test, not proof that all 61 are ready. Expect partial recovery and accept it.

---

## 6. Extraction rules (locked, non-negotiable)

These are standing rules from the scanner framework. They apply to every field written by this build.

- **Boolean extraction: null by default.** Write `false` ONLY from an affirmative "not permitted" statement. Never from absence of a mention.
- **An exception to a policy proves the policy exists.** A stated clutch-size exception confirms a clear-bag requirement.
- **THE DISCRIMINATOR: a full-size non-clear alternative means `false`, a clutch-size exception means `true`.** These two both look like "a non-clear bag is allowed" and they point in opposite directions. Collapsing them is what produced the 45 wrong values. Compare the non-clear allowance to the clear one: comparable size means it is an alternative, so a clear bag is not required (`false`); substantially smaller, at clutch or small-item scale, means it is a carve-out that proves the requirement (`true`). Worked examples: `angel-stadium` is correctly `false`, because a non-clear 12" x 12" purse is permitted outright alongside a clear bag at 12.75" x 6.5" x 12.75". `bc-place` is correctly `true`, because the normal bag "must be made of clear plastic and smaller than 12"x12"x6"" and the only opaque allowance is "one small opaque bag ... no larger than 6.5"x 8.5"".
- **Advisory language is not a requirement.** A request is not a mandate. If the only thing the page actually requires is something else (search, screening, inspection) and the clear bag is phrased as a suggestion, the value is `null`, not `true`. A heading that reads "Clear Bag Policy" does not by itself establish a requirement; read the body. Worked example: `sac-ballpark`, whose policy body is "all bags be subject to search ... **Please place** all belongings in a clear plastic bag". The mandate is search. Corrected to `null` on 2026-07-31.
- **An event-level override is not the venue baseline.** Venues routinely tighten the bag policy for a single tour, promoter or game. Store and render the BASELINE; keep the override in `bagPolicyNotes` as an event-scoped caveat, never in `clearBagRequired`. The reason is structural: a venue page cannot know which event a reader is attending, so presenting an event-level rule as the venue policy tells most readers something false about the night they are actually going to, and it reads as authoritative while doing it. This directly constrains the Phase 1 FAQ generator: the clear-bag answer must come from the baseline boolean, and any event caveat belongs in prose, not in the assertion. Worked example: `state-farm-arena` is correctly `false`, because its baseline is "generally does not enforce a clear bag policy" with non-clear purses permitted to 14" x 14" x 6"; the clear-bag-only rule on its page applies only to three named July 2026 dates. Practical test: mandatory language scoped to a named event, tour, promoter or date range is an override; scoped to the venue or the season it is the baseline.
- **A size-only envelope is silence on clarity, not negation of it.** A permitted-bag envelope stated purely by size, with no clarity term anywhere on the page, says nothing about whether a clear bag is required. Write `null`, never `false`. This differs from the discriminator above, which needs a stated non-clear allowance to compare against; here there is nothing to compare. Practical test: search the page for "clear", "transparent", "see-through", "opaque", "non-clear"; no hit anywhere means `null`. Worked examples: `gainbridge-fieldhouse` (prohibits "Bags larger than 6"x10"x2"" and never uses the word clear) and `coca-cola-coliseum`, both corrected `false` to `null` on 2026-07-31.
- **A self-contradicting source establishes nothing.** If a page states a policy twice and the two statements disagree, neither reading is affirmatively established while the other stands. Do not pick the one you prefer. Write `null`, record both statements verbatim in the notes, and flag the building for a targeted re-read or a direct query to the venue. Worked example: `toyota-stadium`, whose "Approved bags include" list permits "Fanny Packs smaller than 14x16" with no clear qualifier (one line under a "Clear Cinch bag" that has one), pointing to `false`, while the summary line on the same page says "one large clear bag (14" x 14" x 6" ...) or one small clutch (5.5" x 8.5")", pointing to `true`. Held at `null` on 2026-07-31.
- **Conference-level policy cannot be inferred per school.** The SEC bag spec being standard does not license writing it to a school without that school's own affirmative statement.
- **Store the source URL that actually carries the value**, not a plausible adjacent page. Verify the citation, not just the value.
- **Independent verification before production display.** Extractor confidence carries no signal on its own.
- **No em dashes** anywhere: code, comments, copy, commit messages.

---

## 7. Build phases (gated, stop and report at each)

**Phase 0 — Read-only audit. No edits.**
Determine and report:
- Where the clear-bag FAQ string is generated, and how many venues render a false or contradictory bag claim. Produce the affected list.
- Whether the duplicated gate sentence, double periods, and og:url bug propagate beyond target-field.
- Whether the 4 zero-engagement venues (target-field, oracle-park, american-family-field, great-american-ball-park) share a rendering defect, since 0.0s sessions may indicate an error rather than disinterest.
- Current state of branch `feature/venue-overlay-topup` and whether it still merges cleanly.
Stop and report before any change.

**Phase 1 — FAQ template fix.**
Rewrite the bag-policy FAQ generation to derive from policy data across the three cases in section 2. Fix the duplicate gate sentence, double periods, and og:url in the same pass. Gate: preview deploy, spot-check one clear-bag venue (an NFL stadium), one size-limit-only venue (target-field), and one null-policy venue. Confirm FAQPage schema validates. Stop and report.

**Phase 2 — Merge the overlay top-up.**
Merge `feature/venue-overlay-topup` with `--no-ff`, push, revalidate the 8 affected venue pages, and confirm the "doors open" line renders live via cache-busting curl. Optionally run the nycfc sub-page re-sweep first to make it 9/14. Gate: read-back from Firestore AND live page verification for all 8. Stop and report.

**Phase 3 — CFB 61 re-sweep (stable fields only).**
Re-run the 61 held buildings against evergreen gameday hubs with content-based freshness verification. Harvest bag policy, gate rules, prohibited items, re-entry, screening. Leave parking price and tailgating null. Dry-run first, `--execute` gated. Gate: per-school coverage and verification report before any write. Stop and report.

**Phase 4 — Deferred top-up (late August).**
Parking prices, tailgate maps, lot assignments once schools publish. Plus the queued rename reconciliation and below-floor top-ups.

---

## 8. Verification requirements

- Read-back from Firestore after every write.
- **Cache-busting curl** against the live page. Never `web_fetch` for verification, CDN serves stale.
- IndexNow dual-endpoint submission (api.indexnow.org plus bing.com/indexnow) on every content change. Bing is where venue content converts best, so this is not optional.
- After any Vercel secret rotation, trigger an empty-commit redeploy to bind the new env var.

---

## 9. Timeline pressure

**August 10** is the working target for 118 football buildings live (86 CFB plus 32 NFL) to capture indexing lead time before the season. That is 10 days out.

CFB kicks off late August. NFL September 10. Football logistics demand is recurring and weekly rather than one annual spike: roughly 870 game-weeks of parking and bag-policy demand between late August and January across NFL and CFB.

Separately, the Raptive application window opens **2026-09-27** (domain registered 2026-03-27, six month minimum). Content quality is a stated review criterion and a large share of thin auto-generated pages is a known risk. Venue pages carrying correct, substantive logistics prose serves both the SEO thesis and that review.

---

## 10. Conventions (standing)

- Branch-only, `feature/*` off main, `--no-ff` merges, delete branch post-merge. No force-push.
- Claude Code is authorized to push feature branches and to merge and push to main.
- Dry-run default, `--execute` gated on anything destructive.
- One logical commit per area. Stop and report at every gate.
- `node --check` for syntax, `tsc --noEmit` for types. Never `node -e`.
- Adversarial self-review before each consequential diff.
- Floor-guard and snapshot-first discipline on any pipeline write.
- No em dashes anywhere.

---

## 11. Open questions for Matt

1. Should the nycfc sub-page re-sweep run before the overlay merge (making it 9/14), or merge the 8 now and pick up nycfc later? Recommendation: merge now, nycfc in Phase 3.
2. The venue page links "Official parking lot map" out to MLB.com, the competitor that owns the parking SERP, directly beside the SpotHero CTA. Keep or drop?
3. Confirm whether the 61 CFB buildings should write partial records (stable fields populated, parking null) or stay held until complete. Recommendation: write partial, indexing lead time is the binding constraint.

---

## 12. Open the build thread with

"This thread implements the PromoNight venue FAQ fix and gate-time data completion. Read `venue-faq-and-gatetime-spec.md` for full context, the data case, locked extraction rules, and phase gates. Start with Phase 0, the read-only audit. Stop and report before making any change."
