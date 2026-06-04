'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isRedesignEnabledClient, isTeamRoute } from '@/lib/redesign';
import { BrandBar } from './BrandBar';
import { Footer } from './Footer';
import { Button } from './Button';

// 404 view for an invalid team slug. Renders the redesigned light chrome
// (BrandBar + Footer) EXACTLY when the global chrome is suppressed — i.e. the
// same condition RedesignChromeGate / Nav use: gate on AND a real team route
// (/{sport}/{team} with a known sport). On a malformed path (e.g. /foo/bad) the
// global chrome is NOT suppressed, so here we render only the body and let the
// global Nav/Footer show — no double chrome in any case. Gate off → only the
// body, global chrome shows.
export function TeamNotFoundView() {
  const pathname = usePathname();
  const redesignChrome = isRedesignEnabledClient() && isTeamRoute(pathname);

  if (redesignChrome) {
    return (
      <div className="rd-root flex min-h-screen flex-col">
        <BrandBar />
        <main className="grid flex-1 place-items-center px-6 py-24">
          <div className="max-w-md text-center">
            <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">404</div>
            <h1 className="rd-display mt-3 text-4xl text-rd-ink md:text-5xl">TEAM NOT FOUND</h1>
            <p className="mt-3 text-rd-ink-soft">
              We couldn&rsquo;t find that team. The URL may be off, or the team isn&rsquo;t tracked yet.
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <Button href="/teams" variant="primary">Browse all teams</Button>
              <Button href="/" variant="secondary">Home</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Global Nav/Footer render around this (gate off, or malformed non-team path).
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-24">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-accent-red">404</div>
        <h1 className="font-display mt-3 text-4xl tracking-[1px] md:text-5xl">TEAM NOT FOUND</h1>
        <p className="mt-3 text-text-secondary">
          We couldn&rsquo;t find that team. The URL may be off, or the team isn&rsquo;t tracked yet.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link
            href="/teams"
            className="inline-flex items-center rounded-xl bg-accent-red px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          >
            Browse all teams
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-border-subtle bg-bg-card px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-border-hover"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
