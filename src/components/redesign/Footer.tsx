import Link from 'next/link';
import { FollowFooterCTA } from '@/components/follow/FollowFooterCTA';
import { CFB_HUB, isCfbHubLive } from '@/lib/league-hubs';
import { getCoverageCounts } from '@/lib/get-coverage-counts';

// Redesign v2 footer. The light team-page redesign uses a cream page with white
// cards, but the footer is the one intentionally-dark surface: warm charcoal
// (bg-rd-ink) with cream/white text for contrast. Because the rd-card/rd-ink
// utilities are tuned for the light surface, this component uses explicit light
// text colors (white/90, white/55, …) and an inline hex red accent on charcoal.

export interface FooterProps {
  year?: number;
}

// Slightly brighter than brand --color-rd-red so it reads on the charcoal bg.
const RED_ON_DARK = '#ff5a4d';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const BROWSE_LINKS: FooterLink[] = [
  { label: 'Promos today', href: '/promos/today' },
  { label: 'Hot this week', href: '/promos/this-week' },
  { label: 'Bobbleheads', href: '/promos/bobbleheads' },
  { label: 'Jersey giveaways', href: '/promos/jersey-giveaways' },
  { label: 'Theme nights', href: '/promos/theme-nights' },
  { label: 'Food deals', href: '/promos/food-deals' },
  { label: 'All teams', href: '/teams' },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: 'About', href: '/about' },
  { label: 'Download', href: '/download' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Contact', href: 'mailto:hello@getpromonight.com', external: true },
];

// Discovery hubs. Gives the previously-orphaned scoring pages, the World Cup
// hub, the /venues directory, and the /follow funnel a clean dofollow incoming
// link on every page. The stadium-guides entry is the sitewide path into the
// venue cluster: every indexable venue page is two clicks from any page via
// footer -> /venues -> venue. The college hub link is gated on the same
// registry flag as the nav, so the footer cannot outlive or precede the hub:
// before it, the only visible college link on the homepage went to the
// rivalries index and the hub itself sat behind a collapsed menu.
const DISCOVER_LINKS: FooterLink[] = [
  { label: 'Best promos', href: '/best-promos' },
  { label: 'Team rankings', href: '/team-rankings' },
  { label: 'Stadium guides', href: '/venues' },
  { label: 'World Cup 2026', href: '/world-cup' },
  ...(isCfbHubLive() && CFB_HUB ? [{ label: 'College football', href: CFB_HUB.href }] : []),
  { label: 'College football rivalries', href: '/cfb/rivalries' },
  { label: 'Follow your teams', href: '/follow' },
];

function FooterColumn({ heading, links }: { heading: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="font-rd uppercase text-[11px] tracking-[0.14em] text-white/40">
        {heading}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                className="font-rd text-sm text-white/55 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="font-rd text-sm text-white/55 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer({ year }: FooterProps) {
  // The brand line states the site's coverage; its count and league list come
  // from the same derivation as the root description and the homepage, never
  // a literal (this paragraph read "169 teams" by hand on every page).
  const coverage = await getCoverageCounts();
  return (
    <footer className="w-full border-t border-rd-line-strong bg-rd-ink text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          {/* Brand block */}
          <div className="max-w-sm">
            <p className="rd-display text-2xl leading-none">
              <span className="text-white">PROMO</span>
              <span style={{ color: RED_ON_DARK }}>NIGHT</span>
            </p>
            <p className="mt-4 font-rd text-sm leading-relaxed text-white/55">
              Every giveaway, theme night, food deal, and promotion across {coverage.teamCount} teams
              in {coverage.leagueList}.
            </p>
            <FollowFooterCTA />
          </div>

          {/* Link columns */}
          <FooterColumn heading="Browse" links={BROWSE_LINKS} />
          <FooterColumn heading="Discover" links={DISCOVER_LINKS} />
          <FooterColumn heading="Company" links={COMPANY_LINKS} />
        </div>

        {/* Bottom row */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="font-rd text-[12px] tracking-[0.04em] text-white/40">
            © {year ?? 2026} PromoNight. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
