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

export type TeamMeta = {
  name: string;
  league: string;
  sport: string;
};

export type StarPlacement =
  | 'team_page_hero'
  | 'teams_browser_card'
  | 'my_teams_featured'
  | 'playoffs_hub_team_card'
  | 'homepage_find_your_team'
  | 'homepage_tonight_inline'
  | 'homepage_this_week_inline'
  | 'promo_aggregator_inline'
  | 'playoffs_hub_promo_inline'
  | 'footer_team_list';

type StarredTeamsContextValue = {
  starred: string[];
  toggleStar: (slug: string, meta: TeamMeta, placement: StarPlacement) => void;
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
    (slug: string, meta: TeamMeta, placement: StarPlacement) => {
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
