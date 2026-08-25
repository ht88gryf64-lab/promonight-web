import { AppDownloadButtons } from './app-download-buttons';
import { APP_LEAGUES } from '@/lib/coverage-counts';

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
  /** The team's league. The app covers APP_LEAGUES only, so the pitch renders
   *  nothing for the others: a reminder offer for a league the app does not
   *  carry is a promise the download cannot keep. */
  league: string;
  variant?: 'dark' | 'light';
  className?: string;
}) {
  if (!(APP_LEAGUES as readonly string[]).includes(league)) return null;
  const light = variant === 'light';
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
