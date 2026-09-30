'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// The state of the bracket's controls: which round, which conference, which
// series is open. It lives in a provider that renders NO element of its own,
// so the bracket and the predicted bracket below it can share one set of
// controls while staying separate children of the page. That matters for
// ads: units are placed between the page's direct children, and a unit must
// never land inside a subtree that re-renders when a control is pressed.

export interface SeriesIndexEntry {
  id: string;
  round: string;
  conference: string | null;
  status: 'upcoming' | 'live' | 'final';
}

/** Why the round last changed. The bracket scrolls to a round that a pill or
 *  a link chose, and leaves the scroll alone when the reader swiped there. */
export type RoundCause = 'initial' | 'pill' | 'swipe' | 'link';

/** How a series came to be open: the reader tapped it here, or arrived on a
 *  link that named it. */
export type OpenCause = 'tap' | 'link';

interface Controls {
  round: string;
  roundCause: RoundCause;
  conference: string | null;
  openId: string | null;
  openCause: OpenCause | null;
  /** False in the server HTML and until the first effect has run. */
  hydrated: boolean;
  setRound: (round: string, cause: RoundCause) => void;
  setConference: (conference: string) => void;
  setOpen: (id: string | null, cause: OpenCause) => void;
}

const BracketControls = createContext<Controls | null>(null);

export function useBracketControls(): Controls {
  const c = useContext(BracketControls);
  if (!c) throw new Error('useBracketControls must be used inside BracketControlsProvider');
  return c;
}

/** The series a URL fragment names, or null. "#wild_card-2" names a series
 *  only when the bracket has one with that id. */
export function seriesFromFragment(fragment: string, index: readonly SeriesIndexEntry[]): SeriesIndexEntry | null {
  let id = fragment.replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  if (!id) return null;
  return index.find((s) => s.id === id) ?? null;
}

export function BracketControlsProvider({
  initialRound,
  initialConference,
  index,
  children,
}: {
  initialRound: string;
  initialConference: string | null;
  index: readonly SeriesIndexEntry[];
  children: ReactNode;
}) {
  const [round, setRoundState] = useState<{ key: string; cause: RoundCause }>({ key: initialRound, cause: 'initial' });
  const [conference, setConferenceState] = useState<string | null>(initialConference);
  const [open, setOpenState] = useState<{ id: string | null; cause: OpenCause | null }>({ id: null, cause: null });
  const [hydrated, setHydrated] = useState(false);

  // The fragment is read AFTER the first render, never during it. The server
  // cannot see a fragment, so the first client render has to match a page
  // that knows nothing about it; until this runs, CSS :target does the work.
  useEffect(() => {
    const apply = () => {
      const hit = seriesFromFragment(window.location.hash, index);
      if (!hit) return;
      setOpenState({ id: hit.id, cause: 'link' });
      setRoundState({ key: hit.round, cause: 'link' });
      if (hit.conference !== null) setConferenceState(hit.conference);
    };
    apply();
    setHydrated(true);
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [index]);

  const setRound = useCallback((key: string, cause: RoundCause) => setRoundState({ key, cause }), []);
  const setConference = useCallback((c: string) => setConferenceState(c), []);
  const setOpen = useCallback((id: string | null, cause: OpenCause) => setOpenState({ id, cause: id === null ? null : cause }), []);

  const value = useMemo<Controls>(
    () => ({
      round: round.key,
      roundCause: round.cause,
      conference,
      openId: open.id,
      openCause: open.cause,
      hydrated,
      setRound,
      setConference,
      setOpen,
    }),
    [round, conference, open, hydrated, setRound, setConference, setOpen],
  );

  return <BracketControls.Provider value={value}>{children}</BracketControls.Provider>;
}
