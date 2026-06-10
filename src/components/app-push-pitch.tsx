import { AppDownloadButtons } from './app-download-buttons';

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
  variant = 'dark',
  className = 'mt-10',
}: {
  teamName: string;
  teamSlug: string;
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const light = variant === 'light';
  return (
    <div
      className={`${className} ${
        light ? 'bg-rd-card border border-rd-line' : 'bg-bg-card/50 border border-border-subtle'
      } rounded-2xl p-6 text-center`}
    >
      <p className={`${light ? 'text-rd-ink-soft' : 'text-text-secondary'} text-sm mb-1`}>
        Want push notifications the morning of every {teamName} promo?
      </p>
      <p className={`${light ? 'text-rd-ink-faint' : 'text-text-muted'} text-xs mb-5`}>
        The free PromoNight app sends alerts for giveaways, theme nights, and food deals. Optional, not required to use this site.
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
