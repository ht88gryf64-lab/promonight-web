# Runbook: the three seeded NFL flex rows

**Written 2026-09-13, when the Patriots and Broncos theme slates were seeded by hand.**

## Why this file exists

`new-england-patriots` and `denver-broncos` publish their 2026 theme slate only
as a social graphic. There is no crawlable article, so 22 rows were seeded by
hand from the graphics (`scripts/seed-nfl-gameday-themes.js` in the pipeline
repo). Dates came from the games spine, joined by opponent.

Three of those rows sit on games the NFL has not finally scheduled. The spine
carries `timeTbd: true` on all three.

| club | promoId | spine date | title | flex window |
|---|---|---|---|---|
| new-england-patriots | `a272ed0b37650022` | 2027-01-03 | Inspire Change | Jan 2-4 |
| new-england-patriots | `5aaeb259ec4fa44f` | 2027-01-10 | Thank You Fans | Jan 9-10 |
| denver-broncos | `399ba2b328075362` | 2027-01-09 | Fan Appreciation | Jan 9-10 |

## The hazard

`promoId = sha256(teamId | date | normalizedTitle)`, first 16 hex characters.
**The date is part of the identity.** If the NFL flexes one of these games to a
different day, the seeded doc does not move. It keeps rendering under the old
date, and nothing corrects it:

- The row carries `manualCuration: true`. `promo-writer` never touches a locked
  doc and `promo-diff` routes it to a `*-locked` HOLD. The lock that protects
  the row from a scanner is the same lock that prevents a scanner fixing it.
- Both clubs have no scanner source at all, so no replacement candidate would
  be generated even with the lock off.
- **Nothing compares a promo's date against the spine.** The games ingest will
  update the spine when the NFL publishes the flexed date. No job reads that
  back into promos.

So the failure is silent, and it surfaces as a wrong date on a live page.

## The correction path

Two steps, in this order. Re-running the seed script alone is NOT enough,
because it only writes; the stale doc would remain and the page would show the
promo twice, on two different dates.

1. **Delete the stale doc by its id** from `teams/<club>/promos/<promoId>`,
   using the id in the table above.
2. **Re-run the seed script.** It re-joins by opponent, picks up the new spine
   date, mints the new promoId and writes the row:
   `node scripts/seed-nfl-gameday-themes.js --execute`
3. Revalidate: POST `/api/revalidate` with `/nfl/<club>`.

## When to check

Check after the NFL announces its Week 17 and Week 18 schedule, which is
normally in the back half of December 2026. The check is cheap: compare each
row's `date` against the spine game for the same (club, opponent).

```
node -e '...' # join teams/<club>/promos against games by opponent, diff the date
```

If a general spine-vs-promo date reconciliation ever gets built, it supersedes
this file and these three rows stop being special.
