'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconChevronDown } from '@tabler/icons-react';
import { LEAGUE_HUBS, hubAriaLabel } from '@/lib/league-hubs';
import { LeagueChip } from './LeagueChip';

// "League hubs" dropdown for the redesign top bar. Lists only live hubs from the
// LEAGUE_HUBS registry (MLB today; the list grows as hubs ship). Keyboard
// accessible: the trigger carries aria-expanded, Escape closes it, and an
// outside click/tap closes it. Rendered once and always visible, so it works on
// both desktop and mobile. The redesign top bar has no separate mobile menu
// (the other links are desktop-only, hidden below md), so this single dropdown
// is the mobile-visible entry point rather than an item in a menu that does not
// exist. No nav analytics event is fired because the top bar has no existing
// nav-event pattern to match. Client component for the open/close state.
const TRIGGER_CLASS =
  'inline-flex items-center gap-1 font-rd text-[12px] uppercase tracking-[0.12em] ' +
  'text-rd-ink-soft transition-colors hover:text-rd-ink';

export function BrandBarLeagueHubs() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="league-hubs-menu"
        className={TRIGGER_CLASS}
      >
        League hubs
        <IconChevronDown
          size={13}
          stroke={2.25}
          aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Always rendered, hidden via CSS when closed (display:none removes it
          from the tab order and a11y tree). This keeps the live hub links in
          the SSR source of every gate-on page, so /mlb is a crawlable internal
          link from the global chrome, not just an on-click element. */}
      <div
        id="league-hubs-menu"
        className={`absolute right-0 top-full mt-2 min-w-[230px] rounded-xl border border-rd-line bg-rd-card p-1 shadow-[0_8px_28px_rgba(33,29,24,0.14)] ${open ? '' : 'hidden'}`}
      >
        {LEAGUE_HUBS.map((hub) => (
          <Link
            key={hub.href}
            href={hub.href}
            aria-label={hubAriaLabel(hub)}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-rd text-[13px] normal-case tracking-normal text-rd-ink-soft transition-colors hover:bg-rd-cream hover:text-rd-ink"
          >
            <LeagueChip accent={hub.accent} label={hub.label} size={22} />
            <span>{hub.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
