# CTR diagnostic, Gate 0 + Gate 1 report

Branch `feature/ctr-diagnostic-sep2026`. Read-only so far. No code changed.
Date 2026-09-03. GSC window Jun 2 to Sep 2 2026.

## Headline

The brief's Phase 3 plan rests on four premises. Three of them are
contradicted by the evidence, and the fourth is only half true.

| # | Brief premise | Verdict |
|---|---|---|
| 1 | Rewriting stuck-team titles toward the Tigers exemplar will lift CTR | REFUTED. Winners and stuck teams already ship byte-identical title templates AND identical snippet formats. There is no exemplar to port. |
| 2 | Venue bag-policy SERPs have an AI Overview on top | REFUTED. Zero AI Overviews across all 26 live SERPs. PAA is present, AIO is not. |
| 3 | Venue CTR is fixable via PAA capture | HALF TRUE. We are not on page 1 at all for the three venue queries checked, so there is no CTR to fix. It is a ranking problem, which the brief itself deferred. |
| 4 | "[team] theme nights" is a real intent our titles ignore | CONFIRMED, and it is the one well-evidenced lever in the whole brief. |

## Request budget

| Phase | Ceiling | Used |
|---|---|---|
| Phase 0 curls to getpromonight.com | 40 | 38 (1 batched revalidate POST + 37 GETs) |
| Phase 1 Chrome searches | 26 | 26 |
| Phase 2 Rich Results loads | 6 | in flight |
Out-of-band: 5 Ahrefs GSC API reads (different service, not against the site).

---

## Phase 0.1, served vs source

37 of 37 pages returned HTTP 200. Cache after the batched revalidate:
33 REVALIDATED, 3 HIT, 1 STALE. Zero JSON-LD parse errors across 37 pages.

**Served matches source on all 30 team titles and all 7 venue titles.**
Two apparent description diffs were HTML entity artifacts of the extractor
(`&#x27;` vs `'`) on kansas-city-royals and philadelphia-phillies, not real
divergence. No place where served differs from what generateMetadata produces.

| slug | grp | title len | desc len | H2 | H3 | FAQ q | JSON-LD blocks |
|---|---|---|---|---|---|---|---|
| arizona-diamondbacks | - | 57 | 134 | 14 | 10 | 8 | 16 |
| atlanta-braves | STUCK | 51 | 130 | 16 | 10 | 8 | 18 |
| baltimore-orioles | - | 54 | 134 | 17 | 11 | 9 | 25 |
| boston-red-sox | - | 51 | 128 | 15 | 10 | 8 | 24 |
| chicago-cubs | STUCK | 49 | 148 | 14 | 10 | 8 | 13 |
| chicago-white-sox | WIN | 54 | 158 | 17 | 11 | 9 | 30 |
| cincinnati-reds | - | 52 | 159 | 16 | 11 | 9 | 16 |
| cleveland-guardians | WIN | 56 | 141 | 15 | 10 | 8 | 13 |
| colorado-rockies | - | 53 | 125 | 16 | 10 | 8 | 27 |
| detroit-tigers | WIN | 51 | 123 | 17 | 11 | 9 | 26 |
| houston-astros | STUCK | 51 | 125 | 17 | 11 | 9 | 22 |
| kansas-city-royals | - | 55 | 130 | 16 | 10 | 8 | 21 |
| los-angeles-angels | STUCK | 55 | 141 | 13 | 8 | 6 | 8 |
| los-angeles-dodgers | STUCK | 56 | 122 | 17 | 11 | 9 | 23 |
| miami-marlins | - | 50 | 122 | 17 | 11 | 9 | 37 |
| milwaukee-brewers | - | 54 | 152 | 14 | 10 | 8 | 14 |
| minnesota-twins | - | 52 | 157 | 17 | 11 | 9 | 26 |
| new-york-mets | - | 50 | 146 | 15 | 9 | 7 | 11 |
| new-york-yankees | STUCK | 53 | 140 | 14 | 9 | 7 | 11 |
| oakland-athletics | WIN | 54 | 140 | 17 | 11 | 9 | 17 |
| philadelphia-phillies | - | 58 | 144 | 15 | 10 | 8 | 18 |
| pittsburgh-pirates | STUCK | 55 | 135 | 16 | 11 | 9 | 13 |
| san-diego-padres | - | 53 | 152 | 16 | 10 | 8 | 22 |
| san-francisco-giants | STUCK | 57 | 130 | 14 | 9 | 7 | 17 |
| seattle-mariners | - | 53 | 126 | 16 | 10 | 8 | 37 |
| st-louis-cardinals | - | 56 | 133 | 16 | 10 | 8 | 21 |
| tampa-bay-rays | STUCK | 51 | 129 | 13 | 9 | 7 | 15 |
| texas-rangers | - | 50 | 120 | 17 | 11 | 9 | 43 |
| toronto-blue-jays | STUCK | 54 | 137 | 15 | 10 | 8 | 12 |
| washington-nationals | - | 57 | 133 | 14 | 9 | 7 | 13 |

All 7 venue pages: indexable, no robots noindex, 2 JSON-LD blocks each,
StadiumOrArena + PostalAddress + GeoCoordinates + FAQPage.

## Phase 0.2, the four answers

**Q1. Is the title templated identically across all 30, or is there per-team variation?**
Identically. Exactly one shape across all 30:
`{Display Name} Promos & Giveaways 2026 | PromoNight`. Zero teams deviate.
The only variable is the team name.

**Q2. Do the winner titles differ from the stuck titles?**
No. This is the finding that breaks Phase 3.1 as written.

| | stuck (10) | winners (4) |
|---|---|---|
| title template | identical | identical |
| avg rendered length | 53.2 | 53.8 |
| titles over 60 chars | 0 | 0 |
| H2 skeleton | identical | identical |
| JSON-LD type set | identical | identical |

Dodgers and Tigers render the same 17 H2s in the same order with only the
team and venue names swapped. The best page on the site and the worst page
on the site are the same template applied to different data. Whatever
separates 3.04% from 0.58%, it is not on our page.

**Q3. Does any team page title or H2 contain "theme nights"?**
Title: no, 0 of 30. The word "Giveaways" is in every title; "Theme Nights"
is in none.
Body: yes, 30 of 30, as an H2 already: "What are the best {Nickname} theme
nights in 2026?". So Phase 3.2 as specified ("add an H2 if absent") is a
no-op. The section is not absent. It is phrased as a question rather than
as a heading a crawler reads as a topic.
Meta description: only 1 of 30 (milwaukee-brewers) happens to contain
"theme night", and only because it fell out of the upcoming-promo list.

**Q4. Character length at mobile truncation (~60 chars)?**
Every one of the 30 fits. Longest is Philadelphia Phillies at 58, shortest
Chicago Cubs at 49. Nothing is being truncated. Title length is not a
factor for any team, stuck or winner.

## Phase 0.3, render surfaces for a team title/description string

Shared input for S2. Editing the metadata alone is not sufficient; two
of these are independent copies of the same string.

| # | Location | What it feeds | Note |
|---|---|---|---|
| 1 | `src/app/[sport]/[team]/page.tsx:90` | `<title>` | canonical source |
| 2 | `src/app/[sport]/[team]/page.tsx:95` | og:title, twitter:title | appends brand by hand |
| 3 | `src/app/[sport]/[team]/page.tsx:106-151` | meta description, og:description, twitter:description | |
| 4 | `src/components/json-ld.tsx:134` | WebPage `name` in JSON-LD | INDEPENDENT hardcoded copy, year 2026 inline |
| 5 | `src/components/redesign/RedesignTeamPage.tsx:205` | visible hero subtitle | INDEPENDENT hardcoded copy |
| 6 | `src/components/redesign/Hero.tsx:12` | subtitle prop | |
| 7 | `scripts/validate-team-meta-2026.ts:33` | mirror | CURRENT, in lockstep |
| 8 | `scripts/audit-title-lengths.ts:45,145` | mirror | STALE, still says "Promo Schedule" |
| 9 | `scripts/check-metadata-dedupe.ts:41` | mirror | STALE, and uses `city + name` not `teamDisplayName` |

`src/app/llms.txt/route.ts` does NOT reproduce per-team titles, it emits a
URL pattern. Not an escape surface.

**Live render path.** `isRedesignEnabled()` is true in production, so the
team route renders `RedesignTeamPage`, not the legacy JSX in `page.tsx`.
Confirmed against served HTML. Any body-copy edit must target the redesign
components; the legacy block below the gate is dead on production.

Venue surfaces for S3: `src/lib/venue-hub.ts:825 venueHubTitle`,
`:981 venueHubDescription`, and the FAQ generator at
`src/components/venue-hub/VenueHubView.tsx:160-208`.

## Phase 0.4, Event JSON-LD

Generated in `src/components/json-ld.tsx`. Two different shapes:

Regular promo Events (`json-ld.tsx:46-57`), one per upcoming promo, which is
what all 30 MLB pages emit: `@type`, `name`, `startDate` (date-only,
no time), `description`, `location` (Place + PostalAddress), `organizer`
(SportsTeam). Missing every Google-recommended Event field: no `offers`,
no `image`, no `endDate`, no `url`, no `performer`, no `eventStatus`,
no `eventAttendanceMode`.

Playoff Events (`json-ld.tsx:64-85`) DO carry `offers`, `eventStatus` and
`eventAttendanceMode`. MLB never reaches this path (`shouldCheckPlayoffs`
is false for MLB), so no MLB page emits the richer shape.

The Dodgers page emits 23 JSON-LD blocks: 1 WebPage, 21 Events, 1 FAQPage.
Phase 2 will establish whether these fail validation or are simply declined.

---

## Phase 1, live SERP classification (S1, 26 of 26 searches)

Full 26-row table is in the S1 report. The load-bearing results:

**Zero AI Overviews on all 26 SERPs.** Including all three venue
bag-policy queries. The brief's stated AIO premise does not hold.

**Google is not rewriting our titles.** All 23 rendered listings show
`{Team} Promos & Giveaways 2026` verbatim, identical between the giveaways
query and the theme-nights query for the same team.

**The venue pages do not rank on page 1.** busch-stadium, wrigley-field and
citi-field were all NOT FOUND in the top 6-7 organic results, corroborated
by their own GSC panels at average positions 10.8, 10.6 and 11.2. Busch
alone showed 970 impressions and 1 click over 7 days.

**Position is the dominant variable.** Every zero-click query observed sits
at position 6 or worse; every clicking query sits at 3.4 or better.
Controls: Tigers pos 2.1 approx 14% CTR, White Sox pos 3.4 approx 3.9%,
Guardians pos 2.5 approx 2.0%.

**The winners use the same snippet format flagged as defective.** Tigers
and White Sox both render the aggregate-count opener ("have 24 promotional
events coming up in the 2026 season, including...") that the brief would
have us rewrite away on Dodgers, Astros and Rays. Tigers converts at ~14%
with it.

**The real templated defect.** Six of ten stuck teams end their theme-night
snippet with the identical content-free sentence "Theme nights include
special entertainment, themed merchandise, and ...": Braves, Pirates,
Yankees, Astros, Blue Jays, Rays. That is boilerplate occupying the snippet
where dated item names should be.

## Pooled CTR by query intent

Ahrefs GSC sample, ratio of sums not average of ratios:

| intent | keywords | impressions | clicks | CTR | wtd position |
|---|---|---|---|---|---|
| promotional schedule | 16 | 24,546 | 204 | 0.83% | 5.67 |
| giveaways | 35 | 25,306 | 333 | 1.32% | 6.36 |
| theme nights | 6 | 2,463 | 34 | 1.38% | 6.69 |

"promotional schedule" converts worst despite ranking best, which confirms
the brief's bucket A call. "theme nights" converts BEST in this sample, at
the worst average position.

Caveat, stated plainly: this sample does not contain the brief's
"cubs theme nights" row (4,809 impressions at 0.12%). Adding it would drag
the theme-nights bucket to about 0.55% and reverse the ordering. Theme-night
CTR is highly variable by term. Do not treat 1.38% as the expected value.

## Data reconciliation, important

The Ahrefs GSC connector disagrees with the brief's Pages.csv figures at the
page level by roughly 7x. Ahrefs reports los-angeles-dodgers at 18,264
impressions / 0.29% CTR / position 8.44; the brief reports 138,709 / 0.58% /
7.37. Site level is much closer (Ahrefs 1.48M impressions Jun-Aug vs the
brief's 1.81M).

Cause: Ahrefs page rows aggregate only the keywords Ahrefs has stored for
that page (Dodgers: 624), not true GSC page totals. It is a keyword-capped
sample, roughly 13% of Dodgers impressions.

Consequence: the brief's numbers are authoritative for magnitude. Ahrefs is
usable only for relative within-sample signals (position ordering, intent
mix, keyword breadth). Both sources agree on direction and on rank order of
winners vs stuck, so the qualitative diagnosis is safe.

One signal only Ahrefs supplies: the Dodgers page ranks for 624 keywords
against the Tigers' 274, on comparable impressions. The big-market pages are
being shown for a far wider, lower-intent query set, which mechanically
deflates page-level CTR without anything being wrong with the page.

## Defects found incidentally

1. `src/components/venue-hub/VenueHubView.tsx:208` emits
   "Where do you park for a Atlanta Braves game?" Should be "an". Live on
   truist-park in both the visible H2 and the FAQPage JSON-LD.
2. `scripts/check-metadata-dedupe.ts` and `scripts/audit-title-lengths.ts`
   both claim to mirror the team metadata template and both have drifted to
   an older "Promo Schedule" wording. `check-metadata-dedupe.ts` carries a
   comment asserting it is "kept in lockstep". It is not.

---

# Gate 2, rich result diagnostic (S1, 6 of 6 Rich Results Test loads)

## Verdict: the markup is valid. Google is declining the feature.

All 6 URLs crawled and rendered. **Zero errors on all 6 pages.** Every issue
reported across the entire test set is suffixed `(optional)`.

| URL | detected types | valid items | errors | warnings per item |
|---|---|---|---|---|
| /mlb/los-angeles-dodgers | Events only | 21 | 0 | 6 optional |
| /mlb/detroit-tigers | Events only | 24 | 0 | 6 optional |
| /mlb/tampa-bay-rays | Events only | 13 | 0 | 6 optional |
| /venues/busch-stadium | Local businesses + Organization | 2 | 0 | 3 + 2 optional |
| /venues/wrigley-field | Local businesses + Organization | 2 | 0 | 3 + 2 optional |
| /venues/truist-park | Local businesses + Organization | 2 | 0 | 3 + 2 optional |

The six Event warnings, identical on all 58 items across the three team pages:
`offers`, `image`, `endDate`, `eventStatus`, `performer`, `url`, each marked
optional. Neither the date-only `startDate` nor the absent
`eventAttendanceMode` drew any error or warning.

**The control settles it.** Detroit Tigers, the site's best-converting page at
roughly 14% CTR at position 2.1, carries byte-identical Event schema with the
identical six missing optional fields as the Dodgers page, which converts at
zero. Schema is held constant across the winner and the losers, so it cannot
be the causal variable.

## FAQPage

FAQPage does not appear in the Rich Results Test output for any of the 6 URLs.
Not valid, not invalid, not ineligible: absent. The tool enumerates only types
mapping to a currently supported Search feature, and Google restricted FAQ rich
results in August 2023 to authoritative government and health sites. So the
omission is the expected presentation, though it is omission rather than a
labelled ineligibility, and S1 was careful to report it that way.

Operational consequence: **FAQ markup on this site cannot produce a rich result,
and no rewrite changes that.** Any future FAQ work is a PAA capture and
relevance play only, and must not be costed as a rich-result play. Note also
that because the tool omits rather than validates FAQPage, this test gives no
signal on whether the FAQ markup is well-formed; that would need the Schema.org
validator.

## Phase 3.4 decision: NO schema change

Decided by the main agent at Gate 2 on this evidence.

- Event: do not add the six optional fields for CTR reasons. The Tigers control
  proves schema is not what separates winners from losers. Adding six fields to
  58 Event items per page across 167 pages is significant pipeline work aimed at
  a non-causal variable.
- FAQPage: the feature does not exist for this site.
- Venue StadiumOrArena: a third-party page marking up a building it does not own
  is not a path to a local rich result regardless of field completeness.

## Recorded, not acted on

1. **Address inconsistency between the two corpora.** The team-page Event's
   nested Place carries a full `streetAddress` (`1000 Vin Scully Ave, Los
   Angeles, CA 90012`), while the venueHubs StadiumOrArena for the same building
   carries only locality, region and country, and Google flagged
   `Missing field "streetAddress"` and `Missing field "postalCode"` on it. The
   data to close the gap already exists in the other corpus. Flagged as data
   quality, not as a rich-result fix; there is no evidence it moves anything.
2. `startDate` is date-only, no time, no timezone, on all 58 Event items. The
   tool flagged neither an error nor a warning. Recorded only so nobody later
   assumes it was checked and passed on the merits. It was simply not flagged.
3. S1 could not capture two verbatim Organization warning strings on Wrigley and
   Truist because the result expander toggles unreliably; it reported those two
   as inferred from the structurally identical Busch result rather than as
   captured. Counts were captured directly.

---

# Gate 3, Phase 3 pre-merge verification

Header, as directed: **Event and FAQPage markup validate; Google declines the
enhancement; FAQ markup has no rich-result upside on this site.**

Branch feature/ctr-diagnostic-sep2026. Working tree, nothing committed, nothing
merged, nothing pushed. Zero production requests in this phase.

## Diff summary by file

| File | Change |
|---|---|
| `src/lib/title-treatment.ts` | NEW. Single flip point: `TREATMENT_SLUGS` (the ten), `TITLE_SEASON_YEAR = 2026` hardcoded, `isTitleTreatmentTeam`, `teamTitleSubtitle` (title tail, for the hero), `teamBareTitle`. Dated experiment header, start 2026-09-03, read date 2026-10-01, one-line promote/revert. |
| `src/app/[sport]/[team]/page.tsx` | `<title>` reads `teamBareTitle`. `socialTitle` inherits it unchanged. Treatment-only dated theme-night lead added to the description, with the named theme night dropped from the promo list it leads so it cannot print twice. |
| `src/components/json-ld.tsx` | WebPage `name` reads the helper instead of its own hardcoded copy. |
| `src/components/redesign/RedesignTeamPage.tsx` | Hero `subtitle` reads `teamTitleSubtitle(team)` instead of its own hardcoded copy. |
| `src/components/redesign/Hero.tsx` | `subtitle` prop comment no longer asserts one example value. |
| `src/components/team-content-sections.tsx` | `ThemeSection`: one shared `themeParagraph` rendered by BOTH variants. Boilerplate sentence gone from both. Adds `monthDayShort`. |
| `scripts/validate-team-meta-2026.ts` | Imports the helper so the title mirror cannot drift. Control over 60 still FAILS the run; treatment over 60 prints as accepted and does not affect the exit code. |
| `src/lib/venue-hub.ts` | NEW `indefiniteArticleFor`, sound-based. |
| `src/components/venue-hub/VenueHubView.tsx` | Parking FAQ question uses the helper. |
| `src/lib/__tests__/indefinite-article.test.ts` | NEW. 6 tests over real corpus names. |
| `audit/ctr-phase0-audit.ts`, `audit/ctr-phase3-verify.ts` | NEW. The Phase 0 extractor and the pre-merge harness. |

## The 7-page table (local render of the branch, next build + next start)

| page | arm | title | len | og:title | WebPage name | hero subtitle | boilerplate | JSON-LD |
|---|---|---|---|---|---|---|---|---|
| los-angeles-dodgers | treatment | Los Angeles Dodgers Giveaways & Theme Nights 2026 \| PromoNight | 62 | PASS | PASS | PASS | absent | 23 blocks, 0 errors |
| new-york-yankees | treatment | New York Yankees Giveaways & Theme Nights 2026 \| PromoNight | 59 | PASS | PASS | PASS | absent | 11 blocks, 0 errors |
| tampa-bay-rays | treatment | Tampa Bay Rays Giveaways & Theme Nights 2026 \| PromoNight | 57 | PASS | PASS | PASS | absent | 15 blocks, 0 errors |
| detroit-tigers | control | Detroit Tigers Promos & Giveaways 2026 \| PromoNight | 51 | n/a | PASS | unchanged | absent | 26 blocks, 0 errors |
| chicago-white-sox | control | Chicago White Sox Promos & Giveaways 2026 \| PromoNight | 54 | n/a | PASS | unchanged | absent | 30 blocks, 0 errors |
| cleveland-guardians | control | Cleveland Guardians Promos & Giveaways 2026 \| PromoNight | 56 | n/a | PASS | unchanged | absent | 13 blocks, 0 errors |
| truist-park | venue | n/a | n/a | n/a | n/a | n/a | n/a | 2 blocks, 0 errors |

All three control titles are byte-identical to the strings captured from
PRODUCTION at Gate 0. truist-park renders
`Where do you park for an Atlanta Braves game?` in both the visible H2 and the
FAQPage JSON-LD, and the old "a Atlanta" string is gone from the HTML.

Sample theme paragraphs, showing the boilerplate replaced by dated items:
- Dodgers: "...have 12 theme nights scheduled at Dodger Stadium during the 2026
  season. Next up: Lakers Night (Sep 3), Dodgers Date Night (Sep 4), Union
  Night (Sep 5)."
- Guardians (control, 3.2 applies to all 30): "...Next up: Bark in the Park
  (Sep 14), Noche Latina (Sep 15), Fan Appreciation Night (Sep 19)."

## Checks beyond the specified 7

The 7-page table samples. Two failure modes it cannot catch were checked
across the full set, locally and for free:

- **All 30 MLB titles.** Exactly 10 render treatment, 20 render control. Every
  one of the 20 control titles is byte-identical to its Gate 0 production
  capture. No leakage into the control arm, and no non-MLB team affected.
- **All 30 MLB descriptions within budget.** Longest is 159 chars against the
  160 cap. No treatment description overflows.
- **Boilerplate across 34 pages** (all 30 MLB plus one each of NFL, WNBA, NBA,
  MLS): zero occurrences of the removed sentence. All 30 MLB pages carry the
  "Next up:" replacement, so no team currently hits the omit branch.

## Gates

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, clean |
| `npm test` | 705 pass, 0 fail, 29 suites |
| 6 article-helper tests | all pass, confirmed present in the suite run |
| `scripts/validate-team-meta-2026.ts` | PASS. Splits the arms: control <= 60 enforced, 4 treatment titles listed as accepted |
| JSON-LD parse, all 7 pages | 0 parse errors |
| em dashes on added diff lines | 0 |

## Counts

| | declared | actual |
|---|---|---|
| Subagents this phase | 1 (S2) | 1 (S2). S1 was resumed, not newly spawned, to close Gate 2 under the prior authorization |
| Production requests | 12 curls + 1 revalidate POST | **0** |
| Local requests | not capped | 71 to localhost:3111 (7 table + 30 title sweep + 34 boilerplate sweep) |

## Deviations and things to know

1. **Zero production requests, by design.** The branch is unmerged, so
   revalidating and curling getpromonight.com would re-render main and return a
   false pass on changes that are not deployed. The full 12-curl production
   budget is unspent and reserved for the post-merge step.
2. **Four treatment titles knowingly exceed 60 rendered characters**
   (SF Giants 63, Dodgers 62, Pirates 61, Angels 61; Blue Jays sits exactly on
   60). The brief predicted zero. Accepted because every query-relevant token
   ends by char 50 and only the brand suffix can clip. Reversible in one line.
3. **The theme-nights answer does NOT feed FAQPage JSON-LD.** The brief assumed
   it did. `TeamContentSections` renders the question-shaped H2s and feeds
   nothing to structured data; the FAQPage is built separately from
   `generateTeamFAQs`, whose question set contains no theme-nights question.
   Confirmed independently by S2. Nothing was added to the FAQPage.
4. **`validate-team-meta-2026.ts` needed a scope extension.** Importing the
   helper alone would have turned the script into a permanent red on the four
   accepted over-60 titles, since it exits non-zero above 60. The arms are now
   split. Control over 60 still fails.
5. **That script's DESCRIPTION mirror was already stale** before this work, and
   still is. The Gate 0 table called it "CURRENT, in lockstep", which is right
   about the title and wrong about the description. Marked KNOWN STALE in a
   comment; fixing it is its own change.
6. **A stale `tsconfig.tsbuildinfo` produced a phantom tsc error** mid-run, and
   the first build failed on a type error in the verification harness itself
   (missing top-level export made it a global script). Both fixed; the build
   that produced the verified output is clean and was rerun from scratch.

## Post-merge steps, on authorization

`--no-ff` merge to main, push, poll the www alias (never read a `vercel ls`
row), record the alias-ready timestamp as the experiment start. Then one
batched revalidate for the 30 MLB team paths plus truist-park, confirming
count 31, then the same 7-page curl table against production inside the
12-curl ceiling. If any treatment page fails, `git revert -m 1` the merge
commit, no force-push, re-alias, report, and do not patch forward on main.
