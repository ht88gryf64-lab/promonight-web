'use client';

import Link from 'next/link';
import { track, normalizeSport } from '@/lib/analytics';

// Return-direction internal link: from a venue hub BACK into a tenant team's
// page. The mirror of VenueHubLink (team -> hub). It closes the internal-link
// loop the hub otherwise leaves open (the hub links out to affiliates but never
// back to the teams that play there). Rendered as a real <Link> (SSR'd to a
// crawlable <a href>) so it carries link equity and AI crawlers see it; the
// 'use client' wrapper only adds the tracking handler, it does not gate the
// anchor. Fires a first-party `hub_to_team` event (dual-emit PostHog + GA4 via
// track()) carrying the building AND the destination team, so the return
// direction is measured the same way venue_hub_click measures the forward one.
//
// Framing is the PromoNight-native hook: a fan on a venue page wants that team's
// promo schedule and giveaways, so the label sells that, not a bare team name.
// CFB pages are gameday/schedule (no promo schedule), so they get gameday copy.

type Props = {
  teamId: string;
  league: string;
  href: string;
  name: string;
  isCfb: boolean;
  buildingSlug: string;
  buildingName: string;
};

function TicketIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M13 5v14" strokeDasharray="2 2" />
    </svg>
  );
}

export function HubTeamLink({ teamId, league, href, name, isCfb, buildingSlug, buildingName }: Props) {
  // Fire on mousedown (not click) so the event lands even when the navigation
  // tears down the page first — mirrors VenueHubLink / the affiliate convention.
  const fire = () => {
    track('hub_to_team', {
      surface: 'web_venue',
      team_slug: teamId,
      sport: normalizeSport(league),
      placement: 'venue_hub_teams_block',
      building_slug: buildingSlug,
      building_name: buildingName,
      destination_url: href,
    });
  };

  const headline = isCfb ? `${name} gameday guide` : `${name} promos & giveaways`;
  const sub = isCfb ? 'Schedule, rivalries and tickets' : 'Bobbleheads, theme nights and this season schedule';

  return (
    <Link
      href={href}
      onMouseDown={fire}
      className="group flex items-center gap-2.5 w-full rounded-[14px] bg-rd-card border border-rd-line px-4 py-3 shadow-[0_1px_3px_rgba(33,29,24,0.06)] transition-all hover:-translate-y-0.5 hover:border-rd-red/40 hover:shadow-[0_4px_14px_rgba(33,29,24,0.10)]"
    >
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-rd-red text-white shrink-0">
        <TicketIcon />
      </span>

      <span className="flex flex-col items-start leading-tight">
        <span className="font-rd font-bold text-[13px] text-rd-ink">{headline}</span>
        <span className="font-rd text-[12px] text-rd-ink-soft">{sub}</span>
      </span>

      <span
        aria-hidden="true"
        className="ml-auto text-rd-ink-faint text-[17px] leading-none transition-transform group-hover:translate-x-0.5"
      >
        &rsaquo;
      </span>
    </Link>
  );
}
