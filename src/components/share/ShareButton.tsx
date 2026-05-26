'use client';

import type { MouseEvent } from 'react';
import type { ShareItem } from './types';
import { useShare } from './ShareContext';

interface ShareButtonProps {
  /** The item to share when tapped. */
  item: ShareItem;
  /**
   * Placement tag recorded on the share_initiated event (e.g. "promo_card",
   * "game_card"). Used by the context-driven default path.
   */
  placement: string;
  /**
   * Optional override. When provided it takes precedence over the shared
   * ShareContext — useful if a surface wants to manage the sheet itself.
   */
  onShare?: (item: ShareItem) => void;
  /** Override the default icon-button styling. */
  className?: string;
  /** Accessible label; defaults to "Share". */
  label?: string;
}

// Small, icon-only share affordance. stopPropagation()/preventDefault() run
// first so a tap never triggers the surrounding card's navigation (the scored
// promo card, for example, wraps its body in an <a>).
export function ShareButton({
  item,
  placement,
  onShare,
  className,
  label = 'Share',
}: ShareButtonProps) {
  const share = useShare();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShare) {
      onShare(item);
      return;
    }
    share?.openShare(item, placement);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={handleClick}
      className={
        className ??
        'inline-flex items-center justify-center w-8 h-8 rounded-full text-text-secondary hover:text-white hover:bg-white/10 active:bg-white/[0.15] transition-colors'
      }
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"
        />
      </svg>
    </button>
  );
}
