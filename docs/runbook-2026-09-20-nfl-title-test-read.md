# RUNBOOK: nfl-schedule-title-sep2026, ship and read

**Read date 2026-09-20, or ship + 15 days if the merge slips. It will not happen
on its own.**

Owner: whoever is on the promonight-web rotation that day.
Branch: `seo/nfl-schedule-title-test`.
Code: `NFL_SCHEDULE_TITLE_SLUGS` in `src/lib/title-treatment.ts`.
Registry: `docs/SITE-AUDIT.md`, "Live experiment: nfl-schedule-title-sep2026".
Method and confounders: `audit/nfl-title-test-baseline-2026-09-05.md`. That
document is authoritative for how to score the read; this one is the operational
sheet, and deliberately does not restate the method so the two cannot drift.

Throughout, this is the ingest invocation. The script has no shebang and is not
executable, so it does not run as a bare path:

    R="node --require ./scripts/stub-server-only.cjs --import tsx scripts/nfl-title-baseline.ts"

---

## 0. Before the merge, blocking

**The baseline of record must exist first**, and it is two exports, not one.
Section 3 of the baseline document explains why Ahrefs and Windsor cannot supply
either.

Use a **custom date range**, not a preset. "Last 28 days" is the trap: it looks
right in the UI and produces per-page rows that are 28-day totals, which cannot
be filed under a 14-day window. The first export handed to this runbook was
exactly that, and the ingest refused it.

Search Console reports about two days behind, so the freshest usable day is
roughly today minus 2. Pick the 14-day window that ends on the last settled day
and sits entirely before ship, then pass it with `--from`/`--to`. A GAP between
the baseline window and the ship date is fine. An OVERLAP is not, and the ingest
refuses it.

**Pass `--dir`, the whole unzipped export folder, not `--csv`.** Chart.csv proves
the range the export actually covers and Filters.csv proves which filters were
applied. Pages.csv and Queries.csv carry neither, so a bare `--csv` cannot tell a
14-day filtered export from a 28-day unfiltered one. On `--dir` the ingest checks
both and refuses to write on a mismatch.

- [ ] Search Console, custom range, 14 days ending on the last settled day,
      **Pages** tab, export.
- [ ] Same range, add a filter of **Page contains `/nfl/`**, **Queries** tab,
      export. The filter is load-bearing twice over: without it "giants" also
      matches the MLB San Francisco Giants, a ctr-diagnostic treatment club, and
      the unfiltered site-wide export hits the 1,000-row cap and silently drops
      every zero-click query.
- [ ] `$R --window baseline --tab pages   --dir <export folder> --from <start> --to <end> --export-date <today> --execute`
- [ ] `$R --window baseline --tab queries --dir <export folder> --from <start> --to <end> --export-date <today> --execute`

- [ ] Confirm `baselineOfRecord.status` is `captured` in
      `audit/nfl-title-test-baseline-2026-09-05.json`. **That field is the gate,
      not the presence of a CSV.** A file can be the wrong property; the status
      field cannot be set by one, because the ingest refuses to write a
      degenerate export without `--force`.
- [ ] Commit both CSVs and the updated JSON.

Pre-merge checks, none of which are automated (this repo has one GitHub workflow
and it is the IndexNow deploy hook, so nothing blocks a bad merge on its own):

- [ ] `npm test`. Expect 787 passing, 7 of them in
      `src/lib/__tests__/nfl-title-arm.test.ts`.
- [ ] `node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/validate-team-meta-2026.ts`
      Expect zero titles over 60 outside the `mlb-ctr-treatment` arm. **This is
      the only check that runs against live Firestore display names.** The guard
      test freezes display names as literals, so a Firestore correction that
      pushes a title past 60 would pass the test suite and fail only here.
- [ ] `npm run build`.

### If the baseline was not captured before ship

Recoverable, contrary to the obvious reading. Search Console retains sixteen
months of Performance data, so the pre-ship window stays exportable long after
the merge. What a merge destroys is not the data, it is the
ability to attribute that window cleanly to the old titles. Export it anyway,
ingest it, note in the JSON that it was captured after ship, and downgrade the
read to a within-page before and after with that caveat stated in the write-up.

## 1. Ship

1. Merge `seo/nfl-schedule-title-test` with `--no-ff`.
2. Wait for the Vercel deployment to reach **Ready**. Revalidating while a build
   is still running regenerates every path from the old bundle and still answers
   `ok:true` (`docs/known-issues.md` entry 27).
3. **Record the ship timestamp.** Poll the www alias until it serves the new
   title, and write that timestamp into the SITE-AUDIT registry row and into
   `shipDate` in the baseline JSON. The read window is derived from it. This is
   how ctr-diagnostic's start was established and it is the step most likely to
   be skipped. If ship is not 2026-09-05, pass `--ship-date` to every later
   ingest and redate this runbook.
4. Revalidate the ten changed paths in one batched POST to `/api/revalidate` with
   the `x-revalidate-secret` header. The sport segment is derived as
   `data.league.toLowerCase()`, not from a stored `sportSlug` field.
   **Expect `revalidated: 10`** in the response body, server-counted. Anything
   less means some paths did not flush; do not proceed on `ok:true` alone.
5. Verify against served HTML, never a source grep. Six fetches, cache-busted:
   treatment `chicago-bears`, `kansas-city-chiefs`, `san-francisco-49ers`;
   control `los-angeles-rams`, `seattle-seahawks`, `miami-dolphins`.

       p=/nfl/chicago-bears
       curl -sS -D /tmp/hdr.txt -H 'Cache-Control: no-cache' \
         "https://www.getpromonight.com${p}?cb=$(date +%s)-$RANDOM" -o /tmp/page.html

   Then read everything else offline from `/tmp/page.html`: `<title>`,
   `og:title`, the JSON-LD `WebPage.name`, the `<h1>`, and the hero subtitle.
   Treatment pages are self-proving, because the new suffix cannot exist in the
   previous build. Control pages are not: "unchanged" is also what a stale render
   shows, so bind them by checking the `dpl_` value on their asset URLs against
   the new deployment id.

### If a page serves the wrong title

`git revert -m 1` the merge commit, no force-push, re-alias, report. Do not patch
forward on main. This is the rule `audit/ctr-diagnostic-gate0-gate1.md` already
established for the sibling experiment and there is no reason for this one to
differ.

### IndexNow: do nothing, on purpose

**Do not hand-submit the ten URLs, and do not add a manual IndexNow step to this
runbook later.** A production deployment already fires
`.github/workflows/indexnow-after-deploy.yml`, which triggers on
`deployment_status` where the state is success and the environment is Production,
and POSTs `/api/indexnow/deploy`, which reads the sitemap and submits every URL.
All ten changed pages were confirmed present in the built sitemap, which carries
481 URLs. A separate bounded submission of the same ten would be redundant, would
spend rate budget against both endpoints for nothing, and would create a second
place to maintain the slug list.

If someone later proposes adding a manual step here, the answer is that the
deploy hook already covers it. Check the workflow run rather than adding a call.

## 2. The read

**Export on 2026-09-23 or later, not on the 20th.** Search Console data for the
most recent days is incomplete; exporting a window the day after it closes
undercounts its tail and biases every delta downward, toward a false null.

- [ ] Export both tabs for the read window, **2026-09-07 to 2026-09-20**, as a
      custom range (ship was 2026-09-06T12:30:58Z), Queries again filtered to
      Page contains `/nfl/`. Match the baseline's window LENGTH exactly, or the raw
      click and impression deltas compare different amounts of time.
- [ ] `$R --window read --tab pages   --dir <export folder> --export-date <today> --execute`
- [ ] `$R --window read --tab queries --dir <export folder> --export-date <today> --execute`
- [ ] Check `suspect` and `suspectReasons` on both stamps in the JSON before
      trusting a number.
- [ ] Write the conclusion to `audit/nfl-title-test-read-2026-09-20.md`, and
      commit it with both read CSVs and the updated JSON.

Score it the way `audit/nfl-title-test-baseline-2026-09-05.md` sections 4 and 5
require. The four rules easiest to get wrong:

- **The promo-schedule family table is what the decision rule reads.** The pages
  table is context, because it mixes in every other query on the URL.
- **Per page, never pooled.** `los-angeles-rams` was 785 of 816 control
  impressions in the July sample; a pooled arm ratio is that one page against
  noise. Rams is read as its own line.
- **Score against the promo-schedule family, not the million-volume head terms.**
  A null on `chiefs schedule` is the expected result, not a failure. The
  `bareSchedule` column exists so that expectation is visible.
- **Directional signal, not a result.** Ten pages against ten over fourteen days
  with recrawl lag is not powered for significance and must not be written up as
  though it were.

## 3. Revert

One line: empty `NFL_SCHEDULE_TITLE_SLUGS` in `src/lib/title-treatment.ts`.
`teamMetaTitle` then delegates every team to `teamBareTitle` and all ten titles
return to control byte for byte. Revalidate the ten paths afterwards. IndexNow
again needs no manual step.

`src/lib/__tests__/nfl-title-arm.test.ts` will fail on its treatment table after
a revert, which is correct: delete that table in the same commit that ends the
experiment.

**Both live experiments share `src/lib/title-treatment.ts`, and the MLB one reads
on 2026-10-01.** Any edit to that file before then, including this revert, must
leave all 30 MLB titles byte-identical. The guard test asserts exactly that, so
re-run `npm test` and do not ship the revert on inspection alone.

On a null result, prefer extending the window over reverting immediately.
Recrawl lag dilutes the measured effect toward zero, so a positive result is
stronger evidence for the change than a null is against it.

## 4. Closeout

When the read is written up and the decision is made: update the SITE-AUDIT
registry row with the outcome, then either delete this file or mark it done with
the date and the deployment sha.
