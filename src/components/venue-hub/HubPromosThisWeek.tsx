import type { VenueHubWeekPromo } from '@/lib/venue-hub';
import { VenueHubPromoCard } from './VenueHubPromoCard';

// "Promos this week" on a venue logistics hub: the PromoNight-native hook on a
// page that is otherwise bags, parking and gates. Server component; the only
// client leaf is the card (its tap event).
//
// Three rules live here:
//   1. Conditional render. No promos in the 7-day window -> null. No empty
//      state, no "no promos this week" line, same discipline as every other hub
//      card. An off-season building simply does not show the block.
//   2. ONE ROW TALL. A single horizontal scroller regardless of promo count, so
//      the block costs the same vertical space at 1 promo as at 8. Fixed-width
//      cards make the next one peek, which is the overflow affordance; mobile
//      gets native swipe.
//   3. Multi-tenant emphasis, NOT multi-tenant splitting. A shared building
//      (MSG, MetLife) keeps ONE date-sorted scroller with mixed teams and marks
//      the team per card. Splitting into a scroller per team would break rule 2.
export function HubPromosThisWeek({
  items,
  buildingSlug,
  buildingName,
}: {
  items: VenueHubWeekPromo[];
  buildingSlug: string;
  buildingName: string;
}) {
  if (items.length === 0) return null;

  // Emphasis is driven by what is actually IN the list, not by the tenant count:
  // a two-tenant building where only one team has promos this week reads as
  // single-team to the fan, so it gets no marker.
  const showTeamMarker = new Set(items.map((i) => i.team.id)).size > 1;

  return (
    <section aria-labelledby="promos-this-week" className="mb-3">
      <h2
        id="promos-this-week"
        className="m-0 mb-2.5 font-rd text-[13px] font-extrabold uppercase tracking-[0.08em] text-rd-ink-faint"
      >
        Promos this week
      </h2>

      {/* Scroll container. No negative margin / edge bleed on purpose: on lg this
          sits in a grid cell next to the sticky booking rail, and a bleeding
          scroller would run under it. */}
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory items-stretch gap-3">
          {items.map((item) => (
            <div
              key={`${item.team.id}-${item.promo.date}-${item.promo.title}`}
              /* Fixed width = the peek that signals overflow, and every item the
                 same width.
                 UNIFORM HEIGHT BY STRETCH, never a fixed px height: items-stretch
                 on the row above sizes every item to the tallest, and `flex-col`
                 plus `[&>*]:flex-1` pushes that height down into the card itself
                 so the white card fills the item instead of shrink-wrapping its
                 content. Nothing clips, because the tallest card still defines the
                 height; a two-line title or an extra tag just makes every card in
                 the strip taller together.
                 The clamp bounds that tallest card. It targets the row's
                 description <p>, the row's only paragraph, and it is scoped to
                 this wrapper — the team page and league hub uses of the same row
                 component never see it. */
              className="flex w-[82%] max-w-[330px] shrink-0 snap-start flex-col sm:w-[330px] [&>*]:flex-1 [&_p]:line-clamp-2"
            >
              <VenueHubPromoCard
                promo={item.promo}
                team={item.team}
                daysOut={item.daysOut}
                buildingSlug={buildingSlug}
                buildingName={buildingName}
                showTeamMarker={showTeamMarker}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
