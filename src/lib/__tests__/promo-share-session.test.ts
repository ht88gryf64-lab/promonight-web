// Promo page sharing: the share session's lifetime (Gate B F3) and the
// blocked-storage fallback (Gate B F4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Static import is safe: the module reads window only when called.
import { SHARE_SESSION_IDLE_MS, SHARE_SESSION_MAX_MS, getShareSession, setShareSession, shareSessionLive } from '../promo-share-session';

const store = new Map<string, string>();
let blocked = false;
const storage = {
  getItem: (k: string) => {
    if (blocked) throw new Error('blocked');
    return store.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (blocked) throw new Error('blocked');
    store.set(k, v);
  },
  removeItem: (k: string) => {
    if (blocked) throw new Error('blocked');
    store.delete(k);
  },
};
let phSession: string | null = null;
(globalThis as any).window = {
  sessionStorage: storage,
  localStorage: storage,
  setInterval: () => 0,
  clearInterval: () => {},
  get posthog() {
    return phSession ? { get_session_id: () => phSession } : undefined;
  },
};
(globalThis as any).document = { addEventListener() {}, removeEventListener() {} };


const base = { shareId: 'ab12cd34', channel: 'copy' as const, promoId: 'p1', selfOpen: false };

test('the share session ends with the PostHog session it landed in; 30 minutes without one; 24 hours at most', () => {
  const at = 1_800_000_000_000;
  assert.equal(shareSessionLive({ at, sid: 's1' }, at + 5 * 3600_000, 's1'), true, 'same PostHog session hours later: live');
  assert.equal(shareSessionLive({ at, sid: 's1' }, at + 60_000, 's2'), false, 'PostHog moved on: over');
  assert.equal(shareSessionLive({ at, sid: '' }, at + SHARE_SESSION_IDLE_MS - 1, null), true);
  assert.equal(shareSessionLive({ at, sid: '' }, at + SHARE_SESSION_IDLE_MS + 1, null), false, 'no PostHog: 30 minutes');
  assert.equal(shareSessionLive({ at, sid: 's1' }, at + SHARE_SESSION_MAX_MS + 1, 's1'), false, 'hard cap');
});

test('a stored session is dropped on read once its PostHog session is over', () => {
  blocked = false;
  phSession = 's1';
  setShareSession({ ...base, at: Date.now(), sid: 's1' });
  assert.equal(getShareSession()?.shareId, 'ab12cd34');
  phSession = 's2';
  assert.equal(getShareSession(), null);
  assert.equal(store.get('pn_share_session'), undefined, 'cleared from storage');
});

test('with storage blocked the session still holds for the page', () => {
  blocked = true;
  phSession = null;
  setShareSession({ ...base, at: Date.now(), sid: '' });
  assert.equal(getShareSession()?.shareId, 'ab12cd34');
  blocked = false;
});
