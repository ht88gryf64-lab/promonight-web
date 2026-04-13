'use client';

import Link from 'next/link';
import { useState } from 'react';
import { event } from '@/lib/analytics';

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
      <Link href="/" className="font-display text-xl tracking-wider">
        <span className="text-white">PROMO</span>
        <span className="text-accent-red">NIGHT</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
        <Link
          href="/teams"
          className="font-mono text-[11px] tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
        >
          Browse Teams
        </Link>
        <Link
          href="/download"
          onClick={() => event('app_store_click', { platform: 'ios', section: 'nav', page: 'global' })}
          className="bg-accent-red hover:bg-accent-red-dim text-white font-body font-bold text-sm px-5 py-2.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
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
            Browse Teams
          </Link>
          <Link
            href="/download"
            onClick={() => { setMenuOpen(false); event('app_store_click', { platform: 'ios', section: 'nav', page: 'global' }); }}
            className="bg-accent-red text-white font-bold text-sm px-5 py-2.5 rounded-lg text-center"
          >
            Get the App
          </Link>
        </div>
      )}
    </nav>
  );
}
