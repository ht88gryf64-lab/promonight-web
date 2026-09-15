# Pre-Raptive Core Web Vitals baseline

This file holds two capture sets. **Baseline B is the comparison baseline.**
Baseline A is retained unaltered because it was taken with the Mediavine Grow
script still loading, under a protocol that was not uniform across its rows, and
the A-to-B delta is worth keeping visible rather than discarding.

Both sets were taken before any ad code existed on getpromonight.com. Once ad
units are live this measurement window cannot be recovered.

## Reproducible protocol (pinned)

**Any future capture that does not follow this protocol exactly is not
comparable to Baseline B, and must not be presented as a before-and-after
against it.** The numbers below are lab measurements whose absolute values are
a function of the harness; only like-for-like comparison carries meaning.

**Baseline A and Baseline B are not comparable in either direction.** Neither
can stand in for the other, and the A-to-B delta below is retained as a record
of what differed between two runs, not as a measurement of anything. **Baseline
B stands alone as the comparison baseline.**

**INP is directional only. LCP and CLS carry the comparison.** Across Baseline
B's twelve rows the number of interactions clearing the 16 ms Event Timing
threshold ranged from **0 to 16**, so the per-row INP figures rest on very
uneven evidence: some are a maximum over sixteen observations, two are a single
observation, and one had nothing to observe at all. Treat an INP movement as a
hint worth investigating, never as a result. Field INP from CrUX is the
instrument for a real number.

| Element | Value |
| --- | --- |
| Browser | `--headless=new`. Version was pinned at **152.0.7977.76** for Baselines A, B and the 2026-09-06 C. It is **no longer pinned**: Chrome auto-updates and a matching binary was not retained, so the version is expected to drift and must be recorded per capture instead. Baseline D ran on **153.0.8010.36** |
| Chrome flags | `--no-first-run --no-default-browser-check --disable-extensions --hide-scrollbars --mute-audio` |
| Profile | fresh `--user-data-dir` per run, discarded afterwards |
| Driver | Chrome DevTools Protocol 1.3 over a raw websocket (Python 3.13.7, `websockets` 16.0). No Lighthouse, no PageSpeed Insights |
| Target | production `https://www.getpromonight.com` only. Never a preview deploy: preview differs on deployment protection, cache behaviour and domain |
| HTTP cache | disabled for **every** navigation, warmup included (`Network.setCacheDisabled: true`) |

### Emulation, per profile

| | mobile | desktop |
| --- | --- | --- |
| `Emulation.setDeviceMetricsOverride` | 412 x 823, `deviceScaleFactor` 1.75, `mobile: true` | 1350 x 940, `deviceScaleFactor` 1.0, `mobile: false` |
| `Emulation.setUserAgentOverride` | `Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36` | **set explicitly** to `Browser.getVersion`'s `userAgent`. From 2026-09-15 this is what "cleared (native desktop UA)" means in practice: CDP has no `clearUserAgentOverride`, one Chrome process serves the whole run, and mobile is captured first, so the Pixel 5 override persists into desktop unless the native UA is put back. Sending `""` is **not** this call - see `042eb29` |
| `Network.emulateNetworkConditions` | 1.6 Mbps down (209715 B/s), 750 Kbps up (96000 B/s), 150 ms latency | 10240 Mbps down/up (1342177280 B/s), 40 ms latency |
| `Emulation.setCPUThrottlingRate` | 4 | 1 |

### Warmup procedure

Warmup is load bearing and is **not** optional.

1. One Chrome process for the entire run. Per-process TLS and connection setup
   is therefore paid exactly once, on the first navigation.
2. **All twelve URLs are warmed before any of them is captured**, in the same
   order they are later captured.
3. **Each URL is warmed under the same emulation profile it is captured under.**
   An unthrottled warmup is not acceptable: it does not exercise the same
   request path, and can leave a conditionally fetched LCP resource cold.
4. Warmup records TTFB only, after a 2.5 s settle. It is not a capture.
5. Because the browser HTTP cache is disabled throughout, warmup populates the
   Vercel edge and ISR caches, never the browser's.

### Capture order

Fixed and part of the protocol. Six mobile first, then six desktop, each in this
URL order: `/mlb/minnesota-twins`, `/nhl/dallas-stars`, `/venues/td-garden`,
`/venues/fenway-park`, `/cfb/alabama`, `/promos/this-week`.

### How each metric is obtained

- **LCP / CLS**: `PerformanceObserver` with `buffered: true`, read after a 4 s
  settle. CLS uses the session-window algorithm (5 s window, 1 s gap) and
  excludes any shift flagged `hadRecentInput`.
- **INP**: a lab figure. CDP-dispatched input is *trusted* input, so it produces
  genuine Event Timing entries. After the settle, the harness dispatches 4
  `Tab` keydown/keyup pairs and 3 clicks at a computed non-interactive point
  (`elementFromPoint` walking the viewport for the first element with no
  `a,button,input,select,textarea,[role=button],[onclick],summary,dialog`
  ancestor), 350 ms apart. INP is reported as the **maximum** interaction
  latency observed. `durationThreshold` is 16 ms, the spec minimum.
- This is **not** field INP. It carries no real-user interaction mix. CrUX is
  the right instrument for the real number.

### 2026-09-14: the /nhl/dallas-stars mobile CLS row has since been fixed

**Read this before comparing anything on `/nhl/dallas-stars` against Baseline
B.** The 0.0688 mobile CLS recorded for that URL in Baseline A and Baseline B
was a real, reproducible layout shift, and it has been fixed. It was not an ad
effect, a harness artefact, or noise: it reproduced to four decimal places
across Baseline A, Baseline B and both Baseline C runs, while the same page
measured 0.0000 on desktop.

**What it was.** A font-swap wrap-boundary shift in the `SeasonExplorer`
category-chip row. Archivo loads `display: swap`, and next/font's size-adjusted
fallback matches vertical metrics but cannot match horizontal advance widths, so
every chip gained roughly 3px when the real face landed. `flex-wrap` turned that
width change into a height change: a chip fell to a third line and everything
below it moved 41.5px. Diagnosed causally rather than inferred - with all
`woff2` blocked the page served 0.0000 with zero shift entries, which ruled out
a lazy mount, a hydration-gated section, unsized media and a data-dependent
render in one test.

**The condition, for a future session that sees this recur:** upcoming giveaway
count >= 10 AND upcoming theme count >= 10, at a 412px viewport. Both counts
two digits widens chip row one from 358px on the fallback to 369px in a 364px
container, which is what crosses the wrap boundary. It is data-specific and
time-varying, not NHL-specific: 10 of 169 team pages met it on 2026-09-14,
across NHL, MLB and NBA, and membership moves as upcoming counts change.

**Fixed in `04250ee`** (chip row scrolls instead of wrapping, so its height no
longer depends on its content width). Measured on production immediately after
that deploy, at this exact pinned protocol:

| URL | Baselines A and B | After `04250ee` |
| --- | ---: | ---: |
| /nhl/dallas-stars mobile | 0.0688 | **0.0004** |
| /nhl/los-angeles-kings mobile | 0.0594 | **0.0004** |

**The Baseline B row below is retained exactly as recorded and is not edited.**
0.0688 is the correct measurement for the build that produced it
(`dpl_6SmKD6N32GfyozKbBP25TBVwN6j1`), and rewriting it would destroy the record
this file exists to hold.

**Consequence for the October post-ad comparison.** A future capture of
`/nhl/dallas-stars` will show roughly -0.068 mobile CLS against its Baseline B
row, and **that delta is this fix, not an ad effect**. Reading it as an ad
improvement would be a straightforward error, and reading an ad regression
against the old row would understate the regression by the same amount. Either
compare that URL against a post-`04250ee` re-capture, or subtract the fix
explicitly. The same caution applies in weaker form to every other team-page
row: the residual 0.0003-0.0004 width-only shift is unchanged, but any page
that met the condition at its own capture time carries the same correction.

## Baseline B: post-Grow, pre-Raptive, uniform warmed protocol, production.

**This is the comparison baseline.** Captured 2026-09-05, 12:51Z-12:54Z UTC.

| Field | Value |
| --- | --- |
| Deploy serving at capture | `dpl_6SmKD6N32GfyozKbBP25TBVwN6j1` |
| Identical across all twelve rows | **yes**, re-read from the served HTML of every one of the twelve captures |
| Mediavine Grow | absent (gate re-checked on production immediately before the run: 0 occurrences of `faves.grow.me`) |
| Ad network script / ad container / CMP | none |
| Protocol | the pinned protocol above, uniformly, all twelve rows in one pass |

### Mobile (412 x 823, 4x CPU, 1.6 Mbps / 150 ms)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | cold TTFB | warm TTFB | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 1580 | 0.0005 | 32 | 1580 | 156.8 | 25.3 | 16 |
| /nhl/dallas-stars | team | 1536 | 0.0688 | 32 | 1536 | 23.1 | 28.7 | 5 |
| /venues/td-garden | venue | 1404 | 0.0023 | 16 \* | 1404 | 24.9 | 26.1 | 1 |
| /venues/fenway-park | venue | 1392 | 0.0166 | 16 | 1392 | 23.1 | 27.1 | 2 |
| /cfb/alabama | CFB school | 1528 | 0.0000 | <16 \*\* | 1528 | 23.5 | 27.9 | 0 |
| /promos/this-week | aggregator | 1380 | 0.0000 | 16 | 1380 | 22.9 | 25 | 2 |

### Desktop (1350 x 940, 1x CPU, 40 ms RTT)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | cold TTFB | warm TTFB | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 428 | 0.0070 | 32 | 428 | 24.3 | 24.3 | 2 |
| /nhl/dallas-stars | team | 500 | 0.0000 | 32 | 500 | 26.3 | 25.5 | 4 |
| /venues/td-garden | venue | 356 | 0.0010 | 32 | 356 | 31.6 | 25.9 | 2 |
| /venues/fenway-park | venue | 364 | 0.0072 | 32 | 364 | 26.4 | 29 | 5 |
| /cfb/alabama | CFB school | 408 | 0.0001 | 16 | 408 | 30.3 | 25.4 | 2 |
| /promos/this-week | aggregator | 380 | 0.0001 | 16 \* | 380 | 25.9 | 30.3 | 1 |

`\*` row rests on a **single** Event Timing observation. `\*\*` **no**
interaction reached the 16 ms reporting threshold, so INP is below 16 ms rather
than unmeasured; there is no B value to difference against A for that row.

### Thin-observation rows, stated explicitly

| Row | Interactions above 16 ms | Reading |
| --- | ---: | --- |
| /venues/td-garden mobile | 1 | single observation |
| /promos/this-week desktop | 1 | single observation |
| /cfb/alabama mobile | 0 | nothing crossed the threshold; INP < 16 ms |

Every other row rests on 2 to 16 observations. Rows reporting exactly 16 ms sit
at the measurement floor and mean "nothing slow was observed", not "INP is
16 ms".

### LCP element per page

| URL | Strategy | LCP element |
| --- | --- | --- |
| /mlb/minnesota-twins | mobile | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /nhl/dallas-stars | mobile | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /venues/td-garden | mobile | `DIV.min-w-[180px] flex-1 font-rd text-[13px] leading-[1.5] text-` |
| /venues/fenway-park | mobile | `DIV.min-w-[180px] flex-1 font-rd text-[13px] leading-[1.5] text-` |
| /cfb/alabama | mobile | `DIV.mt-3 italic leading-tight text-white` |
| /promos/this-week | mobile | `P.rounded-2xl border border-rd-line bg-rd-card p-5 font-rd tex` |
| /mlb/minnesota-twins | desktop | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /nhl/dallas-stars | desktop | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /venues/td-garden | desktop | `DIV` |
| /venues/fenway-park | desktop | `DIV` |
| /cfb/alabama | desktop | `H1.mt-1 font-black text-white` |
| /promos/this-week | desktop | `P.rounded-2xl border border-rd-line bg-rd-card p-5 font-rd tex` |

Every LCP element is a text node. No page's LCP is an image, which means an ad
unit placed above or beside the current LCP text has a direct path to becoming
the new LCP element.

### Cold versus warm TTFB

Reported separately so per-process TLS setup and per-URL cache state stay
distinguishable.

- **Per-process TLS and connection setup**: paid once, on the very first
  navigation of the run (`/mlb/minnesota-twins` mobile, cold TTFB **156.8 ms**).
- **Every other cold TTFB**: 22.9-31.6 ms, i.e. already in the warm range on
  first contact.
- **Warm TTFB across all twelve captures**: 24.3-30.3 ms.

The expectation going in was that a production deploy invalidates ISR wholesale
and every URL would therefore pay a regeneration cost on its first load. That
did not happen, and the cold column is the evidence: only the first navigation
was slow, and it was slow by roughly the cost of TLS setup, not of a
regeneration. These routes are statically prerendered at build time, so a new
deploy ships their HTML already built and there is no per-URL first-hit penalty
to warm away. The warmup pass still runs, because the protocol must be
reproducible on the October side regardless of what the cache happens to be
doing that day.

## Baseline A to Baseline B delta, per URL

Stated without interpretation. **The two sets differ in more than one variable**
— Grow.me presence, warm-state uniformity, capture order, and time of day all
changed between them — so no single cause can be read off this table, and in
particular the delta must not be attributed to the Grow removal.

| URL | Strategy | LCP A | LCP B | ΔLCP | CLS A | CLS B | ΔCLS | INP A | INP B | ΔINP |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | mobile | 3444 | 1580 | -1864 | 0.0005 | 0.0005 | +0.0000 | 40 | 32 | -8 |
| /nhl/dallas-stars | mobile | 1068 | 1536 | +468 | 0.0688 | 0.0688 | +0.0000 | 32 | 32 | +0 |
| /venues/td-garden | mobile | 1116 | 1404 | +288 | 0.0023 | 0.0023 | +0.0000 | 16 | 16 | +0 |
| /venues/fenway-park | mobile | 948 | 1392 | +444 | 0.0166 | 0.0166 | +0.0000 | 16 | 16 | +0 |
| /cfb/alabama | mobile | 1172 | 1528 | +356 | 0.0000 | 0.0000 | +0.0000 | 24 | <16 | n/a |
| /promos/this-week | mobile | 1144 | 1380 | +236 | 0.0000 | 0.0000 | +0.0000 | 32 | 16 | -16 |
| /mlb/minnesota-twins | desktop | 596 | 428 | -168 | 0.0000 | 0.0070 | +0.0070 | 16 | 32 | +16 |
| /nhl/dallas-stars | desktop | 348 | 500 | +152 | 0.0004 | 0.0000 | -0.0004 | 16 | 32 | +16 |
| /venues/td-garden | desktop | 260 | 356 | +96 | 0.0010 | 0.0010 | +0.0000 | 16 | 32 | +16 |
| /venues/fenway-park | desktop | 280 | 364 | +84 | 0.0072 | 0.0072 | +0.0000 | 32 | 32 | +0 |
| /cfb/alabama | desktop | 320 | 408 | +88 | 0.0001 | 0.0001 | +0.0000 | 16 | 16 | +0 |
| /promos/this-week | desktop | 284 | 380 | +96 | 0.0001 | 0.0001 | +0.0000 | 32 | 16 | -16 |

`<16` means no interaction crossed the 16 ms Event Timing threshold in Baseline
B, so `ΔINP` is `n/a` for that row rather than zero.

## Baseline A: Grow present, mixed warm state, superseded.

Superseded as the comparison baseline, retained verbatim below. Two properties
disqualify it from that role: the Mediavine Grow script was loading on every
page while these numbers were taken, and its twelve rows were captured in two
passes under different warm states (pass 1 unwarmed, pass 2 warmed by a single
homepage load). Nothing below has been altered or reconciled against Baseline B.

## Capture metadata

| Field | Value |
| --- | --- |
| Capture window (UTC) | pass 1 2026-09-05T12:03Z-12:10Z; pass 2 2026-09-05T12:14Z-12:16Z |
| Deploy serving at capture | `dpl_GRMXNjv7g3mEihaqa6DxLyudCqks` |
| Build artifact | `/_next/static/chunks/main-app-5eb0d9c55a395822.js` |
| Host | www.getpromonight.com (production) |
| Measurement tool | Chrome DevTools Protocol driven directly (no Lighthouse) |
| Browser | Google Chrome 152.0.7977.76, `--headless=new`, fresh user-data-dir |
| CDP protocol version | 1.3 |
| Driver | `audit`-local Python harness (`websockets` 16.0, Python 3.13.7), one page load per row |
| HTTP cache | disabled for every run (`Network.setCacheDisabled: true`) |

The deploy ID was read out of the served HTML of every measured page (the
`?dpl=` query parameter Vercel appends to each `_next/static` asset URL), not
from a response header. All eight rows returned the same deploy ID, and it
matches the deploy ID observed on the ten pages fetched in the Phase 1 audit
pass, so every number below describes one single production build.

## Emulation profile

Both profiles mirror the standard Lighthouse presets so the post-integration
re-measurement can be compared like for like.

| | mobile | desktop |
| --- | --- | --- |
| Viewport | 412 x 823 CSS px | 1350 x 940 CSS px |
| Device pixel ratio | 1.75 | 1 |
| `mobile` flag | true | false |
| User agent | Pixel 5 / Android 12 Chrome 152 | default desktop Chrome 152 |
| Network | 1.6 Mbps down, 750 Kbps up, 150 ms RTT | 10 Gbps, 40 ms RTT |
| CPU throttle | 4x | 1x |

## Results

LCP and CLS are real observations from `PerformanceObserver` with
`buffered: true`, read after a 4-second settle. CLS uses the standard
session-window algorithm (5 s window, 1 s gap) and excludes shifts flagged
`hadRecentInput`. INP is a **lab** figure: CDP-dispatched input is trusted
input, so it produces genuine Event Timing entries, and INP is reported as the
maximum interaction latency over the scripted interactions listed in the last
column (4 Tab keypress pairs plus 3 clicks on a computed non-interactive point).
It is not field INP and carries no real-user interaction mix.

### Mobile (412 x 823, 4x CPU, 1.6 Mbps / 150 ms)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | TTFB (ms) | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 3444 * | 0.0005 | 40 | 1628 | 224.5 | 19 |
| /nhl/dallas-stars | team | 1068 | 0.0688 | 32 | 1068 | 26.4 | 15 |
| /venues/td-garden | venue | 1116 | 0.0023 | 16 | 1116 | 26.0 | 2 |
| /venues/fenway-park | venue | 948 | 0.0166 | 16 | 948 | 33.1 | 3 |
| /cfb/alabama | CFB school | 1172 | 0.0000 | 24 | 1172 | 25.7 | 3 |
| /promos/this-week | aggregator | 1144 | 0.0000 | 32 | 1144 | 24.9 | 4 |

### Desktop (1350 x 940, 1x CPU, 40 ms RTT)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | TTFB (ms) | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 596 | 0.0000 | 16 | 352 | 25.8 | 14 |
| /nhl/dallas-stars | team | 348 | 0.0004 | 16 | 348 | 26.9 | 16 |
| /venues/td-garden | venue | 260 | 0.0010 | 16 | 260 | 24.8 | 14 |
| /venues/fenway-park | venue | 280 | 0.0072 | 32 | 280 | 26.9 | 16 |
| /cfb/alabama | CFB school | 320 | 0.0001 | 16 | 320 | 26.3 | 12 |
| /promos/this-week | aggregator | 284 | 0.0001 | 32 | 284 | 27.0 | 1 |

The four rows added in pass 2 were preceded by a throwaway warmup load of `/`
so that none of them paid the cold TLS and CDN cost that inflated the Twins
mobile row in pass 1. The warmup measured TTFB 98.0 ms; all four captures that
followed it measured 26.3-27.0 ms. The warmup itself is not a baseline row and
its numbers are excluded. Pass 2 ran on the same deploy as pass 1
(`dpl_GRMXNjv7g3mEihaqa6DxLyudCqks`, re-read from the served HTML of all five
pass-2 loads), so the whole table still describes one single production build.

### LCP element per page

| URL | Strategy | LCP element |
| --- | --- | --- |
| /mlb/minnesota-twins | mobile | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /nhl/dallas-stars | mobile | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /venues/td-garden | mobile | `DIV.min-w-[180px] flex-1 font-rd text-[13px] leading-[1.5]` |
| /venues/fenway-park | mobile | `DIV.min-w-[180px] flex-1 font-rd text-[13px] leading-[1.5]` |
| /cfb/alabama | mobile | `DIV.mt-3 italic leading-tight text-white` |
| /promos/this-week | mobile | `P.rounded-2xl border border-rd-line bg-rd-card p-5 font-rd` |
| /mlb/minnesota-twins | desktop | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /venues/td-garden | desktop | `DIV` |
| /nhl/dallas-stars | desktop | `H1.rd-display mt-3 text-4xl uppercase text-white md:text-6xl` |
| /venues/fenway-park | desktop | `DIV` |
| /cfb/alabama | desktop | `H1.mt-1 font-black text-white` |
| /promos/this-week | desktop | `P.rounded-2xl border border-rd-line bg-rd-card p-5 font-rd` |

Every LCP element is a text node. No page's LCP is an image today, which means
an ad unit placed above or beside the current LCP text has a direct path to
becoming the new LCP element.

## Caveats that affect how these numbers should be read

1. `*` **/mlb/minnesota-twins mobile is an outlier and should be treated as
   soft.** It was the first navigation made by a cold browser profile, so it
   carries TLS and connection setup that no other row paid: TTFB 224.5 ms
   against 24.9-33.1 ms everywhere else. Its LCP of 3444 ms is inflated by an
   unknown amount. The desktop run of the same URL (596 ms, warm) is the more
   trustworthy read of that template. Re-measure this row with the same harness
   when the post-integration comparison is made.
2. **CLS on /nhl/dallas-stars (0.0688) is the largest observed** and is roughly
   30x the next-largest mobile figure. It comes from a single non-input layout
   shift. This is the page most exposed to a CLS regression once a unit is
   injected.
3. `Load_ms` is null on the mobile rows because `loadEventEnd` had not fired
   when the 4-second settle expired under 4x CPU throttling. LCP, CLS, FCP and
   TTFB are unaffected.
4. **INP is a lab figure with a small, synthetic interaction set** (2-19
   interactions per page). The two venue mobile rows recorded only 2-3
   interactions above the 16 ms Event Timing threshold, so their INP of 16 ms is
   at the measurement floor and means "nothing slow was observed", not "INP is
   16 ms". Field INP from CrUX is the right instrument for the real number.
   The /promos/this-week desktop row is the thinnest sample in the table: one
   interaction cleared the threshold, so its 32 ms is a single observation, not
   a distribution.
5. One page load per URL per strategy. There is no run-to-run variance estimate.

## Coverage history: the baseline is now complete

All twelve measurements exist. They were taken in two passes.

Pass 1 delivered 8 of the 12 under a twelve-operation ceiling, because four
operations produced no data:

- 3 spent on Google PageSpeed Insights API calls that returned HTTP 429
  (`Quota exceeded for quota metric 'Queries' ... 'Queries per day'`) on the
  anonymous, keyless quota. PSI was abandoned after the third.
- 1 spent on a browser-extension navigation whose measurement was invalid: the
  tab loaded in the background and Chrome suppresses paint timing for pages that
  load while hidden, so LCP and FCP came back null.

Pass 2 captured the four desktop rows pass 1 could not reach
(/nhl/dallas-stars, /venues/fenway-park, /cfb/alabama, /promos/this-week) plus
one warmup load, 5 operations against a six-operation ceiling. The same CDP
harness, emulation profile and Chrome build were used in both passes.

The only asymmetry left in the table is that pass 2 was warmed and pass 1 was
not. That favours the pass-2 rows by roughly 70 ms of TTFB and is why the Twins
mobile row stays flagged rather than being quietly compared against them.

## Ad-free state verified at capture

Checked against the served HTML of ten production pages fetched in the same
session, one per template plus /privacy and /ads.txt, all on deploy
`dpl_GRMXNjv7g3mEihaqa6DxLyudCqks`:

- `pagead2.googlesyndication.com`: 0 occurrences on every page.
- `adsbygoogle`, `data-ad-client`, `google_ad_client`: 0 occurrences on every page.
- `[data-ad-slot]` ad containers: 0 in the DOM on every page. The repo's
  `AdSlot` component returns `null` while `NEXT_PUBLIC_AD_NETWORK` is unset, so
  no reserved box exists to collapse.
- No consent-management platform, cookie banner, `__tcfapi`, `__uspapi` or
  `__gpp` on any page.
- Third-party scripts present and included in these numbers: Grow.me
  (`faves.grow.me/main.js` with `data-grow-faves-site-id`) and Google
  Analytics 4 (`G-N2M0M355LX`, preloaded via next/script).

**Correction to an earlier reading of this file.** The Grow.me tag was first
recorded here as Raptive's own engagement product, which would have made the
site partly onboarded already. That is wrong. The
`faves.grow.me/main.js` + `data-grow-faves-site-id` signature is Mediavine's
standard Grow install, left over from an abandoned Mediavine Journey
application. It is a competitor script, not partial Raptive onboarding, and it
is scheduled for removal.

This matters for how the table is compared later. Grow.me was live and loading
on every page while these numbers were taken, so the baseline is "pre-ad-unit
with Grow.me present". Removing Grow.me is itself a performance change. A
post-integration comparison that removes Grow.me and adds Raptive is measuring
two deltas at once; capture an intermediate reading after the Grow.me removal
lands if the two effects need to be told apart.

---

## Baseline C: 2026-09-06, after FanTools, from a REBUILT harness. Read the caveat before the numbers.

**Why this exists.** FanTools shipped to the team-page sidebar on 2026-09-06
(merge `69ea952`), which raised the question of whether Baseline B still
described the pages Raptive would inject into.

**The answer is yes, and not because of these numbers.** None of the six
baseline URLs renders FanTools — the module has exactly one config entry,
`/nba/minnesota-timberwolves`, which is not in this corpus. The two team pages
that ARE in it, `/mlb/minnesota-twins` and `/nhl/dallas-stars`, changed by
**five bytes**: a serialised `null` in the aside's RSC children array, measured
by diffing two full builds (see `docs/known-issues.md` entry 44). No element,
no request, no change to the LCP element — which on both pages is still the
hero `H1.rd-display`, above and unrelated to the sidebar. Nothing there can
move a lab metric.

**The harness that produced Baseline A and B was never committed.** It was
rebuilt on 2026-09-06 from the pinned protocol above and committed as
`scripts/capture-cwv-baseline.py`, so the next capture is a command. The
environment matched exactly: Chrome 152.0.7977.76, Python 3.13.7,
websockets 16.0, same machine. Four details the protocol does not specify had
to be reconstructed, and the file names them in its header: the interleaving of
the Tab pairs and clicks, the `elementFromPoint` raster, CDP call ordering, and
how FCP is derived.

**Two runs, so this baseline carries the variance estimate Baseline B says it
lacks.** Run 1 12:32Z, run 2 12:41Z, production, deploy serving `69ea952`.

### Mobile — the reconstruction is faithful here

| URL | B LCP | C LCP r1 / r2 | B CLS | C CLS r1 / r2 |
| --- | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | 1580 | 1692 / 1628 | 0.0005 | 0.0005 / 0.0005 |
| /nhl/dallas-stars | 1536 | 1540 / 1528 | 0.0688 | 0.0688 / 0.0688 |
| /venues/td-garden | 1404 | 1384 / 1384 | 0.0023 | 0.0023 / 0.0023 |
| /venues/fenway-park | 1392 | 1392 / 1392 | 0.0166 | 0.0166 / 0.0166 |
| /cfb/alabama | 1528 | 1532 / 1532 | 0.0000 | 0.0000 / 0.0000 |
| /promos/this-week | 1380 | 1384 / 1412 | 0.0000 | 0.0000 / 0.0000 |

**Every mobile CLS figure reproduces to four decimal places**, across both runs
and against a capture taken by different code a day earlier. LCP lands within
0.3% on five of six rows. The exception is `/mlb/minnesota-twins`, +112 ms in
run 1 and +48 ms in run 2 — a spread of 64 ms between two runs of the same
harness on the same build, which is larger than any signal a five-byte payload
change could produce. Call it noise and say so.

### Desktop — NOT comparable to Baseline B, and it is not the change

| URL | B LCP | C LCP r1 / r2 | B CLS | C CLS r1 / r2 |
| --- | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | 428 | 160 / 176 | 0.0070 | 0.0000 / 0.0000 |
| /nhl/dallas-stars | 500 | 176 / 164 | 0.0000 | 0.0000 / 0.0000 |
| /venues/td-garden | 356 | 144 / 136 | 0.0010 | 0.0010 / 0.0010 |
| /venues/fenway-park | 364 | 160 / 132 | 0.0072 | 0.0072 / 0.0072 |
| /cfb/alabama | 408 | 212 / 148 | 0.0001 | 0.0001 / 0.0001 |
| /promos/this-week | 380 | 144 / 132 | 0.0001 | 0.0001 / 0.0001 |

Desktop LCP comes in **uniformly 55-65% lower than Baseline B on all six URLs**,
and reproduces tightly across both runs (132-212 ms). A uniform shift on every
row, stable run to run, is a harness or environment difference, not a page
change — a five-byte payload delta on two of six URLs cannot make the other
four 60% faster. The most likely cause is the desktop UA handling: this
reconstruction sends `Emulation.setUserAgentOverride` with an empty string where
the protocol says "cleared", which is not the same call.

**Per this document's own rule, the desktop half of Baseline C must not be
presented as a before-and-after against Baseline B.** The mobile half may be.
Desktop CLS reproduces exactly on five of six rows regardless; the sixth,
`/mlb/minnesota-twins` at 0.0070 to 0.0000, is a shift disappearing.

### What still needs doing

Baseline B and C both measure a corpus with **no partner-app page in it**. If
Raptive injects into `/nba/minnesota-timberwolves`, neither baseline describes
that page shape: it is the one team page carrying roughly 6 KB more HTML and an
extra outbound link. Adding it is a corpus change, which makes it a new
baseline rather than a row appended here.

The desktop UA divergence should be settled before the next capture, since it
is the one thing standing between this harness and a like-for-like desktop
comparison.

## Baseline D: pre-Raptive-install, production, uniform warmed protocol.

**This supersedes Baseline B as the comparison baseline for the post-install
capture.** B remains correct for the build that produced it and is retained
unaltered. The 2026-09-06 Baseline C above is a **harness-validation run, not a
successor to B** - it exists to show that a rebuilt harness reproduced B's
mobile half, and its desktop half is disqualified by the UA defect described in
its own section. Neither A, B nor C is edited by this section.

**Why a third baseline.** B was captured on `dpl_6SmKD6N32GfyozKbBP25TBVwN6j1`.
Production has since shipped the mobile weave order floor (`e6132e0`), the
single-`<main>` retags and selector hooks (`eee9a34`), the chip-row CLS fix
(`04250ee`), the Raptive privacy statement (`e0accc5`) and the ads.txt AdSense
removal (`f4fa756`). B no longer describes the build the ad tags will land on.
D does.

### Two deviations from the pinned protocol, stated before the numbers

**1. Chrome 153.0.8010.36, not the pinned 152.0.7977.76.** Chrome auto-updated
and no 152 binary was retained on the capture machine; none was downloaded. A
major-version change is a harness change, so **the B-to-D delta carries an
unknown Chrome-version component on every row, in both halves**. That component
is not separated out below and cannot be from this data alone. It does not
affect D's fitness for its actual job: the post-install capture will run on 153
or later too, so D-to-post-install stays internally consistent, which is the
comparison this baseline exists to serve.

**2. The desktop rows are the first captured under a conforming UA.** The
protocol's "cleared (native desktop UA)" is now implemented as an explicit set
to `Browser.getVersion`'s `userAgent` (`042eb29`); the previous harness sent the
empty string. **D's desktop half is therefore not comparable to any desktop half
captured before it** - not B's, and not the 2026-09-06 C's. The desktop B-to-D
delta is reported below because it was asked for, and it should be read with
that in mind. The resolved UA was
`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`.
Note it identifies as **HeadlessChrome**: that is what this browser natively
sends, and therefore what "cleared" resolves to under `--headless=new`.

### Capture metadata

| Field | Value |
| --- | --- |
| Captured | 2026-09-15, 15:53Z-15:56Z UTC |
| Build | `main` at `f4fa756` |
| Deploy serving at capture | `dpl_9Z7WVbma91Xz6ZhSUyeK2bozn3Y8` |
| Identical across all twelve rows | **yes**, re-read from the served HTML of each of the twelve captures individually, not once per run |
| Chrome | 153.0.8010.36, `--headless=new` |
| Harness | `scripts/capture-cwv-baseline.py` at `4d7712c` |
| Ad network script / ad container / CMP | **none**. 0 occurrences of `raptive`, `adthrive`, `adsbygoogle`, `faves.grow.me` in the served HTML. The single `googletag` hit is the GA4 `G-N2M0M355LX` preload, as in Baseline B |
| Mediavine Grow | absent |
| Protocol | the pinned protocol above, uniformly, all twelve rows in one pass, with the two deviations named directly above |

### Mobile (412 x 823, DSF 1.75, 4x CPU, 1.6 Mbps / 150 ms)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | cold TTFB | warm TTFB | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 1576 | 0.0004 | 32 | 1576 | 54.2 | 44.0 | 6 |
| /nhl/dallas-stars | team | 1524 | 0.0004 | 32 | 1524 | 81.7 | 42.9 | 4 |
| /venues/td-garden | venue | 1376 | 0.0023 | <16 \*\* | 1376 | 50.6 | 57.2 | 0 |
| /venues/fenway-park | venue | 1380 | 0.0166 | 16 \* | 1380 | 51.6 | 53.2 | 1 |
| /cfb/alabama | CFB school | 1520 | 0.0000 | <16 \*\* | 1520 | 44.8 | 67.0 | 0 |
| /promos/this-week | aggregator | 1360 | 0.0001 | <16 \*\* | 1360 | 86.0 | 42.2 | 0 |

### Desktop (1350 x 940, DSF 1.0, 1x CPU, 40 ms RTT)

| URL | Template | LCP (ms) | CLS | INP (ms) | FCP (ms) | cold TTFB | warm TTFB | interactions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /mlb/minnesota-twins | team | 288 | 0.0000 | 24 | 288 | 53.6 | 61.1 | 4 |
| /nhl/dallas-stars | team | 548 | 0.0000 | <16 \*\* | 548 | 90.2 | 42.6 | 0 |
| /venues/td-garden | venue | 288 | 0.0010 | 32 \* | 288 | 76.3 | 62.7 | 1 |
| /venues/fenway-park | venue | 288 | 0.0072 | 16 | 288 | 82.8 | 45.1 | 3 |
| /cfb/alabama | CFB school | 336 | 0.0001 | 16 \* | 336 | 43.1 | 74.3 | 1 |
| /promos/this-week | aggregator | 280 | 0.0001 | 32 | 280 | 43.7 | 55.7 | 2 |

`\*` row rests on a **single** Event Timing observation. `\*\*` **no**
interaction reached the 16 ms reporting threshold, so INP is below 16 ms rather
than unmeasured.

### Thin-observation rows, stated explicitly

Seven of the twelve rows rest on one observation or none - a materially thinner
evidence base than Baseline B, where three rows did.

| Row | Interactions above 16 ms | Reading |
| --- | ---: | --- |
| /venues/td-garden mobile | 0 | nothing crossed the threshold; INP < 16 ms |
| /cfb/alabama mobile | 0 | nothing crossed the threshold; INP < 16 ms |
| /promos/this-week mobile | 0 | nothing crossed the threshold; INP < 16 ms |
| /nhl/dallas-stars desktop | 0 | nothing crossed the threshold; INP < 16 ms |
| /venues/fenway-park mobile | 1 | single observation |
| /venues/td-garden desktop | 1 | single observation |
| /cfb/alabama desktop | 1 | single observation |

The remaining five rows rest on 2 to 6 observations. Rows reporting exactly
16 ms sit at the measurement floor and mean "nothing slow was observed", not
"INP is 16 ms". Per the pinned protocol, INP here is directional only.

### LCP element per page

Not captured. The committed harness does not record the LCP element, and no
attempt is made here to restate Baseline B's elements as if they had been
observed in this run.

## Baseline B to Baseline D delta, per URL

Reported without interpretation, as asked. **Every row in both halves carries
the unknown Chrome-version component described above.** Every desktop row
additionally spans the UA fix and is not a like-for-like comparison.

### Mobile

| URL | LCP B -> D | CLS B -> D | INP B -> D |
| --- | ---: | ---: | ---: |
| /mlb/minnesota-twins | 1580 -> 1576 (-4) | 0.0005 -> 0.0004 (-0.0001) | 32 -> 32 |
| /nhl/dallas-stars | 1536 -> 1524 (-12) | 0.0688 -> 0.0004 (-0.0684) | 32 -> 32 |
| /venues/td-garden | 1404 -> 1376 (-28) | 0.0023 -> 0.0023 (0.0000) | 16 -> <16 |
| /venues/fenway-park | 1392 -> 1380 (-12) | 0.0166 -> 0.0166 (0.0000) | 16 -> 16 |
| /cfb/alabama | 1528 -> 1520 (-8) | 0.0000 -> 0.0000 (0.0000) | <16 -> <16 |
| /promos/this-week | 1380 -> 1360 (-20) | 0.0000 -> 0.0001 (+0.0001) | 16 -> <16 |

The `/nhl/dallas-stars` mobile CLS movement of -0.0684 is the chip-row fix in
`04250ee`, already documented above, which predicted 0.0688 -> 0.0004. It is not
an anomaly and not an ad effect.

### Desktop

| URL | LCP B -> D | CLS B -> D | INP B -> D |
| --- | ---: | ---: | ---: |
| /mlb/minnesota-twins | 428 -> 288 (-140) | 0.0070 -> 0.0000 (-0.0070) | 32 -> 24 |
| /nhl/dallas-stars | 500 -> 548 (+48) | 0.0000 -> 0.0000 (0.0000) | 32 -> <16 |
| /venues/td-garden | 356 -> 288 (-68) | 0.0010 -> 0.0010 (0.0000) | 32 -> 32 |
| /venues/fenway-park | 364 -> 288 (-76) | 0.0072 -> 0.0072 (0.0000) | 32 -> 16 |
| /cfb/alabama | 408 -> 336 (-72) | 0.0001 -> 0.0001 (0.0000) | 16 -> 16 |
| /promos/this-week | 380 -> 280 (-100) | 0.0001 -> 0.0001 (0.0000) | 16 -> 32 |
