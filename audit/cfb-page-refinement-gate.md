# CFB Team-Page Refinement — gate

**Generated:** 2026-07-09 · **Branch:** cfb-phase3 (local, NOT pushed/merged) · CFB committed `live: false`.

Declutters the affiliate real estate and makes schedule games open a gameday modal. Template change to `CfbSchoolPage` — reuses existing components, no rebuild.

## Changes

**CHANGE 1 — top affiliate block only.** The "Plan your gameday" cluster under the hero (Ticketmaster + TicketNetwork, SpotHero, Expedia, Fanatics) stays. No bottom block added.

**CHANGE 2 — per-game affiliate stacks removed.** Deleted the entire "Road trips worth the drive" section (one card per away game with a stacked TM/SpotHero/Expedia cluster). Schedule rows are now clean: date, VS/AT/N, opponent, rivalry tag, kickoff/"Kickoff TBA" — no inline CTAs.

**CHANGE 3 — road games show stadium NAME + CITY, never the junk address.** Root cause found: the junk was in the scraped `cfbVenues.city`/`state` fields (59 of 86 are corrupt — raw street addresses, "University of X"+city run-ons, wiki fragments, bracketed URLs, empties; e.g. Purdue's `city` = "850 Steven Beering Drive[https://…search.cfm Find Campus Address]"). The `name` field is always clean.
- New authoritative `src/lib/cfb/venue-cities.ts`: a hand-verified `venueId -> city` map for all 86 venues (`venueCity()` returns the clean city or null; NEVER the junk field). Verified the 86 keys exactly match the Firestore venue ids.
- The junk rendered in TWO places: the removed Road Trips section AND the hero "About the venue" Location panel (which showed `venue.city, venue.state`). Both now use `venueCity()`. The clean city also flows into the top-block + modal affiliate destinations (Expedia now reads "Husky Stadium, Seattle" instead of the scraped address).

**CHANGE 4 — schedule games are clickable → gameday modal.** New `src/components/cfb/CfbSchedule.tsx` (client) renders the schedule as clickable `<button>` rows and opens the SHARED `Modal` shell (`src/components/ui/modal.tsx` — native `<dialog>`: focus-trap, Esc, backdrop-click, scroll-lock; NOT hand-rolled). Modal contents for a CFB game:
- Matchup (vs/at opponent) + date, kickoff or "Kickoff TBA" (+ network), rivalry/trophy tag with the Wikipedia hotlink.
- Venue as "Stadium · City" — the game's ACTUAL venue: the school's own for home games, the opponent's for away games (resolved from `awayVenue`/`awaySchool`, already loaded on the game view).
- The per-game affiliate cluster: TicketmasterCTA (TM + TicketNetwork), SpotHeroCTA (parking), ExpediaCTA (hotels) — pointed at that game's venue/host. `surface="web_cfb"`, `placement="cfb_game_modal"` (distinguishes modal clicks from the top block's `cfb_gameday` in PostHog). Neutral-site / untracked-opponent games gracefully show tickets only (no venue → no hotels/parking).

Shared presentational bits (`fmtMonthDay`, `fmtDayLong`, `TrophyTag`, `Eyebrow`, fonts) extracted to `src/components/cfb/cfb-bits.tsx` so the server page + client schedule share one source.

## Verification (local build 287/287, EXIT 0, tsc clean)

- **[C1]** "Plan your gameday" top block present on all 86 pages. No bottom block.
- **[C2]** "Road trips worth the drive" section gone from all 86 pages (0). No inline per-game stacks.
- **[C3]** Comprehensive junk scan (bracket/URL/street-word/"University of" indicators in visible text) across all 86 pages: **0 junk**. Hero Location now shows clean cities — Washington → **Seattle**, Purdue → **West Lafayette**, Alabama → **Tuscaloosa** (matches the task examples). 0 junk in any affiliate href across all pages.
- **[C4]** Schedule rows render as clickable `<button>`s (12 on Minnesota = its 12 games) with a hover chevron; the shared `<dialog>` modal shell is wired into every page's SSR. "Tap any game…" hint on all 86.
- **Affiliate tagging:** top-block hrefs carry `web_cfb`/`web_cfb_{id}` (verified); modal CTAs pass `surface="web_cfb"` `placement="cfb_game_modal"`. Expedia destination cleaned to "Husky Stadium, Seattle".
- **Read-efficiency preserved:** the stadium-name/city lookups use `venueCity()` (a static map) + the already-loaded `awayVenue`/`awaySchool` on the game view — NO new Firestore reads. `src/lib/cfb/data.ts` is untouched.

Interactive (modal open/close, contents, home vs away venue resolution, per-game affiliates) verified on the preview deploy — see URL below.

## Adversarial self-check
1. **Any per-game affiliate stack still inline in the schedule?** No — Road Trips section deleted; affiliates live only in the top block + the modal.
2. **Any raw venue address still rendering (esp. Purdue)?** No — 0 junk in visible text across all 86; hero Location + modal use `venueCity()`; Purdue shows "West Lafayette".
3. **Did the modal reuse the pro modal component or hand-roll one?** Reused the shared `Modal` shell (`ui/modal.tsx`, native `<dialog>`) — no new overlay/focus logic.
4. **Correct venue for BOTH home and away games?** Yes — home resolves the school's venue, away the opponent's (`awayVenue`); neutral/untracked degrade to tickets-only.
5. **web_cfb_* surface tags intact on modal CTAs?** Yes — `surface="web_cfb"`, `placement="cfb_game_modal"`; not a pro surface, not dropped.
6. **Did stadium-name lookups reintroduce per-page full-collection reads?** No — `venueCity()` is a static map; away venues were already loaded via the cached collections in `getCfbSchoolPage`. `data.ts` unchanged.

## Preview
- **https://promonight-ixdetwzdb-btj8tk69dk-7318s-projects.vercel.app** — deployed with CFB `live: true` TEMPORARILY (uncommitted; reverted after) so the full navigable experience (nav → hub → team page → gameday modal) is visible. Protected preview; review authenticated. Open a team page (e.g. `/cfb/minnesota`), click a schedule game to open the modal, and check an away game (e.g. "at Purdue" → "Ross-Ade Stadium · West Lafayette") vs a home game.

## Files
- New: `src/lib/cfb/venue-cities.ts`, `src/components/cfb/CfbSchedule.tsx`, `src/components/cfb/cfb-bits.tsx`.
- Edited: `src/components/cfb/CfbSchoolPage.tsx` (removed Road Trips + inline ScheduleRow; schedule now `<CfbSchedule>`; hero Location + top-block affiliates use clean city).

---

**STOP — CFB page-refinement gate. No push/merge. CFB committed `live: false`.**
