# Pre-Raptive Core Web Vitals baseline

**This is the pre-Raptive-integration baseline, captured before any ad code was
installed on getpromonight.com.** No ad network script, no ad container, and no
consent-management platform was present in the served HTML of any measured page
at capture time (verified independently in the same pass; see "Ad-free state
verified at capture" below). Once ad units are live this measurement window
cannot be recovered, so these numbers are the only pre-ad reference point.

## Capture metadata

| Field | Value |
| --- | --- |
| Capture window (UTC) | 2026-09-05T12:03Z to 2026-09-05T12:10Z |
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
| /venues/td-garden | venue | 260 | 0.0010 | 16 | 260 | 24.8 | 14 |

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
5. One page load per URL per strategy. There is no run-to-run variance estimate.

## Coverage gap against the brief

The brief called for six URLs at both mobile and desktop, twelve measurements,
under a twelve-fetch Phase 2 ceiling. Twelve network operations were spent, but
four produced no data:

- 3 spent on Google PageSpeed Insights API calls that returned HTTP 429
  (`Quota exceeded for quota metric 'Queries' ... 'Queries per day'`) on the
  anonymous, keyless quota. PSI was abandoned after the third.
- 1 spent on a browser-extension navigation whose measurement was invalid: the
  tab loaded in the background and Chrome suppresses paint timing for pages that
  load while hidden, so LCP and FCP came back null.

The remaining 8 produced the 8 valid rows above. **Four desktop captures are
therefore missing**: /nhl/dallas-stars, /venues/fenway-park, /cfb/alabama and
/promos/this-week. Mobile was prioritised because it is 84% of traffic; the two
desktop rows that were captured cover the team and venue templates, which
together account for 336 of the 481 URLs in the sitemap. Completing the four
missing desktop rows costs four more page loads with the same harness and should
be done before any ad code ships.

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
  (`faves.grow.me/main.js`, Raptive's own engagement product, already live
  sitewide) and Google Analytics 4 (`G-N2M0M355LX`, preloaded via next/script).

Because Grow.me is already on every page, this baseline is "pre-ad-unit", not
"pre-Raptive-anything". Any post-integration comparison should hold that
constant.
