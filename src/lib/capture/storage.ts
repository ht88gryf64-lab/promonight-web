// Storage that cannot throw.
//
// Every access here is wrapped, because there are several ways for a browser to
// make storage explode and none of them are worth a broken team page. Safari
// private mode has historically thrown on setItem; some managed browsers throw
// on merely ACCESSING window.localStorage; quota can be exhausted; extensions
// disable it. A trigger engine that crashes a page is far worse than one that
// never fires, so the rule for this whole feature is: on any storage failure,
// suppress and move on.
//
// `available` is the signal the suppression check reads. It is false when the
// store could not even be reached, which is deliberately conservative: if we
// cannot read the dismissal flag or the subscribed flag, we do not know whether
// showing a prompt would be respecting the user's stated wishes, so we do not
// show one.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorage {
  readonly available: boolean;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

// ── Keys ────────────────────────────────────────────────────────────────────
// promonight:* to match the existing starred-teams keys
// (src/hooks/use-starred-teams.tsx). The repo has four naming conventions in
// play already; this feature adds no fifth.

/** localStorage. Epoch milliseconds of the last dismissal, as a string. */
export const KEY_DISMISSED_AT = 'promonight:capture_dismissed_at';

/**
 * localStorage. Set at submit time by Phase 2, read from Phase 1b onward.
 *
 * THIS IS NOT A SOURCE OF TRUTH ABOUT SUBSCRIPTION STATE, and must never be
 * treated as one. It is self-reported by the client, written at SUBMIT time and
 * therefore before the email is confirmed, so a record it vouches for may sit
 * pending forever. It does not survive a device change, a cleared browser, or a
 * different browser on the same machine. It says only "this browser once posted
 * an email", which is exactly enough to avoid nagging someone who already
 * signed up here, and nothing more. Anything that needs real subscription state
 * reads Firestore.
 */
export const KEY_SUBSCRIBED = 'promonight:subscribed';

/** localStorage. The A/B arm, assigned once and never reassigned. */
export const KEY_VARIANT = 'promonight:capture_variant';

/** sessionStorage. The per-session counter state, as JSON. */
export const KEY_SESSION = 'promonight:capture_session';

// ── Wrapper ─────────────────────────────────────────────────────────────────

const UNAVAILABLE: SafeStorage = {
  available: false,
  get: () => null,
  set: () => {},
  remove: () => {},
};

export function createSafeStorage(raw: StorageLike | null | undefined): SafeStorage {
  if (!raw) return UNAVAILABLE;

  // Prove it works before trusting it. A store that throws on write is not
  // usable for a feature whose whole job is remembering decisions, and the
  // probe is how a private-mode browser is detected without a UA sniff.
  try {
    const probe = '__pn_probe__';
    raw.setItem(probe, '1');
    raw.removeItem(probe);
  } catch {
    return UNAVAILABLE;
  }

  return {
    available: true,
    get(key) {
      try {
        return raw.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        raw.setItem(key, value);
      } catch {
        // Quota or a mid-session permission change. Nothing to do: the caller
        // degrades on the next read.
      }
    },
    remove(key) {
      try {
        raw.removeItem(key);
      } catch {
        // Same.
      }
    },
  };
}

/**
 * Reading window.localStorage can itself throw in some managed browsers, so
 * even the property access is guarded, not just the calls on it.
 */
export function browserStorage(kind: 'local' | 'session'): SafeStorage {
  if (typeof window === 'undefined') return UNAVAILABLE;
  try {
    return createSafeStorage(kind === 'local' ? window.localStorage : window.sessionStorage);
  } catch {
    return UNAVAILABLE;
  }
}
