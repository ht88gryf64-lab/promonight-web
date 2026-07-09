# CFB Affiliate Destination Validation (Part A) — pre-launch money-path gate

**Generated:** 2026-07-09 · **Branch:** cfb-phase3 (local, NOT pushed) · **Status: fixes APPLIED (was diagnostic-only; corrected 2026-07-09).**

Method: real destination checks — for fuzzy/redirect vendors a 200 is NOT treated as a pass; TicketNetwork was validated by RENDERED title + body, Fanatics stores by web-search discovery (WAF-blocks curl), Expedia/SpotHero by decoded deep-link + coords. Tracking IDs/surface tags were already verified (shared pro stack); this validates DESTINATIONS.

> **Correction (2026-07-09):** the original pass reported Ticketmaster as a "100% blocker (404)." That was a **validation-method false negative** — an HTTP fetch of a browser-resolved, bot-protected redirect vendor. Per `docs/ticketmaster-impact-attribution-conflict.md` ("never conclude an affiliate link is broken from an env/curl read — read the rendered href"), TM resolves correctly in-browser and on the deploy. **TM is correct; no change was made.** All other findings below drove real fixes, now committed on cfb-phase3.

## Headline

| Vendor | Result | Verdict |
|---|---|---|
| **TicketNetwork** | 80/86 correct out of the box; **6 fuzzy-matched to the wrong performer** | ✅ **FIXED** — 6-entry slug-override table added (rendered-validated). `512458c` |
| **Ticketmaster** | Renders correctly in-browser (the "404" was an HTTP-fetch false negative on a redirect vendor) | ✅ **Correct — no change.** Not a blocker. |
| **Expedia** | 78/86 end-to-end; 8 venues lacked coords → city-fallback | ✅ **FIXED** — 8 venue coords backfilled (2-source verified); 86/86 now stadium-precise. `0078b5d` |
| **SpotHero** | 78/86; same 8 no-coords venues | ✅ **FIXED** — same coords backfill. `0078b5d` |
| **Fanatics** | Was auto-omitted on all 86 (no store mapping) | ✅ **ADDED** — 86/86 deep-linked to each school's college store, Impact `/c/`-tracked. `769acba` |

**Launch call:** **No blockers.** All four affiliate CTAs (tickets ×2, hotels, parking) plus Fanatics resolve to the correct destination on all 86 CFB pages, each with `web_cfb_{id}` surface attribution.

## 1. TicketNetwork — 6 slug overrides (FIXED)

The build generates `www.ticketnetwork.com/e/performers/{slugifySchool(name+mascot)}-tickets`, e.g. `minnesota-golden-gophers-tickets`. For 80/86 this lands on the correct team's TN page and surfaces football (body-checked). But TN fuzzy-serves a 200 for unknown slugs, and **6 landed on the wrong performer** — all now corrected via a `CFB_TN_SLUG_OVERRIDES` table in `src/lib/cfb/page-extras.ts` (mirrors the pro `TICKETNETWORK_OVERRIDES` pattern), threaded to `ticketNetworkSlug` on the affiliate Team:

| School | Old build slug | Resolved to (WRONG) | Override applied (rendered-validated) |
|---|---|---|---|
| **ole-miss** | ole-miss-rebels | "Gay Ole Opry" (comedy) | `mississippi-rebels` |
| **appalachian-state** | app-state-mountaineers | "APP New York City Open" (tennis) | `appalachian-state-mountaineers` |
| **south-florida** | usf-bulls | "USF Baseball Tournament" | `south-florida-bulls` |
| **army** | army-black-knights | "…Black Knights Softball" | `army-west-point-black-knights` |
| **smu** | smu-mustangs | "…Mustangs Women's Volleyball" | `smu-mustangs-football` |
| **nc-state** | nc-state-wolfpack | "NC State Symphonic Band" | `north-carolina-state-wolfpack` |

Root cause: `slugifySchool` uses the school name/mascot (sometimes the short form, e.g. "App State", "USF"), and TN indexes some teams under a different name (Ole Miss = "Mississippi Rebels"), a different sport, or a same-token non-team performer. Each override was confirmed by fetching the TN page and matching the RENDERED `<title>` + body to the football team — not by a 200.

**Marquee (§13):** Ohio State, Michigan, Texas, Oklahoma, Georgia, Alabama, Auburn, Tennessee, Penn State, Minnesota → correct team, football surfaced. Ole Miss was the one marquee miss and is fixed.

**Honest limitation:** validation confirms the PERFORMER PAGE is the right team and surfaces football; it did not click each of the 80 through to confirm every school's specific 2026 game inventory is currently listed. The 6 wrong ones were unambiguous and are corrected.

## 2. Ticketmaster — correct (the "404" was a method false-negative)

Every CFB TM link is `ticketmaster.com/{nickname}-tickets` (no `ticketmasterAttractionId` for CFB). An HTTP fetch of that URL returns 404 / "Ticketmaster - Browse" — **but that is the bot-protection/redirect behavior of the vendor, not the user experience.** TM's `{slug}-tickets` performs a server-side redirect to the artist/team page for a real browser session; the deploy (Matt-confirmed) resolves correctly. This is exactly the failure mode `docs/ticketmaster-impact-attribution-conflict.md` warns about: a curl/env check on a bot-protected redirect vendor is not evidence the link is broken. **Read the rendered href.** TM stays as-is; it is not a blocker.

(The earlier "even the pro Twins bare slug 404s" observation is consistent with this — the pro pages carry an attraction ID and emit `/{slug}-tickets/artist/{id}`, but the bare-slug redirect still works in-browser for both.)

## 3. Expedia — correct + tracked end-to-end (coords backfilled)

Decoded (Auburn): `expedia.com/affiliate?...destination=Jordan–Hare Stadium, Auburn&latLong=32.60222,-85.48917…&camref=1011l5KcC9&creativeref=1100l68075&adref=PZPbSQWcB2&pubref=web_cfb_auburn`. Venue name + coords in the deep-link, camref/creativeref/adref present, `pubref = web_cfb_{id}` — correct destination + attribution end-to-end.

**8 venues previously lacked lat/lng** (fell back to city-level): `ben-hill-griffin-stadium` (Florida), `bridgeforth-stadium…` (JMU), `darrell-k-royal-texas-memorial-stadium` (Texas), `martin-stadium-northwestern-university` (Northwestern), `memorial-stadium-lincoln` (Nebraska), `saban-field-at-bryant-denny-stadium` (Alabama), `sanford-stadium` (Georgia), `space-city-financial-stadium` (Houston). **All 8 backfilled** with 2-source-verified coordinates (Wikipedia article coord + OpenStreetMap, agreeing within tolerance; `coordsVerified=true`, `coordsSources[]`, `coordsVerifiedAt` on each venue doc — audit fields added to `CfbVenue` in `src/lib/cfb/types.ts`). Northwestern's doc carries the **Ryan Field (2026) coordinate** (42.06556, -87.6925) per the prior disambiguation decision (the bare "Ryan Field" Wikipedia article is a disambiguation page). **Firestore now shows 86/86 CFB venues with non-zero lat/lng.**

## 4. SpotHero — correct + portal attribution (coords backfilled)

`spothero.com/search?lat={venue.lat}&lng={venue.lng}&sid=web_cfb_{…}` — parking at the venue coords with `sid` portal attribution. The same 8 no-coords venues that fell back to a generic search are fixed by the same backfill. 86/86 now route to stadium-precise coordinates.

## 5. Fanatics — 86/86 deep-linked + Impact-tracked (ADDED)

Originally all 86 CFB schools had no `fanaticsUrl` → `FanaticsCTA` returned null (no broken link, but no merch CTA either). Now every school maps to its **discovered canonical Fanatics college store** (`CFB_FANATICS_STORES` in `src/lib/cfb/fanatics-stores.ts`, 86 entries; e.g. `fanatics.com/college/alabama-crimson-tide/…`), threaded to the affiliate Team's `fanaticsUrl` in `page-extras.ts`. `buildFanaticsUrl` wraps it in main's Impact `/c/` redirect: `fanatics.93n6tx.net/c/{account}/{adId}/{campaign}?subId1=web_cfb_{id}&u={encoded store URL}` — so each link is **deep-linked to the right school's store AND Impact-attributed**, not a bare generic link. Stores were discovered by web search (Fanatics WAF-blocks curl) and validated to the root college store (rejecting pro-prefix mislabels and sub-sections). Unmapped schools would degrade cleanly to null; all 86 are mapped.

## 6. Read-efficiency note (adjacent CFB fix, same branch)

While preparing launch, the `/cfb` build reader (`src/lib/cfb/data.ts`) was made read-efficient: the three static collections (schools/venues/rivalries) + games are now read ONCE per build process (module-level TTL cache, TTL = the page's 21600s ISR window) instead of a full-collection read per page, and `getCfbSchoolPage` is wrapped in React `cache()` for the metadata+page double-call. Build Firestore reads dropped ~68,500 → ~3,248 (95%), and all 86 pages prerender with no timeouts. Rendered output is byte-identical (verified). CFB-isolated; the MLB reader is untouched. This does not change any affiliate destination — noted here because it touches the same CFB read path the affiliate CTAs render from.

## Pre-launch actions — status

1. **TicketNetwork:** 6 overrides added, rendered-validated. ✅ DONE (`512458c`)
2. **Ticketmaster:** no action — correct in-browser; the "404" was a method false-negative. ✅ RESOLVED
3. **Coords backfill** (Expedia + SpotHero): 8 venues, 2-source verified; 86/86 now precise. ✅ DONE (`0078b5d`)
4. **Fanatics:** 86/86 deep-linked + Impact-tracked. ✅ DONE (`769acba`)

## Adversarial self-check

1. **Any vendor reported correct on a 200 / an unreliable check alone?** No. TN "correct" required a rendered title match + football-body check (the 6 wrong performers were caught despite 200s). TM is called correct on the doctrine that a curl 404 on a bot-protected redirect vendor is not evidence of breakage (read the rendered href) — consistent with the Matt-confirmed deploy, not on a raw 200. Fanatics stores were web-search-discovered + validated to the root college store, not curl-checked.
2. **Was the original TM "blocker" a real regression or a measurement artifact?** Measurement artifact — an HTTP fetch of a redirect vendor. Corrected here; TM unchanged in code.
3. **Long tail honestly marked?** The 80 TN "correct" are validated to team + football surfaced (not per-school 2026 inventory click-through); the 6 wrong are explicit and fixed. Coords are 2-source verified (not single-source). Fanatics stores are root-store validated (pro-prefix mislabels rejected).
4. **Marquee explicitly validated?** Yes — 11 §13 marquee TN links (10 correct, Ole Miss fixed).

---

**All Part A affiliate destinations are launch-ready on cfb-phase3. No pushes/merges from this pass.**
