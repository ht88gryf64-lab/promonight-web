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

## 3. The baseline of record

**Status: PENDING. The merge is held until this exists.**

The baseline of record is a Google Search Console Pages export for
**2026-08-22 to 2026-09-04**, the 14 days before the change, covering the 20
test URLs. It is not optional and it is not substitutable. Without it the
2026-09-20 read has nothing to compare against and the experiment produces a
number nobody can defend.

Three sources were checked and none of them can supply it:

| source | why not |
|---|---|
| Ahrefs GSC connector | Holds no URL-attributed data after 2026-07-15. `gsc-page-history`, `gsc-keywords` and `gsc-pages` all return empty for any window starting later; `gsc-pages` additionally ignores `date_to` and returns a whole-month bucket. Unfiltered site-level history runs to 2026-08-22, but that is one number for the property, not per page. |
| Ahrefs, even inside its window | A keyword-capped sample, not true page totals. `audit/ctr-diagnostic-gate0-gate1.md` reconciled it against a real Pages.csv during the MLB experiment and measured it roughly **7x low at page level**, about 13% of true impressions. Its own conclusion was that Ahrefs is good for relative within-sample signals only. |
| Windsor.ai | Only a GA4 connector is attached to this account (property 534233585, PromoNight-Web). GA4 carries sessions and pageviews. It has no impressions, no CTR and no position, so it cannot answer this question at all. |

So the export is manual. It is a one-time cost and it is the same source the MLB
`ctr-diagnostic-sep2026` experiment treated as authoritative.

### TWO exports, not one

Both are blocking. The Pages export answers the decision rule; the Queries export
is the only thing that isolates the family the test is actually about (section 4).
A Pages-only baseline aggregates every query on the URL, so the promo-schedule
signal would arrive diluted by head terms the experiment does not claim to win.

In Search Console, Performance > Search results, set the range to
2026-08-22 to 2026-09-04, then:

1. **Pages tab, export.** The file wanted has the page URL in its first column:
   `Pages.csv` inside the zip, column header `Top pages`.
2. **Add a filter of Page contains `/nfl/`, then Queries tab, export.** Column
   header `Top queries`. The page filter is not cosmetic: without it, "giants"
   also matches the MLB San Francisco Giants, who are a ctr-diagnostic treatment
   club, and the attribution silently crosses experiments.

The filter also keeps the export under the UI's 1,000-row cap. Above that cap
low-click test URLs fall off the bottom of the table and would be recorded as
having no impressions.

### How it lands in the repo

    R="node --require ./scripts/stub-server-only.cjs --import tsx scripts/nfl-title-baseline.ts"

    $R --window baseline --tab pages   --csv ~/Downloads/Pages.csv   --export-date <today>
    $R --window baseline --tab queries --csv ~/Downloads/Queries.csv --export-date <today>

Those are dry runs. Adding `--execute` to each writes the raw CSV into `audit/`
as the artifact of record and fills in the per-page blocks in
`audit/nfl-title-test-baseline-2026-09-05.json`. When both have landed,
`baselineOfRecord.status` flips from `pending` to `captured`. **That field, not
the presence of a file, is the merge gate.**

`--export-date` is what lets the script check reporting lag. Search Console data
for the most recent days is incomplete, so an export taken within 3 days of the
window closing undercounts the window tail, which biases every later delta
downward: the direction that reads as "the title did nothing". The stamp records
it either way.

### Windows move if the merge slips

The windows are derived, never hardcoded: baseline is `[ship - 14, ship - 1]` and
read is `[ship + 1, ship + 14]`, from a `shipDate` recorded in the JSON. If the
merge happens on a day other than 2026-09-05, pass `--ship-date` once and every
window follows. The script refuses to build a window containing the ship date at
all, which is the house rule the sibling experiment already wrote down: a
straddling window mixes both titles in the treatment arm and is invalid.

### What the ingest refuses

Exercised against synthetic exports in the real Search Console shapes:

| case | behaviour |
|---|---|
| the wrong tab | refuses, and names which `--tab` to use instead |
| an unrelated property, or fewer than 10 of 20 URLs matched | refuses to write at all; `--force` required |
| apex-host or domain-property URLs | normalised and matched |
| a bare CTR column such as `0.5` | ignored; CTR is derived from clicks and impressions, so half a percent cannot become fifty |
| an export at the 1,000-row cap | flagged suspect, with the filter fix named |
| a URL with a query string, a fragment, or a trailing slash | normalised and matched |

A refusal matters more than it sounds: the merge gate is satisfied by this
artifact existing, so a degenerate export must never be allowed to become it.

**A page absent from the export means it had no impressions in the window.** That
is a real reading, and it is recorded as absent rather than coerced to zero so
the read cannot divide by it. Three of the twenty were absent even from the far
larger July Ahrefs sample, so expect some absences here too.

### The proxy that is NOT the baseline

The July 2026 Ahrefs figures were captured before any of this was known and are
kept in the JSON per page under `ahrefsJuly2026`, and at the top level under
`priorSampleNotTheBaseline` (renamed from `baselineSource`, because that key name
was itself a claim and the wrong one). They are seven weeks
stale and roughly 7x low. **Do not score the read against them.** They are
retained for one purpose: they are what established that
`los-angeles-rams` dominates the control arm, and that the head-term hypothesis
had no support.

---

## 4. Score against the promo-schedule family, not the head terms

The brief originally framed this around bare schedule intent: `chiefs schedule`
1,050,000 (KD 13), `bears schedule` 936,000 (KD 17), and so on. **That is not the
hypothesis being tested and the read must not be scored against it.**

Two independent reasons, one measured here and one already measured in this repo.

**Not one query of that shape appears anywhere in the NFL sample.** Every NFL
query in it carries a promo or giveaway token. Stated precisely, because section 3
rules out treating this sample as reality: the head terms are absent from a
keyword-capped sample that holds roughly 13% of true impressions, so this is
strong evidence they are not a meaningful source of impressions on these pages,
and it is not proof of zero. The baseline Queries export will settle it, which is
part of why that export is blocking.

**The repo has already ruled on this.** `src/lib/cfb/metadata.ts:116-122` records
that CFB titles were *inverted* after measurement: *"Schedule-intent queries are
unwinnable, sitting at position 34 to 56 against Google's own sports panel, so
leading with 'Football Schedule' spends the most valuable characters in the title
on a term we cannot rank for."* CFB added "Schedule", measured it, and demoted it
from the lead while keeping the word. Google's sports panel owns NFL schedule
intent at least as firmly as it owns CFB's.

### The actual target

The prize is the promo-schedule family, where these pages already rank well and
the current title contains **no schedule token at all**:

| query | impr | CTR | pos |
|---|---|---|---|
| rams promotional schedule 2026 | 160 | 34.4% | 1.89 |
| ny giants promotional schedule 2026 | 26 | 38.5% | 2.38 |
| rams promotional schedule | 54 | 27.8% | 3.67 |
| new york giants promotional schedule | 6 | 33.3% | 4.50 |
| chicago bears promotional schedule 2026 | 3 | 33.3% | 3.00 |
| 49ers promotional schedule | 12 | 0% | 4.08 |
| chicago bears promotional schedule | 7 | 0% | 5.86 |
| rams giveaway schedule | 20 | 15.0% | 4.40 |
| 49ers giveaway schedule | 5 | 0% | 6.20 |

Positions 1.9 to 6.2, converting at up to 38%, on a title that never says
"schedule". That is the gap this test closes. It is a much smaller prize than the
brief's headline volumes, and it is a real one.

**The question the 2026-09-20 read answers is therefore:** did adding a schedule
token to the title improve clicks, impressions or CTR on the query family these
pages already own? Not: did we capture `chiefs schedule`. A null on the head
terms is the expected result and is not evidence against the change.

Where possible, pull the Queries export alongside the Pages export at the read
and look at the promo-schedule rows specifically. The Pages export answers the
decision rule; the Queries export is what explains it.

---

## 5. The 2026-09-20 read

Compare arms **per page, never pooled.** NFL team pages went 79 to 177 pageviews
in a week on preseason alone and Week 1 opened 2026-09-10 inside the window, so
any week-over-week number will rise regardless of the title.

**Do not compute a pooled treatment-versus-control CTR.** In the July sample
`los-angeles-rams` was 785 of the control arm's 816 impressions and converted at
26%. Excluding it, the entire control arm was 1 click on 31 impressions. A pooled
arm ratio is that one page against noise, and it would move on Rams seasonality
alone. Rams gets its own line and is read as its own line.

Procedure:

1. Export **both tabs again** for the read window, the same way and with the same
   `Page contains /nfl/` filter on the Queries tab. The read window is
   `[ship + 1, ship + 14]`, which is 2026-09-06 to 2026-09-19 for a 2026-09-05
   ship and moves with `--ship-date` if the merge slipped.
2. **Export on 2026-09-23 or later, not on the 20th.** Search Console data for
   the most recent days is incomplete. Exporting a window the day after it closes
   undercounts its tail and biases every click and impression delta downward,
   which is exactly the direction that reads as a null. Pass `--export-date` so
   the lag is checked and recorded rather than assumed.
3. Ingest both:

       R="node --require ./scripts/stub-server-only.cjs --import tsx scripts/nfl-title-baseline.ts"

       $R --window read --tab pages   --csv ~/Downloads/Pages-sept.csv   --export-date <today> --execute
       $R --window read --tab queries --csv ~/Downloads/Queries-sept.csv --export-date <today> --execute

   With both windows present each prints its per-page delta table. A page absent
   in either window prints as not comparable rather than as a delta against an
   assumed zero.
4. **The promo-schedule family table is the one the decision rule is scored on.**
   The Pages table is context: it shows what happened to the URL overall, across
   every query including the head terms the test does not claim. Read the family
   table first and the pages table second.
5. Read the ten treatment rows against the ten control rows **as two sets of ten
   numbers**, not as two averages. What counts is whether the treatment rows move
   together and the control rows do not. One page carrying the whole difference
   is not a signal, it is a page.
6. Report mean position alongside every CTR delta. A CTR change on a page that
   also moved three positions is a ranking change wearing a title change's
   clothes.
7. Check the `bareSchedule` column. It should stay near zero. If it does not,
   the CFB ruling has a counterexample and that is a finding in its own right.
8. Note the absences explicitly. Three of the twenty had no rows even in the much
   larger July sample.
9. Write the conclusion to `audit/nfl-title-test-read-2026-09-20.md` and commit
   it with both read CSVs. A read that lives only in a terminal is not a read.

### What this read can and cannot be

**Ten pages against ten, over roughly fifteen days, with an unknown share of that
window still serving the old title to Google, yields a DIRECTIONAL SIGNAL and not
a result.** It is not powered for significance and must not be written up as
though it were. There is no n at which a fifteen-day, twenty-page CTR comparison
becomes conclusive, and pretending otherwise is how a null gets read as a
refutation.

Recrawl lag cuts one way only, and it matters for how a null is interpreted:
Google has to recrawl and re-render before the new title is ever shown, so the
measured effect is diluted toward zero by an unknown fraction. **A positive
result is therefore stronger evidence for the change than a null is against it.**

Decision rule, from the brief: expand if the treatment rows move materially
against the control rows; revert the ten titles if not. On a null, prefer
extending the window over reverting immediately, precisely because of the lag
above.
---

## 6. Confounders, ranked

1. **los-angeles-rams is 96% of the control arm's sampled impressions**
   (785 of 816) and converts at 26%. Excluding it, the entire control arm is 1
   click on 31 impressions in a month. Any pooled arm-level comparison is close
   to a Rams-versus-everything comparison. **Severity: critical.** Mitigation:
   do not pool at all. Report per-page deltas for all 20 URLs and read Rams as
   its own line, exactly like every other page. See section 5.
2. **Statistical power.** Ten pages against ten, over roughly 15 days, on a base
   this thin. Grossing the July sample up by the documented 7x gives the treatment
   arm on the order of 1,500 true impressions a month, and the window is half a
   month. A CTR difference would have to be very large, well into double-digit
   relative terms, before it outran noise. **This read will produce a directional
   signal, not a significant result, and should be reported in those words.**
3. **Recrawl lag.** Google has to recrawl and re-render before the new title is
   ever shown. The production deploy submits the whole sitemap to IndexNow, these
   ten URLs included, but submission is not indexation and part of the 15-day
   window will still have the old title live in the SERP. The measured effect is
   diluted by an unknown fraction toward zero, so a null is weaker evidence
   against the hypothesis than a positive is for it.
4. **Arm composition.** The treatment arm holds the bigger national brands
   (Cowboys, Chiefs, Eagles, 49ers) and so has a wider, lower-intent query set.
   The MLB Gate 0 report measured exactly this effect: big-market pages rank for
   far more keywords on comparable impressions, which mechanically deflates
   page-level CTR without anything being wrong with the page.
5. **Promo-count imbalance**, 6 zero-promo pages in treatment against 4 in
   control. Zero-promo pages have a different on-page offer and a different
   snippet.
6. **Week 1 opens 2026-09-10**, inside the window. It lifts both arms, which is
   why the read compares treatment deltas against control deltas rather than
   looking at treatment levels.
7. **Title truncation is not the same for all ten.** Google truncates by pixel
   width, not characters. The three 58-character titles are the ones at risk.
8. **Form confound.** Treatment adds "Schedule" and drops the standalone word
   "Promos". A move cannot be attributed to "Schedule" alone with certainty,
   though the brand suffix retains the stem, so the effect of the drop is
   expected to be small.

---

## 7. Ship, revert, and the IndexNow ruling

Operational steps live in `docs/runbook-2026-09-20-nfl-title-test-read.md` and
are deliberately not duplicated here, so the method in this document and the
procedure in that one cannot drift apart. The two points worth knowing from it:

**Revert is one line.** Empty `NFL_SCHEDULE_TITLE_SLUGS` in
`src/lib/title-treatment.ts`. `teamMetaTitle` then delegates every team to
`teamBareTitle` and all ten titles return to control byte for byte.
`src/lib/__tests__/nfl-title-arm.test.ts` will fail on its treatment table after
a revert, which is correct: delete that table in the same commit that ends the
experiment.

**IndexNow needs no manual step, at ship or at revert.** A production deploy
fires `.github/workflows/indexnow-after-deploy.yml`, which POSTs
`/api/indexnow/deploy`, which reads the sitemap and submits every URL. All ten
changed pages were confirmed present in the built sitemap, which carries 481
URLs. Hand-submitting the same ten separately would be redundant. Do not add a
manual IndexNow step to either procedure later.
