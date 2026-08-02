# Reading the capture trigger telemetry

How to take the Phase 1 read that decides the engaged-time floor. Written down
because the correct query is not the obvious one, and the obvious one is wrong in
a direction that argues for lowering the floor.

The trigger renders nothing. Every event here describes a prompt that WOULD have
fired. Nothing on this page is user-facing.

## The three events

| Event | Fires when | Guarded |
| --- | --- | --- |
| `capture_threshold_met` | gesture threshold AND 30 engaged seconds | once per pathname |
| `capture_prompt_shown` | gesture threshold AND 45 engaged seconds, not suppressed | once per pathname, and once per session via `markShown` |
| `capture_prompt_suppressed` | gesture threshold AND 45 engaged seconds, suppressed | once per pathname |

`capture_threshold_met` is a probe and decides nothing. It exists only so the
population that qualifies and then leaves between 30 and 45 seconds can be
counted, because that population emits nothing else and was completely invisible
in the first read.

The probe is suppression-gated: it measures the people who would have been
prompted, not everyone who taps. A visitor suppressed for `already_subscribed`,
`session_already_shown`, or any other reason emits no probe. That gate runs
before the probe is emitted (`src/lib/capture/trigger-engine.ts`, the
`evaluateSuppression` call precedes the `if (!reason && ...)` that emits it), so
the probe count can never exceed one per session once a prompt has been shown.

## The query

Count DISTINCT SESSIONS on both sides. Set the start bound to the merge
timestamp of the retune; `first_pageview` suppressions before that point describe
a different rule and are not comparable to anything after it.

```sql
SELECT
    uniqIf(properties.$session_id, event = 'capture_threshold_met') AS sessions_probed,
    uniqIf(properties.$session_id, event = 'capture_prompt_shown') AS sessions_shown,
    uniqIf(properties.$session_id, event = 'capture_threshold_met')
      - uniqIf(properties.$session_id, event = 'capture_prompt_shown') AS sessions_lost_30_to_45,
    -- Divergence check. If these differ from the session counts above, the raw
    -- subtraction is already wrong and the multi-page bias below is live.
    countIf(event = 'capture_threshold_met') AS raw_probe_events,
    countIf(event = 'capture_prompt_shown') AS raw_shown_events
FROM events
WHERE timestamp >= toDateTime('PENDING_PRODUCTION_DEPLOY')  -- see note below
  AND event IN ('capture_threshold_met', 'capture_prompt_shown')
```

`sessions_lost_30_to_45` is the answer: the number of sessions that would gain a
prompt if the floor moved from 45 seconds to 30.

## Why raw event subtraction is wrong

`count(capture_threshold_met) - count(capture_prompt_shown)` divides a
per-pageview numerator by a per-session denominator, because the probe is guarded
per pathname while only one prompt is ever allowed per session.

Concretely: a visitor qualifies on team page A, leaves at 40 seconds, navigates to
team page B, qualifies again, and is shown there at 45 seconds. The session cap is
written by `markShown` at the 45-second floor, so nothing had capped them while
they were on A. They emit two probes and one shown. A raw subtraction books one
loss. Nothing was lost: they were prompted anyway, and lowering the floor would
have gained exactly zero additional prompts from that session.

**Bias direction: UP.** It inflates the apparent 30-to-45 band and therefore
argues for lowering the floor partly on an artifact. It also grows with the very
change being measured, since removing `first_pageview` is what makes qualifying on
a first pageview possible at all, and therefore what makes qualifying on two pages
of one session possible.

A second, smaller bias runs the other way. `guards.probed` is a single pathname
slot, so a visitor who probes page A, visits page B without qualifying, and
returns to A emits no second probe for A while still emitting shown there.
**Bias direction: DOWN.** It needs an A to B to A navigation where only A
qualifies, which is rarer than the first case and partly offsets it.

Both require a multi-page session. The first read had 1.39 pageviews per session
and 72 distinct people behind 74 qualifying events, so neither was material then.
Run the divergence check in the query above before assuming that still holds.

## Test-account filtering

`execute-sql` runs raw and does NOT apply the project's internal and test user
filter. The PostHog UI does apply it by default. Raw SQL therefore reads slightly
higher than the filtered view.

Measured on the first read window (2026-07-30 17:22:13Z, 19 hours):

| | Filtered (UI) | Raw (`execute-sql`) |
| --- | --- | --- |
| Sessions | 253 | 260 |
| Pageviews | 352 | 365 |
| Qualifying evaluations | 29 | 30 |
| Suppressed | 27 | 28 |
| Shown | 2 | 2 |

The gap is our own browsing. Pick one view and stay in it for the whole read;
do not compare a filtered number against a raw one.

## What this read cannot tell you

It sizes the WHOLE 30-to-45 band, not its shape. `seconds_on_page` on the probe
records when the visitor crossed the threshold, not when they left, so the data
cannot distinguish a visitor who left at 31 seconds from one who left at 44. A
floor of 35 or 40 cannot be sized from these events. The only two floors this
read compares are 45 (current) and 30 (the probe).

If an intermediate floor becomes interesting, that needs a second probe at that
mark, not an interpolation of this one.

## The arm, and where it is stamped

The arm is assigned EAGERLY, on a browser's first pageview, before any behaviour is
observable (`src/components/capture/CaptureTrigger.tsx`, the `resolveVariant` call
sits above the counter, the timer and the subscriber). It is written once to
`localStorage` under `promonight:capture_variant` and never reassigned.

Until 2026-08-01 it was REPORTED only by the three capture events, all of which
need the gesture threshold and 30 engaged seconds to fire. That made the arm
visible for about a ninth of the browsers that had one: 117 arms observed against
809 browsers with a pageview, over the first 57 hours. Two consequences, both bad:

- Assignment balance could only be checked on the qualifying subset, so a question
  answerable in an hour took a day of waiting instead.
- A per-1,000-VISITORS rate was not computable at all. You cannot split a
  denominator by an arm the visitor never reported.

`page_view` and `newsletter_signup` now carry `variant` as well. Both resolve
through `resolveBrowserVariant()` in `src/lib/capture/variant.ts`, which wraps the
same `resolveVariant` the trigger uses and adds no logic: there is still exactly
one flip site, so two callers racing on a brand-new browser cannot produce two
arms.

**The four email-funnel events — `email_cta_click`, `follow_page_view`,
`teams_starred`, `newsletter_signup` — carry it too, and it has to be all four.**
The point of labelling the funnel is to see WHERE an arm loses people. A single
unstamped step is a hole no step-to-step rate can be computed across, which
disables the one question the labelling exists to answer.

**The direct stamp on `newsletter_signup` is MANDATORY, not preferable, and this
is the number that settles it.** The alternative on the table was recovering the
arm by joining a signup back to that browser's capture events. Measured against
the first 57 hours, that join yields a numerator of **exactly zero**: all five
signups in the window came from browsers that never emitted a capture event, so
every one of them is dropped by the join. Not "a smaller numerator" — no
numerator. Anyone reaching for the join again should re-run this before assuming
it degrades gracefully, because it does not degrade, it returns nothing:

```sql
SELECT qualified, count() AS signup_browsers
FROM (
    SELECT
        person_id,
        maxIf(1, event IN (
            'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed'
        )) = 1 AS qualified,
        maxIf(1, event = 'newsletter_signup') = 1 AS signed_up
    FROM events
    WHERE timestamp >= toDateTime('PICK_A_BOUND')
    GROUP BY person_id
)
WHERE signed_up
GROUP BY qualified
```

Two things to know before reading any of it:

- **`unassigned` now appears on real traffic, and that is expected.** The capture
  events could barely carry it, because a storage-less browser is suppressed for
  `storage_unavailable` before reaching a shown event. A pageview has no such
  filter. Exclude `unassigned` from both arms when computing a rate; never fold it
  into control.
- **The kill switch gates the pageview stamp too.** `gate.ts` promises OFF means
  no storage touched, so `resolveBrowserVariant()` returns `unassigned` without
  reading or writing anything when the trigger is disabled. Both causes of
  `unassigned` therefore look identical on the event. Time-bound every arm query
  to a window where the gate was on, which you need to do anyway.

## Checking that assignment is even

The reason the stamp exists. One query over a day of pageviews gives roughly 350
flips instead of 45. Measured on the days before the stamp shipped: 316 browsers
emitted `page_view` on 2026-07-31, 377 on 2026-08-01.

(An earlier draft of this file said 800 a day. That was wrong. It came from
reading an 809-browser total that spanned 57 hours as though it were a daily rate.
The corrected figure does not change the decision below, but it does change how
long you wait for the wider ones.)

Bound the query at the deploy: **2026-08-02T02:20:00Z**, when
`dpl_9afFEEMUZX2Brfpupxx4GbLurAQk` went Ready. Pageviews from the previous bundle
carry no `variant` key at all, which is distinct from `unassigned` and will group
under an empty value. That is the old bundle draining out of CDN caches, not a
finding.

```sql
SELECT
    properties.variant AS arm,
    uniq(person_id) AS browsers,
    count() AS pageviews
FROM events
WHERE timestamp >= toDateTime('PICK_A_BOUND_INSIDE_THE_LIVE_WINDOW')
  AND event = 'page_view'
GROUP BY arm
ORDER BY arm
```

Read `browsers`, not `pageviews`. The randomization unit is the browser; one
browser emits many pageviews and they all carry the same arm, so counting events
treats one flip as many and makes any deviation look far more significant than it
is. That error is what produced the false alarm logged at the bottom of this file.

Where a fair coin lands 95% of the time, by sample size:

| browsers | roughly | control, 95% band |
| --- | --- | --- |
| 350 | one day | 157-193 |
| 700 | two days | 324-376 |
| 1050 | three days | 493-557 |

**One day settles the question that prompted this and settles it outright.** A true
75/25 assignment would put about 262 of 350 in control, roughly nine standard
deviations outside the band. Nothing subtle is being asked of the first read.

One day does NOT settle a small tilt. Distinguishing a true 56/44 from a fair coin
has only about 60% power at 350 browsers and needs three to four days. Do not read
"inside the band at n=350" as proof the coin is exactly fair; read it as proof it
is not 75/25, which is the claim on the table.

One caveat on the denominator, which does not bias the arm but does explain a gap:
`page_view` is deferred behind `requestIdleCallback`, so a browser that leaves
before the callback runs is assigned but never reports. Over the pre-stamp window
`$web_vitals` saw 1249 browsers against `page_view`'s 809. Idle-callback timing is
independent of the arm, so the sample stays unbiased; it is just smaller than total
traffic.

## Phase 2 metric definitions

Both are per PERSON. Never per session, never per event.

The randomization unit must equal the analysis unit. The arm lives in
`localStorage` (`KEY_VARIANT`), which is a property of the browser profile and
survives tab close, navigation and session rotation. `sessionStorage`
(`KEY_SESSION`) is a treatment-delivery cap — it controls how often a prompt may
appear within a tab — not a randomization unit. Analysing per session gives
several correlated observations per randomized unit and understates variance,
which INFLATES significance. Analysing per event does the same, worse.

The units also line up exactly, which is worth knowing rather than assuming:
`person_profiles: 'identified_only'` is set with no `identify()` call anywhere, so
PostHog's `person_id` is a deterministic UUIDv5 of the anonymous `distinct_id`,
and that id and the arm share a storage lifetime — both die when localStorage is
cleared. Verified empirically on 2026-08-01: 0 of 117 browsers ever reported two
arms.

### Primary: signups per 1,000 QUALIFYING browsers

The honest primary, because it is the population at risk of seeing the sheet. A
browser that never crosses the threshold was never going to be prompted in either
arm, so including it dilutes both arms with visitors the treatment cannot reach
and shrinks the measured effect toward zero for a reason that has nothing to do
with whether the sheet works.

```sql
SELECT
    arm,
    countIf(qualified) AS qualifying_browsers,
    countIf(qualified AND signed_up) AS signups,
    round(countIf(qualified AND signed_up) / countIf(qualified) * 1000, 1) AS per_1k
FROM (
    SELECT
        person_id,
        -- The browser's arm, ignoring events that carry none. One browser has
        -- exactly one arm, so any event that carries a real one will do.
        anyIf(properties.variant, properties.variant IN ('control', 'variant_a')) AS arm,
        maxIf(1, event IN (
            'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed'
        )) = 1 AS qualified,
        maxIf(1, event = 'newsletter_signup') = 1 AS signed_up
    FROM events
    WHERE timestamp >= toDateTime('PHASE_2_START')
      AND event IN (
          'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed',
          'newsletter_signup', 'page_view'
      )
    GROUP BY person_id
)
WHERE arm IN ('control', 'variant_a')
GROUP BY arm
ORDER BY arm
```

### Secondary: signups per 1,000 visitors

Computable only since the `page_view` stamp. Report it alongside the primary, not
instead of it: it is the number that answers "what did this do to the business",
while the primary answers "does the sheet work on the people who see it". Same
query with `qualified` swapped for a pageview test:

```sql
        maxIf(1, event = 'page_view') = 1 AS visited
```

and the rate taken over `countIf(visited)`.

Do not mix the two denominators in one chart, and label whichever you quote. They
differ by roughly a factor of ten (9.4% of browsers qualified in the first
post-retune window), so an unlabelled rate is unreadable a month later.

## Investigation log: the 2026-08-01 arm skew

Recorded because the SHAPE of the correction is the part that gets lost.

**The alarm.** `capture_prompt_shown` in the first post-retune window split 31
control / 9 variant_a, called out as a 1-in-1000 outcome, against a pre-retune
window cited as an unremarkable 16 / 13.

**Three errors in the framing, all real:**

1. The 1-in-1000 assumed 40 independent Bernoulli trials. The randomization unit
   is the browser and the counting unit was the event, so independence did not
   hold and the statistic did not apply. It happened to land near the right answer
   anyway, because there turned out to be almost no clustering: exactly 1.000
   shown events per browser in both arms.
2. "If the probe splits evenly but shown does not, the bug is downstream of
   assignment" is incoherent. The arm is resolved once and frozen into the context
   object every emission spreads, and nothing in the repo branches on it, so there
   is no downstream that could change it.
3. **The baseline was a different measurement.** The cited 16 / 13 is 29 QUALIFYING
   EVALUATIONS (shown + suppressed) from the first 19 hours, of which 27 were
   `first_pageview` suppressions. Across the entire pre-retune window
   `capture_prompt_shown` fired three times: 2 control, 1 variant_a. There was no
   pre-retune baseline for that event to compare against.

**And the finding that error 3 nearly buried.** Correcting the baseline did not
dissolve the inflection, it relocated it. Comparing like for like — distinct
persons across all capture events — pre-retune ran 32 / 40 (44.4% control) and
post-retune ran 34 / 11 (75.6% control), a two-proportion z of 3.30, p ≈ 0.001.
The original evidence was invalid AND a correct version of it existed and still
showed the shift. Verify a bad baseline; do not discard the question with it.

**Verdict: bad luck.** Every mechanism the code allows was eliminated positively,
not by absence: zero-byte diff on `variant.ts` and `storage.ts` across the retune,
uniform flip, no reassignment path, arm inert, assignment eager and therefore
independent of qualification, 0 of 117 browsers carrying two arms, 0 `unassigned`
anywhere, max 3 capture events per browser, single production host so the
test-account filter was a no-op, ordinary consumer traffic with no bot signature,
and both arms behaviourally identical (median 45s, mean trigger count 3.59 vs
3.60). Adjusted for the window having been chosen after seeing the anomaly, call
it roughly p ≈ 0.005.

**The instrument, not the wait.** The response was to stamp the arm on `page_view`
rather than wait for another 45 browsers, because 800 flips a day settles the
question outright and the same change unblocks the Phase 2 denominator. If the
`page_view` balance ever comes back outside the band above, the code explanation
is exhausted and the next place to look is outside this repo: something patching
`Math.random` before `variant.ts` reads it.

## Related

- `src/lib/capture/trigger-engine.ts` — the decision, both floors, the guards
- `src/lib/capture/engaged-timer.ts` — `ENGAGED_FLOOR_MS`, `PROBE_FLOOR_MS`
- `src/lib/capture/suppression.ts` — the reasons, and why `first_pageview` was cut
- `src/lib/analytics.ts` — `CaptureThresholdMetProperties`, the event contract
