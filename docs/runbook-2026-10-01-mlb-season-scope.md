# RUNBOOK: 2026-10-01, lift the MLB season-scope hold

**Do this on 2026-10-01. It will not happen on its own.**

Owner: whoever is on the promonight-web rotation that day.
Branch that introduced it: `feature/team-page-season-scope`.
Code: `MLB_SEASON_SCOPE_START` in `src/lib/season-scope.ts`.

---

## What is scheduled to happen

Team pages publish SEASON promo counts instead of upcoming-only counts. MLB was
held back so the change would not land inside `ctr-diagnostic-sep2026`
(`src/lib/title-treatment.ts`), whose four-week read date is 2026-10-01 and whose
treatment arm is ten MLB team pages.

The gate is a dated condition evaluated at render:

```ts
export const MLB_SEASON_SCOPE_START = '2026-10-01';
isSeasonScopeLive('MLB', today)  //  today >= MLB_SEASON_SCOPE_START
```

There is no env var and no feature flag. Nothing needs editing to flip it.

## The step that IS required, and why

**The original comment on that constant said the pages would pick the change up
"on their next ISR revalidation within 24 hours, no second build, no redeploy."
That was wrong and has been corrected in the code.** Next.js ISR is:

1. **Request-triggered, not time-triggered.** `export const revalidate = 86400`
   does not schedule anything. A page with no request after its window expires
   never regenerates.
2. **Stale-while-revalidate.** The first request after expiry serves the OLD
   HTML and only enqueues the regeneration. The earliest anyone sees new output
   is the second request after expiry.

So 24 hours is a floor, not a ceiling, and the flip is staggered per page and
unbounded above. Left alone, the corpus sits in a mixed state: some MLB pages
saying "144 promotions in the 2026 season", others still saying "19 promotional
events coming up in the 2026 season", including inside FAQPage structured data.

Nothing in this repo forces it. The MLB cron (`/api/cron/mlb-schedule`, Mon
10:00 UTC) calls no `revalidatePath`. The pipeline MLB scanner (Tue 08:00 UTC,
first post-flip run 2026-10-06) does, but only for teams whose promos CHANGED,
and by October there are no MLB promos left to change.

### Do ONE of these on 2026-10-01

**Option A, preferred: ship any deploy.** A production deployment rebuilds all
169 team pages, so every MLB page converges at once. If a deploy is already
scheduled that day, this runbook needs nothing else.

**Option B: revalidate the 30 MLB paths explicitly.**

```bash
# Paths are /{sportSlug}/{teamId}. sportSlug is NOT a stored Firestore field:
# derive it as data.league.toLowerCase(), the way mapTeamDoc does. Building the
# path from d.data().sportSlug yields undefined and silently drops every doc.
curl -sS -X POST https://www.getpromonight.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -d '{"paths":["/mlb/los-angeles-dodgers", ... all 30 ...]}'
```

**SANITY-CHECK THE COUNT.** `/api/revalidate` returns `{ok:true}` regardless of
whether a path was valid, so the response is not evidence. Compare the
server-counted number of paths revalidated against the number of paths you sent.
If they disagree, paths were dropped, almost certainly by the `sportSlug` trap
above. `/` is rejected by design; do not include it.

Then verify at the render, with a cache-busting curl and never `web_fetch`,
because the CDN serves stale:

```bash
curl -sS -H 'Cache-Control: no-cache' \
  "https://www.getpromonight.com/mlb/los-angeles-dodgers?cb=$(date +%s)" \
  | grep -o 'promotions in the 2026 season'
```

## What the pages will actually say, and why it is not what the design note shows

**Every MLB club has zero promo rows dated on or after 2026-10-01.** Measured
2026-09-04 across all 30: the latest row in the league is 2026-09-27, and 15
clubs end there. So on the day the hold lifts, every MLB page is already in the
season-complete state.

That means:

- MLB renders state (b), `"144 promotions in the 2026 season"`, with no forward
  clause. It never renders the mid-season shape,
  `"98 promotions in the 2026 season, 19 still to come"`, which is the example
  used throughout the code comments and the Phase 0 note.
- The promo list heading changes to `2026 SEASON PROMOS` under the eyebrow
  "The full season", instead of `UPCOMING PROMOS` over a line saying there are
  none.
- The calendar's 30-day prerender window is empty (no games), so the hidden
  day-detail blocks disappear and MLB pages get materially lighter, roughly
  600 to 650 KB against the 846 KB peak today.

If any of that reads wrong on the day, the revert is one line: set
`MLB_SEASON_SCOPE_START` to a later date and deploy. Pages that already flipped
need a forced revalidation to go back.

## After the flip, watch for this

`resolveSeasonScope` requires a single calendar year equal to
`TITLE_SEASON_YEAR`. When 2027 MLB rows begin publishing alongside the retained
2026 archive, typically January to February, every MLB page crosses into
`spansYears` and the resolver returns null. **The feature silently switches
itself off** and the pages revert to the upcoming-only wording, with nothing
announcing it.

That is the safe direction (absence beats a wrong season total) but it lands
exactly when the pages are most valuable, in the bobblehead-calendar query
window. See the "next season" position in
`audit/team-page-season-scope-phase0.md`; the fix is a two-season resolver, and
it should be built from a January measurement of how many teams land in that
shape, not before.

## Checklist

- [ ] 2026-10-01: confirm `ctr-diagnostic-sep2026` has been read before flipping
      anything. If the read has slipped, push `MLB_SEASON_SCOPE_START` out and
      redate this runbook.
- [ ] Deploy, or POST the 30 MLB paths to `/api/revalidate`.
- [ ] Compare the server-counted revalidation count against the paths sent.
- [ ] Cache-busting curl on 3 MLB pages, one of them a treatment slug, and
      confirm `"promotions in the 2026 season"` appears with no forward clause.
- [ ] Confirm page weight dropped rather than rose (expect roughly 600-650 KB).
- [ ] Delete this file, or mark it done with the date and the deployment sha.
