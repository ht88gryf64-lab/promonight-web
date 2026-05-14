'use client';

import { useState, type MouseEvent } from 'react';
import { StarIcon } from './star-icon';
import {
  useStarredTeams,
  type StarPlacement,
  type TeamMeta,
} from '@/hooks/use-starred-teams';

type CommonProps = {
  teamSlug: string;
  teamName: string;
  league: string;
  sport: string;
  placement: StarPlacement;
};

type StarToggleProps = CommonProps & {
  surface?: 'light' | 'dark';
};

// Tier 1: 28x28 button containing a 20px star. Used wherever a team is the
// primary unit on screen (team browser cards, team detail hero, my-teams
// featured grid, playoffs team cards). Pops when transitioning from
// unstarred → starred for tactile feedback; quietly fills on the unstar
// path so the user doesn't get a "do you really want to remove" feel.
export function StarToggle({
  teamSlug,
  teamName,
  league,
  sport,
  placement,
  surface = 'light',
}: StarToggleProps) {
  const { toggleStar, isStarred, isHydrated } = useStarredTeams();
  const [popKey, setPopKey] = useState(0);

  if (!isHydrated) {
    // Reserve exact footprint so cards don't jump on hydration.
    return (
      <span
        aria-hidden="true"
        className="inline-block"
        style={{ width: 28, height: 28 }}
      />
    );
  }

  const filled = isStarred(teamSlug);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const meta: TeamMeta = { name: teamName, league, sport };
    toggleStar(teamSlug, meta, placement);
    if (!filled) {
      setPopKey((k) => k + 1);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={filled ? `Unstar ${teamName}` : `Star ${teamName}`}
      aria-pressed={filled}
      className="inline-flex items-center justify-center rounded-full bg-transparent border-0 cursor-pointer p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-1"
      style={{
        width: 28,
        height: 28,
        filter: filled ? 'drop-shadow(0 0 6px rgba(251,191,36,0.45))' : undefined,
      }}
    >
      <span
        key={popKey}
        className={popKey > 0 ? 'animate-star-pop' : undefined}
        style={{ lineHeight: 0 }}
      >
        <StarIcon filled={filled} size={20} surface={surface} />
      </span>
    </button>
  );
}

type StarToggleInlineProps = CommonProps & {
  // Icon size in pixels. Button hit area scales as size + 6 so the touch
  // target stays usable: default 14 → 20x20 button, footer's 12 → 18x18.
  // Use this only when the surrounding layout demands tighter density;
  // most call sites should use the default.
  size?: number;
};

// Tier 2: small inline star (default 14px) inside a square hit area. Used
// inside dense promo lists where the team is referenced contextually
// rather than being the primary unit. No pop animation — the surrounding
// row already has its own hover feedback and a bouncing star inside a
// list reads as noise.
export function StarToggleInline({
  teamSlug,
  teamName,
  league,
  sport,
  placement,
  size = 14,
}: StarToggleInlineProps) {
  const { toggleStar, isStarred, isHydrated } = useStarredTeams();
  const buttonSize = size + 6;

  if (!isHydrated) {
    return (
      <span
        aria-hidden="true"
        className="inline-block"
        style={{ width: buttonSize, height: buttonSize }}
      />
    );
  }

  const filled = isStarred(teamSlug);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const meta: TeamMeta = { name: teamName, league, sport };
    toggleStar(teamSlug, meta, placement);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={filled ? `Unstar ${teamName}` : `Star ${teamName}`}
      aria-pressed={filled}
      className="inline-flex items-center justify-center rounded-sm bg-transparent border-0 cursor-pointer p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-red"
      style={{ width: buttonSize, height: buttonSize, lineHeight: 0 }}
    >
      <StarIcon filled={filled} size={size} surface="dark" />
    </button>
  );
}
