import type { VenueHubNextGiveaway } from '@/lib/venue-hub';
import { formatMonDay } from '@/lib/promo-page-copy';
import { synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { PromoPageLink } from '@/components/promo-page-link';

// "Next giveaways here" on a venue hub (Phase 3c): the next three upcoming
// giveaways at the building across every tenant, each the promo name (the
// link, to the promo's own page), the club and the date. Server component;
// the only client leaf is the link (its click event). Renders nothing with
// zero items: an off-season building shows no block, the same discipline as
// HubPromosThisWeek. Every item here already has a page (the loader keeps
// only rows the one helper links), so the block never falls back to a team
// anchor.
export function HubNextGiveaways({ items, buildingName }: { items: VenueHubNextGiveaway[]; buildingName: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="next-giveaways-here" className="mx-auto max-w-[1160px] px-3 pt-4 md:px-8 md:pt-6">
      <div className="rounded-2xl border border-rd-line bg-rd-card px-4 py-3 md:px-5">
        <h2 id="next-giveaways-here" className="m-0 font-rd text-[13px] font-extrabold uppercase tracking-[0.08em] text-rd-ink-faint">
          Next giveaways here
        </h2>
        <p className="sr-only">The next giveaways at {buildingName}, across every club that plays here.</p>
        <ul className="m-0 mt-2 list-none divide-y divide-rd-line p-0">
          {items.map(({ promo, team, href }) => (
            <li key={`${team.id}-${promo.date}-${promo.title}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
              <PromoPageLink
                href={href}
                surface="web_venue"
                teamSlug={team.id}
                promoId={synthPromoId(team.id, promo)}
                className="text-sm font-semibold text-rd-ink transition-colors hover:text-rd-red md:text-base"
              >
                {promo.title}
              </PromoPageLink>
              <span className="font-rd text-xs text-rd-ink-soft">{teamDisplayName(team)}</span>
              <time dateTime={promo.date} className="font-rd text-xs text-rd-ink-faint">
                {formatMonDay(promo.date)}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
