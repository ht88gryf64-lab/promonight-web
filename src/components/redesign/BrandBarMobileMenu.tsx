'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconMenu2 } from '@tabler/icons-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/redesign/Button';
import { WorldCupNavLink } from '@/components/world-cup/nav-link';
import { LEAGUE_HUBS, hubAriaLabel } from '@/lib/league-hubs';
import { LeagueChip } from './LeagueChip';

// Mobile hamburger + fullscreen nav sheet for the gate-on redesign top bar.
// Shown only below md (md:hidden); at md+ the desktop link cluster + the League
// hubs dropdown + Get the App button carry navigation. The overlay REUSES the
// shared Modal primitive (variant='light' size='full'), which provides the focus
// trap, focus restore, body scroll-lock, Esc-to-close, backdrop-click, and a
// built-in close button, so nothing here is a hand-rolled overlay. Modal keeps
// its children mounted even when closed, so every nav link stays in the SSR
// source and remains crawlable. Client child of the server BrandBar (all the
// interactive state lives here); it renders inside BrandBar's .rd-root scope, so
// the rd-* tokens and Archivo resolve.

const ROW_BASE =
  'flex items-center gap-3 rounded-lg px-3 py-3 font-rd text-[15px] font-medium transition-colors hover:bg-rd-cream';
const ROW_LINK = `${ROW_BASE} text-rd-ink-soft hover:text-rd-ink`;
const ROW_WC = `${ROW_BASE} text-rd-red hover:text-rd-red-dark`;

export function BrandBarMobileMenu({
  playoffsActive = false,
  worldCupActive = false,
}: {
  playoffsActive?: boolean;
  worldCupActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Auto-close (and release Modal's body scroll-lock) when the viewport crosses
  // to md+, where the desktop nav takes over. Without this, a rotate/resize past
  // the md breakpoint while the sheet is open hides the md:hidden dialog with
  // `open` still true, so Modal's [isOpen] effect never re-runs and body scroll
  // stays locked until reload.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 768px)');
    if (mq.matches) {
      setOpen(false);
      return;
    }
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open]);

  // Close the sheet whenever a link inside it is tapped (delegated), so a client
  // navigation dismisses the overlay. Esc + backdrop close are handled by Modal
  // itself. Taps on non-link areas (section labels) do nothing.
  const handleNavClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) close();
  };

  // Canonical BrandBar link order + conditionals (mirrors BrandBar.tsx).
  const links = [
    { label: 'Today', href: '/promos/today' },
    { label: 'Teams', href: '/teams' },
    { label: 'My Teams', href: '/my-teams' },
    ...(playoffsActive ? [{ label: 'Playoffs', href: '/playoffs' }] : []),
  ];

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-nav-sheet"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-rd-ink transition-colors hover:bg-rd-cream"
      >
        <IconMenu2 size={22} stroke={2.25} aria-hidden />
      </button>

      <Modal isOpen={open} onClose={close} variant="light" size="full" ariaLabel="Site navigation">
        <nav id="mobile-nav-sheet" aria-label="Site navigation" onClick={handleNavClick}>
          <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            Menu
          </p>
          <div className="mt-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={ROW_LINK}>
                {l.label}
              </Link>
            ))}
            {worldCupActive ? <WorldCupNavLink className={ROW_WC} /> : null}
            <Link href="/about" className={ROW_LINK}>
              About
            </Link>
          </div>

          <p className="mt-7 font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
            League hubs
          </p>
          <div className="mt-2">
            {LEAGUE_HUBS.map((hub) => (
              <Link key={hub.href} href={hub.href} aria-label={hubAriaLabel(hub)} className={ROW_LINK}>
                <LeagueChip accent={hub.accent} label={hub.label} size={30} />
                <span>{hub.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <Button href="/download" variant="primary" fullWidth>
              Get the App
            </Button>
          </div>
        </nav>
      </Modal>
    </div>
  );
}
