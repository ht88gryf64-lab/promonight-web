'use client';

import type { MouseEvent } from 'react';
import type { Promo, Team } from '@/lib/types';
import { RedesignPromoRow, type PromoRowShare } from '@/components/redesign/RedesignPromoRow';
import { promoAnchorId, synthPromoId, teamDisplayName } from '@/lib/promo-helpers';
import { track, normalizeSport } from '@/lib/analytics';

// One card in the venue hub "Promos this week" scroller. The card itself IS the
// team-page promo row (RedesignPromoRow in its `href` deep-link mode) — the same
// component /promos/today and the league hubs render — so the visual is
// guaranteed identical to the rest of the site and stays in sync for free. This
// file adds exactly two things around it: the tap event, and the multi-tenant
// team marker.
//
// The deep link targets the promo's own anchor on the team page,
// /{sport}/{team}#promo-{promoAnchorId}. That anchor already exists on the first
// 10 upcoming rows (promo-list.tsx) and PromoArrivalHighlight already handles the
// scroll, the flash, and the no-match-lands-at-top fallback, so nothing on the
// team page changes for this feature.
export function VenueHubPromoCard({
  promo,
  team,
  daysOut,
  buildingSlug,
  buildingName,
  showTeamMarker,
}: {
  promo: Promo;
  team: Team;
  daysOut: number;
  buildingSlug: string;
  buildingName: string;
  /** True only on multi-tenant buildings, where a fan swiping the one shared
   *  scroller needs to know whose game each promo is at. Single-tenant buildings
   *  pass false and the card renders exactly as it does site-wide. */
  showTeamMarker: boolean;
}) {
  const href = `/${team.sportSlug}/${team.id}#promo-${promoAnchorId(promo)}`;

  const share: PromoRowShare = {
    teamName: teamDisplayName(team),
    teamSlug: team.id,
    sport: team.sportSlug,
    primaryColor: team.primaryColor,
    // The building we are already on. The share payload wants the venue the
    // promo happens at, and on this surface that is known without a venue read.
    venueName: buildingName,
  };

  // Fired from the wrapper rather than from inside RedesignPromoRow, so the
  // shared row component is not touched for a hub-only concern.
  //
  // The row's stretched deep link is an <a> covering the whole card, so any body
  // tap lands inside it. The ShareButton is a <button> painted ABOVE that overlay
  // and has no <a> ancestor, so the closest('a') test is what keeps a share tap
  // from being miscounted as a promo click. Click (not mousedown) because this is
  // a client-side route change, which does not tear the page down, and because
  // click also covers keyboard activation of the focused link.
  const fire = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Element) || !e.target.closest('a')) return;
    track('venue_hub_promo_click', {
      surface: 'web_venue',
      team_slug: team.id,
      sport: normalizeSport(team.league),
      placement: 'venue_hub_promos_this_week',
      building_slug: buildingSlug,
      building_name: buildingName,
      promo_id: synthPromoId(team.id, promo),
      promo_type: promo.type,
      is_highlight: promo.highlight,
      days_out: daysOut,
      destination_url: href,
    });
  };

  return (
    <div onClick={fire}>
      {showTeamMarker ? (
        <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
          {/* Hairline ring so a near-white team color still reads on cream. */}
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full border border-black/15"
            style={{ backgroundColor: team.primaryColor }}
          />
          <span className="truncate font-rd text-[11px] font-bold uppercase tracking-[0.08em] text-rd-ink-soft">
            {team.name}
          </span>
        </div>
      ) : null}
      <RedesignPromoRow promo={promo} share={share} href={href} />
    </div>
  );
}
