import { AppDownloadButtons } from './app-download-buttons';
import { APP_LEAGUES } from '@/lib/coverage-counts';
import { EmailCtaLink } from '@/components/follow/EmailCtaLink';
import { followHref } from '@/components/follow/FollowCTA';

// The "soft app pitch" extracted verbatim from PromoList so the team page can
// render it in the email+app pairing above the FAQ while every other PromoList
// surface keeps it inline (gated by PromoList's showAppPitch). Reproduces both
// the light and dark stylings byte-for-byte; default `className` ('mt-10') and
// the styling match the original inline blocks exactly so callers that keep
// showAppPitch render identically. The body copy is the original's, with its one
// em dash replaced by a period to satisfy the no-em-dashes rule (the only
// surfaces that render this pitch are team pages).
export function AppPushPitch({
  teamName,
  teamSlug,
  league,
  variant = 'dark',
  className = 'mt-10',
}: {
  teamName: string;
  teamSlug: string;
  /** The team's league. The app covers APP_LEAGUES only. For the others the
   *  slot carries the weekly email instead: a reminder offer for a league the
   *  app does not carry was a promise the download could not keep, and the
   *  email (Tuesdays, every league) is the thing those fans can actually use. */
  league: string;
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const light = variant === 'light';
  if (!(APP_LEAGUES as readonly string[]).includes(league)) {
    // Same card, same slot, same styling; the offer is the weekly digest, which
    // is what /api/cron/weekly-digest sends every Tuesday to subscribers who
    // starred this team. It is weekly, not a promo-day reminder (that is the
    // Pro app feature), and the copy says so. Reuses the funnel's own entry
    // link so the click records as email_cta_click on web_team_page, the same
    // event and surface as every other team-page email CTA.
    return (
      <div
        className={`${className} ${
          light ? 'bg-rd-card border border-rd-line' : 'bg-bg-card/50 border border-border-subtle'
        } rounded-2xl p-6 text-center`}
      >
        <p className={`${light ? 'text-rd-ink-soft' : 'text-text-secondary'} text-sm mb-1`}>
          Want a heads-up on {teamName} promo nights?
        </p>
        <p className={`${light ? 'text-rd-ink-faint' : 'text-text-muted'} text-xs mb-5`}>
          One free email every Tuesday with the {teamName} giveaways, theme nights, and food deals coming up, and the week&apos;s biggest promos across the leagues when your teams are quiet. No app or account needed.
        </p>
        <EmailCtaLink
          surface="web_team_page"
          teamSlug={teamSlug}
          href={followHref('web_team_page', teamSlug)}
          className={
            light
              ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-rd-red px-6 py-3 font-rd text-sm font-semibold text-white transition-colors hover:bg-rd-red-dark'
              : 'inline-flex items-center justify-center gap-2 rounded-xl bg-accent-red px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90'
          }
        >
          Get the weekly email →
        </EmailCtaLink>
      </div>
    );
  }
  return (
    <div
      className={`${className} ${
        light ? 'bg-rd-card border border-rd-line' : 'bg-bg-card/50 border border-border-subtle'
      } rounded-2xl p-6 text-center`}
    >
      <p className={`${light ? 'text-rd-ink-soft' : 'text-text-secondary'} text-sm mb-1`}>
        Want a reminder the morning of every {teamName} promo?
      </p>
      <p className={`${light ? 'text-rd-ink-faint' : 'text-text-muted'} text-xs mb-5`}>
        The PromoNight app is a free download, and PromoNight Pro adds a reminder on each promo morning. Optional, not required to use this site.
      </p>
      <AppDownloadButtons
        section="promo_list_app_pitch"
        page={`team/${teamSlug}`}
        teamSlug={teamSlug}
        variant="compact"
      />
    </div>
  );
}
