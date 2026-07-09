# CFB Affiliate Destination Validation (Part A) — pre-launch money-path gate

**Generated:** 2026-07-09 · **Branch:** cfb-phase3 (local, NOT pushed) · **Diagnostic only — no links fixed in this pass (per instruction).** Method: real HTTP resolve + `<title>` + page-body checks (a 200 is NOT treated as a pass, especially for TicketNetwork). Tracking IDs/surface tags were already verified (shared pro stack); this validates DESTINATIONS.

## Headline

| Vendor | Correct | Wrong destination | Degraded | Verdict |
|---|---|---|---|---|
| **TicketNetwork** | **80 / 86** (right team, football surfaced) | **6** (fuzzy-matched to wrong performer) | — | Fixable with a 6-entry slug-override table (slugs found) — fix before launch |
| **Ticketmaster** | **0 / 86** | **86** (bare slug 404 → generic browse) | — | **BLOCKER** — systemically broken; needs a decision (attraction IDs / search URL / drop) |
| **Expedia** | **78 / 86** (venue + camref end-to-end) | 0 | 8 (no venue coords → city-only/hidden) | OK; backfill 8 venue coords |
| **SpotHero** | **78 / 86** (venue coords + portal sid) | 0 | 8 (no coords → generic search) | OK; same 8-coords backfill |
| **Fanatics** | n/a | 0 | — | Correctly auto-omitted on all 86 (no broken link) ✓ |

**Launch call:** **Ticketmaster is a blocker** (100% broken). **TicketNetwork needs 6 slug overrides** (low count, all fixed values known — do before launch; Ole Miss → "Gay Ole Opry" and NC State → "Symphonic Band" are especially bad). Expedia/SpotHero are fine with an 8-venue coords backfill. Fanatics is correct.

## 1. TicketNetwork (the priority — 200s on everything)

The build generates `www.ticketnetwork.com/e/performers/{slugifySchool(name+mascot)}-tickets`, e.g. `minnesota-golden-gophers-tickets`. **The addendum's worry (full-football-slug guess) is mostly OK** — for 80/86 it lands on the correct team's TN page, and those pages DO surface the team's football tickets (body check: Ohio State 187 "football" mentions / 646 event indicators; Minnesota 216 / 1020; Alabama 288 / 766). But TN fuzzy-serves a 200 for unknown slugs, and **6 land on the wrong performer:**

| School | Build slug | Resolves to (WRONG) | Correct override slug (verified) |
|---|---|---|---|
| **ole-miss** | ole-miss-rebels | **"Gay Ole Opry"** (comedy) | `mississippi-rebels` → "Mississippi Rebels" |
| **appalachian-state** | app-state-mountaineers | **"APP New York City Open"** (tennis) | `appalachian-state-mountaineers` |
| **south-florida** | usf-bulls | **"USF Baseball Tournament"** | `south-florida-bulls` |
| **army** | army-black-knights | **"…Black Knights Softball"** | `army-west-point-black-knights` |
| **smu** | smu-mustangs | **"…Mustangs Women's Volleyball"** | `smu-mustangs-football` |
| **nc-state** | nc-state-wolfpack | **"NC State Symphonic Band"** | `north-carolina-state-wolfpack` |

Root cause: `slugifySchool` uses school name/mascot (sometimes the short name, e.g. "App State", "USF"), and TN indexes some teams under a different form (Ole Miss = "Mississippi Rebels"), a different sport page, or a same-token non-team performer.

**Marquee (§13) — explicitly validated:** Ohio State, Michigan, Texas, Oklahoma, Georgia, Alabama, Auburn, Tennessee, Penn State, Minnesota → **correct team** (title-matched, football surfaced). **Ole Miss → WRONG ("Gay Ole Opry")** — the one marquee miss.

**Precision note:** the 80 correct pages are the team's GENERIC (all-sports) TN page, which lists football. A `{...}-football` variant exists (e.g. `alabama-crimson-tide-football-tickets` → "Alabama Crimson Tide Football Tickets") and would (a) force the football-specific page and (b) auto-fix the two SPORT mismatches (army, smu) — but the NAME mismatches (ole-miss→Mississippi, nc-state→North Carolina State, app-state/south-florida full name) still need name overrides. **A 6-entry `TICKETNETWORK_OVERRIDES` table (like the pro side already maintains for oakland-athletics) is the robust fix.** Optionally re-run over all 86 with the `-football` variant to force football pages site-wide.

**Honest limitation:** validation confirms the PERFORMER PAGE is the right team + surfaces football; it did not click each of the 80 through to confirm every school's specific 2026 game inventory is currently listed. The 6 wrong ones are unambiguous.

## 2. Ticketmaster — SYSTEMICALLY BROKEN

Every CFB TM link is `ticketmaster.com/{nickname}-tickets` (no `ticketmasterAttractionId` for CFB) → **HTTP 404, title "Ticketmaster - Browse"** for all 11 marquee (both `{nickname}-tickets` and `{nickname}-football-tickets`). This is systemic, not CFB-slug-specific: even the **pro** Twins bare slug 404s — pro pages only resolve because they carry `ticketmasterAttractionId` and emit `/{slug}-tickets/artist/{id}`. CFB has no attraction IDs, so the bare-slug fallback 404s across the board.

TM *does* list CFB football (`ticketmaster.com/search?q=Alabama Crimson Tide Football` → 200, "Find tickets for 'Alabama Crimson Tide Football'"). **Fix options (decision needed, not made here):** (a) populate `ticketmasterAttractionId` for CFB teams (research pass, like the pro populate script); (b) route CFB TM to a `/search?q=…` URL; (c) drop the TM button for CFB and rely on TicketNetwork for tickets. Until one is chosen, **every CFB Ticketmaster click 404s** — a launch blocker for that CTA.

## 3. Expedia — correct + tracked end-to-end (for coords-venues)

Decoded (Auburn): `expedia.com/affiliate?siteid=1&landingPage=…Hotel-Search?destination=Jordan–Hare Stadium, Auburn&latLong=32.60222,-85.48917…&camref=1011l5KcC9&creativeref=1100l68075&adref=PZPbSQWcB2&pubref=web_cfb_auburn`. So: **venue name + coords in the deep-link, camref/creativeref/adref present, pubref = web_cfb_{id}** — correct destination + attribution end-to-end.

**8 venues lack lat/lng** → `resolveHotelLink` falls back to city-level or hides: `ben-hill-griffin-stadium` (Florida), `bridgeforth-…` (JMU), `darrell-k-royal-…` (Texas), `martin-stadium-…` (Northwestern), `memorial-stadium-lincoln` (Nebraska), `saban-field-at-bryant-denny-stadium` (Alabama), `sanford-stadium` (Georgia), `space-city-financial-stadium` (Houston). Several are marquee/major (Texas, Alabama, Georgia, Florida, Nebraska). Not broken (fallback works), but a small coords backfill would restore precise stadium-area hotel search for these.

## 4. SpotHero — correct + portal attribution (for coords-venues)

`spothero.com/search?lat={venue.lat}&lng={venue.lng}&sid=web_cfb_{…}` — parking at the venue coords with `sid` portal attribution. Same **8 no-coords venues** fall back to `spothero.com/?sid=…` (generic, no coords). Same coords backfill fixes both Expedia + SpotHero.

## 5. Fanatics — correctly omitted

All 86 CFB schools have no `fanaticsUrl`/`fanaticsPath` (college teams excluded from the mapping) → `FanaticsCTA` returns null. **0 broken Fanatics links.** ✓

## Recommended pre-launch actions (report, not applied)

1. **TicketNetwork:** add the 6 overrides above (or re-run all 86 with a `-football` variant + keep the 6 name overrides). Small, known.
2. **Ticketmaster:** DECISION — populate attraction IDs, switch to search URLs, or drop the CFB TM button. Currently 100% 404.
3. **Coords backfill** for the 8 venues → restores Expedia/SpotHero precision.
4. Fanatics: no action.

## Adversarial self-check

1. **Any TN/TM reported correct on a 200 alone?** No — TN "correct" required a title match to the school AND a body check that football is surfaced; the 6 wrong performers were caught despite 200s. TM's 404 was caught, not passed.
2. **Long tail honestly marked?** The 80 TN "correct" are validated to team + football surfaced; the honest limitation (not click-through-confirmed per-school 2026 inventory) is stated. The 6 wrong are explicit. Nothing silently claimed passing.
3. **Marquee explicitly validated?** Yes — all 11 §13 marquee listed with per-school results (10 correct, Ole Miss wrong).

---

**STOP — Part A gate. Reporting before Part B. No links fixed, no push, no merge.**
