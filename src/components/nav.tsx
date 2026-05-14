'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { trackInstallClick } from '@/lib/analytics';
import { useStarredTeams } from '@/hooks/use-starred-teams';

const BROWSE_LINKS = [
  { href: '/promos/this-week', label: 'Hot this week' },
  { href: '/promos/bobbleheads', label: 'Every bobblehead' },
  { href: '/promos/jersey-giveaways', label: 'Jersey & apparel' },
  { href: '/promos/theme-nights', label: 'Theme nights' },
];

interface NavProps {
  playoffsActive?: boolean;
}

export function Nav({ playoffsActive = false }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const pathname = usePathname();
  const { count, isHydrated } = useStarredTeams();
  const isMyTeamsActive = pathname === '/my-teams';
  const showStarCount = isHydrated && count > 0;
  const starCountLabel = `${count} starred team${count === 1 ? '' : 's'}`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
      <Link href="/" className="font-display text-xl tracking-wider">
        <span className="text-white">PROMO</span>
        <span className="text-accent-red">NIGHT</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-6">
        <Link
          href="/teams"
          className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
        >
          Teams
        </Link>
        <Link
          href="/my-teams"
          aria-current={isMyTeamsActive ? 'page' : undefined}
          className={`relative inline-flex items-center font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${isMyTeamsActive ? 'text-white' : 'text-text-secondary hover:text-white'}`}
        >
          My Teams
          {showStarCount && (
            <span
              aria-label={starCountLabel}
              className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#FBBF24]"
            />
          )}
        </Link>
        {playoffsActive && (
          <Link
            href="/playoffs"
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-accent-red hover:text-white transition-colors"
          >
            Playoffs
          </Link>
        )}
        <div
          className="relative"
          onMouseEnter={() => setBrowseOpen(true)}
          onMouseLeave={() => setBrowseOpen(false)}
        >
          <button
            onClick={() => setBrowseOpen((v) => !v)}
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors inline-flex items-center gap-1"
          >
            Browse
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {browseOpen && (
            <div className="absolute top-full left-0 pt-3">
              <div className="bg-bg-card border border-border-subtle rounded-xl p-2 min-w-[220px] shadow-xl">
                {BROWSE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/[0.04] rounded-lg transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link
          href="/about"
          className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
        >
          About
        </Link>
        <Link
          href="/download"
          onClick={() => trackInstallClick({ platform: 'unknown', section: 'nav', page: 'global' })}
          className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
        >
          Get the App
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden flex flex-col gap-1.5 p-2"
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-bg/95 backdrop-blur-xl border-b border-border-subtle p-6 flex flex-col gap-4 md:hidden">
          <Link
            href="/teams"
            onClick={() => setMenuOpen(false)}
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white"
          >
            Teams
          </Link>
          <Link
            href="/my-teams"
            onClick={() => setMenuOpen(false)}
            aria-current={isMyTeamsActive ? 'page' : undefined}
            className={`relative inline-flex items-center font-mono text-[11px] tracking-[0.08em] uppercase ${isMyTeamsActive ? 'text-white' : 'text-text-secondary hover:text-white'}`}
          >
            My Teams
            {showStarCount && (
              <span
                aria-label={starCountLabel}
                className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#FBBF24]"
              />
            )}
          </Link>
          {playoffsActive && (
            <Link
              href="/playoffs"
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[11px] tracking-[0.08em] uppercase text-accent-red hover:text-white"
            >
              Playoffs
            </Link>
          )}
          <div className="border-t border-border-subtle pt-4">
            <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim mb-3">
              Browse
            </div>
            <div className="flex flex-col gap-3">
              {BROWSE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm text-text-secondary hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            href="/about"
            onClick={() => setMenuOpen(false)}
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white border-t border-border-subtle pt-4"
          >
            About
          </Link>
          <Link
            href="/download"
            onClick={() => { setMenuOpen(false); trackInstallClick({ platform: 'unknown', section: 'nav', page: 'global' }); }}
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white"
          >
            Get the App
          </Link>
        </div>
      )}
    </nav>
  );
}
