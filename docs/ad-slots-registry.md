# Ad Slots Registry

Single source of truth for ad placements on getpromonight.com. Mirrors the CTA
registry pattern: every slot rendered on a production page corresponds to a row
below. New slot added = new row. Don't edit existing rows; mark deprecated
rows with `status: deprecated` and add a follow-up row.

Slot configs live in `src/lib/ads/slots.ts`. Component lives in
`src/components/ads/AdSlot.tsx`. Network injection lives in
`src/components/ads/AdProvider.tsx`. Set `NEXT_PUBLIC_AD_NETWORK=adsense` and
`NEXT_PUBLIC_ADSENSE_PUB_ID=pub-5027420504477090` to activate AdSense.

| slot_id | page_types | desktop | tablet | mobile | lazy | tier (post-activation) | status |
|---|---|---|---|---|---|---|---|
| header_leaderboard | homepage, team_page, promo_collection, playoffs_hub | 970×250 | 728×90 | 320×100 | no | high | active |
| team_page_after_hero | team_page | 728×90 | — | 300×250 | yes | high | active |
| in_content_1 | team_page, promo_collection, playoffs_hub | 728×90 | — | 300×250 | yes | high | active |
| in_content_2 | playoffs_hub | 300×250 | — | 300×250 | yes | medium | active |
| in_content_3 | playoffs_hub | 728×90 | — | 300×250 | yes | medium | active |
| sidebar_sticky | team_page, playoffs_hub | 300×600 | — | — | yes | medium | active |
| adhesion_footer | homepage, team_page, promo_collection, playoffs_hub | — | — | 320×50 | no | medium | active |
| recirc_native | homepage | 728×250 | — | 300×250 | yes | medium | active |

## Homepage placement order (redesign)

Rows above describe slot CONFIG, not mount position, so the redesign's
placement changes are recorded here rather than as row edits. No row is
edited or deprecated: the three homepage slots keep their ids, sizes, lazy
flags and tiers exactly as listed.

Order on the assembled homepage, top to bottom:

1. hero, ribbon, tonight rail
2. `header_leaderboard` (LEAVES IN PLACE: it already sat at the boundary just
   below the hero, and the tonight rail now fills that gap, so the slot
   follows the rail without moving relative to the page structure)
3. this week, best promos rail, category grid, team finder
4. `recirc_native` (MOVED: previously above the team finder, now below it)
5. gameday grid, app block, newsletter strip, founder block, FAQ
6. `adhesion_footer` (unchanged, last)

Three slots, same as the live homepage today. Note that all three currently
render nothing at all: `AdSlot` collapses when no network is assigned and
`NEXT_PUBLIC_AD_NETWORK` is unset, which is true of the live homepage too.

## Lighthouse / CLS

Premium networks (Mediavine, Raptive) reject sites with CLS > 0.1 in field
data. We don't have a Lighthouse CI configured yet. Once one is added, gate
the build on CLS for these page types:

- `/` (homepage)
- `/[league]/[team]` (sample team page)
- `/playoffs`
- `/promos/this-week` (sample collection page)

Until then, every `AdSlot` reserves height matching its largest configured
dimension at the current breakpoint to suppress layout shift when ad creatives
load in.

## Adding a new slot

1. Add the entry in `src/lib/ads/slots.ts`.
2. Drop the `<AdSlot config={AD_SLOTS.YOUR_KEY} pageType="…" />` into the
   appropriate page template.
3. Add a row to this table with the same shape.

## Adding a new ad network

1. Append the network's line to `public/ads.txt`.
2. Set `NEXT_PUBLIC_AD_NETWORK` to the new network identifier.
3. Add a branch to `AdProvider.tsx` that injects the network's loader script.
   No component or page changes needed — the network's script targets
   `[data-ad-slot]` to inject creatives.

## Team-page order hazard (Raptive remediation)

**This section was authored 2026-09-06. It is not an append to a prior item —
no order-hazard item existed in this repo before it, and neither
`data-ad-region`, `data-ad-item` nor `data-ad-anchor` appears anywhere in the
tree or in git history. The only selector hook that exists today is
`data-ad-slot` (`src/components/ads/AdSlot.tsx:123`, `:168`).**

**The hazard.** On `/[sport]/[team]` the `<aside>` and `<main>` wrappers are
`contents lg:block` (`src/components/redesign/RedesignTeamPage.tsx:279`,
`:307`). Below `lg` both collapse to `display: contents`, so every section
becomes a direct item of the single-column grid and the hand-assigned
`order-[n]` utilities — not DOM order — decide the mobile sequence. A network
script that injects a sibling `<div>` into that grid gets the CSS initial value
`order: 0`, which is lower than every value the page uses. **An injected ad
lands first on mobile, above the hero content and above the tickets CTA**,
wherever in the DOM it was inserted. Injection into `<main>` or `<aside>` at
`lg` is unaffected, because `lg:block` restores a normal block container and
`order` goes inert there.

**Current order inventory, mobile sequence.** Every value in use today, so a
remediation can pick a safe band rather than guess:

| order | element | container |
|---:|---|---|
| 10 / 11 | `SeasonExplorer` (10) or `ScheduleBlock` (11) | main |
| 12 | `DivisionRivals`, zero-promo mount | main |
| 20 | `AffiliateRail` — contains the single tickets CTA | aside |
| **21** | **`FanTools`** — fan-made partner app module | **aside** |
| 30 | `team_page_after_hero` ad slot | main |
| 31 | NFL schedule-release video | main |
| 32 | `PlayoffSection` | main |
| 40 | `PromoList` / `ZeroPromoFallback` | main |
| 41 | `DivisionRivals`, populated mount | main |
| 42 | `FollowCTA` + `AppPushPitch` | main |
| 43 | `AuthorityStats` | main |
| 50 | `RecurringDealsSection` | main |
| 60 | `ExploreCard` | aside |
| 61 | `TeamRelatedAggregators` | main |
| 62 | `sidebar_sticky` ad slot | aside |
| 71 | `TeamContentSections` | main |
| 72 | `TeamFAQ` | main |
| 80 | `in_content_1` ad slot | main |

Free bands: 13-19, 22-29, 33-39, 44-49, 51-59, 63-70, 73-79, 81+.

**What FanTools changes.** `FanTools` was added 2026-09-06 as a new
order-indexed child of the `<aside>`, at `order-[21]`, mounted between
`AffiliateRail` (`order-[20]`) and `ExploreCard` (`order-[60]`) at
`RedesignTeamPage.tsx:302`. It self-gates to `null` on the 168 teams with no
`src/config/partner-apps.ts` entry, so on those pages it occupies a child slot
that renders no element. Two consequences for remediation:

1. **The `display:contents` / order fix must account for `order-[21]`.** It is
   the only value between the affiliate rail and the after-hero ad slot, and it
   is deliberately below the rail so a third-party app link can never precede
   the tickets CTA. Any fix that renumbers, normalises, or drops the order
   weave has to preserve that relation, not just the ad's position.
2. **The `data-ad-region` / `data-ad-item` / `data-ad-anchor` selector hooks
   must account for it.** These are proposed, not built. When they are built,
   `FanTools` is a region child that must be enumerable like any other: a hook
   scheme derived from DOM order alone will mis-place ads on this page, and one
   that enumerates only elements that render will silently disagree between the
   one team page with a partner app and the 168 without.

**Verification note.** Nothing here is enforced by a test. The order values are
hand-assigned literals, and there is no scanner that would catch a new sibling
mounted without one — a section with no `order-*` inherits `order: 0` and jumps
to the top of the mobile column, which is the same failure mode as the injected
ad above.
