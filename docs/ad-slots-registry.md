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
