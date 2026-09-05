# NFL schedule-title test, baseline record

Experiment `nfl-schedule-title-sep2026`. Branch `seo/nfl-schedule-title-test`,
cut from main at d076c7d. Captured 2026-09-05, before anything shipped.
Read date 2026-09-20. Frozen numbers: `audit/nfl-title-test-baseline-2026-09-05.json`.

Flip point and revert switch: `src/lib/title-treatment.ts`, `NFL_SCHEDULE_TITLE_SLUGS`.
Emptying that set reverts all ten titles to control in one line.

---

## 1. What ships

Ten NFL team `<title>` strings, and the og:title / twitter:title mirror of each.
Nothing else on any page moves.

The brief's first-choice form was `{Team} 2026 Schedule, Promos & Giveaways | PromoNight`.
It was not shipped. It renders 60 to 66 characters and exceeds the 60-character
mobile SERP budget on 8 of the 10 pages. On a site where 153 titles are already
flagged too long and Google is rewriting 52 of them, a title Google rewrites
measures nothing, so an over-budget title would have made the read worthless
rather than merely untidy. The brief authorised a shorter form; this is it.

**Form chosen: `{Display Name} 2026 Schedule & Giveaways | PromoNight`.**
Range 52 to 58 characters. Zero over 60.

Why these tokens survived the cut, in priority order:

- **Schedule** is the whole hypothesis, and every one of the twenty pages carries
  a full 17-game regular-season schedule (verified against Firestore, below), so
  the word is a claim the page delivers.
- **2026** stays. It is not decoration: in the July keyword sample
  `rams giveaways 2026` drew 351 impressions against 40 for bare `rams giveaways`,
  a 9x difference. `src/lib/title-treatment.ts` already carries a standing note
  against dropping the year to buy length back.
- **Giveaways** is the incumbent ranking token, present in every current title.
- **Promos** is the one word dropped against control. The ` | PromoNight` brand
  suffix still carries that stem, so the treatment title is close to a pure
  *addition* of "Schedule" rather than a swap. This is the nearest thing to a
  confound in the form and it is small, but it is not zero: see section 6.

### The ten treatment titles

| slug | rendered title | len |
|---|---|---|
| chicago-bears | Chicago Bears 2026 Schedule & Giveaways \| PromoNight | 52 |
| detroit-lions | Detroit Lions 2026 Schedule & Giveaways \| PromoNight | 52 |
| dallas-cowboys | Dallas Cowboys 2026 Schedule & Giveaways \| PromoNight | 53 |
| new-york-giants | New York Giants 2026 Schedule & Giveaways \| PromoNight | 54 |
| baltimore-ravens | Baltimore Ravens 2026 Schedule & Giveaways \| PromoNight | 55 |
| kansas-city-chiefs | Kansas City Chiefs 2026 Schedule & Giveaways \| PromoNight | 57 |
| cincinnati-bengals | Cincinnati Bengals 2026 Schedule & Giveaways \| PromoNight | 57 |
| philadelphia-eagles | Philadelphia Eagles 2026 Schedule & Giveaways \| PromoNight | 58 |
| pittsburgh-steelers | Pittsburgh Steelers 2026 Schedule & Giveaways \| PromoNight | 58 |
| san-francisco-49ers | San Francisco 49ers 2026 Schedule & Giveaways \| PromoNight | 58 |

Headroom is two characters at the top end. A display-name correction in Firestore
could push a title over the budget silently, so the ceiling is asserted in
`src/lib/__tests__/nfl-title-arm.test.ts` rather than left to inspection.

### What deliberately did not move

The brief freezes schema, H1, page content and descriptions. Honouring that means
the `<title>` on these ten pages now deliberately disagrees with two other
surfaces:

| surface | reads | state on the ten treatment pages |
|---|---|---|
| JSON-LD `WebPage.name` | `teamBareTitle` (`json-ld.tsx:146`) | still `{Team} Promos & Giveaways 2026` |
| visible hero subtitle | `teamTitleSubtitle` (`RedesignTeamPage.tsx:243`) | still `Promos & Giveaways 2026` |
| meta description | gated on `isTitleTreatmentTeam` | unchanged, predicate deliberately not widened |

That divergence is the cost of "title only" and is recorded here so it is not
later mistaken for drift. It is low risk: `WebPage.name` is weakly consumed and
the subtitle is not a title surface. If the test is promoted, both should be
brought back into line in the same change.

The NFL arm is a **separate predicate** from the MLB one on purpose.
`isTitleTreatmentTeam` does not only pick a title, it also decides whether the
meta description grows a "Next {team} theme night" lead. Folding the NFL set into
it would have moved ten descriptions the brief freezes, on the exact surface the
read measures.

---

## 2. Page facts at baseline (verified against Firestore 2026-09-05)

All 20 pages carry a full 17-game regular-season schedule. The premise holds.

Promo counts are not balanced between the arms, and this matters for the read:

| | pages with 0 promos | total promos |
|---|---|---|
| treatment | 6 of 10 | 43 |
| control | 4 of 10 | 59 |

Zero-promo pages route to the zero-state fallback. On those six treatment pages
the new title is in fact *more* truthful than the one it replaces, because the
schedule is the only thing the page has.

---

## 3. GSC baseline, and what could not be captured

**The brief asked for GSC clicks, impressions, CTR and position per page for the
14 days prior (2026-08-22 to 2026-09-04). That data does not exist in any source
available here.** This is a limitation of the tooling, not an omission, and the
read on 2026-09-20 has to be planned around it.

Measured, by probing the Ahrefs GSC connector (project 9957864):

| query | freshest data |
|---|---|
| site-level `gsc-performance-history`, unfiltered | 2026-08-22 |
| the same call with any URL filter | 2026-07-15 |
| `gsc-page-history` for any page | 2026-07-15 |
| `gsc-keywords` filtered to `/nfl/` | July bucket only, empty for August |
| `gsc-pages` | ignores `date_to`, returns a whole-month bucket |

So the freshest per-page window the connector holds is **seven weeks stale**.

A second, independent problem: even for July the connector is a keyword-capped
sample rather than true page totals. `audit/ctr-diagnostic-gate0-gate1.md`
reconciled it against a real GSC Pages.csv during the MLB experiment and found it
roughly **7x low at page level**, about 13% of true impressions. Its own
conclusion was that Ahrefs is usable for relative within-sample signals only.

**What is needed before the 2026-09-20 read is worth running: a GSC Pages.csv
export for 2026-08-22 to 2026-09-04 filtered to these 20 URLs**, and a matching
export at the read. That is the same source the MLB experiment treated as
authoritative. Drop it beside this file and the JSON sibling gains a real
baseline block.

### What was captured (proxy only, July 2026 bucket, Ahrefs sample)

| slug | arm | impr | clicks | CTR% | pos |
|---|---|---|---|---|---|
| chicago-bears | T | 16 | 2 | 12.50 | 7.81 |
| dallas-cowboys | T | 1 | 0 | 0.00 | 3.00 |
| kansas-city-chiefs | T | 1 | 0 | 0.00 | 6.00 |
| philadelphia-eagles | T | 1 | 0 | 0.00 | 26.00 |
| pittsburgh-steelers | T | 1 | 0 | 0.00 | 30.00 |
| san-francisco-49ers | T | 74 | 5 | 6.76 | 5.86 |
| new-york-giants | T | 94 | 17 | 18.09 | 6.52 |
| cincinnati-bengals | T | absent from sample | | | |
| detroit-lions | T | 5 | 1 | 20.00 | 7.40 |
| baltimore-ravens | T | 4 | 0 | 0.00 | 9.25 |
| los-angeles-rams | C | 785 | 205 | 26.11 | 3.17 |
| los-angeles-chargers | C | 6 | 1 | 16.67 | 3.83 |
| atlanta-falcons | C | 4 | 0 | 0.00 | 8.00 |
| tampa-bay-buccaneers | C | 1 | 0 | 0.00 | 40.00 |
| buffalo-bills | C | 1 | 0 | 0.00 | 5.00 |
| denver-broncos | C | 2 | 0 | 0.00 | 5.50 |
| seattle-seahawks | C | absent from sample | | | |
| minnesota-vikings | C | 10 | 0 | 0.00 | 6.80 |
| new-york-jets | C | 7 | 0 | 0.00 | 27.71 |
| miami-dolphins | C | absent from sample | | | |

Arm totals in the sample: treatment 197 impressions / 25 clicks;
control 816 / 206. Three pages have no rows at all.

---

## 4. The finding that most affects how this should be read

The brief's target is bare schedule intent: `chiefs schedule` 1,050,000 (KD 13),
`bears schedule` 936,000 (KD 17), and so on. **Not one query of that shape appears
anywhere in the NFL sample.** Every NFL query these pages actually rank for
carries a promo or giveaway token:

| query | impr | CTR | pos |
|---|---|---|---|
| rams giveaways 2026 | 351 | 27.6% | 3.06 |
| rams promotional schedule 2026 | 160 | 34.4% | 1.89 |
| rams promotional schedule | 54 | 27.8% | 3.67 |
| ny giants promotional schedule 2026 | 26 | 38.5% | 2.38 |
| 49ers promotional schedule | 12 | 0% | 4.08 |
| chicago bears promotional schedule 2026 | 3 | 33.3% | 3.00 |

The repo has already ruled on this once, in the closest analogue it has.
`src/lib/cfb/metadata.ts:116-122` records that CFB schedule titles were
**inverted** after measurement: *"Schedule-intent queries are unwinnable, sitting
at position 34 to 56 against Google's own sports panel, so leading with 'Football
Schedule' spends the most valuable characters in the title on a term we cannot
rank for."* The brief cites CFB metadata v2 as precedent for adding "Schedule";
the fuller precedent is that CFB added it, measured it, and demoted it from the
lead while keeping the word.

Two things follow, and they point in opposite directions:

1. **The 1M-volume prize is very likely unavailable.** Google's own sports panel
   owns `[team] schedule` for NFL at least as firmly as for CFB. Do not expect the
   headline volume figures in the brief to convert into impressions here.
2. **There is a smaller real prize the brief did not name.** The pages already
   rank 1.9 to 7.3 for `[team] promotional schedule`, converting at 28 to 38%,
   and the current title contains no schedule token at all. Adding one is a
   plausible lift on a query family that is already working, and the same title
   change tests it.

The honest framing of this experiment is therefore: **it tests whether a schedule
token helps on the promo-schedule query family the pages already own, not whether
it wins the head term.** The head term is probably not winnable and the read
should not be scored against it.

---

## 5. The 2026-09-20 read

Compare arms, never weeks. NFL team pages went 79 to 177 pageviews in a week on
preseason alone and Week 1 opens 2026-09-10 inside the window, so any
week-over-week number will rise regardless of the title.

Procedure:

1. Export GSC Pages.csv for 2026-09-06 to 2026-09-19, filtered to the 20 URLs,
   plus the 2026-08-22 to 2026-09-04 baseline export if it was not captured
   earlier. Ahrefs will not have this data; use Search Console directly.
2. Compute **pooled CTR per arm as a ratio of sums**, clicks divided by
   impressions across the arm, not the mean of per-page CTRs. This is the house
   method (`audit/ctr-diagnostic-gate0-gate1.md`, "ratio of sums not average of
   ratios") and it matters here because per-page CTRs range from 0% to 26%.
3. Compute the same pooled CTR **excluding los-angeles-rams**, and report both.
   See the confounder below; the un-excluded number is close to meaningless.
4. Difference-in-differences: `(T_after - T_before) - (C_after - C_before)`, on
   pooled CTR and on impressions, with mean position reported alongside so a CTR
   move driven purely by a ranking move is visible rather than hidden.
5. Report per-page deltas too. With n=10 the pooled figure can be one page.

Decision rule, from the brief: expand if treatment CTR or impressions move
materially against control; revert the ten titles if not.

---

## 6. Confounders, ranked

1. **los-angeles-rams is 96% of the control arm's sampled impressions**
   (785 of 816) and converts at 26%. Excluding it, the entire control arm is 1
   click on 31 impressions in a month. Any pooled arm-level comparison is close
   to a Rams-versus-everything comparison. **Severity: critical.** Mitigation:
   always report the read both with and without the Rams, and treat the ex-Rams
   number as primary.
2. **Statistical power.** Ten pages against ten, over roughly 15 days, on a base
   this thin. Grossing the July sample up by the documented 7x gives the treatment
   arm on the order of 1,500 true impressions a month, and the window is half a
   month. A CTR difference would have to be very large, well into double-digit
   relative terms, before it outran noise. **This read will produce a directional
   signal, not a significant result, and should be reported in those words.**
3. **Recrawl lag.** Google has to recrawl and re-render before the new title is
   ever shown. IndexNow is submitted for the ten URLs at ship, but part of the
   15-day window will still have the old title live in the SERP. The measured
   effect is diluted by an unknown fraction toward zero, so a null is weaker
   evidence against the hypothesis than a positive is for it.
4. **Arm composition.** The treatment arm holds the bigger national brands
   (Cowboys, Chiefs, Eagles, 49ers) and so has a wider, lower-intent query set.
   The MLB Gate 0 report measured exactly this effect: big-market pages rank for
   far more keywords on comparable impressions, which mechanically deflates
   page-level CTR without anything being wrong with the page.
5. **Promo-count imbalance**, 6 zero-promo pages in treatment against 4 in
   control. Zero-promo pages have a different on-page offer and a different
   snippet.
6. **Week 1 opens 2026-09-10**, inside the window. It lifts both arms, which is
   why the read is a difference of differences and not a level.
7. **Title truncation is not the same for all ten.** Google truncates by pixel
   width, not characters. The three 58-character titles are the ones at risk.
8. **Form confound.** Treatment adds "Schedule" and drops the standalone word
   "Promos". A move cannot be attributed to "Schedule" alone with certainty,
   though the brand suffix retains the stem, so the effect of the drop is
   expected to be small.

---

## 7. Revert

One line: empty `NFL_SCHEDULE_TITLE_SLUGS` in `src/lib/title-treatment.ts`.
`teamMetaTitle` then delegates every team to `teamBareTitle` and all ten titles
return to control byte-for-byte. Then revalidate the ten paths and resubmit them
to IndexNow. `src/lib/__tests__/nfl-title-arm.test.ts` will fail on the treatment
rows after a revert, which is correct: delete that file's treatment table in the
same commit that ends the experiment.
