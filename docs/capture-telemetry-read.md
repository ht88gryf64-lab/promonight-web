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

## Related

- `src/lib/capture/trigger-engine.ts` — the decision, both floors, the guards
- `src/lib/capture/engaged-timer.ts` — `ENGAGED_FLOOR_MS`, `PROBE_FLOOR_MS`
- `src/lib/capture/suppression.ts` — the reasons, and why `first_pageview` was cut
- `src/lib/analytics.ts` — `CaptureThresholdMetProperties`, the event contract
