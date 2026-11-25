import Link from 'next/link';
import { Button } from '@/components/redesign/Button';
import { WorldCupNavLink } from '@/components/world-cup/nav-link';
import { BrandBarLeagueHubs } from './BrandBarLeagueHubs';
import { BrandBarMobileMenu } from './BrandBarMobileMenu';
import { EventPageLink } from '@/components/events/EventPageLink';
import { eventPageHref } from '@/lib/events/event-pages';

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
    { label: 'Today', href: '/promos/today' },
    { label: 'Teams', href: '/teams' },
    { label: 'My Teams', href: '/my-teams' },
    ...(playoffsActive ? [{ label: 'Playoffs', href: '/playoffs' }] : []),
  ];

  // EVENTS IN THE TOP NAV (2026-11 fix round): the events index was reachable
  // only from the footer's Discover column. The link comes from the one
  // helper every link into /events goes through, with its own surface
  // (nav_events), so it is absent while EVENTS_PAGES_LIVE is off and its
  // clicks stay separable from the footer's. Resolved HERE, on the server:
  // the flag is not a public env var, so the client menu is handed the href.
  const eventsLink = eventPageHref({ kind: 'index' }, 'nav_events');
  // IT SHOWS ONLY WHERE THE BAR HAS ROOM FOR IT. With the five standing items
  // the bar fits Events from 840px up; below that "My Teams" and "League
  // hubs" wrapped to two lines (measured in Chrome, 2026-11-25). Each
  // conditional link (Playoffs, World Cup) takes roughly another 110px. So
  // the breakpoint moves with them, and under it the link is simply absent
  // from the bar: the footer still carries Events on every page, and below
  // 768 the menu sheet lists it. Literal class strings, for Tailwind's scan.
  const extras = (playoffsActive ? 1 : 0) + (worldCupActive ? 1 : 0);
  const EVENTS_SHOW = ['hidden min-[860px]:inline', 'hidden min-[980px]:inline', 'hidden min-[1100px]:inline'][extras];

  // Opaque cream (ruling 2026-11-08, ux-review D1): at 85% the dark body
  // showed through, because div.rd-root is display: contents and paints
  // nothing behind the header, and the wordmark measured 3.12:1 against
  // the band a fan actually sees. On #f7f3ea it is 4.33:1.
  return (
    <header className="sticky top-0 z-40 border-b border-rd-line bg-rd-cream">
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
            {eventsLink ? (
              <EventPageLink href={eventsLink.href} linkSurface={eventsLink.surface} className={`${LINK_CLASS} ${EVENTS_SHOW}`}>
                Events
              </EventPageLink>
            ) : null}
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
          <BrandBarMobileMenu playoffsActive={playoffsActive} worldCupActive={worldCupActive} eventsHref={eventsLink?.href ?? null} />
        </div>
      </nav>
    </header>
  );
}
