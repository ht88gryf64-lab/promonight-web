'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isRedesignEnabledClient } from '@/lib/redesign';

// Global error boundary. error.tsx MUST be a client component (takes error +
// reset). Rendered inside the root layout, so the global chrome already wraps it
// — body-only. The gate is read client-side (isRedesignEnabledClient), which is
// kept in lock-step with the server gate. Gate ON: light-house body; gate OFF:
// the existing dark body. No custom error boundary existed before, so this only
// upgrades the bare Next default to a branded page that doesn't regress either
// state.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  if (isRedesignEnabledClient()) {
    return (
      <div className={`rd-root grid min-h-[70vh] place-items-center px-6 py-24`}>
        <div className="max-w-md text-center">
          <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">Error</div>
          <h1 className="rd-display mt-3 text-4xl uppercase text-rd-ink md:text-5xl">SOMETHING WENT WRONG</h1>
          <p className="mt-3 text-rd-ink-soft">
            An unexpected error occurred. Try again, or head back home.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center rounded-xl bg-rd-red px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Try again
            </button>
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

  return (
    <main className="grid min-h-[60vh] place-items-center px-6 py-24">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-accent-red">Error</div>
        <h1 className="font-display mt-3 text-4xl tracking-[1px] md:text-5xl">SOMETHING WENT WRONG</h1>
        <p className="mt-3 text-text-secondary">
          An unexpected error occurred. Try again, or head back home.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-xl bg-accent-red px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          >
            Try again
          </button>
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
