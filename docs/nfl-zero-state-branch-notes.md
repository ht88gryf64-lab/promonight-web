# NFL zero-state branch notes

Branch: `feature/nfl-zero-state-schedule`. These are the conclusions from the
build that are not obvious from the diff, and the debts it knowingly takes on.

## What this branch is, and is not

The 32 NFL team pages hold **zero promo documents** in Firestore. Not zero
visible, not zero upcoming: all 32 return an empty array from
`listCollections()`, verified two independent ways. Every page symptom is
downstream of that one absence.

This branch **mitigates** the absence. It does not fix it. The corpus build runs
separately in the promo-pipeline repo. Nothing here ingests an NFL promo.

## Byte-identity can only be verified against a same-day baseline

This is a method, not a convenience. Any future gate that compares built output
against a baseline MUST rebuild that baseline the same day.

The team page bakes clock-dependent values into its prerendered HTML. Six
surfaces are known, and the count grew twice during this branch because a diff
that looked dismissible was chased instead:

| # | Surface | Where | Scope |
|---|---|---|---|
| 1 | `dateModified` ISO timestamp | `json-ld.tsx` | all 169 pages, every revalidation |
| 2 | "Last updated {today}" in a FAQ answer | `promo-helpers.ts` | 97 of 169 |
| 3 | Date-filtered meta description | `[sport]/[team]/page.tsx` | 131 populated |
| 4 | `new Date().getFullYear()` in visible copy | `promo-list.tsx` | populated with past promos |
| 5 | **Calendar today-cell ring** (`ring-1 ring-rd-ink/25`) | `CalendarGrid.tsx` | every page rendering the calendar |
| 6 | **GameExpand day header** ("Tuesday, August 4") | `GameExpand.tsx` | MLB pages, via the 30-day prerender window |

Surfaces 5 and 6 were missed by the Phase 0 audit and by the Gate 1 survey. Both
appear only on pages that render the calendar with games data, which is why a
zero-promo NFL page does not exhibit them and an MLB page does.

Deeper normalization is NOT the fix. Each new surface is discovered only by a
diff failing, so a normalization list is always a lagging indicator. Rebuild the
baseline on the same day and normalize only genuine build artifacts: the Next
build id, `/_next/static/` asset hashes, and `dateModified`.

**A gate run near midnight UTC must rebuild the baseline.**

## Verification ran against LOCAL PRODUCTION BUILDS

Vercel SSO protection is enabled for all deployments except custom domains
(`ssoProtection.deploymentType: "all_except_custom_domains"`). Every preview URL
302s to a Vercel login page.

The documented bypass pairing does NOT work for automation. Tested three ways,
all failing identically:

1. `get_access_to_vercel_url` to mint a shareable link, then fetching it. The
   deployment does not honor `_vercel_share` inline; it exchanges the token for
   a new one and redirects to `vercel.com/sso-api`, which 307s to `/login`
   without an authenticated browser session.
2. The same fetch against the `sso-api` exchange leg. Rejected, deployment
   hostnames only.
3. curl following the full chain with a cookie jar. Lands on the login page; the
   cookies set are for `vercel.com`, not the deployment host.

So checks were run against `next build` output in `.next/server/app/`, which is
the real prerendered crawlable HTML. **That covers content and byte-identity. It
does NOT cover deployed ISR behavior**, which is what matters after merge given
`export const revalidate = 86400`.

Any verification script that fetches a preview MUST assert a control marker
(`rd-root` plus a page-specific string) before grading. Without it a login page
grades as "feature absent", which happened once on this branch.

## House convention: optional-field filters are app-code, absent means keep

**Any filter on an OPTIONAL field is an app-code array filter with
absent-means-keep. Never a Firestore equality, unless the field is provably
present on every doc in the collection.**

Two instances now, and the second nearly shipped as a silent outage:

- `isVisiblePromo` (`promo-helpers.ts`) on `tombstoned`. Absent and `false` are
  visible; only `true` hides. Its own comment already warns that a Firestore
  inequality would drop field-absent docs.
- `isRegularSeasonGame` (`types.ts`) on `seasonType`. **MLB game docs carry no
  `seasonType` at all, 2455 of 2455 absent.** Measured:
  `.where('seasonType','==','regular')` on MLB returns **0 of 2455**. The
  obvious-looking query-level implementation would have zeroed the schedule and
  the Games tile on every MLB team page, and it would have looked correct in
  review, because it reads like the plainly right way to write it.

The failure mode is asymmetric and that is why the convention is absolute. A
query-level filter that is wrong returns an empty set, which renders as "no
data" rather than as an error, on pages that are otherwise healthy. Nothing
throws. Verify field presence with a count before filtering on it, and prefer
the array filter even when the field looks universal, because "looks universal"
is what 2455 absent docs looked like from the NFL side.

## Confirm the deployment is serving before revalidating

Never `POST /api/revalidate` immediately after a push. Wait until production is
actually serving the new build, confirmed by fetching a page cache-busted and
asserting on a string only the new code emits.

**Why:** `revalidatePath` flushes the ISR cache and the next request re-renders
from whatever build is live. Flush before the new deployment rolls and you
re-cache the OLD content, and the route still answers `{"ok":true,"revalidated":38}`
because it counts paths it processed, not paths that changed. The response
cannot tell you that you flushed the wrong build.

Measured on the merge that produced these notes: the Rams page was still serving
an 8-hour-old snapshot (`age: 29365`) for roughly 3 minutes after `git push`
returned. A flush in that window would have been a silent no-op reported as a
success.

Check the count against what you sent, too, rather than trusting `ok:true`.
Both flushes here matched exactly: 38 sent / 38 revalidated, then 169 / 169.

## Debts taken on knowingly

### The copy promises something the repo does not yet keep

`LEAGUE_COPY.NFL` says "Confirmed {team} promos will appear here, with the home
date each one runs on." Nothing in this repo ingests NFL promos, so that promise
is kept only when the scanner work merges. Accepted deliberately at G-B.

**If the scanner slips past the September opener, this sentence comes out.**

Note what the copy deliberately does NOT say. It scopes the claim to our own
data ("PromoNight has no confirmed ... listed yet") rather than asserting that
the clubs have not announced anything. The latter is a claim about 32 real
organizations that nothing here has checked, and it would be false for a growing
number of clubs as the opener approaches.

### Pre-existing issues this branch surfaces but does not fix

- `cf-montreal` renders its H2 as "2026 MONTREAL CF MONTRÉAL PROMO SCHEDULE".
  `teamDisplayName` doubles the city because the stored `name` already contains
  it. Pre-existing, one page, newly visible because this branch mounts a
  component that had been dead code.
- The "Coming up" eyebrow sits directly above copy whose first words are that
  nothing is coming. Left alone deliberately: it is shared with 6 non-NFL pages
  and the adjacency is cosmetic.

## Deferred by decision, do not fix here

`CalendarGrid` seed logic, `league-hubs.ts` live flags, `sitemap.ts`,
`HUB_GROUPING`, the `AnalyticsSurface` union, the em dash at
`CalendarGrid.tsx:282`, the four em dashes in FAQ `Answer.text`, the
166-versus-169 contradiction in `promo-helpers.ts`, `playoffsActive` being
declared and never destructured in `RedesignTeamPage`, the hardcoded `NFL: 9` in
`authority-stats.tsx`, and the MLB doubleheader / home-games denominator
question.
