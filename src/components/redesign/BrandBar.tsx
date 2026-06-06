import Link from 'next/link';
import { Button } from '@/components/redesign/Button';

// Redesign v2 top bar. Replaces the global dark nav on gated team pages with a
// light, sticky, translucent cream bar carrying the PromoNight wordmark, a
// compact link set, and the primary "Get the App" CTA. Presentational only.

export interface BrandBarProps {
  playoffsActive?: boolean;
}

interface NavLink {
  label: string;
  href: string;
}

const LINK_CLASS =
  'font-rd text-[12px] uppercase tracking-[0.12em] text-rd-ink-soft ' +
  'hover:text-rd-ink transition-colors';

export function BrandBar({ playoffsActive = false }: BrandBarProps) {
  const links: NavLink[] = [
    { label: 'Teams', href: '/teams' },
    { label: 'My Teams', href: '/my-teams' },
    ...(playoffsActive ? [{ label: 'Playoffs', href: '/playoffs' }] : []),
    { label: 'About', href: '/about' },
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

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </div>

          <Button href="/download" variant="primary" size="sm">
            Get the App
          </Button>
        </div>
      </nav>
    </header>
  );
}
