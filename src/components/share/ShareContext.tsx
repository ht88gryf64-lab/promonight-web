'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ShareItem } from './types';
import { ShareSheet } from './ShareSheet';

interface ShareContextValue {
  openShare: (item: ShareItem, placement: string) => void;
}

const ShareContext = createContext<ShareContextValue | null>(null);

// Single source of truth for the share sheet. Mounted once near the root so
// only one sheet can ever be open, and so server-rendered cards (promo list,
// game calendar) can drop a <ShareButton> in without the page needing to plumb
// a setState callback through the RSC boundary — they reach this via context.
export function ShareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ item: ShareItem; placement: string } | null>(null);

  const openShare = useCallback((item: ShareItem, placement: string) => {
    setState({ item, placement });
  }, []);
  const close = useCallback(() => setState(null), []);

  const value = useMemo(() => ({ openShare }), [openShare]);

  return (
    <ShareContext.Provider value={value}>
      {children}
      <ShareSheet
        item={state?.item ?? null}
        placement={state?.placement ?? ''}
        onClose={close}
      />
    </ShareContext.Provider>
  );
}

// Returns null when used outside a ShareProvider so ShareButton degrades to a
// no-op rather than throwing.
export function useShare(): ShareContextValue | null {
  return useContext(ShareContext);
}
