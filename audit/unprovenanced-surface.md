# What the site still publishes with no provenance

Report only, 2026-08-29. Counts what RENDERS after every gate, not what is
stored. A CLAIM is a stored value asserting a fact; a POINTER (a link) asserts
nothing and is excluded from the totals.

## The number

**2,641 unprovenanced claims render today** — but see the correction below, and
`audit/promos-provenance.md`: the comparable forward-looking figure is **415**.
The promo count groups 2,224 PAST events with 77 upcoming ones, and treats
scanner-verified rows as the same risk class as generated venue prose.

| Corpus | Rendered claims | Carry a source | Unprovenanced | Where |
|---|---|---|---|---|
| `promos` (subcollection) | 4,881 descriptions | 2,578 | **2,303** | every promo row, on every surface, plus JSON-LD |
| `venues` | 296 | 0 | **296** | the venue card on 100 team pages |
| `recurringDeals` | 42 | 0 | **42** | recurring-deal sections |
| `venueHubs` | 1,010 | 1,010 | **0** | venue pages, /cfb, /nfl |
| `playoffPromos` | 172 | 172 | **0** | /playoffs |

The `venues` 296 break down as `parkingInfo` 100, `accessibility` 99,
`nearby` 97. **No document in the `venues` collection carries a `sources` map at
all**, so the number is not "unsourced pending a pass"; the corpus has no place
to put a source.

## The shape, which matters more than the count

**Three different failure modes, needing three different remedies.**

**1. `promos`, 2,303 of 4,881: a partial regime.** Just over half the corpus
carries a `sourceUrl` and the rest does not, which is the most dangerous of the
three states. A reader cannot tell the sourced half from the unsourced half, and
neither can a future audit without re-verifying everything. This is the same
condition that made the venues batch unfixable per-doc. It is also the largest
surface on the site by an order of magnitude, and unlike venue prose it changes
every week, so the unsourced share is continuously refreshed rather than
decaying. **This is the one that should be measured again before anything else
is swept.**

**2. `venues`, 296: no regime at all.** Zero provenance, by construction. Two of
its fields were silenced outright on 2026-08-29 for being 78.9% and 47% wrong;
the three that remain were never verified either, and survive only because
nobody has sampled them. `parkingInfo` and `accessibility` in particular carry
prices, gate names, ADA routing and shuttle claims. The honest description is
that this corpus is unaudited rather than sound.

**3. `recurringDeals`, 42: small and uniform.** No source on any of them, but 42
is a size a person can verify in an afternoon. It is the only one of the three
where "fix per doc" is a real option.

**And `venueHubs` at 0 is the control that proves the regime works.** 1,010
claims render, every one with its own provenance key, and 58 populated fields
are withheld because they lack one. That corpus went through the same generated
seeding as the others. The difference is not the data, it is that a gate exists
and is consulted.

## What this does not count

- **Pointers.** 100 bag links on team pages plus the hub pointer set. A link
  asserts nothing, and the pointer/claim split is deliberate.
- **`games`, 2,776 docs.** Schedule data from official feeds. A different class:
  wrong dates are a data-quality problem, not an unsupported assertion.
- **Structural fields** (name, city, coordinates, address, capacity). Ungated on
  every consumer. `address` is worth noting separately because it reaches the
  weekly digest as "Happening around {city} this week" through a path with no
  gate of any kind, which is a second ungated door into the `venues` collection.
- **Derived copy** built by the app from counts and dates rather than stored
  prose. That is generated, but it is generated from data the page also shows.

## The decision this is meant to inform

Sweeping and building the tripwire are not alternatives at this size. **2,303 of
the 2,641 sit in one corpus that changes weekly**, so a sweep of it is stale
before it finishes, while a tripwire that fails a build on an ungated render
path costs one afternoon and holds for every corpus at once. The two corpora
where a sweep genuinely terminates are `venues` (296, static) and
`recurringDeals` (42, static).

The counterargument, stated fairly: a tripwire prevents the NEXT gap and does
nothing about the 2,641 already live, and the `venues` 296 are on the highest-
traffic pages on the site.
