import { IconArrowRight } from '@tabler/icons-react';
import type { Team } from '@/lib/types';
import type { CaptureSurface } from '@/lib/follow-surface';
import { EmailCtaLink } from '@/components/follow/EmailCtaLink';

// Entry CTA for the email capture funnel. Links to /follow carrying the entry
// surface (and a pre-star team slug when on a team page) and dual-emits
// email_cta_click via EmailCtaLink. Server component; the only interactive
// bit is the EmailCtaLink client leaf, which is also what resolves the A/B arm
// at click time (a server component cannot read localStorage). The
// path-inferred site-wide variant (footer) lives in FollowFooterCTA below.

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
  // Presentation only. 'stack' (default) is the centered card every current
  // caller renders, byte-identical. 'split' is the redesigned homepage strip:
  // same heading, same copy, same destination, same EmailCtaLink and the same
  // single email_cta_click event, laid out horizontally with a red edge rail.
  // No form, no input, no new client code: the design target carries no input
  // element anywhere on the page, so the newsletter section is a link out in
  // the target exactly as it already is here.
  layout?: 'stack' | 'split';
}

export function FollowCTA({
  surface,
  team,
  heading,
  sub,
  className = '',
  layout = 'stack',
}: FollowCTAProps) {
  const teamSlug = team?.id;
  const resolvedHeading =
    heading ??
    (team ? `NEVER MISS A ${team.name.toUpperCase()} GIVEAWAY` : 'NEVER MISS A GIVEAWAY');
  const resolvedSub =
    sub ??
    (team
      ? `Get the ${team.city} ${team.name} bobbleheads, theme nights and food deals, plus any other teams you follow, in one free email a week.`
      : 'Get the giveaways, theme nights and food deals for the teams you follow in one free email a week.');

  if (layout === 'split') {
    return (
      <div
        className={`relative overflow-hidden rounded-[22px] border border-rd-line bg-rd-card px-8 py-9 shadow-[0_1px_2px_rgba(26,16,14,0.05)] md:px-11 ${className}`}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[5px]"
          style={{
            backgroundImage:
              'linear-gradient(180deg, var(--color-rd-red), var(--color-rd-red-dark))',
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
          <div>
            <h2 className="rd-display text-2xl uppercase text-rd-ink md:text-3xl">
              {resolvedHeading}
            </h2>
            <p className="mt-2 max-w-[460px] font-rd text-sm text-rd-ink-soft">{resolvedSub}</p>
          </div>
          <EmailCtaLink
            surface={surface}
            teamSlug={teamSlug}
            href={followHref(surface, teamSlug)}
            className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-rd-ink px-7 py-4 font-rd text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Get the free weekly email
            <IconArrowRight size={16} stroke={2.5} />
          </EmailCtaLink>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-rd-line bg-rd-card p-8 text-center ${className}`}>
      <h2 className="rd-display text-2xl uppercase text-rd-ink md:text-3xl">{resolvedHeading}</h2>
      <p className="mx-auto mt-3 max-w-md font-rd text-sm text-rd-ink-soft">{resolvedSub}</p>
      <div className="mt-6 flex justify-center">
        <EmailCtaLink
          surface={surface}
          teamSlug={teamSlug}
          href={followHref(surface, teamSlug)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rd-red px-6 py-3.5 font-rd text-base font-semibold text-white transition-colors hover:bg-rd-red-dark"
        >
          Get the free weekly email →
        </EmailCtaLink>
      </div>
    </div>
  );
}
