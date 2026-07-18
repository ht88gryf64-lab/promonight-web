import Link from 'next/link';
import type { PromoWithTeam, Venue } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { promoAnchorId, synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { promoDetailLine, formatClock } from './helpers';

// One /promos/today promo card (Mockup A). A clickable unit: the whole card
// navigates to the team page deep-linked to this exact promo
// (/[sport]/[team]#promo-{id}) via a stretched-link pseudo-element, while the
// inline TicketNetwork / Ticketmaster / SpotHero CTA row sits above it (relative
// z-10) so each CTA fires its affiliate out (new tab) WITHOUT triggering the card
// navigation. No nested anchors, no JS propagation handling — the stretched
// ::after and the z-layered CTA row do it structurally.
//
// Server component: the stretched link is a plain <Link>, and the CTAs are their
// own client leaves (TrackedAffiliateLink), so the card prerenders and stays
// crawlable. All CTAs carry surface=web_today.
//
// The CTA row is an `@container/cta` so the inline CTA tiles reveal their
// descriptor / arrow only when the card is wide enough, and compress to
// brand-marks (never wrapping) down to 360px.
export function TodayPromoCard({
  promo,
  venue,
  accent,
  surface,
  dimmed = false,
}: {
  promo: PromoWithTeam;
  venue: Venue | null;
  accent: string;
  surface: AnalyticsSurface;
  dimmed?: boolean;
}) {
  const p = promo;
  const anchorHref = `/${p.team.sportSlug}/${p.team.id}#promo-${promoAnchorId(p)}`;
  const promoKey = synthPromoId(p.team.id, p);
  const detail = promoDetailLine(p);
  const clock = formatClock(p.time);
  const eyebrow = venue?.name
    ? `${teamDisplayName(p.team)} · ${venue.name}`
    : teamDisplayName(p.team);

  return (
    <article
      className={`relative flex min-w-0 items-stretch gap-3 rounded-2xl border border-rd-line bg-rd-card p-3.5 transition-shadow hover:shadow-[0_4px_16px_rgba(33,29,24,0.08)] sm:p-4 ${
        dimmed ? 'opacity-70' : ''
      }`}
    >
      {/* League color bar */}
      <span
        aria-hidden
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: accent }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-rd text-[11px] font-semibold uppercase tracking-[0.09em] text-rd-ink-faint">
              {eyebrow}
            </div>
            <h3 className="mt-0.5 font-rd text-[16px] font-bold leading-snug text-rd-ink">
              {/* Stretched link — covers the whole card via ::after so the card
                  body navigates to the promo anchor. */}
              <Link
                href={anchorHref}
                className="rounded-sm transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-rd-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red"
              >
                {p.title}
              </Link>
            </h3>
            {detail && (
              <div className="mt-0.5 font-rd text-[12px] text-rd-ink-soft">{detail}</div>
            )}
          </div>

          {clock && (
            <div className="shrink-0 pt-0.5 text-right">
              <div className="rd-numerals text-[15px] leading-none text-rd-ink">{clock}</div>
            </div>
          )}
        </div>

        {/* CTA row — sits above the stretched ::after (relative z-10). Each CTA
            is an independent affiliate-out link; the card body navigation never
            fires from a CTA tap. */}
        <div data-cta-row className="@container/cta relative z-10 mt-3 flex items-stretch gap-1.5">
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
    </article>
  );
}
