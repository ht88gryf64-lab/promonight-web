import type { PromoWithTeam, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { promoAnchorId, synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { RedesignPromoRow, type PromoRowShare } from '@/components/redesign/RedesignPromoRow';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';

// One /promos/today promo unit. Reuses the EXACT team-page promo row
// (RedesignPromoRow) so the visual — date stamp, category icon, Giveaways + HOT
// tags, title, full description, "vs OPPONENT", share icon — is guaranteed
// identical to team pages and stays in sync. The whole row deep-links to the
// team page promo anchor (/[sport]/[team]#promo-{id}) via the row's `href` mode;
// the compact inline TicketNetwork / Ticketmaster / SpotHero CTA row is appended
// BELOW the row (the team-page row does not carry it). The CTA row sits outside
// the row's stretched link, so CTAs fire their affiliate out while a row-body tap
// navigates to the promo. All CTAs carry surface=web_today.
export function TodayPromoCard({
  promo,
  venue,
  surface,
  dimmed = false,
}: {
  promo: PromoWithTeam;
  venue: Venue | null;
  surface: AnalyticsSurface;
  dimmed?: boolean;
}) {
  const p = promo;
  const anchorHref = `/${p.team.sportSlug}/${p.team.id}#promo-${promoAnchorId(p)}`;
  const promoKey = synthPromoId(p.team.id, p);
  const share: PromoRowShare = {
    teamName: teamDisplayName(p.team),
    teamSlug: p.team.id,
    sport: p.team.sportSlug,
    primaryColor: p.team.primaryColor,
    venueName: venue?.name ?? null,
  };

  return (
    <div className={dimmed ? 'opacity-70' : undefined}>
      {/* Full team-page row visual, deep-linked to the team promo anchor. */}
      <RedesignPromoRow promo={p} share={share} href={anchorHref} />

      {/* Compact inline CTA row appended below the row. Independent affiliate
          links (new tab); container-queried so descriptors reveal only when wide
          enough and it never wraps down to 360px. */}
      <div data-cta-row className="@container/cta mt-2 flex items-stretch gap-1.5">
        <TicketmasterCTA
          team={p.team}
          surface={surface}
          placement="today_card"
          promoId={promoKey}
          size="compact"
          layout="inline"
        />
        <SpotHeroCTA
          team={p.team}
          surface={surface}
          placement="today_card"
          venue={venue}
          size="compact"
          layout="inline"
        />
      </div>
    </div>
  );
}
