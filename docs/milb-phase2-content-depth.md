# MiLB Phase 2: team page content depth
Starts after Phase 1 G4. Everything stays behind milbLive=false.

1. Recurring-promo summary: group MILB promos that repeat on the same weekday with the same offer_name/offer_type into an "Every {weekday}" block above the schedule. Derive from data; no hardcoded counts. Known-bad test: a one-off promo must not appear as recurring.
2. Parent, affiliate and sibling links:
   - MILB team page links to its parent MLB team.
   - Each MLB team page gets an "Affiliates" module listing its 4 MILB clubs by level.
   - Each MILB team page shows its full parent system, e.g. "Twins system: St. Paul (AAA) · Wichita (AA) · Cedar Rapids (A+) · Fort Myers (A)", current club shown unlinked, levels ordered AAA to A, derived from parentTeamId (no hardcoded lists).
   - Link only to clubs that pass milbLive and are indexable. Known-bad test: a sibling with zero upcoming promos (noindex) renders as plain text, not a link.
3. Ballpark basics from the Stats API venue endpoint for the stored venue.id: name, city/state, coordinates only. Use coordinates to enable the existing forecast on MILB promo pages. No bag, parking, gate or transit fields, ever.
4. Explainers: list the 15 most frequent MILB offer_name/offer_type values across all 120 clubs with counts, so Matt can pick which get explainer entries (claude/promo-explainers-draft.md format). Report only; do not write explainers.

Gates: G1 diff + test suite as its own step + ux-review subagent (390/768/1280) on a MILB team page and an MLB page with the Affiliates module, rendered against a seeded test doc. Adversarial reviewer before merge. Stop and report; do not merge or flip milbLive.
Subagents: 2 (ux-review, adversarial reviewer). Network: 40 per phase.
