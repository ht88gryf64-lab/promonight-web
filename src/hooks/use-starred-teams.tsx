'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { normalizeSport, track } from '@/lib/analytics';

const STORAGE_KEY = 'promonight:starred_teams';
const INTRO_FLAG_KEY = 'promonight:has_seen_my_teams_intro';
export const SHOW_STAR_TOAST_EVENT = 'promonight:show-star-toast';

export type ShowStarToastDetail = {
  teamName: string;
  placement: string;
};

export type TeamMeta = {
  name: string;
  league: string;
  sport: string;
};

// Canonical placement enum for the star-event family. Tier 1 (large 20px
// star in a 28x28 button) lands on surfaces where the team itself is the
// primary unit. Tier 2 (small inline star) lands inside dense promo lists
// where the team is referenced contextually. Every <StarToggle> and
// <StarToggleInline> call site must pass one of these strings; TypeScript
// enforces the closed set.
//
// `playoffs_hub_promo_inline` was scoped in the original spec but dropped
// in Checkpoint C: the parent team card already carries a Tier 1 star, so
// inline stars on child promo entries would be redundant clutter on the
// 40%-of-traffic /playoffs hub.
export type StarPlacement =
  // ── Tier 1 ────────────────────────────────────────────────────────────
  | 'team_page_hero'
  | 'teams_browser_card'
  | 'my_teams_featured'
  | 'playoffs_hub_team_card'
  | 'homepage_find_your_team'
  // ── Tier 2 ────────────────────────────────────────────────────────────
  | 'homepage_tonight_inline'
  | 'homepage_this_week_inline'
  | 'promo_aggregator_inline'
  | 'footer_team_list'
  // ── Engagement capture sheet ──────────────────────────────────────────
  // TWO literals, not one, because the two stars this sheet writes are not
  // the same act. `capture_sheet_context` is automatic: submitting the form
  // stars the team whose page it fired on. `capture_sheet_chip` is a tap the
  // visitor performed. Both genuinely change the starred set, so both emit
  // team_starred and neither is suppressed; the split is what lets a reader
  // of the placement breakdown tell a deliberate star from a side effect
  // without joining back to the capture funnel to find out.
  | 'capture_sheet_context'
  | 'capture_sheet_chip';

/**
 * Per-call behavior switches. Optional and defaulted, so every existing call
 * site keeps its exact behavior.
 */
export type ToggleStarOptions = {
  /**
   * Skip the first-star education toast for this call only. The flag itself is
   * left UNSET, so the next star from anywhere else still earns the toast: this
   * suppresses a collision, it does not consume the education.
   *
   * The one caller is the engagement capture sheet. PostStarToastHost renders
   * the toast at `fixed bottom-5 left-1/2`, which is exactly where that sheet
   * sits on a phone, so a first-ever star from inside the sheet would drop a
   * toast on top of the sheet that caused it. The sheet's own success copy
   * ("We've added the ... to your teams here") already says what the toast
   * would have said.
   */
  suppressIntroToast?: boolean;
};

type StarredTeamsContextValue = {
  starred: string[];
  toggleStar: (
    slug: string,
    meta: TeamMeta,
    placement: StarPlacement,
    options?: ToggleStarOptions,
  ) => void;
  isStarred: (slug: string) => boolean;
  isHydrated: boolean;
  count: number;
};

const StarredTeamsContext = createContext<StarredTeamsContextValue | null>(null);

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      return parsed as string[];
    }
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch {
    return [];
  }
}

function writeStored(next: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode) or quota-exceeded; the
    // in-memory state still updates so the tab works for the session.
  }
}

export function StarredTeamsProvider({ children }: { children: ReactNode }) {
  const [starred, setStarred] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Ref mirrors the latest array so toggleStar can compute the next value
  // without recreating itself on every state change. setState updaters are
  // double-invoked under React strict mode, which would double-fire the
  // analytics call if we put the side effect inline.
  const starredRef = useRef<string[]>(starred);
  useEffect(() => {
    starredRef.current = starred;
  }, [starred]);

  useEffect(() => {
    const initial = readStored();
    starredRef.current = initial;
    setStarred(initial);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue == null) {
        starredRef.current = [];
        setStarred([]);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
          starredRef.current = parsed as string[];
          setStarred(parsed as string[]);
        }
      } catch {
        // Ignore malformed cross-tab writes.
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleStar = useCallback(
    (slug: string, meta: TeamMeta, placement: StarPlacement, options?: ToggleStarOptions) => {
      const current = starredRef.current;
      const wasStarred = current.includes(slug);
      const next = wasStarred
        ? current.filter((s) => s !== slug)
        : [...current, slug];

      starredRef.current = next;
      setStarred(next);
      writeStored(next);

      track(wasStarred ? 'team_unstarred' : 'team_starred', {
        team_slug: slug,
        team_name: meta.name,
        league: meta.league,
        sport: normalizeSport(meta.sport),
        placement,
      });

      // First-star education toast. Only fires when the user is going from
      // unstarred → starred AND has never seen the intro before. The flag
      // flips immediately so a rapid double-click can't show the toast twice.
      if (!wasStarred && !options?.suppressIntroToast) {
        try {
          const seen = window.localStorage.getItem(INTRO_FLAG_KEY);
          if (!seen) {
            window.localStorage.setItem(INTRO_FLAG_KEY, '1');
            window.dispatchEvent(
              new CustomEvent<ShowStarToastDetail>(SHOW_STAR_TOAST_EVENT, {
                detail: { teamName: meta.name, placement },
              }),
            );
          }
        } catch {
          // localStorage unavailable — skip the toast rather than fail the star.
        }
      }
    },
    [],
  );

  const isStarred = useCallback(
    (slug: string) => starred.includes(slug),
    [starred],
  );

  const value = useMemo<StarredTeamsContextValue>(
    () => ({
      starred,
      toggleStar,
      isStarred,
      isHydrated,
      count: starred.length,
    }),
    [starred, toggleStar, isStarred, isHydrated],
  );

  return (
    <StarredTeamsContext.Provider value={value}>
      {children}
    </StarredTeamsContext.Provider>
  );
}

export function useStarredTeams(): StarredTeamsContextValue {
  const ctx = useContext(StarredTeamsContext);
  if (!ctx) {
    throw new Error('useStarredTeams must be used inside <StarredTeamsProvider>');
  }
  return ctx;
}

/**
 * Non-throwing variant, for surfaces where stars are an ENHANCEMENT and the page
 * must render regardless.
 *
 * useStarredTeams above keeps throwing, which is correct for every consumer that
 * cannot do its job without stars: a loud failure in development beats a star
 * button that silently does nothing. This variant exists for the opposite case.
 *
 * The one caller today is the preferences page. It is token-gated and it is the
 * only route a subscriber has for managing teams or unsubscribing, and
 * unsubscribe access is a legal obligation rather than a convenience. A throw
 * there does not degrade to a lesser page, it degrades to src/app/error.tsx,
 * whose "Try again" calls reset() and re-renders the same tree, so a
 * deterministic throw like a missing provider would loop on the error page
 * forever with no way through to unsubscribe.
 *
 * Returning null lets that caller fall back to its unseeded behavior instead.
 */
export function useStarredTeamsOptional(): StarredTeamsContextValue | null {
  return useContext(StarredTeamsContext);
}
