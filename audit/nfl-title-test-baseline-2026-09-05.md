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
the read cannot divide by it. In the real 28-day export all 20 URLs were present,
so an absence in a 14-day window would be notable rather than routine; the three
pages the Ahrefs sample showed as missing had impressions all along.

### The proxy that is NOT the baseline, and what corrected it

The July 2026 Ahrefs figures are kept in the JSON per page under
`ahrefsJuly2026`, and at the top level under `priorSampleNotTheBaseline`
(renamed from `baselineSource`, because that key name was itself a claim and the
wrong one). **Do not score the read against them.**

On 2026-09-05 a real Search Console export arrived covering 2026-08-07 to
2026-09-03, 28 days, unfiltered. It is NOT the baseline of record: the window is
wrong, and per-page rows are totals over whatever range was exported, so it
cannot be filed under a 14-day window. The ingest refused it, correctly. But it
is real GSC data on these exact URLs, and it overturns two things the Ahrefs
sample had established.

**Correction 1: the Rams do not dominate the control arm.** Ahrefs put
`los-angeles-rams` at 96.2% of control impressions, converting at 26%. Real GSC
puts it at **37.5%**, converting at 3.2%. The arms are close to balanced:

| | clicks | impressions | CTR |
|---|---|---|---|
| treatment, 28 days | 1,874 | 11,458 | 16.4% |
| control, 28 days | 951 | 9,416 | 10.1% |

An impression ratio of 1.22 to 1, not the one-page-against-noise picture the
Ahrefs sample painted. The per-page ruling in section 5 still stands, because
with n=10 and this much per-page spread a pooled figure is fragile either way,
but it no longer rests on the Rams being an outlier and must not be written up as
though it does.

**Correction 2: the test is better powered than stated.** The Ahrefs sample
implied roughly 1,500 treatment impressions a month. Real GSC implies about
**5,700 per 14 days** in treatment and 4,700 in control. The Ahrefs undercount on
these pages was 58x in the treatment arm and 12x in control, far worse than the
7x the MLB reconciliation measured on MLB pages. Section 6's power note is
revised accordingly: still a directional read, but on a real impression base
rather than a marginal one.

Also worth recording: all 20 URLs are present in real GSC data. The three pages
the Ahrefs sample showed as absent had impressions all along.

### The head-term question, answered on real data

Among the top 1,000 site queries by clicks, queries naming an NFL team token and
containing "schedule":

| family | queries | impressions | clicks | positions |
|---|---|---|---|---|
| promo-schedule (`{team} promotional schedule`, `{team} giveaway schedule`) | 25 | 1,617 | 299 | 3.0 to 5.3 |
| bare schedule (`{team} schedule`) | **0** | **0** | **0** | n/a |

That 28-day read was capped at 1,000 rows and excluded zero-click queries, so it
could only show that no bare-schedule query earned a click. **The filtered
baseline export settles it.** 233 rows, well under the cap, zero-click queries
included, filtered to `Page +/nfl`, covering 2026-08-21 to 2026-09-03:

**Bare-schedule impressions across all twenty test pages: zero.** Not a low
number, not a rounding artifact of a cap. Zero, on every one of the twenty.

The promo-schedule family over the same fourteen days:

| slug | arm | impressions | clicks | CTR | position |
|---|---|---|---|---|---|
| new-york-giants | T | 404 | 123 | 30.45% | 3.33 |
| los-angeles-rams | C | 358 | 11 | 3.07% | 5.00 |
| chicago-bears | T | 196 | 49 | 25.00% | 2.75 |
| baltimore-ravens | T | 80 | 15 | 18.75% | 6.33 |
| detroit-lions | T | 76 | 27 | 35.53% | 3.68 |
| san-francisco-49ers | T | 69 | 17 | 24.64% | 2.64 |
| new-york-jets | C | 59 | 2 | 3.39% | 4.20 |
| los-angeles-chargers | C | 48 | 20 | 41.67% | 3.25 |
| denver-broncos | C | 45 | 9 | 20.00% | 5.93 |
| tampa-bay-buccaneers | C | 39 | 7 | 17.95% | 4.82 |
| seattle-seahawks | C | 32 | 8 | 25.00% | 5.53 |
| atlanta-falcons | C | 13 | 5 | 38.46% | 3.31 |
| miami-dolphins | C | 9 | 3 | 33.33% | 4.44 |
| dallas-cowboys | T | 7 | 1 | 14.29% | 3.57 |
| buffalo-bills | C | 6 | 3 | 50.00% | 2.17 |

Five pages have no schedule-family query at all: bengals, chiefs, eagles,
steelers, vikings.

Section 4's reframing is no longer an inference. The head terms the brief was
built around draw **no impressions whatsoever** on these pages, while the family
the title ignores ranks between 2.2 and 6.3 and converts up to 50%. The test is
scored on the second table, and a null on the first is not a result at all
because there is nothing there to move.

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

## 4b. los-angeles-rams is in freefall, and it is not the title

Flagged during baseline review because earlier reads had this page converting at
26% and the baseline shows 2.06%. It is a control page, so nothing here changes
what ships, but it changes how its row must be read.

| window | clicks | impressions | CTR | position |
|---|---|---|---|---|
| 2026-06-02 to 2026-09-01 (92 days) | 1,101 | 8,671 | 12.70% | 5.47 |
| 2026-08-07 to 2026-09-03 (28 days) | 113 | 3,534 | 3.20% | 6.91 |
| 2026-08-21 to 2026-09-03 (14 days, baseline) | 39 | 1,890 | 2.06% | 7.57 |

**Impressions rising, position falling, clicks collapsing.** Averaged over the 92
day window the page drew about 1,320 impressions and 168 clicks per fortnight; the
baseline fortnight has 1,890 impressions and 39 clicks. It is being shown more and
clicked far less.

**The Sept 4 game-time label fix is not the cause.** `b688e20` merged at
`fc59442`, 2026-09-04 11:00, and the baseline window closes 2026-09-03. The
decline is fully present in data that predates the fix by a day. Whatever this
is, it started earlier.

**It is a ranking loss, not a CTR loss.** The page's biggest query,
`rams giveaways 2026`, sits at position 7.34 with 410 impressions and 2 clicks
(0.49%). In the July Ahrefs sample the same query was position 3.06 at 27.6%.
Positions four through eight convert at a small fraction of positions two through
three, which accounts for most of the collapse without any change in the page's
appeal. The same pattern the MLB Gate 0 report recorded for big-market pages
holds here: a wider, lower-intent query set at worse positions deflates page CTR
with nothing wrong with the page.

**One lead worth chasing separately.** The Rams page currently carries a single
promo, `Championship Replica Ring` on 2026-10-18. A page ranking for
`[team] giveaways 2026` with one giveaway on it is thin, and thinning content is
a plausible driver of a ranking loss of this size. That is a hypothesis, not a
finding, and it belongs to its own investigation rather than this experiment.

**Consequence for the read.** A control page losing this much ground on its own
would flatter the treatment arm in any pooled comparison, which is a second
independent reason the pooled number is banned in section 5. Read the Rams row
against the Rams baseline and nothing else, and expect it to fall further.

---

## 5. The 2026-09-20 read

**The comparison is a per-page delta against each page's own baseline. The
control arm exists to detect the Week 1 seasonal lift, not to serve as a matched
cohort.** This is the single most important instruction in the document and the
baseline data is why.

The arms are not matched, and cannot be made matched by any reweighting:

| | clicks | impressions | CTR |
|---|---|---|---|
| treatment, 2026-08-21 to 2026-09-03 | 1,125 | 6,165 | **18.25%** |
| control, same window | 485 | 5,296 | **9.16%** |

Four treatment pages carry 1,039 of the treatment arm's 1,125 clicks: Giants
28.29%, Lions 21.93%, Bears 18.34%, 49ers 10.34%. **Control has no comparable
page.** A pooled arm comparison would show treatment ahead by nine percentage
points before a single title changed, and would keep showing it afterwards
whatever the titles did. It would be a measurement of which teams are in which
bucket, not of the change.

So:

- Each page is compared **only against itself**. Twenty independent before and
  after readings.
- The control arm answers exactly one question: how much did pages of this kind
  move over this fortnight without a title change? Week 1 opened 2026-09-10
  inside the read window, so a treatment rise that the control rows match is
  seasonality, and a treatment rise the control rows do not match is the signal.
- `los-angeles-rams` gets its own line and is read as its own line, like every
  other page.
- **Never report a pooled arm CTR.** Not as a headline, not as a summary, not as
  a sanity check. It is a number that cannot mean what it looks like it means.

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

1. **Per-page spread, not Rams dominance. REVISED 2026-09-05.** The original
   entry read that `los-angeles-rams` was 96% of control impressions and rated
   this critical. That came from the Ahrefs sample and real Search Console data
   refuted it: the Rams are 37.5% of control impressions, and the arms sit at
   1.22 to 1. **Severity: moderate, not critical.** What survives is the real
   reason to avoid pooling: per-page CTR across these twenty URLs spans 3.2% to
   28.8%, so any arm-level ratio is dominated by whichever two or three pages
   happen to carry the impressions that fortnight. Mitigation is unchanged: do
   not pool. Report per-page deltas for all 20 and read Rams as its own line
   like every other page. See section 5.
2. **Statistical power. REVISED 2026-09-05.** The original entry estimated the
   treatment arm at roughly 1,500 impressions a month by grossing the Ahrefs
   sample up 7x. Real Search Console data puts it near **5,700 per 14 days**,
   with 4,700 in control, so the base is several times larger than stated and the
   Ahrefs undercount on these pages was 58x rather than 7x. That improves the
   read without rescuing it: ten pages against ten over fourteen days, with
   recrawl lag eating an unknown share of the window, is still not powered for
   significance. **This read will produce a directional signal, not a significant
   result, and must be reported in those words.** The promo-schedule family it is
   actually scored on is thinner still: 1,617 impressions over 28 days across the
   whole arm set, so per-page family deltas will be small integers and must be
   read as such.
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
