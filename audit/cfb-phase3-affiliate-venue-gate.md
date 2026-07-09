# CFB Phase 3 — Venue Panel + Trophy Hotlinks + Real Affiliate Stack (Gate)

**Generated:** 2026-07-08 · **Branch:** `cfb-phase3` (local commits, NOT pushed) · **Preview:** deployed (protection ON). **No prod, no merge to main, no push.**

## Verdict

**PASS.** Two additions landed on the ONE `CfbSchoolPage` template, on a branch first brought up to date with `main`:
1. **Venue facts panel** (right of the hero) — verified `cfbVenues` structure only, no invented/generated data.
2. **Trophy tag hotlinks** — each rivalry tag links to the trophy's own Wikipedia article (the stored corroborating source), new-tab + `noopener noreferrer`; null/invalid → plain text.
3. **Real shared affiliate stack** — CFB now renders the SAME components the pro pages use (Ticketmaster + TicketNetwork stacked, SpotHero, Expedia, Fanatics), not copies, with clean `web_cfb` attribution.

A 4-lens adversarial verification ran; 3 lenses PASS, the one "concerns" is the already-flagged TN/TM slug-validation follow-up. All findings triaged below.

## Pre-req: merge main → cfb-phase3 (the branch was 78 commits behind)

Required to reuse the real shared components (they post-date the cfb lineage). **Post-merge check PASSED:**
- Conflict surface was exactly as predicted: **only `src/lib/analytics.ts`** (kept both new surface sets; registered `web_cfb` in the union, the `KNOWN_SURFACES` allowlist, and `inferSurfaceFromPath`). The 2 calendar files auto-merged; no other manual resolution.
- Build clean (287 pages). Phase 3 work survived: immersive theming (hero wash, vivid accent, Instrument Serif), ONE-template conditional blocks, kickoff TBA fix (**0** impossible 1–6 AM renders across 86), rivalry tags, venue resolution, crown-none.

## Task A — Venue facts panel

- Renders **only** verified `cfbVenues` fields: `name`, `Location` (city/state, gated on presence), `Capacity` (gated on `capacity > 0`). No generated prose (that stays the editorial `venueInTheirWords` block).
- **opened-year and surface are NOT in the `CfbVenue` schema → OMITTED, never invented.**
- **Data reality:** capacity is populated for **only 9/86 venues** (App State 30,000; Penn State, Kansas, Kansas State, Pittsburgh, Ole Miss, San Diego State, UCF, Utah). 77 are null → the row is omitted (no `toLocaleString()` on null). 79/86 have location. So most panels show **name + location**; the 9 add capacity. Honest "show what's verified."

## Task A — Trophy tag hotlinks

- `cfbRivalries.source` is a provenance **trail**, not a single URL: `"<master-list URL> + <trophy article URL>"`. The reader (`data.ts:safeHttpUrl`) extracts the **non-list** `en.wikipedia.org/wiki/` article and surfaces it; the master list is **never** linkable.
- Tag renders as `<a target="_blank" rel="noopener noreferrer">` when a valid article URL exists, else a plain `<span>` (never a broken link).
- **Verified:** 0 `/wiki/List_of` links across all 86 pages; the 4 Minnesota trophy URLs + Toledo's rivalry URL resolve **200**; 10 tag links each carry `target=_blank` + `noopener noreferrer`.

## Task B — Real shared affiliate stack

- CFB imports the **same** `@/components/affiliates/*` leaves as the pro `AffiliateRail` — `TicketmasterCTA` (Ticketmaster + TicketNetwork stacked), `SpotHeroCTA`, `ExpediaCTA`, `FanaticsCTA`. **No inline reimplementation or restyle** (Lens 1 could not refute).
- **TicketNetwork resolves the full football slug** via a new symmetric optional `Team.ticketNetworkSlug` (mirrors `ticketmasterSlug`): `minnesota` → `ticketnetwork.com/e/performers/minnesota-golden-gophers-tickets`, subId1 `web_cfb_minnesota`. Pro teams leave it unset → id-based default unchanged.
- **Expedia names the school's own venue:** "Find hotels near Huntington Bank Stadium" (home) / "Husky Stadium" (Washington road trip) — CFB passes its own `cfbVenues` venue (name + coords).
- **Fanatics auto-omits** for all 86 (76 college teams excluded from the mapping; `FanaticsCTA` self-gates to null). 0 Fanatics links.
- **Attribution clean:** `web_cfb` on every CTA; **0 `web_team_page`, 0 `web_away_game`** across pages. CFB uses CFB-only placements (`cfb_gameday` / `cfb_signature` / `cfb_road_trip`) — never `away_game_card` — and never passes `gameDate`, so the two pro-surface fork branches in the shared components are structurally unreachable.

## Adversarial verification (4 lenses)

| Lens | Verdict | Outcome |
|---|---|---|
| Shared-not-copied | **pass** | Same modules as AffiliateRail; zero inline partner markup |
| Attribution | **pass** | All CFB clicks `web_cfb`; fork branches unreachable; `web_cfb` in union + allowlist |
| Broken-links + invented-data | **concerns** | Venue panel + trophy links PASS; major = TN/TM slug validation (flagged follow-up); 1 nit → rejected |
| Pro regression | **pass** (re-verified) | Lens returned a stub; deterministic check confirms pro TN unchanged (Dodgers → `los-angeles-dodgers-tickets`) |

**Nit rejected (would introduce bugs):** the suggestion to strip trailing punctuation from the trophy URL would corrupt real article names that legitimately end in `)` — `Little_Brown_Jug_(college_football_trophy)`, `Holy_War_(BYU–Utah)`, `Governor's_Cup_(Kentucky)` — or contain commas (`Clean,_Old-Fashioned_Hate`). The provenance is space-delimited, so `[^\s"]+` already captures each URL exactly; all resolve 200. No change.

## Flagged follow-ups (logged, not done — per instruction)

1. **CFB ticket-vendor slug validation.** TicketNetwork (and Ticketmaster) ship from unvalidated performer slugs; TN returns 200 for *every* slug (incl. bogus), so "no 404" ≠ "right performer." `audit/validate-ticketnetwork-links.ts` covers pro teams only. Recommended: extend it to iterate the 86 `cfbSchools` (via `toAffiliateTeam`) + a TM-slug check, record any mismatches as CFB overrides. **Live-but-unvalidated on CFB until this runs.**
2. **Venue capacity backfill.** Only 9/86 venues have capacity (Phase-2 gap). A small additive pull could backfill capacity (and opened-year/surface, currently absent from the schema) from the venue infobox to enrich the panel.

## Preview

`https://promonight-avzrkxihh-btj8tk69dk-7318s-projects.vercel.app/cfb/<school>` — Deployment Protection ON (anonymous → 302 SSO). Review authenticated in-browser.
- **Minnesota** (rich, 4 rivalry games with trophies) — full stack: Ticketmaster + TicketNetwork + SpotHero + Expedia ("near Huntington Bank Stadium"), **Fanatics absent**; venue panel (name + Minneapolis, MN — capacity null → omitted); 4 clickable trophy tags.
- **Toledo** (sparse G5) — venue panel useful from name (Glass Bowl) + location; capacity omitted (null); 1 trophy link (Bowling Green–Toledo), no broken links; same real stack, Fanatics absent.

## Adversarial self-check (the four required)

1. **Same shared components, or a copied restyle that drifts?** Same — CFB imports the identical `@/components/affiliates/*` leaves AffiliateRail uses; no inline partner markup (Lens 1 pass). Change a partner once → propagates to pro + CFB.
2. **Does the CFB hotel CTA resolve the school's OWN venue?** Yes — Expedia deep-links + labels the school's `cfbVenues` venue (name + coords): "Find hotels near Huntington Bank Stadium" / "Husky Stadium," not a pro default.
3. **Any partner CTA linking to a bad/missing URL?** No broken links: Fanatics omitted (no CFB mapping), trophy links resolve 200 (never the list page). Caveat logged: TN/TM slugs are unvalidated (soft-200), so "right performer" isn't yet confirmed — the flagged validation pass covers it.
4. **Does `web_cfb` tagging survive the swap?** Yes — 0 `web_team_page` / 0 `web_away_game` across pages; `web_cfb` in the union AND the allowlist (no downgrade to `web_other`); pro-surface fork branches unreachable from CFB.

---

**STOP — gate only. Preview deployed, no prod, no merge, no push.**
