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
| Browser | Google Chrome **152.0.7977.76**, `--headless=new` |
| Chrome flags | `--no-first-run --no-default-browser-check --disable-extensions --hide-scrollbars --mute-audio` |
| Profile | fresh `--user-data-dir` per run, discarded afterwards |
| Driver | Chrome DevTools Protocol 1.3 over a raw websocket (Python 3.13.7, `websockets` 16.0). No Lighthouse, no PageSpeed Insights |
| Target | production `https://www.getpromonight.com` only. Never a preview deploy: preview differs on deployment protection, cache behaviour and domain |
| HTTP cache | disabled for **every** navigation, warmup included (`Network.setCacheDisabled: true`) |

### Emulation, per profile

| | mobile | desktop |
| --- | --- | --- |
| `Emulation.setDeviceMetricsOverride` | 412 x 823, `deviceScaleFactor` 1.75, `mobile: true` | 1350 x 940, `deviceScaleFactor` 1.0, `mobile: false` |
| `Emulation.setUserAgentOverride` | `Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36` | cleared (native desktop UA) |
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
