// Promo page sharing (2026-11-03): the client half's storage. Two records,
// both best effort (private mode or blocked storage degrades to "no share
// session", never to an error):
//
//   pn_share_session (sessionStorage): the shared-link session this tab is
//     in, set on landing. Read by every TrackedAffiliateLink through
//     useShareSession, so Impact links add subId2=share for the rest of the
//     tab's session, across client navigations, after the address bar has
//     been cleaned. A new tab is a new session (sessionStorage is per tab).
//
//   pn_share_created (localStorage): the share ids THIS browser minted,
//     each with the PostHog distinct_id that minted it. On landing, a share
//     id found here under the visitor's own distinct_id is a self-open. Only
//     ids and distinct_ids, capped at the newest 50.
//
// HYDRATION. useShareSession is a useSyncExternalStore whose server snapshot
// is null, so the server render and the hydration render agree (no subId2)
// and the client re-renders with the session after hydration.

import { useSyncExternalStore } from 'react';
import { SHARE_ID_RE, type PromoShareChannel } from './promo-share';

export interface ShareSession {
  shareId: string;
  channel: PromoShareChannel;
  promoId: string;
  /** True when the visitor opened their own share; such a session adds no
   *  subId2 and is excluded from share metrics. */
  selfOpen: boolean;
}

const SESSION_KEY = 'pn_share_session';
const CREATED_KEY = 'pn_share_created';
const CREATED_MAX = 50;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: ShareSession | null = null;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function parseSession(raw: string | null): ShareSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ShareSession>;
    if (!v || typeof v.shareId !== 'string' || !SHARE_ID_RE.test(v.shareId)) return null;
    return { shareId: v.shareId, channel: v.channel as PromoShareChannel, promoId: String(v.promoId ?? ''), selfOpen: v.selfOpen === true };
  } catch {
    return null;
  }
}

/** The current shared-link session, or null. Stable identity between writes
 *  (useSyncExternalStore requires it). */
export function getShareSession(): ShareSession | null {
  if (typeof window === 'undefined') return null;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseSession(raw);
  }
  return cachedValue;
}

export function setShareSession(s: ShareSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the session lives for this page only.
    cachedRaw = JSON.stringify(s);
    cachedValue = s;
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const serverSnapshot = (): ShareSession | null => null;

export function useShareSession(): ShareSession | null {
  return useSyncExternalStore(subscribe, getShareSession, serverSnapshot);
}

// ── shares this browser created ─────────────────────────────────────────────

function readCreated(): Array<[string, string]> {
  try {
    const raw = window.localStorage.getItem(CREATED_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember that this browser, as `distinctId`, created `shareId`. */
export function recordCreatedShare(shareId: string, distinctId: string): void {
  try {
    const next = [...readCreated().filter(([id]) => id !== shareId), [shareId, distinctId] as [string, string]].slice(-CREATED_MAX);
    window.localStorage.setItem(CREATED_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the self-open check cannot see this share. The PostHog
    // dashboard's creator join (share_complete distinct_id) still excludes it.
  }
}

/** The distinct_id that created `shareId` in this browser, or null. */
export function creatorOf(shareId: string): string | null {
  const hit = readCreated().find(([id]) => id === shareId);
  return hit ? hit[1] : null;
}

/** Self-open: the share was created in this browser under the visitor's own
 *  distinct_id. When either distinct_id is not known (PostHog blocked at
 *  share time or at landing), a share created in this browser counts as a
 *  self-open. */
export function isSelfOpen(shareId: string, currentDistinctId: string | null): boolean {
  const creator = creatorOf(shareId);
  if (creator === null) return false;
  if (!creator || !currentDistinctId) return true;
  return creator === currentDistinctId;
}
