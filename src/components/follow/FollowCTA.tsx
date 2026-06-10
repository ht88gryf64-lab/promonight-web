import type { Team } from '@/lib/types';
import type { CaptureSurface } from '@/lib/follow-surface';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';

// Entry CTA for the email capture funnel. Links to /follow carrying the entry
// surface (and a pre-star team slug when on a team page) and dual-emits
// email_cta_click via TrackedTapLink. Server component; the only interactive
// bit is the TrackedTapLink client leaf. The path-inferred site-wide variant
// (footer) lives in FollowFooterCTA below.

export function followHref(surface: CaptureSurface, teamSlug?: string): string {
  const params = new URLSearchParams({ source: surface });
  if (teamSlug) params.set('team', teamSlug);
  return `/follow?${params.toString()}`;
}

interface FollowCTAProps {
  surface: CaptureSurface;
  // When present, the CTA pre-stars this team and personalizes the copy.
  team?: Team;
  heading?: string;
  sub?: string;
  className?: string;
}

export function FollowCTA({ surface, team, heading, sub, className = '' }: FollowCTAProps) {
  const teamSlug = team?.id;
  const resolvedHeading =
    heading ??
    (team ? `NEVER MISS A ${team.name.toUpperCase()} GIVEAWAY` : 'NEVER MISS A GIVEAWAY');
  const resolvedSub =
    sub ??
    (team
      ? `Get every ${team.city} ${team.name} bobblehead, theme night, and food deal, plus any other teams you follow, in one free email a week.`
      : 'Get every giveaway, theme night, and food deal for the teams you follow in one free email a week.');

  return (
    <div className={`rounded-2xl border border-rd-line bg-rd-card p-8 text-center ${className}`}>
      <h2 className="rd-display text-2xl uppercase text-rd-ink md:text-3xl">{resolvedHeading}</h2>
      <p className="mx-auto mt-3 max-w-md font-rd text-sm text-rd-ink-soft">{resolvedSub}</p>
      <div className="mt-6 flex justify-center">
        <TrackedTapLink
          trackEvent="email_cta_click"
          trackProps={{ surface, team_slug: teamSlug }}
          href={followHref(surface, teamSlug)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rd-red px-6 py-3.5 font-rd text-base font-semibold text-white transition-colors hover:bg-rd-red-dark"
        >
          Get the free weekly email →
        </TrackedTapLink>
      </div>
    </div>
  );
}
