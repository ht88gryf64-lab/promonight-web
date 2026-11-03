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
// The session ends with the PostHog session it landed in (see LIFETIME).
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
  /** Landing time, ms. */
  at: number;
  /** The PostHog session id at landing, '' when PostHog was not loaded. */
  sid: string;
}

const SESSION_KEY = 'pn_share_session';
const CREATED_KEY = 'pn_share_created';
const CREATED_MAX = 50;

// LIFETIME (Gate B F3). The share session is the PostHog session it landed
// in, so subId2 on partner links and share_id on PostHog events end
// together: once PostHog's session id moves on (30 minutes idle, or its 24h
// cap), the share session is over. Without a PostHog id it lasts 30 minutes
// from landing. 24 hours is the hard cap either way. sessionStorage alone
// lives as long as the tab, which a restored mobile tab stretches to days.
export const SHARE_SESSION_IDLE_MS = 30 * 60 * 1000;
export const SHARE_SESSION_MAX_MS = 24 * 60 * 60 * 1000;
const RECHECK_MS = 60 * 1000;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: ShareSession | null = null;
// Storage blocked (Gate B F4): the session lives in memory for this page.
let memoryRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

function parseSession(raw: string | null): ShareSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ShareSession>;
    if (!v || typeof v.shareId !== 'string' || !SHARE_ID_RE.test(v.shareId)) return null;
    if (typeof v.at !== 'number' || !Number.isFinite(v.at)) return null;
    return { shareId: v.shareId, channel: v.channel as PromoShareChannel, promoId: String(v.promoId ?? ''), selfOpen: v.selfOpen === true, at: v.at, sid: typeof v.sid === 'string' ? v.sid : '' };
  } catch {
    return null;
  }
}

function currentPostHogSessionId(): string | null {
  try {
    const ph = (window as unknown as { posthog?: { get_session_id?: () => string } }).posthog;
    return ph?.get_session_id?.() || null;
  } catch {
    return null;
  }
}

/** Whether a stored session is still live at `now`. Pure, for tests. */
export function shareSessionLive(s: Pick<ShareSession, 'at' | 'sid'>, now: number, postHogSessionId: string | null): boolean {
  if (now - s.at > SHARE_SESSION_MAX_MS || now < s.at - 60_000) return false;
  if (s.sid) return postHogSessionId ? postHogSessionId === s.sid : now - s.at <= SHARE_SESSION_MAX_MS;
  return now - s.at <= SHARE_SESSION_IDLE_MS;
}

/** The current shared-link session, or null. Stable identity between writes
 *  (useSyncExternalStore requires it); null once the session has ended. */
export function getShareSession(): ShareSession | null {
  if (typeof window === 'undefined') return null;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseSession(raw);
  }
  if (cachedValue && !shareSessionLive(cachedValue, Date.now(), currentPostHogSessionId())) {
    clearShareSession();
    return null;
  }
  return cachedValue;
}

function write(raw: string | null): void {
  try {
    if (raw === null) window.sessionStorage.removeItem(SESSION_KEY);
    else window.sessionStorage.setItem(SESSION_KEY, raw);
    memoryRaw = null;
  } catch {
    memoryRaw = raw;
  }
  cachedRaw = undefined;
}

export function setShareSession(s: ShareSession): void {
  write(JSON.stringify(s));
  for (const fn of listeners) fn();
}

export function clearShareSession(): void {
  write(null);
  cachedValue = null;
  cachedRaw = null;
}

// Expiry is checked on every read, and every minute (and when the tab comes
// back) while anything is subscribed, so open links lose subId2 when the
// session ends rather than at the next render.
let timer: number | undefined;
let lastLive: string | null = null;
function recheck(): void {
  const now = getShareSession()?.shareId ?? null;
  if (now !== lastLive) {
    lastLive = now;
    for (const fn of listeners) fn();
  }
}
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (listeners.size === 1) {
    lastLive = getShareSession()?.shareId ?? null;
    timer = window.setInterval(recheck, RECHECK_MS);
    document.addEventListener('visibilitychange', recheck);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', recheck);
    }
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
