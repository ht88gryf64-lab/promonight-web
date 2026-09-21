# RSC payload field sweep — what ships without rendering

**Date:** 2026-09-21. Read-only. Measured against production served HTML, not
read off the source.

**Trigger:** approving the first reader contribution put the approved prose,
its `contributionId` and its `approvedAt` into the served bytes of
`/cfb/penn-state` while the page displayed nothing. Fixed in `7dbe174`. This
sweep asks where else the same class lives.

---

## 0. The mechanism, stated once

A **server component passing an object to a client component** serializes
**every field of that object** into the RSC flight payload, which is served in
the HTML. Nothing has to render it. The payload is the `self.__next_f.push([1,
"..."])` script calls.

Server-only data does not leak this way: the flight payload carries a server
component's *rendered output*, not its props. So the entire frontier is the set
of server→client prop boundaries.

**Method.** 78 client components in `src/`; 30 take a Firestore-backed type.
For each collection, find the read path's mapper, then extract the flight
payload from the live page and count distinct keys. Counting needs
`grep -o … | wc -l`: the served HTML is one line, so `grep -c` returns 1 for
"present" and hides the magnitude. That error is in an earlier draft of this
sweep and was corrected.

---

## 1. Result: the gates hold where it matters. Nothing sensitive ships.

**No contact, credential, email or suppressed claim reaches any payload.** Four
of five corpora are gated at the mapper, which is the right place, and the
measurements confirm the gate rather than the intention.

| corpus | mapper | verdict |
|---|---|---|
| `teams` | `mapTeamDoc` (data.ts:54) | allowlist. `contactUrl` — on all 169 docs, **zero readers anywhere in the codebase** — is dropped and never ships. |
| `promos` | `mapPromoDoc` (data.ts:109) | allowlist. `sourceUrl`, `verifyReason`, `titleProvenance`, `joinedFrom`, `resolvedFrom`, `fidelity`, `titleMissingTokens`, `tombstonedAt`, `seedProvenance`, `manualCuration` — all present on real docs, none reach any page. |
| `venues` | `getVenueForTeam` (data.ts:433) | allowlist **plus redaction at the mapper**: `redactClause`, `nearbySilenced`, `bagPolicyUrlFor`. `gatesOpen` and `publicTransit` are not mapped at all. |
| `venueHubs` | `publishedView` | never crosses a client boundary. `VenueHub` reaches only server components; `HubTeamLink` and `VenueHubLink` take scalars. |
| `cfbSchools` / `cfbVenues` / `cfbGames` | none — raw docs | **the gap.** See §2. |

### The suppressed-transit question, answered directly

The brief's worry was a suppressed transit string silenced on screen and
published in the bytes. **It does not happen.** Measured on four of the 43
suppressed buildings — `levis-stadium`, `dodger-stadium`, `citizens-bank-park`,
`neyland-stadium` — all of which carry a real `publicTransit` value in
Firestore:

```
/venues/levis-stadium        'ungated' 0   'publicTransit' 0   'Capitol Corridor' 0   'VTA' 0
/venues/dodger-stadium       'ungated' 0   'publicTransit' 0
/venues/citizens-bank-park   'ungated' 0   'publicTransit' 0
/venues/neyland-stadium      'ungated' 0   'publicTransit' 0
```

Two independent reasons, which is why it holds: the hub never crosses a client
boundary, and on the `venues` side the suppression is applied in the mapper
rather than in the JSX.

**`publishedView`'s `ungated` escape hatch is contained but is the one thing to
keep watching.** It attaches the full pre-gate object (`out.ungated = hub`,
venue-published-view.ts:162) — every suppressed claim, intact. One consumer:
`buildCondensedLogistics` (venue-hub-condensed.ts:101), which re-derives every
exclusion, every provenance check and transit suppression, waives only
`verified`, projects to `CondensedLine[]`, and is rendered by a server
component. **The day any object carrying `.ungated` is passed to a client
component, every suppressed claim on that building ships.** A one-line guard is
proposed in §5.

---

## 2. Three things ship without rendering. None is sensitive; all are waste.

### 2a. Promo scoring internals — the largest by volume

Crossing: `score`, `scoreBreakdown{baseType, itemType, highlight,
limitedQuantity, sponsor}`, `derivedSignals{quantityCap, isGenericTitle,
signalSources{limitedQuantity, sponsor}}`, `scoredAt`.

`mapPromoDoc` passes the two composite objects through wholesale
(`data.scoreBreakdown as ScoreBreakdown`), so the nested diagnostics ride along.

| page | copies of each field | renders a score? |
|---|---|---|
| `/mlb/minnesota-twins` | **236** | no |
| `/best-promos` | 279 | **yes** — legitimate |
| `/promos/today` | 26 | no |
| `/venues/target-field` | 7 | no |

The only reader is `scored-promo-card.tsx`, reachable only from
`best-promos-browser.tsx`. Everywhere else this is dead weight. `signalSources`
additionally publishes how the scorer classified each promo
(`"structured"` / `"text"` / `"none"`) — internal grading of our own data, on
236 promos per team page.

**Classification: internal diagnostic.** Not contact, not suppressed, not a
held value. Waste and mild disclosure, not a leak.

### 2b. CFB provenance, via `CfbSchedule({ games, school, venue })`

`CfbSchedule` is the client component; `CfbSchoolPage` is a server component
that hands it three raw docs. `CfbGameView.awaySchool` / `awayVenue` carry whole
opponent docs too, which is why several of these appear 4–5 times per page.

Shipping, rendering nothing:

- `CfbVenue`: `capacitySources`, `capacityVerified`, `capacityVerifiedAt`,
  `coordsSources`, `coordsVerified`, `coordsVerifiedAt`, `proposedFrom`,
  `humanConfirmed`, `source`, `timezoneSource`
- `CfbSchool`: `colorsSource`, `colorsHumanConfirmed`, `scheduleUrl`,
  `scheduleUrlConfirmedAt`, `editorialStatus`

**Classification: provenance + internal verification state.** These are our
audit trail — which sources corroborated a capacity, whether a human confirmed
a venue, whether coordinates were cross-checked. Publishing them is not a
privacy problem, but it is the same category the editorial fix just removed,
and `cfbSchools`/`cfbVenues` are the one corpus with **no mapper at all**.

**`editorialStatus` is now actively misleading.** It is a LEGACY STORED field:
`7dbe174` made it derived and deleted its three writers, but the stored value
remains on every school doc and still crosses. `/cfb/penn-state` ships
`"editorialStatus":"auto"` on a page that is now a destination. Nothing reads
it, so nothing breaks — but a stale claim is being published.

### 2c. Team affiliate identifiers

`ticketmasterAttractionId`, `ticketmasterSlug`, `fanaticsUrl`, `fanaticsPath`
— **169 copies each** on `/teams` and `/my-teams`.

`TicketmasterCTA` and `FanaticsCTA` are server components. The only client
reader is `my-teams-view.tsx`, which reads `fanaticsPath` / `fanaticsUrl`.
**`ticketmasterAttractionId` has no client reader at all.**

**Classification: partner-internal identifier.** Public-ish, but it is a
partner's ID for our affiliate relationship, published 169 times on a page that
uses none of it.

---

## 3. Proposed fixes, in order. None built.

1. **Guard `.ungated`** — the only latent *sensitive* one. Either strip it in
   the page's data function the way `stripEditorial` does, or add a test that
   fails if any `.ungated` carrier is a client-component prop. Cheap, and it
   closes the one path that would publish a suppressed claim.
2. **Add a mapper for the CFB corpus.** `cfbSchools`/`cfbVenues`/`cfbGames` are
   read with a bare `as CfbSchool` cast and handed to a client component. This
   is the same shape as the editorial defect and the only corpus with no
   allowlist. A `mapCfbSchoolDoc` / `mapCfbVenueDoc` that drops the provenance
   block would fix 2b entirely and prevent the next field from shipping by
   default.
3. **Drop the stored `editorialStatus`** from the 87 school docs, now that
   nothing writes or reads it.
4. **Project the scoring block** in `mapPromoDoc`, or pass promos to
   non-scoring surfaces without it. Biggest byte win (236 × 5 objects on a team
   page); lowest risk.
5. **Delete `contactUrl`** from the team docs, or give it a reader. 169 docs
   carry a field nothing in the codebase mentions.

---

## 4. What this sweep did NOT cover

- Client components taking non-Firestore props (analytics, capture, nav).
- The `games`, `teamScores`, `playoffPromos`, `tenants`, `appConfig` and
  `subscribers` collections — `subscribers` is the one holding real PII and it
  has no page render path at all, but that was asserted from the read paths,
  not measured.
- Preview/draft surfaces and API routes.
