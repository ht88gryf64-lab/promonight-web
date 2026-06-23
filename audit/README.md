# Site-audit generator

`audit/generate-site-audit.ts` regenerates the **`[AUTO]`** sections of
[`docs/SITE-AUDIT.md`](../docs/SITE-AUDIT.md) from the repo + Firestore. It
reuses the repo's existing Firestore credential path
(`src/lib/data` → `src/lib/firebase`, `FIREBASE_SERVICE_ACCOUNT_KEY`) — no new
credential mechanism — and makes **no PostHog / GSC / Bing calls**. It never
reads or writes `[LIVE]` data.

- `audit/collect.ts` — `collectAuto()`, the pure, dependency-injectable
  collector. It performs no file writes and returns a single structured object.
  The dashboard cron can call it directly.
- `audit/generate-site-audit.ts` — the CLI: parses `docs/SITE-AUDIT.md`,
  regenerates `[AUTO]` bodies from `collectAuto()`, and writes/diffs the result.

## Tag contract

`docs/SITE-AUDIT.md` is organized into `## ` (level-2) sections. The section's
behavior is declared by a bracketed tag inside its header:

| Tag         | Header example                                   | Generator behavior                                  |
|-------------|--------------------------------------------------|-----------------------------------------------------|
| `[AUTO]`    | `## 3. Data completeness by league [AUTO, …]`    | **Body regenerated** from `collectAuto()`; header normalized to `[AUTO, generated YYYY-MM-DD]` |
| `[LIVE]`    | `## 1. Traffic and search [LIVE, as of …]`       | **Preserved byte-for-byte** (PostHog/GSC/Bing — supplied in-thread) |
| `[MANUAL]`  | `## 5. Monetization [MANUAL - NEEDS CONFIRM]`    | **Preserved byte-for-byte** (supplied by Matt)      |
| _(untagged)_| `## 0. Headline state`                           | **Preserved byte-for-byte**                         |

Rules:
- Section boundaries are level-2 (`## `) headers only; `### ` subsections stay
  with their parent section.
- The top-of-file `Generated:` line is updated to the run date.
- Everything that is not an `[AUTO]` section is preserved exactly, including
  whitespace. An `[AUTO]` section the generator has no renderer for is also
  preserved (fail-safe), not blanked.
- Currently regenerated `[AUTO]` sections: **§3 Data completeness by league**,
  **§4 Content coverage**, **§6 Technical health**.

## Data-completeness rubric (signed off 2026-06-12)

A per-team field-presence index; a league's **Overall /10** is the mean of its
teams' totals. This is a **new standard** — it does not reproduce the older
April editorial scores.

| Dimension                              | Field check                                                        | Points |
|----------------------------------------|--------------------------------------------------------------------|:------:|
| Has upcoming promos (≥1)               | ≥1 promo with `date >= today`                                      | 3.0    |
| Promo depth (≥5)                       | ≥5 upcoming promos                                                 | 2.0    |
| Venue resolved                         | `getVenueForTeam` non-null with `address` + finite non-zero coords | 2.0    |
| Venue PYV detail                       | effective `parkingInfo` **&&** `publicTransit` **&&** `bagPolicyUrl` | 2.0  |
| Gate times                             | `gatesOpen` set                                                   | 0.5    |
| Recurring every-game deals             | team has >=1 visible `teams/{id}/recurringDeals` doc (Firestore, tombstone-filtered) | 0.5 |
| **Total**                              |                                                                    | **10.0** |

- **Structural /10** = the season-independent subset only (venue resolved + PYV
  + gates + recurring = 5.0 max), normalized ×2. Read it to judge structural
  data quality without the current-season promo signal.
- **Season** flag = `offseason` when a league has **0 upcoming promos** as of
  the generation date. Because 5 of 10 Overall points require upcoming promos,
  offseason leagues score low on Overall regardless of structural quality —
  that is what Structural /10 is for.

### Coverage counts (`X/167`)
- **Recurring deals**: teams with at least one visible doc in the Firestore
  `teams/{id}/recurringDeals` subcollection (tombstone-filtered; _not_ the
  `Promo.recurring` flag).
- **Venue detail** — teams whose **effective** venue (Firestore + venue
  overrides) has `parkingInfo` **&&** `publicTransit` **&&** `bagPolicyUrl`;
  gate-times reported separately.
- **Affiliate readiness** (reported separately, **not** in the score) —
  Ticketmaster-ready = has `ticketmasterAttractionId`; Fanatics-ready = has
  `fanaticsUrl`.

## Other `[AUTO]` checks

- **Page inventory** by route type (globs `src/app/**/page.tsx`; the dynamic
  `[sport]/[team]` template counts as the live team total).
- **Aggregator pages** present (`/promos/*`, `/best-promos*`, `/world-cup`).
- **Schema presence** per template — actual emitted JSON-LD `@type`s vs the
  expected set, surfacing gaps (e.g. `/promos/*` emits `Article + FAQPage`,
  short of the `CollectionPage + ItemList + FAQPage` aggregator target).
- **Technical assertions** — robots allows GPTBot / ClaudeBot / PerplexityBot /
  Google-Extended / ChatGPT-User / Applebot-Extended; `llms.txt` present; single
  canonical (www) sitemap with no non-www duplicate; www-canonical consistency
  across `metadataBase` / sitemap / robots.
- **Known-bug checks** — asserts the `/playoffs` openGraph `images` array is
  present, and scans every page that defines an `openGraph` block for a missing
  `images` array (the og-image-blank bug class).

## How to run

Run from the repo root (mirrors every other script in this repo):

```bash
# dry-run (default): writes docs/SITE-AUDIT.generated.md and prints a unified diff
npm run audit:generate

# apply: replace docs/SITE-AUDIT.md in place
npm run audit:generate -- --execute

# data only, no doc parsing
npm run audit:generate -- --summary   # human digest
npm run audit:generate -- --json      # full structured object
```

Equivalent direct invocation:

```bash
npx tsx --env-file=.env.local --require ./scripts/stub-server-only.cjs \
  audit/generate-site-audit.ts [--execute | --summary | --json]
```

The dry-run `docs/SITE-AUDIT.generated.md` is git-ignored; only `--execute`
touches the canonical `docs/SITE-AUDIT.md`. After applying, re-upload
`docs/SITE-AUDIT.md` to project knowledge (the one manual step).
