import Link from 'next/link';
import { isRedesignEnabled } from '@/lib/redesign';

// Not-found boundary for the team route (rendered with a 404 status when
// page.tsx calls notFound() for an invalid slug).
//
// SERVER component only — usePathname() breaks not-found SSR (it falls back to
// the default error page), so the gate decision is made server-side via
// isRedesignEnabled(). The root layout wraps this boundary, so the global chrome
// (light BrandBar/Footer when gated on, dark Nav/Footer when off) already frames
// it — this renders body-only in BOTH states. (Phase 1 made the chrome global;
// before that this boundary rendered its own BrandBar/Footer because the old
// Nav/Footer were suppressed on team routes — which would now double up.)
export default function TeamNotFound() {
  if (isRedesignEnabled()) {
    return (
      <div className={`rd-root grid min-h-[70vh] place-items-center px-6 py-24`}>
        <div className="max-w-md text-center">
          <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">404</div>
          <h1 className="rd-display mt-3 text-4xl uppercase text-rd-ink md:text-5xl">TEAM NOT FOUND</h1>
          <p className="mt-3 text-rd-ink-soft">
            We couldn&rsquo;t find that team. The URL may be off, or the team isn&rsquo;t tracked yet.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/teams"
              className="inline-flex items-center rounded-xl bg-rd-red px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Browse all teams
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-rd-line-strong bg-rd-card px-6 py-3 text-sm font-semibold text-rd-ink transition-colors hover:border-rd-ink"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Gate off — the global Nav/Footer render around this; just the body.
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
