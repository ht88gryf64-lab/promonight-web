'use client';

import Link from 'next/link';
import { track, normalizeSport, type AnalyticsSurface } from '@/lib/analytics';

// Internal routing CTA from a team page into that team's building hub
// (/venues/{slug}). This is the internal link that turns team-page traffic into
// hub traffic — the pages-per-session thesis. It is NOT an affiliate link: it
// fires a first-party `venue_hub_click` event (dual-emitted to PostHog + GA4 via
// track()) carrying the team AND the destination building so we can measure
// team-page-to-hub routing directly. team_slug is the TEAM (known here), unlike
// the hub's own building-keyed affiliate sub-IDs.

type Props = {
  teamId: string;
  league: string;
  buildingSlug: string;
  buildingDisplayName: string;
  // Attribution surface for the fired venue_hub_click. Defaults to the pro
  // team-page value so existing callers (AffiliateRail) are unchanged; CFB pages
  // pass 'web_cfb_venue_link' so team-page-to-hub routing splits by origin.
  surface?: AnalyticsSurface;
};

function GuideIcon() {
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
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function VenueHubLink({ teamId, league, buildingSlug, buildingDisplayName, surface = 'web_team_page' }: Props) {
  const href = `/venues/${buildingSlug}`;

  // Fire on mousedown (not click) so the event lands even when the navigation
  // tears down the page before a click handler would run — mirrors the
  // affiliate-link tracking convention.
  const fire = () => {
    track('venue_hub_click', {
      surface,
      team_slug: teamId,
      sport: normalizeSport(league),
      placement: 'team_page_plan_your_visit',
      building_slug: buildingSlug,
      building_name: buildingDisplayName,
      destination_url: href,
    });
  };

  return (
    <Link
      href={href}
      onMouseDown={fire}
      className="group flex items-center gap-2.5 w-full rounded-[14px] bg-rd-card border border-rd-line px-4 py-3.5 shadow-[0_1px_3px_rgba(33,29,24,0.06)] transition-all hover:-translate-y-0.5 hover:border-rd-red/40 hover:shadow-[0_4px_14px_rgba(33,29,24,0.10)]"
    >
      <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-rd-red text-white shrink-0">
        <GuideIcon />
      </span>

      <span className="flex flex-col items-start leading-tight">
        <span className="font-rd font-bold text-[13px] text-rd-ink">Full gameday guide</span>
        <span className="font-rd text-[12px] text-rd-ink-soft">
          Parking, bag policy and gameday info for {buildingDisplayName}
        </span>
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
