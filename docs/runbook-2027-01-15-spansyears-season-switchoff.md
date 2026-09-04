# RUNBOOK: 2027-01-15, the season display switches itself off

**Trigger date: 2027-01-15.** Check before then. The failure is silent, and it
lands in the highest-value MLB publishing moment of the year.

Owner: whoever is on the promonight-web rotation in January 2027.
Code: `resolveSeasonScope` in `src/lib/season-scope.ts`.
Sibling runbook: `docs/runbook-2026-10-01-mlb-season-scope.md`.

---

## What will happen

`resolveSeasonScope` publishes a season count only when the team's dated rows
sit in a **single calendar year** equal to `TITLE_SEASON_YEAR`:

```ts
const span = seasonSpan(dated.map((p) => p.date));
if (!span || span.spansYears) return null;   // <- this line
const year = span.years[0];
if (year !== TITLE_SEASON_YEAR) return null;
```

MLB bobblehead calendars publish **January to February**. The moment the first
2027 row lands beside the retained 2026 archive, `span.spansYears` becomes true,
the resolver returns null, `resolveClaimMode` drops to `{kind:'remaining'}`, and
every affected MLB page reverts to the upcoming-only wording it had before this
whole change.

**Nothing announces it.** No error, no log, no test failure. The page simply
stops saying "N promotions in the 2026 season" and goes back to counting only
what is ahead.

The direction of error is safe. Falling back is correct behaviour, not a bug:
summing a finished 2026 season with a partial 2027 one produces a number that
describes no season at all, and absence beats a wrong total. But it is a bad
resting state, because it happens exactly when a fresh season of bobblehead
dates is publishing and the "[team] giveaways 2027" query family is warming up.

## Why it is worth fixing rather than accepting

The window is the peak. In September 2026 the Dodgers cluster alone carried
roughly 26,000 monthly impressions at 0.30% CTR, and the whole case for season
scope was that pages showing most of their season hit or beat the site's own
CTR-by-position curve while late-season pages undershot it by 5x to 17x. A
January page carrying a complete prior season plus a fresh partial one is the
best content the site will ever have on those queries, and the current guard
publishes the least of it.

## Proposed resolver, NOT YET BUILT

If the rows split into two calendar years **and every upcoming row sits in the
later year**, resolve to the later year, claim that season, and leave the
earlier year as a labelled archive.

The split is **observed, not modelled**. That is the whole point, and it is what
keeps this from reintroducing the season model `src/lib/season-label.ts`
explicitly refuses to build. Nothing here asserts that an NHL season "is"
October to April, or that a calendar year "is" a season. It asserts only what the
rows show: two years, and everything still ahead is in one of them.

`season-label.ts` already supplies the year span; the archive labelling for the
earlier year already works and ships today (`COMPLETED 2025 TO 2026 PROMOS`,
`30 completed events, October 2025 to April 2026` renders on the Red Wings page
right now).

## BUILD IT FROM A JANUARY MEASUREMENT, NOT FROM THIS NOTE

**The rule does not hold if the seasons interleave.** It depends on a clean
split: all upcoming rows in the later year, all earlier-year rows behind us. If
a club carries, say, a late-2026 row that has not happened yet alongside 2027
rows, or the pipeline backfills a 2026 date after 2027 rows land, the
precondition fails and resolving to the later year would publish a season total
that silently omits rows.

So before writing any code, measure. On or about **2027-01-15**, for every team:

1. How many teams actually carry two calendar years at that moment, per league.
2. For each, do ALL upcoming rows sit in the later year? Count the exceptions.
3. How do the rows divide between the years, and does the earlier year look
   finished?
4. How many teams would resolve under the proposed rule that do not resolve
   today, and how many would newly publish a WRONG total if the precondition is
   assumed rather than tested.

The read-only census used for the 2026-09-04 baseline is the template: it swept
all 169 teams and their promo subcollections and is described in
`audit/team-page-season-scope-phase0.md`.

If the measurement shows interleaving is common, **keep the fallback**. It is
correct. The alternative is a page that confidently publishes a season total
missing rows, which is worse than the understatement this project set out to fix.

## Also check on this date

`TITLE_SEASON_YEAR` is hardcoded 2026 across the title, the meta description,
the FAQ copy and this resolver, deliberately, so nothing rolls over at midnight
on Jan 1 before the data exists. Bumping it to 2027 is a separate, deliberate
edit made when 2027 content is ready, and it must move in lockstep everywhere.
Note that bumping it alone does **not** fix the `spansYears` guard: a team
carrying both years still falls back until the two-season resolver exists.

## Checklist

- [ ] 2027-01-15: run the census. Record per-league counts for the four
      questions above.
- [ ] Decide: build the two-season resolver, or keep the fallback and say so.
- [ ] If building: the precondition must be TESTED per team at render, never
      assumed, and a team that fails it falls back exactly as today.
- [ ] Confirm whether `TITLE_SEASON_YEAR` should move to 2027 in the same pass.
- [ ] Delete this file, or mark it done with the date and the decision.
