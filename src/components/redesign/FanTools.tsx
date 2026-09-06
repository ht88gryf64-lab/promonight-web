import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { getPartnerApp, type PartnerAppPlatform } from '@/config/partner-apps';
import type { Team } from '@/lib/types';

// FanTools — the fan-made companion app module in the team-page sidebar.
//
// Renders for a team only when config/partner-apps has an entry for it, which
// today is one team of 169. The gate is INSIDE this component and returns
// null, the same shape as AffiliateRail's FanaticsCTA.
//
// MEASURED, and NOT what the first version of this comment claimed. Returning
// null does not keep the 168 no-entry pages byte-identical. Two full builds
// diffed on 2026-09-06 (main vs this branch, build id and every
// /_next/static/ asset path normalised) show the aside's children array go
// from
//   "children":["$L2c",["$","div",...ExploreCard...]]
// to
//   "children":["$L2c",null,["$","div",...ExploreCard...]]
// identically on /nba/boston-celtics, /mlb/minnesota-twins and
// /nhl/dallas-stars: exactly +5 bytes, and ExploreCard's positional index
// moves from 1 to 2. A `{entry && <FanTools/>}` at the mount site would have
// serialised `false` into the very same slot. NEITHER FORM AVOIDS THE SHIFT.
// Only not mounting the component at all would, and that puts the gate back
// on every caller. The inside gate is still the right shape, but it buys one
// byte, not byte-identity. Recorded with the numbers in docs/known-issues.md
// entry 44.
//
// SCOPE. The offers described here are conditional, not scheduled, so they are
// not promos: no Firestore write, no promos-collection row, and no JSON-LD.
// The team page's structured data is entirely prop-driven from json-ld.tsx and
// emits exactly WebPage + FAQPage; this component adds no script tag of its
// own, and specifically no SoftwareApplication/MobileApplication (removed
// sitewide after a Google rich-results error — see AppDownloadBlock).
//
// The outbound link is UNPAID. It carries no affiliate id, fires
// partner_app_click rather than affiliate_click, and must never be counted as
// revenue. It is also why this file is NOT in components/affiliates: that
// directory is scanned by scripts/verify-affiliate-tracking.ts, which would
// classify every route importing it as an affiliate emitter and fail the build
// for want of a disclosure it does not need.

/** How the platform is named in prose, and what its store button says. */
const PLATFORM: Record<PartnerAppPlatform, { label: string; store: string }> = {
  ios: { label: 'iOS', store: 'App Store' },
};

export interface FanToolsProps {
  team: Team;
  className?: string;
}

export function FanTools({ team, className = '' }: FanToolsProps) {
  // Keyed on Team.id — there is no `slug` field on Team, `id` IS the
  // /[sport]/[team] segment. A key matching no team is silent, not an error.
  const app = getPartnerApp(team.id);
  if (!app) return null;

  const platform = PLATFORM[app.platform];

  return (
    <section className={`bg-rd-card rounded-2xl border border-rd-line p-5 ${className}`}>
      <h2 className="rd-display text-xl text-rd-ink">{app.heading}</h2>

      {app.intro.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-3 font-rd text-sm leading-relaxed text-rd-ink-soft"
        >
          {paragraph}
        </p>
      ))}

      <div className="mt-4 rounded-xl border border-rd-line bg-rd-cream p-4">
        <p className="font-rd font-semibold text-rd-ink">{app.name}</p>
        <p className="mt-0.5 font-rd text-xs text-rd-ink-faint">
          {platform.label}, by {app.developer}
        </p>
        <p className="mt-2 font-rd text-sm leading-relaxed text-rd-ink-soft">
          {app.blurb}
        </p>

        {/* nofollow rather than sponsored because nothing is paid for
            here, and the link is an editorial pointer we do not want to pass
            ranking signal. noopener noreferrer is the house pair every other
            outbound link in src/ carries; this placement takes no exception
            to it. */}
        <TrackedTapLink
          href={app.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          trackEvent="partner_app_click"
          trackProps={{
            surface: 'web_team_page_partner',
            team_slug: team.id,
            partner: app.partner,
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rd-ink px-4 py-2.5 font-rd text-sm font-semibold text-rd-cream transition-colors hover:bg-rd-ink-soft"
        >
          {/* Same filled Apple glyph the PromoNight iOS button uses, so the
              two store buttons on this page do not read as different brands.
              See components/app-download-buttons.tsx. */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          {platform.store}
        </TrackedTapLink>
      </div>

      <p className="mt-3 font-rd text-xs leading-relaxed text-rd-ink-faint">
        {app.disclosure}
      </p>
    </section>
  );
}
