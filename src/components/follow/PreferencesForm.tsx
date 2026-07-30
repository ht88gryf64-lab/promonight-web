'use client';

import { useMemo, useState } from 'react';
import type { Team } from '@/lib/types';
import { useStarredTeams } from '@/hooks/use-starred-teams';
import { TeamStarPicker } from './TeamStarPicker';

// Token-authenticated team management. The save REPLACES the teams array with
// exactly the current selection (removals persist; zero teams reverts to the
// generic list), distinct from the capture form's merge. Unsubscribe is a
// two-step inline confirm that POSTs to /api/unsubscribe.

interface PreferencesFormProps {
  teams: Team[];
  token: string;
  initialTeams: string[];
  email: string;
  // True when arriving from the email's unsubscribe link (?unsub=1): opens the
  // unsubscribe confirm immediately so a single human click completes it.
  autoConfirmUnsub?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface PickerSelection {
  selected: string[];
  // True only when the local stars actually contributed a team the record did
  // not already hold. Silent otherwise, which is the common case: explaining an
  // event that did not happen is its own small lie.
  showDeviceNote: boolean;
}

/**
 * Resolve what the picker shows, from the record, the local stars and any edit
 * the user has already made. Pure so it is testable without a render harness
 * (see docs/known-issues.md entry 6).
 *
 * Precedence: a user edit wins over everything, always. `edited` being non-null
 * is the only condition, so it does not matter whether the edit arrived before
 * or after hydration, nor whether a cross-tab write changed `starred`
 * afterwards. That matters because `starred` is NOT write-once: the provider
 * re-reads it on any `storage` event (src/hooks/use-starred-teams.tsx:108-128),
 * so an effect-based seed could wipe an in-progress edit mid-session. Deriving
 * instead of seeding makes that impossible by construction rather than by
 * timing.
 *
 * HAZARD, and why the isHydrated branch is written this way: useStarredTeams
 * starts at `[]` with isHydrated false and reads localStorage in a mount effect
 * (use-starred-teams.tsx:89-90, 101-106). Unioning during that window would read
 * `[]` on EVERY device, including the one holding the stars. Falling back to
 * initialTeams instead means the picker never displays fewer teams than the
 * record holds, at any point in the page's life. That is the whole guard: Save
 * REPLACES the teams array, so a picker that renders a shrunken set for even one
 * frame is a set the user can commit and lose data to.
 *
 * Asymmetric filtering, deliberate: additions from localStorage are restricted
 * to teams the picker can actually render, but `initialTeams` is passed through
 * untouched. Filtering additions keeps "what you see checked" equal to "what
 * Save sends". Filtering initialTeams would silently drop a slug the record
 * holds but the current team list does not, and Save would then delete it.
 * Never shrink the record's own set.
 */
export function resolvePickerSelection(args: {
  initialTeams: string[];
  starred: string[];
  knownTeamIds: ReadonlySet<string>;
  isHydrated: boolean;
  edited: string[] | null;
}): PickerSelection {
  const { initialTeams, starred, knownTeamIds, isHydrated, edited } = args;

  if (edited !== null) return { selected: edited, showDeviceNote: false };
  if (!isHydrated) return { selected: initialTeams, showDeviceNote: false };

  const have = new Set(initialTeams);
  const additions = starred.filter((slug) => !have.has(slug) && knownTeamIds.has(slug));
  if (additions.length === 0) return { selected: initialTeams, showDeviceNote: false };

  // Record's own teams first, additions appended, matching the merge order the
  // capture path already uses in sanitizeTeams.
  return { selected: [...initialTeams, ...additions], showDeviceNote: true };
}

export function PreferencesForm({
  teams,
  token,
  initialTeams,
  email,
  autoConfirmUnsub = false,
}: PreferencesFormProps) {
  // null until the user touches the picker. Once set it wins permanently, so no
  // later hydration or cross-tab write can overwrite an edit in progress.
  const [edited, setEdited] = useState<string[] | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [confirmingUnsub, setConfirmingUnsub] = useState(autoConfirmUnsub);
  const [unsubscribed, setUnsubscribed] = useState(false);

  const { starred, isHydrated } = useStarredTeams();
  const knownTeamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);

  const { selected, showDeviceNote } = resolvePickerSelection({
    initialTeams,
    starred,
    knownTeamIds,
    isHydrated,
    edited,
  });

  const toggle = (slug: string) => {
    // Computed from the DISPLAYED selection, not from `edited`, which is null
    // until the first toggle. Reading `edited` here would toggle against null.
    setEdited(
      selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug],
    );
    if (status === 'saved') setStatus('idle');
  };

  const save = async () => {
    if (status === 'saving') return;
    setStatus('saving');
    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, teams: selected }),
      });
      const data: { ok?: boolean } | null = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const unsubscribe = async () => {
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error();
      setUnsubscribed(true);
    } catch {
      setConfirmingUnsub(false);
    }
  };

  if (unsubscribed) {
    return (
      <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
        <h2 className="rd-display text-2xl uppercase text-rd-ink">You&apos;re unsubscribed</h2>
        <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
          {email} will no longer receive PromoNight emails. Changed your mind?{' '}
          <a href="/follow" className="font-semibold text-rd-red underline">
            Re-subscribe
          </a>
          .
        </p>
      </div>
    );
  }

  const saveLabel =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save changes';

  return (
    <div className="rounded-2xl border border-rd-line bg-rd-card p-5 md:p-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">
          Your teams
        </span>
        <span className="font-rd text-[11px] text-rd-ink-soft">{selected.length} selected</span>
      </div>

      {showDeviceNote && (
        <p className="mb-2 font-rd text-[12px] text-rd-ink-faint">
          Includes teams you follow on this device.
        </p>
      )}
      <TeamStarPicker teams={teams} selected={selected} onToggle={toggle} />

      {selected.length === 0 && (
        <p className="mt-3 font-rd text-[13px] leading-relaxed text-rd-ink-soft">
          No teams selected. You&apos;ll get the general weekly roundup. Star one or
          more teams to switch to a personalized digest.
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={status === 'saving'}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-rd-red px-6 py-3.5 font-rd text-base font-semibold text-white transition-colors hover:bg-rd-red-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveLabel}
      </button>

      {status === 'error' && (
        <p className="mt-2 text-center font-rd text-[13px] text-rd-red" role="alert">
          Could not save. Please try again.
        </p>
      )}

      {/* Announce save progress/success to assistive tech (the button label
          change alone is not reliably re-read). Always present so AT picks up
          the text change. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'saving'
          ? 'Saving your teams'
          : status === 'saved'
            ? 'Your teams were saved'
            : ''}
      </p>

      <div className="mt-6 border-t border-rd-line pt-5 text-center">
        {confirmingUnsub ? (
          <div
            className="flex flex-col items-center gap-2"
            role="group"
            aria-label="Confirm unsubscribe"
          >
            <p className="font-rd text-[13px] text-rd-ink-soft" role="alert">
              Unsubscribe {email} from all PromoNight emails?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={unsubscribe}
                className="rounded-lg border border-rd-red px-4 py-2 font-rd text-[13px] font-semibold text-rd-red transition-colors hover:bg-rd-red/5"
              >
                Yes, unsubscribe
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingUnsub(false)}
                className="rounded-lg border border-rd-line-strong px-4 py-2 font-rd text-[13px] font-semibold text-rd-ink-soft transition-colors hover:border-rd-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingUnsub(true)}
            className="font-rd text-[12px] text-rd-ink-faint underline transition-colors hover:text-rd-ink"
          >
            Unsubscribe from all emails
          </button>
        )}
      </div>
    </div>
  );
}
