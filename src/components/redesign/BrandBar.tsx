import Link from 'next/link';
import { Button } from '@/components/redesign/Button';
import { WorldCupNavLink } from '@/components/world-cup/nav-link';
import { BrandBarLeagueHubs } from './BrandBarLeagueHubs';
import { BrandBarMobileMenu } from './BrandBarMobileMenu';

// Redesign v2 top bar. Replaces the global dark nav on gated team pages with a
// light, sticky, translucent cream bar carrying the PromoNight wordmark, a
// compact link set, and the primary "Get the App" CTA. Presentational only.

export interface BrandBarProps {
  playoffsActive?: boolean;
  worldCupActive?: boolean;
}

interface NavLink {
  label: string;
  href: string;
}

const LINK_CLASS =
  'font-rd text-[12px] uppercase tracking-[0.12em] text-rd-ink-soft ' +
  'hover:text-rd-ink transition-colors';

// Subtle red accent so the World Cup link stands out from the ink-soft links.
const WC_LINK_CLASS =
  'font-rd text-[12px] uppercase tracking-[0.12em] text-rd-red ' +
  'hover:text-rd-red-dark transition-colors';

export function BrandBar({ playoffsActive = false, worldCupActive = false }: BrandBarProps) {
  // World Cup sits after Playoffs and before About; About is rendered last
  // separately so the conditional World Cup link can slot in ahead of it.
  const links: NavLink[] = [
    { label: 'Teams', href: '/teams' },
    { label: 'My Teams', href: '/my-teams' },
    ...(playoffsActive ? [{ label: 'Playoffs', href: '/playoffs' }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-rd-line bg-rd-cream/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="PromoNight home"
          className="rd-display text-lg tracking-tight"
        >
          <span className="text-rd-ink">PROMO</span>
          <span className="text-rd-red">NIGHT</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
            {worldCupActive && <WorldCupNavLink className={WC_LINK_CLASS} />}
            <Link href="/about" className={LINK_CLASS}>
              About
            </Link>
          </div>

          {/* League hubs dropdown and the app CTA are desktop-only (md+); on
              mobile both live inside the hamburger sheet, so the mobile bar is
              just wordmark + hamburger. */}
          <div className="hidden md:block">
            <BrandBarLeagueHubs />
          </div>

          <div className="hidden md:block">
            <Button href="/download" variant="primary" size="sm">
              Get the App
            </Button>
          </div>

          {/* Mobile hamburger + fullscreen nav sheet (md:hidden). */}
          <BrandBarMobileMenu playoffsActive={playoffsActive} worldCupActive={worldCupActive} />
        </div>
      </nav>
    </header>
  );
}
