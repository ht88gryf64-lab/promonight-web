import type { ReactNode } from 'react';

// Barlow Condensed for display, the house body face under it. The variable is
// bound by the page wrapper (see src/app/playoffs), not here, so importing
// this file never pulls a font preload onto another route.
export const CONDENSED = 'var(--font-cfb-condensed), var(--font-rd, system-ui), sans-serif';

export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="border-b-2 border-rd-line pb-2 text-[26px] font-extrabold uppercase leading-none text-rd-ink"
      style={{ fontFamily: CONDENSED }}
    >
      {children}
    </h2>
  );
}

/** The badge on a game that is in progress. The word describes the game's
 *  state as the bracket document recorded it, and nothing about this page. */
export function InProgressBadge() {
  return (
    <span
      data-game-state="live"
      className="inline-flex items-center gap-1 rounded bg-rd-red px-1.5 py-0.5 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] text-white"
    >
      Live
    </span>
  );
}

export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
