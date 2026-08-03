# Reading the capture trigger telemetry

How to read the engagement capture sheet, and before that, how the engaged-time
floor was decided. Written down because several of the correct queries are not
the obvious ones, and the obvious ones are wrong in directions that argue for
the wrong change.

**There is no A/B any more.** The sheet renders for every qualifying visitor.
Why that changed, and what replaces the comparison, is the next section; it is
first because everything below depends on it.

## Why the experiment was dropped

Recorded so this does not read as an omission. The A/B was built, shipped, and
retired before a single number was read from it.

**The arithmetic.** At roughly 350 browsers a day emitting `page_view` and 9.4%
of browsers qualifying, two weeks yields on the order of 460 qualifying
browsers, about 230 per arm. That resolves a large effect and nothing smaller.
The decision rule written in advance had five branches and the honest reading of
the power calculation was that branch five, "underpowered, extend to 28 days",
was the likely outcome. That is a month of showing the sheet to half the people
who could see it, in order to answer a question the source tags already answer.

**What the tags do instead.** `web_engagement_capture` is written by the sheet
and by nothing else. `web_team_page`, `web_homepage`, `web_aggregator` and
`web_playoffs_hub` are written by the static CTAs. Signups split cleanly by
source with no experiment at all. What the split does NOT give is a causal
estimate: it says how many signups arrived through each path, not what would
have happened without the sheet. That trade was made deliberately, on the
grounds that a causal estimate nobody has the traffic to resolve is not worth a
month of half-delivery.

**What was kept, and why.**

1. **The arm machinery is intact and inert.** `resolveVariant` still flips a
   coin, still persists it, still never reassigns, and the arm is still stamped
   on `page_view`, `newsletter_signup`, `follow_page_view` and the `capture_*`
   family. Nothing branches on it. It stays because that plumbing is the entire
   setup cost of the next experiment, it is already live and already
   accumulating a balanced assignment, and removing it costs a branch now and
   another branch the first time we want to test something. See
   `src/lib/capture/variant.ts`.
2. **The guardrail watch is intact, reframed pre/post.** Same four metrics, same
   thresholds, compared against the two weeks before the sheet first rendered
   instead of against a control arm. Losing the control arm loses the
   comparison; it does not lose the ability to notice a break.

**The one thing to do before the evidence expires — DONE, see below.** The
half-traffic window contains a genuine randomized control group. It is
underpowered, which is why the experiment was dropped, but it is the only
unconfounded guardrail read that will ever exist for this feature: seasonality,
traffic mix and news cycles all cancel inside it and none of them cancel in a
pre/post. It was run once before merge and the numbers are recorded in
[the half-traffic reading](#half-traffic-reading) below.

## The half-traffic reading: a record that we looked, 2026-08-03

<a id="half-traffic-reading"></a>

> ### THE FINDING IS ABOUT THE THRESHOLDS, NOT ABOUT THE SHEET
>
> **Two of the four guardrails cross their REVERT threshold in the table below,
> and both crossings are pure noise.** The affiliate one reads "down 100%
> relative" and is three clicks against zero, on a denominator where the control
> rate itself predicts 2.2 expected clicks — observing zero is entirely
> ordinary. The engaged one reads "down 33% relative" and is 4 of 15 against 10
> of 25.
>
> Thresholds written for a two-week window are not merely imprecise at two
> hours. **They are actively misleading**, because they produce confident,
> plausible, one-sided breach signals out of nothing. Anyone glancing at this
> table cold will read two breaches. There are none.
>
> This is the same failure class the matched-length baseline rule exists to
> prevent, arriving by the other door: there, a short post window manufactures a
> breach against a long baseline; here, a small sample manufactures one against
> a threshold calibrated for a large one. **Do not act on a relative threshold
> until the denominators are in the hundreds. Read the counts, never the
> percentages.**

**THIS IS NOT A MEASUREMENT. It is a record that we looked.** It resolves
nothing and was never going to. It exists because the half-traffic window is the
only randomized comparison this feature will ever have, and merging ends it
permanently — so the choice was between capturing something uninterpretable and
capturing nothing. Anyone citing this section as evidence for or against the
sheet has misread it.

Taken at `2026-08-03T01:49Z`, over the whole half-traffic window to that point:
`2026-08-02T23:24:34Z` to `2026-08-03T01:49:18Z`. **That is 2 hours and 25
minutes of traffic.** An earlier draft of this file called it roughly a day; it
was never close to a day, and the distinction is the whole reason the numbers
below cannot be read as a result. Raw `execute-sql`, so the project's
test-account filter is off and our own browsing is included; at n=40 that matters
more than it usually does.

| Guardrail | control | variant_a | Direction | Threshold | Fisher p |
| --- | --- | --- | --- | --- | --- |
| Engaged rate | 40.0% (10/25) | 26.7% (4/15) | worse — NOISE | down >10% rel | 0.502 |
| Affiliate per 100 pv | 7.89% (3/38) | 0.0% (0/28) | worse — NOISE | down >10% rel | 0.256 |
| Single-pv session rate | 72.0% (18/25) | 42.9% (6/14) | better | up >5pp abs | 0.095 |
| Pages per visitor | 1.52 | 1.87 | better | down >10% rel | — |

Browsers: 25 control, 15 variant_a in the guardrail population; 24 / 14 on
`page_view` specifically, a fair-coin two-tailed p of 0.143 and so unremarkable.

**No guardrail breach detected at n=40, and n=40 cannot detect anything short of
catastrophic.** Nothing here is close to significant; the largest p is 0.502 and
the smallest 0.095.

### Nobody has ever used a sheet. Read this before running any query below

**`capture_prompt_submitted` and `capture_prompt_dismissed` DO NOT EXIST in the
project taxonomy as of 2026-08-03.** Not "are rare" — the event names have never
been seen. PostHog returns a did-you-mean suggestion for them.

Across the entire half-traffic window, 6 `capture_prompt_shown` events fired
across 4 browsers, 5 in control and 1 in `variant_a`. The 5 control ones rendered
nothing, by design. **So exactly one browser has ever had a sheet appear, and
none has ever submitted or dismissed one.**

The consequence, and the reason this warning is here rather than in a footnote:

> **The chip funnel, the dismissal read, and the Firestore confirm rate all
> return EMPTY today, and empty means "nobody has seen it yet", NOT "nobody
> converted".** Those two look identical in a result set and imply opposite
> actions. Before drawing any conclusion from a zero, check whether the event
> exists in the taxonomy at all.

This is expected right now and stops being expected quickly. Once full traffic
has run for a day, those two events existing is the smoke test that the sheet is
not merely rendering but usable; their continued absence would mean the sheet
appears and nothing can be done with it, which no unit test catches.

<a id="smoke-test"></a>

### The smoke test — due `2026-08-04T12:24:50Z`

24 hours after `LIVE_FIXED_START`. **Existence, not rates.** No thresholds, no
decision rule, no guardrail reading — Rule 0 runs continuously against the
matched-length baseline and is not part of this.

1. **Do `capture_prompt_submitted` and `capture_prompt_dismissed` exist in the
   taxonomy yet?** They never have. Check the event names resolve at all before
   reading any count, because an empty result and a nonexistent event look
   identical and imply opposite actions.
2. **Are they firing since `LIVE_FIXED_START`?** A count above zero for each is
   the pass. Zero after a day of full traffic means the sheet renders and cannot
   be interacted with, which is the failure no test catches.
3. **The `dismiss_method` distribution.** New, and the reason it is in a smoke
   test rather than a read: `handle` did not exist before `LIVE_FIXED_START` and
   is now the primary dismissal. Whether visitors actually reach for it, versus
   the X, versus backdrop, is the first evidence the affordance works at scale
   rather than for one person who knew what he was looking for.

```sql
SELECT properties.dismiss_method AS method, count() AS n, uniq(person_id) AS browsers
FROM events
WHERE event = 'capture_prompt_dismissed'
  AND timestamp >= toDateTime('2026-08-03T12:24:50Z')
GROUP BY method ORDER BY n DESC
```

Read the counts, never the percentages — the denominators will be tiny. A
`handle` row that exists at all is the signal. Its SHARE means nothing yet, and
per the note on `CaptureDismissMethod` the handle also renders on desktop, so
split by device before inferring anything about the iOS case it was built for.

### Two things about the query itself

- **`affiliate_click` carries no `variant`, exactly as the structural note
  says.** All 7 affiliate clicks in the window group under an empty arm on the
  event; 3 belong to persons resolvable as control from their other events, 0 to
  `variant_a`, and 4 to persons carrying no arm at all. Per-person resolution
  recovers 3 of 7. At scale that loss is proportionate and harmless; at n=7 it is
  most of the data.
- Aliasing an outer aggregate to the same name as the inner column
  (`sum(affiliate_clicks) AS affiliate_clicks`) fails with "aggregate function
  found inside another aggregate function". Give the outer totals distinct names.

## The three trigger events

| Event | Fires when | Guarded |
| --- | --- | --- |
| `capture_threshold_met` | gesture threshold AND 30 engaged seconds | once per pathname |
| `capture_prompt_shown` | gesture threshold AND 45 engaged seconds, not suppressed | once per pathname, and once per session via `markShown` |
| `capture_prompt_suppressed` | gesture threshold AND 45 engaged seconds, suppressed | once per pathname |

`capture_prompt_shown` means the trigger FIRED. The sheet render happens off the
back of it, and the event went out unchanged through the telemetry-only phase
when nothing rendered at all, which is what makes trigger rates comparable
across every phase this feature has had.

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

## The engaged-time floor read

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
-- The retune's own production deploy, which is EARLIER than every window in
-- "The windows, and what bounds them" below: this read predates the sheet.
WHERE timestamp >= toDateTime('RETUNE_DEPLOY_READY')
  AND event IN ('capture_threshold_met', 'capture_prompt_shown')
```

`sessions_lost_30_to_45` is the answer: the number of sessions that would gain a
prompt if the floor moved from 45 seconds to 30.

### Why raw event subtraction is wrong

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

### What this read cannot tell you

It sizes the WHOLE 30-to-45 band, not its shape. `seconds_on_page` on the probe
records when the visitor crossed the threshold, not when they left, so the data
cannot distinguish a visitor who left at 31 seconds from one who left at 44. A
floor of 35 or 40 cannot be sized from these events. The only two floors this
read compares are 45 (current) and 30 (the probe).

If an intermediate floor becomes interesting, that needs a second probe at that
mark, not an interpolation of this one.

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

## The windows, and what bounds them

Five regimes, and mixing them is the easiest way to produce a wrong number.

| Regime | From | To | Who saw the sheet |
| --- | --- | --- | --- |
| Pre-sheet | (open) | `2026-08-02T23:24:34Z` | nobody |
| Half traffic | `2026-08-02T23:24:34Z` | `2026-08-03T02:09:23Z` | `variant_a` only |
| **All traffic, BROKEN on iOS** | `2026-08-03T02:09:23Z` | `2026-08-03T02:27:15.563Z` | everyone who qualifies, **and iOS visitors could not dismiss it** |
| Dark | `2026-08-03T02:27:15.563Z` | `2026-08-03T12:24:50.550Z` | nobody |
| All traffic, fixed | `2026-08-03T12:24:50.550Z` | (open) | everyone who qualifies |

The half-traffic regime lasted **2 hours 45 minutes** in total. It is far too
short to carry any read on its own; what it holds is recorded in
[the half-traffic reading](#half-traffic-reading) and should be treated as a
record that we looked, not as a result.

**The broken window is 17 minutes 53 seconds long and it is not a normal window.**
It is recorded rather than folded into the all-traffic regime because during it
the sheet rendered with no reachable dismissal on any iOS browser at page scale
above 1.02: `position: fixed` sized against the layout viewport, iOS zoom being a
visual-viewport transform, and the close X sitting 6px from the panel's right
edge. See `docs/known-issues.md` entry 10. Anyone reading signup, dismissal or
guardrail data that touches 02:09:23Z–02:27:15Z needs to know the prompt was
undismissable on iOS for that entire window. Do not treat any behaviour inside it
as a preference. A signup there may be a visitor who could not find the way out.

The **dark** window is not a pre/post baseline either. The sheet did not render at
all, so it looks like the pre-sheet regime in the events and is not: browsers that
dismissed or subscribed in the three regimes before it still carry their
suppressors through it.

> ### `PHASE_4_START = 2026-08-02T23:24:34Z`
>
> The sheet's first exposure to any visitor. Deployment
> `dpl_6zGLLdts27kEQb5JpVZS8F3TUHpW`, merge commit `427f98c`. It is the `ready`
> value and not `createdAt`: the build began at 23:21:55 and took 159 seconds,
> and no visitor could reach the sheet during those 159 seconds.

> ### `ALL_TRAFFIC_START = 2026-08-03T02:09:23Z`
>
> The first moment any qualifying visitor could see the sheet regardless of arm.
> Deployment `dpl_6x98e4YHf1D1P1aCmgsHttXYGh8F`, merge commit `c8e0596`.
>
> It is the `ready` value and not `createdAt`: the build began at 02:06:46Z and
> took 157 seconds, and no visitor could reach the un-gated sheet during those
> 157 seconds. `NEXT_PUBLIC_*` values are inlined at build time, so the change
> did not exist for anyone until that build was serving.
>
> **HISTORICAL. DO NOT USE THIS AS A QUERY BOUND.** The window it opens ran for
> 17m53s and was broken on iOS throughout. `LIVE_FIXED_START` below is the bound
> every query in this runbook now takes. This constant is kept so the broken
> window has a name and cannot be silently absorbed into the clean one.

> ### `TRIGGER_OFF = 2026-08-03T02:27:15.563Z`
>
> The sheet went dark. `NEXT_PUBLIC_CAPTURE_TRIGGER` set to `false` for
> Production and rebuilt, deployment `dpl_AE6YihV4ZCYmabTAHyt56ZfBxheK`. Killed
> on a report that the panel overflowed the viewport on a real iPhone 15 Pro with
> the close button off-screen — the shape Google's intrusive-interstitial penalty
> targets, with the Raptive window opening 2026-09-27.
>
> Verified dark rather than assumed: the gate is server-side, so with the flag
> off the RSC payload carries no chip pool. `venueCity` and `opponents` were
> present on the previous build and absent on this one, on both a team page and
> an `AggregatorPage` aggregator.

> ### `LIVE_FIXED_START = 2026-08-03T12:24:50.550Z`
>
> **The bound every query below takes.** The sheet live to all traffic with a
> dismissal that survives a scaled viewport. Deployment
> `dpl_4GepqQLoZfXe5b2XJH5Sin9jz5TG`, merge commit `95fdbf9`. `ready`, not
> `createdAt`: the build began at 12:21:49Z and took 181 seconds.
>
> Same positive control, run in the other direction: `venueCity` and `opponents`
> are present again on both surfaces.
>
> What changed under it: every text input is now >=16px so iOS cannot auto-zoom
> on focus, and the dismissal is a centred grab handle that holds to page scale
> 1.75 in portrait and 1.28 in the landscape corner card, against the X's 1.03.
> Measured on real WebKit, not derived. A new `handle` value joins
> `dismiss_method`; it cannot appear before this timestamp.

**Everything before `ALL_TRAFFIC_START` is half traffic. Everything after
`LIVE_FIXED_START` is full traffic on a sheet that works.** The three regimes in
between are short, and no query may straddle any of them without splitting on it.

The half-traffic window is not a baseline for anything pre/post. It is diluted
by roughly half, so a guardrail computed across it understates any real effect by
about a factor of two and a signups rate across it understates the sheet's reach
by the same. Either bound a query inside one regime or split the arm.

**The regimes leak forward, and a timestamp bound cannot stop them.** The two
durable suppressors are browser state, not events: `promonight:subscribed` is
permanent and `promonight:capture_dismissed_at` lasts 30 days. Every `variant_a`
browser that dismissed or submitted during the half-traffic window carries that
suppressor into the all-traffic window and is silent there. So for the first
month of all-traffic reads, the qualifying population is missing a slice of
exactly the browsers that had already engaged with the sheet — which biases the
early signups rate DOWN, since the people most likely to convert already did.

Nothing in the data marks them, so this is a caveat rather than a filter. It
decays to nothing by roughly `ALL_TRAFFIC_START + 30 days` for the dismissal
half and never for the subscribed half, though the subscribed half is small and
is a conversion that already counted once. Weight an early read accordingly and
do not read a soft first week as the sheet failing.

The synthetic events from browser verification, described in the caveat below,
share a DATE with `PHASE_4_START`, which is why that bound carries a time: they
run from roughly 15:00Z to 23:00Z on 2026-08-02 and the window opens at
23:24:34Z. A bound of `2026-08-02` alone would include them. Use the time.

Keep the project's test-account filter on, as everywhere else in this runbook.

## Signups by source: the sheet against the static CTAs

**This is the primary read now.** It replaces the arm-vs-arm comparison, and it
works because the source tags are genuinely disjoint end to end.

### The tags

| Tag | Written by | Where |
| --- | --- | --- |
| `web_engagement_capture` | the capture sheet's submit, and nothing else | `src/components/capture/CaptureCard.tsx` |
| `web_team_page` | the in-content team-page CTA, and the global footer CTA on a team route | `RedesignTeamPage.tsx`, `FollowFooterCTA.tsx` |
| `web_homepage` | the homepage CTA, and the footer on `/` | `RedesignHomePage.tsx`, `FollowFooterCTA.tsx` |
| `web_aggregator` | the in-content CTA on aggregator pages, and the footer on `/promos/*` and `/best-promos` | `aggregator-layout.tsx`, `FollowFooterCTA.tsx` |
| `web_playoffs_hub` | the footer on `/playoffs*`, and only the footer | `FollowFooterCTA.tsx` |
| `web_other` | the footer on any route none of the above match | `lib/follow-surface.ts` |

**`web_other` is bigger than "safety net" implies, and it is four things at
once**: the footer tag on roughly twenty routes, the fallback for junk input,
the value a forged `?source=` is demoted to, and the read-back for a stored
source that is missing or unrecognised. In PostHog you can separate those with a
`page_path` breakdown, because `track()` stamps the path on every event. On the
Firestore record you cannot: there is no path and no page type stored. Treat
`web_other` as uninterpretable on the Firestore side.

The largest single contributor is a real gap rather than junk: **the league hubs
(`/mlb`, `/wnba`, `/mls`) and every CFB page infer `web_other`.** They are
one-segment or non-sport paths, so they miss the two-segment team-page rule, and
none of them carries an in-content CTA or a capture sheet, so the footer is
their only capture entry. Closing it needs new surface values, not adding `cfb`
to the sport list, which would fold 86 sheet-less pages into `web_team_page` and
contaminate the sheet's own comparison group.

**Where the sheet actually mounts**, which is narrower than "aggregator pages"
suggests: the team-page template, and the six `/promos/*` collection pages that
render `AggregatorPage`. It does NOT mount on `/promos/today`, on `/best-promos`,
or on the league hubs, all of which are still tagged `web_aggregator` or
`web_other` by the footer. So a `web_aggregator` signup is not necessarily a
sheet signup, which is exactly why `web_engagement_capture` is a separate value
rather than a flag on the aggregator tag.

The vocabulary is defined once, in `src/lib/follow-surface.ts`, and is shared by
the PostHog event property `surface` and the Firestore `subscribers.source`
field, so a `newsletter_signup` joins cleanly to the record it created.

### Three things about the tags that will produce a wrong number

**1. `properties.surface` is the tag. `properties.source` is NOT.** `track()`
stamps an attribution `source` on every event: `utm_source`, or the referrer
host, or `direct`. It has nothing to do with this vocabulary.
`WHERE properties.source = 'web_engagement_capture'` returns zero rows and no
error. The queries in this file alias `properties.surface AS source` for
readability because the Firestore FIELD is called `source`; do not carry the
alias back into a `WHERE`.

**2. Always pin the event name.** `surface` carries four unrelated vocabularies
across this app: `CaptureSurface` (this one), the much larger `AnalyticsSurface`
used by pageviews and affiliate clicks, a scoring-page enum, and a couple of bare
literals. `web_team_page` and `web_other` are members of BOTH `CaptureSurface`
and `AnalyticsSurface`, and page and affiliate volume dwarfs funnel volume on
those values. An unfiltered `GROUP BY surface` is not a funnel breakdown, it is
a mixture. The same applies to `page_type`, which the ad-slot events also carry
with their own vocabulary.

**3. The whole team-page funnel sits behind `NEXT_PUBLIC_REDESIGN_V2`.** The
sheet, the in-content CTA and the global footer CTA all live inside the redesign
tree. Turning that flag off, which is the documented redesign rollback, does not
degrade the tags, it removes all three at once and the team-page arm of this
comparison goes to zero. If the flag is flipped during a read window, that is a
window boundary, not a result.

### The query

```sql
SELECT
    toDate(timestamp)          AS day,
    properties.surface         AS source,
    properties.page_type       AS placement,   -- non-empty only for the sheet
    uniq(person_id)            AS browsers,
    count()                    AS signups
FROM events
WHERE timestamp >= toDateTime('LIVE_FIXED_START')
  AND event = 'newsletter_signup'
GROUP BY day, source, placement
ORDER BY day, source
```

Read `browsers` for a rate and `signups` for a total; they differ only when one
person signs up twice, which a re-submit does produce.

For the headline "sheet versus static CTA", collapse to two rows:

```sql
SELECT
    if(properties.surface = 'web_engagement_capture', 'sheet', 'static_cta') AS path,
    uniq(person_id) AS browsers,
    count()         AS signups
FROM events
WHERE timestamp >= toDateTime('LIVE_FIXED_START')
  AND event = 'newsletter_signup'
GROUP BY path
```

### Normalising it: signups per 1,000 qualifying browsers

The raw counts answer "where did signups come from". They do not answer "does
the sheet work on the people who see it", because the two paths have wildly
different denominators: the sheet can only reach a browser that crossed the
engagement threshold, while a CTA is on the page for everyone.

Per PERSON, never per session and never per event. The randomization unit for
anything that ever gets randomized is the browser profile: the arm lives in
`localStorage` (`KEY_VARIANT`) and survives tab close, navigation and session
rotation, while `sessionStorage` (`KEY_SESSION`) is a treatment-delivery cap
rather than a unit. Analysing per session gives several correlated observations
per unit and understates variance, which INFLATES significance.

The units line up exactly, which is worth knowing rather than assuming:
`person_profiles: 'identified_only'` is set with no `identify()` call anywhere,
so PostHog's `person_id` is a deterministic UUIDv5 of the anonymous
`distinct_id`, and that id and the arm share a storage lifetime. Verified
empirically on 2026-08-01: 0 of 117 browsers ever reported two arms.

**Each path gets its own denominator, and they are not the same denominator.**
The sheet is normalised over browsers that QUALIFIED, because that is the only
population it can reach. The static CTAs are normalised over browsers that
VISITED, because that is the population they are on the page for. Reporting a
rate for one and a raw count for the other is not a comparison, and reporting
both over the same denominator answers neither question.

```sql
SELECT
    countIf(qualified)                                   AS qualifying_browsers,
    countIf(visited)                                     AS visiting_browsers,
    countIf(qualified AND signed_up_via_sheet)           AS sheet_signups,
    countIf(visited AND signed_up_via_cta)               AS cta_signups,
    round(countIf(qualified AND signed_up_via_sheet)
          / countIf(qualified) * 1000, 1)                AS sheet_per_1k_qualifying,
    round(countIf(visited AND signed_up_via_cta)
          / countIf(visited) * 1000, 1)                  AS cta_per_1k_visiting,
    -- The sheet on the SAME denominator as the CTA. This is the pair that is
    -- directly comparable; the two above are each path judged on its own terms.
    round(countIf(visited AND signed_up_via_sheet)
          / countIf(visited) * 1000, 1)                  AS sheet_per_1k_visiting
FROM (
    SELECT
        person_id,
        maxIf(1, event IN (
            'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed'
        )) = 1 AS qualified,
        maxIf(1, event = 'page_view') = 1 AS visited,
        maxIf(1, event = 'newsletter_signup'
                 AND properties.surface = 'web_engagement_capture') = 1 AS signed_up_via_sheet,
        maxIf(1, event = 'newsletter_signup'
                 AND properties.surface != 'web_engagement_capture') = 1 AS signed_up_via_cta
    FROM events
    WHERE timestamp >= toDateTime('LIVE_FIXED_START')
      AND event IN (
          'capture_threshold_met', 'capture_prompt_shown', 'capture_prompt_suppressed',
          'newsletter_signup', 'page_view'
      )
    GROUP BY person_id
)
```

Three rates, and you have to say which one you are quoting.
`sheet_per_1k_qualifying` answers "does the sheet work on the people who see
it". `sheet_per_1k_visiting` and `cta_per_1k_visiting` are the pair that answer
"what did each path do to the business", and only those two may be put side by
side.

Never put `sheet_per_1k_qualifying` next to `cta_per_1k_visiting`. The
denominators differ by roughly a factor of ten (9.4% of browsers qualified in
the first post-retune window), so that pairing overstates the sheet by about 10x
and looks entirely plausible.

`qualified` is a subset of `visited` in practice but not by construction:
`page_view` is deferred behind `requestIdleCallback` while the capture events
need 30+ engaged seconds, so a browser that qualifies has almost certainly
reported a pageview. Almost. Do not write a query that assumes the containment.

### Why the denominator is a qualifying BOOLEAN and not a shown count

Because the shown count decays and the boolean does not.

Dismissing or submitting writes a durable suppressor:
`promonight:capture_dismissed_at` silences a browser for 30 days,
`promonight:subscribed` permanently. Both are written by `CaptureCard.tsx` and
by nothing else. So `capture_prompt_shown` per browser falls the longer a window
runs, and falls further in a window that opens at launch than in one that opens
a month later. A rate built on `COUNT(capture_prompt_shown)` is reading the
suppression schedule.

The `qualified` boolean sidesteps it: a browser counts once if it ever emitted
`capture_threshold_met`, `capture_prompt_shown` OR `capture_prompt_suppressed`.
A suppressed browser still emits, with reason `recently_dismissed` or
`already_subscribed`, so it never leaves the denominator. Divide by distinct
sessions shown, or by shown events, and the decay lands directly on the sheet
and understates it by a factor that depends on how long the query ran.

This warning used to be about the two arms diverging. It is not any more, and
that is not the same as it going away: the axis moved from arm to time.

### Separating the two sheet placements

The sheet has two placements and both write `web_engagement_capture`:

- the **team-page sheet** (`RedesignTeamPage.tsx` to `CaptureTriggerHost`,
  `page_type = 'team_page'`), which names the team and offers a chip row
- the **aggregator sheet** (`aggregator-layout.tsx`, `page_type = 'aggregator'`),
  which has no page-level team and, because it is passed `EMPTY_CHIP_POOL`, no
  chip row at all

They are materially different products and folding them into one number hides
that. `page_type` is what tells them apart. It rides on every `capture_prompt_*`
event and, since this change, on `newsletter_signup` too, so the split is a
`GROUP BY` rather than a join back to `capture_prompt_submitted`.

**On the Firestore side they are NOT separable.** `subscribers.source` is a
single value and there is no `page_type` on the record. The `teams` array looks
like a discriminator (the team-page sheet posts one team, the aggregator sheet
posts none) but it is not reliable: teams are MERGED on later submits by
`upsertSubscriber`, so an aggregator-created record grows a non-empty `teams`
the first time that person saves a team anywhere. Do not use it. If the confirm
rate ever needs splitting by placement, that needs a stored field, and the place
to add it is `upsertSubscriber`'s creation branch, written once and never
backfilled, exactly as `source` and the geo fields are.

## Confirm rate by source: the metric that catches what this design risks

**This one is not a PostHog query, and that is not an oversight.** It is
unchanged by dropping the experiment, and it is still the read most likely to
catch a real failure.

> **Returns empty as of 2026-08-03.** No sheet had ever been submitted in
> production, so no subscriber record carried
> `source: web_engagement_capture` — the one created during browser
> verification was deleted the same day. A missing row here today means the
> sheet has not been used, not that it fails to convert. See
> [the half-traffic reading](#half-traffic-reading).

The failure mode it exists for: the sheet captures well, the chips sit directly
under an unfinished task, attention goes to tapping chips instead of tapping the
link in the email, and fewer records ever confirm. Every other metric on this
page looks HEALTHY while that happens. Capture is up, dismissals are down, chips
show uptake, and the list quietly does not grow.

Two reasons it has to come from Firestore:

1. **Confirming happens in an email client, routinely on a different device.**
   Person-level attribution in PostHog would silently drop exactly the people who
   did the right thing.
2. **`source` is the tag, and it is enough.** `web_engagement_capture` means the
   sheet: no other path in the app writes it. The sheet POSTs it directly to
   `/api/subscribe`, and the `/follow` page cannot be talked into it by a crafted
   `?source=` param, because that boundary coerces through `coerceEntrySurface`,
   which excludes it (`src/lib/follow-surface.ts`). That used to be true by
   convention; it is now true by construction, and
   `src/lib/__tests__/follow-surface.test.ts` fails if it stops being.

   **It is not an authenticity guarantee, and do not read it as one.**
   `/api/subscribe` takes `source` from an untrusted request body by design:
   that POST IS the sheet's submit and nothing distinguishes it from a
   hand-rolled one. Narrowing it would unlabel every real sheet conversion, so
   it stays wide, and the per-IP rate limit (5 POSTs / 10 min) is the only thing
   in the way. **The tell is direction.** Forged records are Firestore-only,
   because `newsletter_signup` is emitted client-side by the sheet itself. So
   Firestore running AHEAD of PostHog on this surface means forgery. Firestore
   running BEHIND is the ordinary creation-only undercount described below.
   Those two are the same magnitude of gap pointing opposite ways; check the
   sign before diagnosing either.

So: over records created since `LIVE_FIXED_START`, compare the confirm rate of
`web_engagement_capture` against the confirm rate of the other `web_*` sources
over the same window.

```
subscribers where createdAt >= LIVE_FIXED_START
  group by source
  rate = count(status == 'confirmed') / count(*)
```

`status` is `pending | confirmed | unsubscribed` and `confirmedAt` is set on
confirm, so either field answers it. Count `unsubscribed` as confirmed for this
purpose: they clicked the link, then left, which is a different failure.

**Threshold, carried over from the retired decision rule because it was the one
branch worth keeping.** If the `web_engagement_capture` confirm rate is below
**0.7x** the other `web_*` sources' confirm rate over the same window, ship the
sheet without the chip row. The capture worked; the second ask is what cost the
confirmation. That is a retune, not a revert.

### The caveat that will bite: `source` is creation-only

`upsertSubscriber` sets `source` from the request on the `!snap.exists` branch
only (`src/lib/subscribers.ts`). The pending/unsubscribed branch does write the
field, but as `data.source ?? source` — the stored value always wins — and the
already-confirmed branch does not touch it at all. So an existing subscriber who
converts again through the sheet keeps whatever source their record was created
with.

The one exception is the `??`: a legacy record carrying NO source picks one up
from the next submit, and that submit could be years after the record was made.
Those are pre-`source` records, so they predate every window here and the
`createdAt >=` bound excludes them anyway.

Consequences, both real:

- **Firestore undercounts sheet signups relative to PostHog.** PostHog counts
  the event; Firestore counts the record, and only new records carry the tag.
  The gap is repeat submitters. Do not reconcile the two totals and do not treat
  a difference as a tracking bug.
- **The confirm rate is a rate over NEW records only, which is correct for this
  question.** A record that already existed has already confirmed or already
  failed to, and re-counting it would answer a different question. Keep the
  `createdAt >=` bound; it is doing real work, not just excluding history.

## The chip funnel: do the chips earn their pixels

> **Returns empty as of 2026-08-03, and empty means "not yet seen", not "chips
> do not work".** `capture_prompt_submitted` and `capture_prompt_team_added` had
> never fired in production at that date; `capture_prompt_submitted` was not in
> the taxonomy at all. See [the half-traffic reading](#half-traffic-reading).
> Confirm the events exist before interpreting a zero here.

`chip_count` and `chip_sources` are stamped on `capture_prompt_submitted`, which
fires once per successful submit, so exposure and uptake are both available
without a second event.

```sql
-- What was offered
SELECT properties.chip_count AS chips_offered, properties.chip_sources AS sources, count()
FROM events
WHERE event = 'capture_prompt_submitted' AND timestamp >= toDateTime('LIVE_FIXED_START')
GROUP BY chips_offered, sources ORDER BY chips_offered

-- What was taken
SELECT properties.chip_position AS pos, properties.chip_source AS rule, count()
FROM events
WHERE event = 'capture_prompt_team_added' AND timestamp >= toDateTime('LIVE_FIXED_START')
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

Filter to `page_type = 'team_page'` if you want a clean read. The aggregator
sheet is offered no chips at all, so it contributes a `chip_count` of 0 to the
exposure side and nothing to the uptake side, which drags the average down for a
reason that has nothing to do with whether chips work.

## Dismissal: is the sheet read as intrusive

> **Returns empty as of 2026-08-03.** `capture_prompt_dismissed` was not in the
> project taxonomy at that date — no visitor had ever dismissed a sheet, because
> only one browser had ever been shown one. A zero dismiss rate today is not a
> sheet nobody minds; it is a sheet nobody has met. See
> [the half-traffic reading](#half-traffic-reading).

```sql
SELECT properties.dismiss_method AS method, count() AS n,
       round(count() / sum(count()) OVER () * 100, 1) AS pct
FROM events
WHERE event = 'capture_prompt_dismissed' AND timestamp >= toDateTime('LIVE_FIXED_START')
GROUP BY method ORDER BY n DESC
```

The dismiss RATE is dismissals over `capture_prompt_shown` in the same window.
Dismissed is emitted from the prompt state only, and not while a submit is in
flight, so dismissed and submitted are disjoint and `shown = dismissed +
submitted + abandoned` holds with nobody double counted. The cost is that
"closed the confirmation" is not observable at all, which is deliberate.

Read `escape` and `backdrop` as impatience. `x` and `handle` are BOTH deliberate
closes; sum them for a considered-no rate. A row dominated by `backdrop` means
people are batting it away mid-task.

**Do not read the `handle`-vs-`x` split as sentiment.** It is an affordance
question, not an attitude one. Before this split existed, `x` was the only
deliberate-close control and so was a complete partition of considered-no; it is
not any more, and a `x` row that collapses after 2026-08-03 is that split, not a
change in how people feel about the sheet. The handle also renders at every
width — `CaptureSheet.tsx` deliberately does not `sm:hidden` it — so desktop
pointer clicks land in the same bucket and are not evidence about iOS
reachability. Split on device before inferring anything. And the handle is
tap-only while looking like something you drag, so a low `handle` share is a
floor on reach-for behaviour rather than a measurement of it.

<a id="guardrails-pre-post"></a>

## Guardrails: pre/post, continuous, from day 1

The sheet is an interruption. It can raise signups and still be a net loss, and
these are the four ways that shows up. **Watch these from day 1, not at some
review date.** They are the reason this could be a mistake.

| Guardrail | Definition | Direction that matters |
| --- | --- | --- |
| Engagement | share of persons with at least one `team_page_engaged` | post lower |
| Affiliate | `affiliate_click` per 100 `page_view` | post lower |
| Bounce proxy | share of sessions with exactly one `page_view` | post higher |
| Depth | `page_view` per person | post lower |

**REVERT immediately, without waiting for any window to close, if any of:**

- affiliate clicks per 100 pageviews down more than **10% relative** to baseline
- single-pageview session rate up more than **5 percentage points** absolute
- pages per visitor down more than **10% relative**
- engaged rate down more than **10% relative**

These are one-sided on purpose. The post window being BETTER on a guardrail is
interesting and changes nothing.

### The baseline window, named explicitly

> ### `BASELINE = 2026-07-19T23:24:34Z` to `2026-08-02T23:24:34Z`
>
> The fourteen days immediately before the sheet first rendered for anyone.
> **The comparator for the day-14 read.** For an earlier check, use the matched
> shorter window ending at `2026-08-02T23:24:34Z` — see the section below.

That window is clean in the only sense that matters here: **nothing rendered in
it.** The capture trigger telemetry went live partway through, around
2026-07-30, and telemetry is not treatment — it emits events and touches no
guardrail. Every one of these fourteen days is a day on which no visitor saw a
sheet.

Do not use the half-traffic window as a baseline. It is half-treated, so it
flatters the post window by roughly a factor of two and will hide a real breach.

**Re-derive the baseline from the query below rather than trusting any number
written here.** Traffic mix drifts, and a stale baseline turns a seasonal dip
into a false guardrail breach. The pre-sheet pages-per-visitor figure on record
is 1.65; treat it as a sanity check on your re-derivation, not as the baseline.

### MATCH THE WINDOW LENGTHS. Two of the four metrics are otherwise meaningless

**This is the trap in the whole pre/post reframe, and it fires in the direction
of a false REVERT on day 1.**

Two of the four metrics grow with window length for reasons that have nothing to
do with the sheet:

- **`pages_per_visitor`** is `sum(pageviews) / count(distinct persons)`. Over a
  longer window the same person returns and accumulates more pageviews, so the
  ratio rises monotonically with the window.
- **`engaged_pct`** is the share of persons with at least one
  `team_page_engaged`. More days means more chances to have one, so it rises too.

The other two are ratios of two quantities that scale together and are roughly
window-invariant.

So comparing a three-day post window against a fourteen-day baseline shows
`pages_per_visitor` and `engaged_pct` **down by a large margin, always, in every
possible world**, including one where the sheet did nothing at all. Both of those
have "down more than 10% relative" thresholds. Run naively on day 1, this
reverts a healthy feature.

**The rule: at a day-N check, the baseline is the N days immediately before
`LIVE_FIXED_START`, not the full fourteen.** The fourteen-day `BASELINE` above
is the comparator for the day-14 read and for nothing else. Same length, same
day-of-week coverage where possible, since weekend traffic differs.

### The query, run twice

Run it once over the matched-length baseline window and once over the post
window, and compare the four columns.

```sql
SELECT
    count()                                                   AS browsers,
    round(countIf(engaged) / count() * 100, 2)                AS engaged_pct,
    round(sum(affiliate_clicks) / sum(pageviews) * 100, 2)    AS affiliate_per_100_pv,
    round(sum(single_pv_sessions) / sum(sessions) * 100, 2)   AS single_pv_session_pct,
    round(sum(pageviews) / count(), 2)                        AS pages_per_visitor
FROM (
    SELECT
        person_id,
        maxIf(1, event = 'team_page_engaged') = 1              AS engaged,
        countIf(event = 'page_view')                          AS pageviews,
        countIf(event = 'affiliate_click')                     AS affiliate_clicks,
        uniqIf(properties.$session_id, event = 'page_view')   AS sessions,
        -- uniqIf, NOT countIf. See the note below; this one is easy to get
        -- wrong and wrong in a way that reads as good news.
        uniqIf(properties.$session_id, pv_in_session = 1)     AS single_pv_sessions
    FROM (
        SELECT *, countIf(event = 'page_view') OVER (PARTITION BY properties.$session_id) AS pv_in_session
        FROM events
        WHERE timestamp >= toDateTime('WINDOW_START')
          AND timestamp <  toDateTime('WINDOW_END')
          AND event IN ('page_view', 'team_page_engaged', 'affiliate_click')
    )
    GROUP BY person_id
)
```

**Why `single_pv_sessions` is `uniqIf` and not `countIf`, since an earlier
version of this file had it wrong.** `pv_in_session` is a window function, so it
is attached to EVERY event row in the session, not just the pageview.
`countIf(pv_in_session = 1)` therefore counts rows: a session with one pageview
and three affiliate clicks contributes **four**. Against a denominator of
distinct sessions, that is not a rate and can exceed 100%.

The damage is worse than a wrong number. The numerator moves with affiliate
click volume, so if affiliate clicks collapse — the exact harm the affiliate
guardrail exists to catch — the bounce proxy falls too and reads as an
improvement. Two guardrails that are supposed to be independent end up coupled,
and coupled in the direction that hides the breach. `uniqIf` counts each
qualifying session once regardless of what else happened in it.

### What pre/post cannot do, stated plainly

A pre/post comparison is confounded by everything that changed between the two
windows and is not the sheet: seasonality, schedule density, a traffic-source
mix shift, any other deploy. A control arm cancels all of that and pre/post
cancels none of it.

The practical consequence: **treat a breach as a trigger to investigate, not as
proof.** Before reverting on a pre/post breach, check whether the same metric
moved in the same direction over an equivalent earlier fortnight with no sheet
in it, and check the other three. One guardrail moving alone is more likely to
be a confound; three moving together is more likely to be the sheet.

The one comparison that has no confound is the half-traffic window's arm split,
which is why the note at the top says to run it once. To build it from the query
above:

1. Add `anyIf(properties.variant, properties.variant IN ('control', 'variant_a')) AS arm`
   to the inner `GROUP BY person_id`.
2. Add `WHERE arm IN ('control', 'variant_a') GROUP BY arm` outside it.
3. **Add the three `capture_*` events back to the inner event filter.** They are
   not in the list above because the pre/post read has no arm to resolve, but
   they carry `variant` and dropping them shrinks the pool of events an arm can
   be recovered from. In practice `page_view` covers nearly everyone, so this
   changes little — but "nearly" is not a thing to leave to chance in a read
   that cannot be re-run.
4. Bound it to `2026-08-02T23:24:34Z` through `ALL_TRAFFIC_START`.

Then apply the window-length rule: both arms come from the same window here, so
it does not bite, which is precisely what makes this comparison worth the query.

### Structural note: the arm is not on the guardrail events

`variant` is carried by `page_view`, the `capture_*` family and the four email
funnel events. It is NOT on `team_page_engaged` and NOT on `affiliate_click`.
So any arm split of a guardrail has to be computed per person with the arm
resolved from that person's other events. Do not try to split a guardrail by a
property it does not have: the result will be empty or, worse, silently partial.
One browser has exactly one arm, so any event of that browser's that carries a
real arm will do.

## The sheet's own events

Three events, each carrying the standard capture context (`surface`,
`page_type`, `team_id`, `variant`).

| Event | Fires when | Notes |
| --- | --- | --- |
| `capture_prompt_dismissed` | the sheet is closed from the PROMPT state | `dismiss_method` is `x`, `handle`, `backdrop` or `escape`. `handle` exists only from 2026-08-03; rows before that date cannot contain it |
| `capture_prompt_submitted` | `/api/subscribe` accepted the POST | `email_domain`, plus `chip_count` and `chip_sources` for what the success state was about to offer |
| `capture_prompt_team_added` | a success-state chip is tapped ON | `added_team_id`, `chip_position`, `source_team_id`, `chip_source` |

A successful submit ALSO fires `newsletter_signup` with
`surface = web_engagement_capture` and `page_type`. Both, not either: the
funnel-internal event carries the chip exposure, and the cross-surface event is
what the signups read and every existing signup dashboard count. The general
rule this is an instance of: **when a new surface converts, it joins the
metric's event, and the surface enum is what distinguishes it.** Adding a
parallel event instead makes the surface invisible to every read that already
exists.

`added_team_id` and not `team_id` for the chipped team: `team_id` means the PAGE
team on every other event in this family, and one property meaning two things
across a family is how a dashboard lies quietly.

## The arm, and where it is stamped

**Retained, inert, and worth keeping.** Nothing branches on the arm. Everything
below describes machinery that is running and correct, so the next experiment
starts from a balanced assignment instead of from scratch. Anyone wiring one up
must time-bound their read to their own window: every browser assigned before
that point carries an arm that meant nothing.

The arm is assigned EAGERLY, on a browser's first pageview, before any behaviour
is observable (`src/components/capture/CaptureTrigger.tsx`, the `resolveVariant`
call sits above the counter, the timer and the subscriber). It is written once to
`localStorage` under `promonight:capture_variant` and never reassigned.

Until 2026-08-01 it was REPORTED only by the three capture events, all of which
need the gesture threshold and 30 engaged seconds to fire. That made the arm
visible for about a ninth of the browsers that had one: 117 arms observed against
809 browsers with a pageview, over the first 57 hours. Two consequences, both bad:

- Assignment balance could only be checked on the qualifying subset, so a question
  answerable in an hour took a day of waiting instead.
- A per-1,000-VISITORS rate was not computable at all. You cannot split a
  denominator by an arm the visitor never reported.

`page_view` and the four email-funnel events (`email_cta_click`,
`follow_page_view`, `teams_starred`, `newsletter_signup`) now carry `variant` as
well. All of them resolve through `resolveBrowserVariant()` in
`src/lib/capture/variant.ts`, which wraps the same `resolveVariant` the trigger
uses and adds no logic: there is still exactly one flip site, so two callers
racing on a brand-new browser cannot produce two arms.

**It has to be all four funnel events.** The point of labelling the funnel is to
see WHERE an arm loses people. A single unstamped step is a hole no step-to-step
rate can be computed across, which disables the one question the labelling
exists to answer.

**The direct stamp on `newsletter_signup` is what makes a labelled numerator
possible at all, and this is the number that settles it.** The alternative was
recovering the arm by joining a signup back to that browser's capture events.
Measured against the first 57 hours, that join yields a numerator of **exactly
zero**: all five signups in the window came from browsers that never emitted a
capture event, so every one of them is dropped by the join. Not "a smaller
numerator", no numerator. Anyone reaching for the join again should re-run this
before assuming it degrades gracefully, because it does not degrade, it returns
nothing:

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

- **`unassigned` appears on real traffic, and that is expected.** The capture
  events could barely carry it, because a storage-less browser is suppressed for
  `storage_unavailable` before reaching a shown event. A pageview has no such
  filter. Exclude `unassigned` from either arm when computing a rate; never fold
  it into control.
- **The kill switch gates the pageview stamp too.** `gate.ts` promises OFF means
  no storage touched, so `resolveBrowserVariant()` returns `unassigned` without
  reading or writing anything when the trigger is disabled. Both causes of
  `unassigned` therefore look identical on the event. Time-bound every arm query
  to a window where the gate was on, which you need to do anyway.

### Checking that assignment is even

The reason the stamp exists, and still the right first query for any future
experiment. One query over a day of pageviews gives roughly 350 flips instead of
45. Measured on the days before the stamp shipped: 316 browsers emitted
`page_view` on 2026-07-31, 377 on 2026-08-01.

(An earlier draft of this file said 800 a day. That was wrong. It came from
reading an 809-browser total that spanned 57 hours as though it were a daily rate.
It does not change any decision, but it does change how long you wait for the
wider bands.)

Bound the query at or after **2026-08-02T02:20:00Z**, when
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

One day settles a gross imbalance outright: a true 75/25 assignment would put
about 262 of 350 in control, roughly nine standard deviations outside the band.

One day does NOT settle a small tilt. Distinguishing a true 56/44 from a fair coin
has only about 60% power at 350 browsers and needs three to four days. Do not read
"inside the band at n=350" as proof the coin is exactly fair.

One caveat on the denominator, which does not bias the arm but does explain a gap:
`page_view` is deferred behind `requestIdleCallback`, so a browser that leaves
before the callback runs is assigned but never reports. Over the pre-stamp window
`$web_vitals` saw 1249 browsers against `page_view`'s 809. Idle-callback timing is
independent of the arm, so the sample stays unbiased; it is just smaller than total
traffic.

## Caveat: a handful of synthetic sheet events on 2026-08-02

Browser verification of the sheet ran against a local dev server that carried the
production `NEXT_PUBLIC_POSTHOG_KEY`, so a small number of real capture events
were emitted to this project from `localhost` on 2026-08-02, before the sheet was
merged and before any read window opens. They look like genuine `variant_a`
funnels: `capture_prompt_shown`, `capture_prompt_submitted`,
`capture_prompt_team_added` x3, `newsletter_signup`, `team_starred`.

Roughly a dozen events across four runs, all from one browser profile on one
machine. **Not purged**, deliberately: deleting events from a live project is a
riskier operation than the distortion they cause, and they sit entirely before
every measurement window.

Two things follow. Bound every query at or after `PHASE_4_START` at the earliest,
as this runbook already says to. And if a stray `variant_a` funnel shows up dated
2026-08-02 with `page_path` on a team page and no matching production deployment,
that is what it is.

The Firestore side was cleaned rather than caveated: those runs created one real
pending subscriber (`source: web_engagement_capture`), which was deleted the same
day after a scan confirmed it was the only one. A test record with that source
would otherwise have landed directly in the sheet's numerator, which is the one
place it does real harm. Later verification passes stubbed `/api/subscribe` and
blocked PostHog ingest at the network layer, so they wrote nothing.

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
dissolve the inflection, it relocated it. Comparing like for like, distinct
persons across all capture events, pre-retune ran 32 / 40 (44.4% control) and
post-retune ran 34 / 11 (75.6% control), a two-proportion z of 3.30, p ~ 0.001.
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
it roughly p ~ 0.005.

**The instrument, not the wait.** The response was to stamp the arm on `page_view`
rather than wait for another 45 browsers, because 350 flips a day settles the
question outright and the same change unblocked the denominator. If the
`page_view` balance ever comes back outside the band above, the code explanation
is exhausted and the next place to look is outside this repo: something patching
`Math.random` before `variant.ts` reads it.

That instrument outlived the experiment it was built for, which is most of the
argument for keeping the arm machinery in place.

## Related

- `src/lib/capture/trigger-engine.ts` - the decision, both floors, the guards
- `src/lib/capture/engaged-timer.ts` - `ENGAGED_FLOOR_MS`, `PROBE_FLOOR_MS`
- `src/lib/capture/suppression.ts` - the reasons, and why `first_pageview` was cut
- `src/lib/capture/variant.ts` - the retained, inert arm machinery
- `src/lib/follow-surface.ts` - the source vocabulary and the two coercion boundaries
- `src/lib/analytics.ts` - the event contracts
