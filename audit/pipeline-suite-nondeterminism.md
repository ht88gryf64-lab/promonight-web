# Pipeline suite non-determinism: diagnosed. 2026-09-04. Read-only, no fix applied.

## THE CAUSE

THERE IS NO NON-DETERMINISM IN THE PIPELINE SUITE. I WAS RUNNING THE WRONG RUNNER.

The project's test command is:
  node --test --test-reporter=spec 'test/**/*.js' 'lib/**/*.test.js'

jest is NOT a dependency of this repo. devDependencies are tsx and typescript, and
nothing else. `npx jest` fetched jest 30.5.1 into ~/.npm/_npx/b8d86e6551a4f492 and
ran that. Every varying number I reported came from those runs.

## 1. THE REAL SUITE, 6 RUNS

  tests 821, pass 821, fail 0, on all six.
  Identical 821-name test set on all five captured runs, diffed name by name.
  Wall clock 8.47 / 8.42 / 8.41 / 8.42 / 8.45 s.
  TAP output 4,958 lines on every run.

Nothing varies. Not the totals, not the names, not the count of collected files.

## 2. THE ARTIFACT, REPRODUCED 5 TIMES FROM THE CACHED BINARY, NO NETWORK

  run 1  tests 743  pass 737  fail 6
  run 2  tests 590  pass 584  fail 6
  run 3  tests 676  pass 667  fail 9
  run 4  tests 668  pass 660  fail 8
  run 5  tests 622  pass 614  fail 8

Same shape as the 571/6 and 707/8 I originally reported.

MECHANISM, in three parts, each with its evidence:

a. jest collects 82 suites and ALL 82 FAIL, on every run, deterministically:
   "Your test suite must contain at least one test." The files hold node:test
   tests, not jest tests. `Test Suites: 82 failed, 82 total` in all five runs.

b. THE NUMBERS I WAS SUMMING WERE NOT JEST'S. The `ℹ tests / pass / fail` lines are
   node:test's OWN summary, printed once per WORKER PROCESS at process exit. 82
   files produced only 7 or 8 summary blocks on a 10-CPU machine. So `awk` summing
   those lines counted whichever subset of worker processes lived long enough to
   print, which jest's scheduling decides afresh each run. Every jest total is BELOW
   the true 821 because some workers never print at all.

c. THE FAILURES ARE THE SAME CLASS OF ARTIFACT. jest resets its module registry per
   file while node:test defers callbacks, so by the time a test body runs its module
   reference is undefined:
     "Cannot destructure property 'ageInDays' of 'require(...)' as it is undefined"
     "Cannot read properties of undefined (reading 'createBudgetGovernor')"
     "Cannot read properties of undefined (reading 'filter')"
   4 of the 9 affected files require lazily inside a callback; 5 require at top
   level, so this is not merely the lazy-require pattern.

## 3. THE BRIEF'S CANDIDATES, RULED IN OR OUT WITH EVIDENCE

  Runner bails early, truncating collection
    RULED OUT. jest reports 82 of 82 suites on every run; the real runner collects
    821 tests on every run. Nothing is truncated at collection.

  Parallel workers racing on shared state (emulator, temp dirs, fixtures, scratchpad)
    RULED OUT AS THE CAUSE. Workers are involved, but the variance is in which
    processes print an exit summary, not in contended state. No test touches an
    emulator. Every file write in the suite goes to os.tmpdir() via mkdtempSync.

  Tests that write files other tests read
    RULED OUT. Exactly two test files write anything, both into a fresh
    mkdtempSync directory under os.tmpdir(). No write lands in the repo or the
    scratchpad.

  A glob or config that resolves differently by cwd
    RULED OUT as the cause of the observed variance, CONFIRMED as a real latent
    hazard. Run from test/ instead of the package root, the same command collects
    ZERO tests and reports "# tests 0 / # pass 0 / # fail 0" AND EXITS 0. A green
    summary line is indistinguishable from a suite that ran nothing. npm test always
    runs at the package root, so this is not live today.

  Timeouts under load
    RULED OUT. Every failure reason is a TypeError on an undefined module reference,
    none is a timeout, and wall clock is 8.4 s with 0.06 s of spread.

## 4. LIVE FIRESTORE OR NETWORK: NO

  No collected test requires firebase-admin. The single mention in test/ is a
  COMMENT describing a hand-written fake that stands in for it.
  No collected test requires http, https, net or dns, and none assigns
  globalThis.fetch.
  The firecrawl tests inject a scripted mock client; the file's own header says the
  suite spends zero credits.
  Corroborating: 8.4 s wall clock with 0.06 s spread across six runs is not a suite
  making network calls.

## 5. WHICH FAILURES ARE REAL

  NONE OF THEM. The real runner reports 0 failures on all six runs.

  Nine distinct test names failed across the five jest runs and NEVER THE SAME SET,
  which is what the brief suspected. All nine pass under the real runner:
    ageInDays reads BOTH stored timestamp shapes            ok 815
    passes run IN ORDER and compose                         ok 281
    a pass returning no kept array leaves the set untouched ok 282
    REGRESSION: no active club's stored source is rejected  ok  79
    DIFF chain: absent-streak tombstones at 3               ok 548
    plus four more, all ok.

  ONE REAL DEFECT WAS SURFACED BY THE ARTIFACT, and it was mine, not the suite's:
  after renaming the guard export, test/venuehubs-write-guard.test.js still imported
  the old name in a SECOND require at line 410. That was a genuine ReferenceError
  the real runner catches too. Already fixed.

## 6. CORRECTIONS I OWE

Two artifacts of mine assert a non-determinism that does not exist, on the strength
of my own bad measurement. Both are wrong and should be corrected:
  - the commit message on fix/firecrawl-maxage (4afd102), which tells whoever runs
    the suite that it returns 571/6 then 707/8 with no code change and that
    "full-suite totals cannot judge a patch today";
  - audit/nhl-verifiedatbyfield-defect.md, which says the pipeline half of the
    verifiedAtByField fix is UNVERIFIED until this item closes.

THE PIPELINE HALF IS VERIFIED. On fix/venuehubs-observed-at, the full suite is
823 tests, 823 pass, 0 fail, on three consecutive runs. Baseline on
fix/firecrawl-maxage is 821/821/0. The delta is exactly the two regression tests
that branch adds.

BASELINE RECONCILIATION, so these numbers do not read as drift. Two pairs appear in
the record and both are correct; they were taken on different trees. The 821/823
pair above was measured BEFORE the rebase, when fix/venuehubs-observed-at sat on top
of fix/firecrawl-maxage, so its baseline was that branch (820 on main plus the one
regression test the maxAge commit adds = 821) and the branch itself was 823. The
820/822 pair in the merge commit was measured AFTER rebasing onto main, so the
baseline is main itself at 820 and the branch is 822. The delta attributable to this
change is two regression tests in both readings; the one-test difference between the
pairs is the maxAge test, which is not part of this change and now sits unmerged on
its own branch.

A green run on this suite means something. It always did.
