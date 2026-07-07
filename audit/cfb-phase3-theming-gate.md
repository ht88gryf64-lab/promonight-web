# CFB Phase 3 — Immersive Theming Gate

**Generated:** 2026-07-07 · **Branch:** `cfb-phase3` (local commit `7cb1f28`, NOT pushed) · **Preview:** deployed (protection ON). **No prod, no merge, no push to main.**

## Verdict

**PASS.** The approved immersive team-color treatment now lives in the **ONE** `CfbSchoolPage` template (no second template, no fork). The **environment** is team-colored — full-bleed hero wash + secondary glow, accent-ruled section headings, saturated signature-card gradient, accent rivalry chips — and it is **contrast-safe across the full 86-school color range** (white/light maize, mid-luminance orange, dark navy/black, bright purple). The **affiliate CTAs are reused site-standard and UNCHANGED** — never team-toned — with correct affiliate resolution (home-venue gameday cluster + destination-keyed road-trip clusters) and surface `web_cfb` for PostHog comparability.

All checks below were verified against the **built, prerendered HTML** (`.next/server/app/cfb/*.html`) — byte-identical to what the preview serves — because Deployment Protection walls anonymous fetches (as required).

## What changed (one template, immersive reskin)

- **`src/lib/cfb/theme.ts`** — `CfbTheme` extended with `wash`/`glow`/`cardFrom`/`cardTo`/`onPrimary`. Wash alpha is **capped by primary luminance** (`>0.6 → 0.16`, `>0.35 → 0.26`, else `0.42`) so white hero text always holds; signature-card gradient end is **luminance-aware** (light primary → darken 0.18 so dark text holds at both stops; dark primary → darken 0.4 for depth, white holds). `cfbThemeVars` emits the new vars on the route root.
- **`src/lib/cfb/page-extras.ts`** (new) — `toAffiliateTeam`/`toAffiliateVenue` adapters (CFB→pro `Team`/`Venue`) + `CFB_KICKERS` chant map + `getKicker`. TM slug fallback uses the **full football slug** (`minnesota-golden-gophers`) so it resolves to the team, not the pro club.
- **`src/lib/cfb/data.ts`** — reader now joins **opponent venues** (`awaySchool`/`awayVenue` on `CfbGameView`) so road-trip clusters can point hotels/parking at the destination stadium. Kickoff logic untouched.
- **`src/lib/analytics.ts`** — `'web_cfb'` added to `AnalyticsSurface`.
- **`src/components/cfb/CfbSchoolPage.tsx`** — immersive reskin of the SAME component. Editorial blocks stay conditional (auto pages degrade clean). Affiliate CTAs added site-standard.

## Per-school visual review (6 gate schools + orange-band closers)

| School | Palette case | primary | accent (on dark) | wash | on-primary | Contrast verdict |
|---|---|---|---|---|---|---|
| **Minnesota** | maroon/gold (reference) | `#5B0013` | `#FFB71E` gold | `rgba(91,0,19,.42)` | `#FFF` | ✅ rich maroon hero, gold accents, white text holds |
| **Penn State** | dark navy | `#001E44` | `#FFF` (navy fails floor→white) | `rgba(0,30,68,.42)` | `#FFF` | ✅ navy immersive hero, accent correctly falls to white |
| **Michigan** | **white/light maize** (load-bearing) | `#FFCB05` | `#FFCB05` maize | `rgba(255,203,5,.16)` **low-α** | `#111` | ✅ faint maize wash → **white hero text holds**; dark text on maize card |
| **Iowa** | **very dark** black | `#000000` | `#FCD116` gold | `rgba(0,0,0,.42)` (imperceptible) | `#FFF` | ✅ dark hero carried by gold glow + accents; on-brand, degrades clean |
| **Northwestern** | **bright/clashing** purple | `#4E2A84` | `#FFF` (purple fails floor→white) | `rgba(78,42,132,.42)` | `#FFF` | ✅ purple immersive hero, white accents — no clash |
| **Toledo** | **sparse G5** navy/gold | `#0B2240` | `#FFCD00` gold | `rgba(11,34,64,.42)` | `#FFF` | ✅ full immersive shell on a sparse schedule — reads intentional |
| Tennessee | orange mid-band (0.26 α) | `#FF8200` | `#FF8200` | `rgba(255,130,0,.26)` | `#111` | ✅ composite stays dark, white hero text holds |
| Syracuse / Miami | orange (0.42 α) | `#FF431B`/`#F05A00` | same | `.42` | `#111` | ✅ same — dark-text signature card safe (cardTo darken 0.18) |

**The two hard directions both pass:** a **light** primary (Michigan maize) gets a low-alpha wash so white text holds; a **dark/clashing** primary (Penn State navy, Northwestern purple) has its accent fall off the dark base to white. Nothing ships an unreadable accent or a washed-out hero.

## Affiliate CTAs — site-standard, unchanged, correctly resolved

Verified in `minnesota.html`:

- **Not team-toned:** 0 affiliate `<a>` carry a `--cfb-*` var. The only team-var link is the (intended) Contribute CTA. TM white-card (`border-[#003C71]`, navy `ticketmaster` wordmark) and accent-red Booking/SpotHero buttons render their **site-standard** classes verbatim.
- **Tickets (TM slug fallback):** gameday/signature → `/minnesota-golden-gophers-tickets` (full football slug, **not the Twins**). Road-trip tickets key to the **host** school (`/indiana-hoosiers-tickets`, `/wisconsin-badgers-tickets`, …) — you buy from the home team.
- **Hotels/Parking (coords):** gameday cluster uses the **home** venue (`44.976,-93.225` = Huntington Bank Stadium). Road-trip clusters use each **away** venue's coords (Bloomington, Madison, Seattle, …). **Zero `0/0` fallbacks.**
- **Surface:** `web_cfb` wired through every affiliate URL (`label=web_cfb_none`, `sid=web_cfb_none`).
- **Placements:** `team_page_inline` (gameday tickets), `team_page_hero` (signature inline), `away_game_card` (road-trip tickets), `cfb_gameday_cluster` / `cfb_road_trip` (hotels/parking).

## ONE-template + crown-none + verify-gate discipline

- **ONE template:** single `CfbSchoolPage` component; editorial blocks (`whyYouGo`, `signatureGameId`, `venueInTheirWords`, `gamedayCulture`) render only when present. All 86 Phase-3 pages are `auto`, so **"The one to plan around" = 0 occurrences across all 86** — signature card correctly **crowns none**.
- **Immersive coverage:** **86/86** pages carry the immersive hero (`radial-gradient` present in every file).
- **Kickoff fix intact (no regression):** **0** genuinely impossible 1–6 AM renders across all 86 (the initial 42 "hits" were a bad regex chopping real `11:xx AM`/`12:xx PM` kickoffs). Verified PM times render correctly (`2:30 PM`, `3:30 PM`, `7:00 PM`) — no PM→AM flip.
- **Sparse degradation:** Toledo (few announced kickoffs, fewer road trips) still renders hero + stat strip + gameday cluster + schedule + at least one road trip — intentional, not empty.

## Preview

`https://promonight-glkis1s54-btj8tk69dk-7318s-projects.vercel.app/cfb/<school>` — **Deployment Protection ON** (anonymous GET → 302 → vercel.com SSO). Review authenticated in-browser. Suggested walk: `/cfb/minnesota`, `/cfb/michigan`, `/cfb/northwestern`, `/cfb/penn-state`, `/cfb/iowa`, `/cfb/toledo`.

## Adversarial self-check

1. **ONE template, or did immersion fork a second one?** ONE. `CfbSchoolPage` is a single component; every immersive element is unconditional environment (hero/stat strip/section rules) or a **conditional editorial block** that hides on auto. Graduating auto→destination stays a data flip.
2. **Contrast actually safe on the WORST cases, or just the easy ones?** Worst cases specifically tested: white/light maize (Michigan) → low-α wash, white text holds; bright purple (Northwestern) + navy (Penn State) → accent falls to white; black (Iowa) → gold-carried; orange mid-band (Tennessee/Syracuse/Miami) → composite stays dark. Math is deterministic in `theme.ts`, not eyeballed.
3. **Are the CTAs genuinely UNCHANGED, or subtly team-toned?** Unchanged — 0 affiliate `<a>` carry `--cfb-*`; the reused components render their own site-standard classes. They sit on neutral dark insets, never a team-colored fill. PostHog comparability preserved (surface `web_cfb`).
4. **Do the affiliate links resolve to the RIGHT place?** Yes — TM uses the football slug (not the pro club), gameday hotels/parking use the home stadium coords, road-trip clusters key to the destination (host tickets + away-stadium coords), no `0/0` fallbacks.
5. **Did the reskin regress the kickoff fix or the crown-none rule?** No — 0 impossible AM renders, verified PM times intact, 0 signature crowns on the 86 auto pages. Kickoff logic in `data.ts` was untouched.

---

**STOP — gate only. Preview deployed, no prod, no merge, no push to main.**
