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

### Why the primary uses a qualifying BOOLEAN and not a shown count

Because a shown count is not symmetric across the arms, and the boolean is.

Only `variant_a` can be dismissed or submitted, and those two actions are the
only writers of the durable suppressors: `promonight:capture_dismissed_at` (30
days) and `promonight:subscribed` (permanent). Control has nothing to dismiss and
nothing to submit, so a control browser writes neither and keeps reaching
`capture_prompt_shown` session after session, while a `variant_a` browser that
dismissed once stops. Over any window longer than a session, control accumulates
more `capture_prompt_shown` events per browser, and the gap grows with the
window.

The `qualified` boolean above sidesteps that entirely: it counts a browser once
if it ever emitted `capture_threshold_met`, `capture_prompt_shown` OR
`capture_prompt_suppressed`. A suppressed browser still emits, with reason
`recently_dismissed` or `already_subscribed`, so it stays in the denominator
exactly as a control browser does.

Divide by `count(capture_prompt_shown)`, or by distinct sessions that were shown,
and the asymmetry lands on `variant_a` and understates it by a factor that
depends on how long the query ran. Do not.

## Phase 2 sheet events

Three events, all `variant_a` only, because control renders nothing to dismiss,
submit or tap. Each carries the standard capture context (`surface`, `page_type`,
`team_id`, `variant`).

| Event | Fires when | Notes |
| --- | --- | --- |
| `capture_prompt_dismissed` | the sheet is closed from the PROMPT state | `dismiss_method` is `x`, `backdrop` or `escape` |
| `capture_prompt_submitted` | `/api/subscribe` accepted the POST | `email_domain`, plus `chip_count` and `chip_sources` for what the success state was about to offer |
| `capture_prompt_team_added` | a success-state chip is tapped ON | `added_team_id`, `chip_position`, `source_team_id`, `chip_source` |

`capture_prompt_dismissed` is NOT emitted from the success state, and not while a
submit is in flight. Closing a confirmation is not rejecting a prompt, so folding
the two together would inflate the dismiss rate by exactly the people who
converted. The consequence is that dismissed and submitted are disjoint and
`shown = dismissed + submitted + abandoned` holds with nobody double counted; the
cost is that "closed the confirmation" is not observable at all, which is
deliberate.

### Correction to the Phase 2 spec: the sheet must fire `newsletter_signup`

The Phase 2 instruction listed the sheet's events as `capture_prompt_dismissed`,
`capture_prompt_submitted` and `capture_prompt_team_added`, and did not mention
`newsletter_signup`. Building only those three would have been wrong, and wrong
in a way that produced a believable number rather than an error.

The primary metric above counts conversions as
`maxIf(1, event = 'newsletter_signup')` per person. `capture_prompt_submitted`
appears nowhere in it. A sheet that emitted only the funnel-internal event would
have contributed zero conversions to the query the experiment is decided on, so
`variant_a` would have measured no lift **no matter how well the sheet
performed**, and the obvious reading of that result is "the sheet does not work".

So the sheet fires both, on a successful submit: `newsletter_signup` with
`surface = web_engagement_capture` for the primary metric and every existing
signup dashboard, and `capture_prompt_submitted` as the funnel-internal twin
carrying `email_domain` and the chip exposure. Neither replaces the other.

The general rule this is an instance of: when a new surface converts, it joins
the metric's event, and the surface enum is what distinguishes it. Adding a
parallel event instead makes the surface invisible to every read that already
exists.

Chip uptake is `capture_prompt_team_added` over the `chip_count` on
`capture_prompt_submitted`. Per-rule uptake needs `chip_source` on the adds
against `chip_sources` on the submits; that is the read that answers whether the
venue-city sourcing rule earns its place, since it fires on only a handful of
teams (see `src/lib/capture/chips.ts` on why the table is thin).

`added_team_id` and not `team_id` for the chipped team: `team_id` means the PAGE
team on every other event in this family, and one property meaning two things
across a family is how a dashboard lies quietly.

### Caveat: a handful of synthetic sheet events on 2026-08-02

Browser verification of the sheet ran against a local dev server that carried the
production `NEXT_PUBLIC_POSTHOG_KEY`, so a small number of real capture events
were emitted to this project from `localhost` on 2026-08-02, before the sheet was
merged and before any Phase 2 read window opens. They look like genuine
`variant_a` funnels: `capture_prompt_shown`, `capture_prompt_submitted`,
`capture_prompt_team_added` ×3, `newsletter_signup`, `team_starred`.

Roughly a dozen events across four runs, all from one browser profile on one
machine. **Not purged**, deliberately: deleting events from a live project is a
riskier operation than the distortion they cause, and they sit entirely before
the measurement window.

Two things follow. Bound every Phase 2 query at or after the merge timestamp, as
this runbook already says to for the Phase 1 retune. And if a stray `variant_a`
funnel shows up dated 2026-08-02 with `page_path` on a team page and no matching
production deployment, that is what it is.

The Firestore side was cleaned rather than caveated: those runs created one real
pending subscriber (`source: web_engagement_capture`), which was deleted the same
day after a scan confirmed it was the only one. A test record with that source
would otherwise have landed directly in the Phase 2 numerator, which is the one
place it does real harm. Later verification passes stubbed `/api/subscribe` and
blocked PostHog ingest at the network layer, so they wrote nothing.

## Phase 4: the read that decides the experiment

Written BEFORE the sheet ships, on purpose. A decision rule invented after the
numbers are in is not a decision rule, it is a justification. Everything below
is fixed at merge time; the only thing the data supplies is which branch fires.

### The window, and what bounds it

**Two weeks from the MERGE deployment going Ready. Not from the branch date, not
from the first commit.** `NEXT_PUBLIC_*` values are inlined at build time, so the
sheet does not exist for any visitor until that build is serving. Take the lower
bound from the deployment's `ready` timestamp and paste it into every query in
this section as `PHASE_4_START`.

The synthetic events from browser verification are dated 2026-08-02 and are
described in the caveat above. Any correct bound excludes them automatically;
this is the reason the bound is not optional.

Keep the project's test-account filter on, as everywhere else in this runbook.

### Structural constraint: the arm is not on the guardrail events

`variant` is carried by `page_view`, the `capture_*` family and the four email
funnel events. It is NOT on `team_page_engaged` and NOT on `affiliate_click`.

So **every guardrail below is computed per person, with the arm resolved from
that person's other events**, exactly as the Phase 2 primary does. Do not try to
split a guardrail by a property it does not have: the result will be empty or,
worse, silently partial. One browser has exactly one arm, so any event of that
browser's that carries a real arm will do.

### Primary: signups per 1,000 qualifying browsers, by arm

Unchanged from the Phase 2 definition above, and it is still the honest primary
for the reason given there: a browser that never crossed the threshold was never
going to be prompted in either arm.

One thing that IS new: `newsletter_signup` now carries `variant` at source, so
the conversion no longer has to be recovered by joining a signup back to that
browser's capture events. Use the property, not the join.

```sql
SELECT
    arm,
    countIf(qualified)                                             AS qualifying_browsers,
    countIf(qualified AND signed_up)                               AS signups,
    round(countIf(qualified AND signed_up) / countIf(qualified) * 1000, 1) AS per_1k
FROM (
    SELECT
        person_id,
        anyIf(properties.variant, properties.variant IN ('control', 'variant_a')) AS arm,
        maxIf(1, event IN (
            'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed'
        )) = 1 AS qualified,
        maxIf(1, event = 'newsletter_signup') = 1 AS signed_up
    FROM events
    WHERE timestamp >= toDateTime('PHASE_4_START')
      AND event IN (
          'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed',
          'newsletter_signup', 'page_view'
      )
    GROUP BY person_id
)
WHERE arm IN ('control', 'variant_a')
GROUP BY arm ORDER BY arm
```

### Secondary: signups per 1,000 visitors, by arm

Same query with `qualified` swapped for `maxIf(1, event = 'page_view') = 1`, and
the rate taken over that instead.

Report it ALONGSIDE the primary and never in the same chart. The two denominators
differ by roughly a factor of ten, so an unlabelled rate is unreadable a month
later. The primary answers "does the sheet work on the people who see it"; the
secondary answers "what did this do to the business".

### Guardrails, each by arm

The sheet is an interruption. It can raise signups and still be a net loss, and
these are the four ways that shows up. All four are per person with the arm
resolved as above.

| Guardrail | Definition | Direction that matters |
| --- | --- | --- |
| Engagement | share of persons with at least one `team_page_engaged` | variant_a lower |
| Affiliate | `affiliate_click` per 100 `page_view` | variant_a lower |
| Bounce proxy | share of sessions with exactly one `page_view` | variant_a higher |
| Depth | `page_view` per person, against the 1.65 baseline | variant_a lower |

```sql
SELECT
    arm,
    count()                                                   AS browsers,
    round(countIf(engaged) / count() * 100, 2)                AS engaged_pct,
    round(sum(affiliate_clicks) / sum(pageviews) * 100, 2)    AS affiliate_per_100_pv,
    round(sum(single_pv_sessions) / sum(sessions) * 100, 2)   AS single_pv_session_pct,
    round(sum(pageviews) / count(), 2)                        AS pages_per_visitor
FROM (
    SELECT
        person_id,
        anyIf(properties.variant, properties.variant IN ('control', 'variant_a')) AS arm,
        maxIf(1, event = 'team_page_engaged') = 1              AS engaged,
        countIf(event = 'page_view')                          AS pageviews,
        countIf(event = 'affiliate_click')                    AS affiliate_clicks,
        uniqIf(properties.$session_id, event = 'page_view')   AS sessions,
        countIf(pv_in_session = 1)                            AS single_pv_sessions
    FROM (
        SELECT *, countIf(event = 'page_view') OVER (PARTITION BY properties.$session_id) AS pv_in_session
        FROM events
        WHERE timestamp >= toDateTime('PHASE_4_START')
          AND event IN ('page_view', 'team_page_engaged', 'affiliate_click',
                        'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed')
    )
    GROUP BY person_id
)
WHERE arm IN ('control', 'variant_a')
GROUP BY arm ORDER BY arm
```

The 1.65 pages-per-visitor baseline is the pre-sheet figure. Re-derive it from
the same query run over the two weeks BEFORE `PHASE_4_START` rather than trusting
the number here, because it drifts with traffic mix and a stale baseline turns a
seasonal dip into a false guardrail breach.

### The chip funnel: do the chips earn their pixels

`chip_count` and `chip_sources` are stamped on `capture_prompt_submitted`, which
fires once per successful submit, so exposure and uptake are both available
without a second event.

```sql
-- What was offered
SELECT properties.chip_count AS chips_offered, properties.chip_sources AS sources, count()
FROM events
WHERE event = 'capture_prompt_submitted' AND timestamp >= toDateTime('PHASE_4_START')
GROUP BY chips_offered, sources ORDER BY chips_offered

-- What was taken
SELECT properties.chip_position AS pos, properties.chip_source AS rule, count()
FROM events
WHERE event = 'capture_prompt_team_added' AND timestamp >= toDateTime('PHASE_4_START')
GROUP BY pos, rule ORDER BY pos
```

Uptake is adds over offered. Split by `chip_source` to answer the one question
the venue-city rule was built to have answered: it fires on only a handful of
shared-suburb pairs (see `src/lib/capture/chips.ts`), so if its uptake per chip
offered is not clearly better than the opponent rule's, delete it rather than
carry it.

`chip_position` exists to catch the boring explanation: if uptake collapses with
position, people are tapping the first thing rather than choosing a team, and the
chips are decoration.

### Dismissal: is the sheet read as intrusive

```sql
SELECT properties.dismiss_method AS method, count() AS n,
       round(count() / sum(count()) OVER () * 100, 1) AS pct
FROM events
WHERE event = 'capture_prompt_dismissed' AND timestamp >= toDateTime('PHASE_4_START')
GROUP BY method ORDER BY n DESC
```

The dismiss RATE is dismissals over `capture_prompt_shown` in `variant_a` only.
Remember dismissed is emitted from the prompt state only, so dismissed and
submitted are disjoint and the remainder is abandonment.

Read `escape` and `backdrop` as impatience and `x` as a considered no. A row
dominated by `backdrop` means people are batting it away mid-task.

### Confirm rate: the metric that catches the failure this design risks

**This one is not a PostHog query, and that is not an oversight.**

The failure mode it exists for: the sheet captures well, the chips sit directly
under an unfinished task, attention goes to tapping chips instead of tapping the
link in the email, and fewer records ever confirm. Every other metric on this
page looks HEALTHY while that happens. Capture is up, dismissals are down, chips
show uptake, and the list quietly does not grow.

Two reasons it has to come from Firestore instead:

1. **Confirming happens in an email client, routinely on a different device.**
   Person-level attribution in PostHog would silently drop exactly the people who
   did the right thing.
2. **The arm does not need to be on the subscriber record**, because the sheet
   exists only in `variant_a`. `source == 'web_engagement_capture'` IS the
   treatment arm by construction. Nothing else writes it.

So: over records created since `PHASE_4_START`, compare the confirm rate of
`web_engagement_capture` against the confirm rate of the other `web_*` sources
over the same window, which is the control-equivalent path (a CTA into `/follow`).

```
subscribers where createdAt >= PHASE_4_START
  group by source
  rate = count(status == 'confirmed') / count(*)
```

`status` is `pending | confirmed | unsubscribed` and `confirmedAt` is set on
confirm, so either field answers it. Count `unsubscribed` as confirmed for this
purpose: they clicked the link, then left, which is a different failure.

### The decision rule

Evaluated **in order, first match wins**, the same durability-first shape the
suppression order uses. Written as a rule so it cannot be argued around.

**Rule 0, continuous, from day 1, not day 14.** If any guardrail moves against
`variant_a` past its threshold, **REVERT immediately** without waiting for the
window to close:

- affiliate clicks per 100 pageviews down more than **10% relative** to control
- single-pageview session rate up more than **5 percentage points** absolute
- pages per visitor down more than **10% relative**
- engaged rate down more than **10% relative**

These are one-sided on purpose. `variant_a` being BETTER on a guardrail is
interesting and changes nothing.

**At day 14, in order:**

1. **REVERT** if any Rule 0 threshold is breached.
2. **RETUNE, chips off** if the `web_engagement_capture` confirm rate is below
   **0.7x** the other `web_*` sources' confirm rate over the same window. Ship
   the sheet without the chip row and re-run the two weeks. The capture worked;
   the second ask is what cost the confirmation.
3. **REVERT** if `variant_a` signups per 1,000 qualifying browsers is less than
   or equal to control. The sheet is an interruption that bought nothing.
4. **KEEP** if `variant_a` is at least **1.5x** control on the primary AND the
   95% confidence interval on that ratio excludes 1.0 AND the two arms together
   produced at least **10 signups**.
5. **EXTEND once to 28 days** in every other case, changing nothing. Then
   re-evaluate at rules 1 to 4. If still no match at 28 days, **REVERT**: an
   effect too small to resolve in a month of traffic is too small to justify a
   permanent interruption.

**Why rule 5 exists, stated in advance so it is not mistaken for hedging.** At
roughly 350 browsers a day emitting `page_view` and 9.4% of browsers qualifying,
two weeks yields on the order of 460 qualifying browsers, about 230 per arm. That
is enough to resolve a large effect and nowhere near enough to resolve a small
one. The 10-signup floor in rule 4 stops a 2-versus-0 split being read as
infinite lift. Underpowered is a real outcome and it means keep measuring, not
revert; refusing to name that in advance is how a null gets talked into a win.

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
