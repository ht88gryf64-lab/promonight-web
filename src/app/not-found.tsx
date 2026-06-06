import Link from 'next/link';
import { isRedesignEnabled } from '@/lib/redesign';

// Global 404 boundary (unmatched URLs + root-level notFound()). Rendered INSIDE
// the root layout, so the global chrome (BrandBar/Footer, gated) already wraps it
// — this is body-only. SERVER component (no usePathname) so the gate is decided
// server-side via isRedesignEnabled(), matching app/[sport]/[team]/not-found.tsx.
//
// Gate ON: light-house body in an rd-root + archivoHouse scope (archivoHouse is
// the preload:false instance, so adding it here does not put a font preload on
// any gate-off page). Gate OFF: the existing dark body (the old chrome wraps it);
// previously there was no custom 404, so this only upgrades the bare Next default
// to a branded, on-theme page in both states.
export default function NotFound() {
  if (isRedesignEnabled()) {
    return (
      <div className={`rd-root grid min-h-[70vh] place-items-center px-6 py-24`}>
        <div className="max-w-md text-center">
          <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">404</div>
          <h1 className="rd-display mt-3 text-4xl uppercase text-rd-ink md:text-5xl">PAGE NOT FOUND</h1>
          <p className="mt-3 text-rd-ink-soft">
            The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-rd-red px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Back home
            </Link>
            <Link
              href="/teams"
              className="inline-flex items-center rounded-xl border border-rd-line-strong bg-rd-card px-6 py-3 text-sm font-semibold text-rd-ink transition-colors hover:border-rd-ink"
            >
              Browse teams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-24">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-accent-red">404</div>
        <h1 className="font-display mt-3 text-4xl tracking-[1px] md:text-5xl">PAGE NOT FOUND</h1>
        <p className="mt-3 text-text-secondary">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl bg-accent-red px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          >
            Back home
          </Link>
          <Link
            href="/teams"
            className="inline-flex items-center rounded-xl border border-border-subtle bg-bg-card px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-border-hover"
          >
            Browse teams
          </Link>
        </div>
      </div>
    </main>
  );
}
