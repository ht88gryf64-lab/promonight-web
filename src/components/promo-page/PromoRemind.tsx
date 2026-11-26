'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import { resolveBrowserVariant } from '@/lib/capture/variant';
import { successVariant, type ConfirmationOutcome } from '@/lib/subscribe-outcome';
import { remindSuccessCopy, REMIND_SURFACE, type RemindMode, type ReminderAnswer } from '@/lib/promo-remind-copy';

// The promo page's inline email block (Gate 1 rulings, 2026-11-26): one email
// input and one button, inside the article's CTA section, never a modal. The
// heading and the subline are server-rendered by the view; this client leaf is
// the form, the consent line and the result.
//
// TWO MODES, chosen by the server at render:
//   reminder  a day-before email for this promo, plus the weekly team email.
//   weekly    the weekly team email only (a played game, or too late for a
//             day-before email).
// The page is cached for up to a day, so the mode it rendered can be stale.
// /api/subscribe decides again from the stored promo and says what happened
// (`reminder`), and THE SUCCESS COPY FOLLOWS THAT ANSWER, never the mode.
//
// ONLY STRINGS CROSS IN (CLAUDE.md: every prop of a client component is
// published in the flight payload): ids, the team's name, the league.
//
// The address is never echoed back into the page and the input is
// ph-no-capture, so it reaches no analytics event and no session replay.

export interface PromoRemindProps {
  mode: RemindMode;
  teamId: string;
  teamName: string;
  league: string;
  /** The page's primary promo: the reminder's target, and promo_id on events. */
  promoId: string;
  consent: string;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const ERRORS = {
  invalid_email: 'Enter a valid email address.',
  rate_limited: 'Too many tries from this connection. Wait a few minutes and try again.',
  failed: 'That did not go through. Try again.',
} as const;

export function PromoRemind({ mode, teamId, teamName, league, promoId, consent }: PromoRemindProps) {
  const inputId = useId();
  const noteId = useId();
  const focused = useRef(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const [success, setSuccess] = useState('');

  const eventProps = { surface: REMIND_SURFACE, promo_id: promoId, team_id: teamId, league } as const;

  // Once per page view, on the first focus (ruling 9): the funnel's entry
  // step for this surface.
  const onFocus = () => {
    if (focused.current) return;
    focused.current = true;
    track('email_cta_click', { ...eventProps, team_slug: teamId, variant: resolveBrowserVariant() });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('invalid_email');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setError(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          teams: [teamId],
          source: REMIND_SURFACE,
          ...(mode === 'reminder' ? { reminder: { teamId, promoId } } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        status?: string;
        team_count?: number;
        confirmation?: ConfirmationOutcome;
        reminder?: ReminderAnswer;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(res.status === 429 ? 'rate_limited' : data?.error === 'invalid_email' ? 'invalid_email' : 'failed');
        setStatus('error');
        return;
      }
      const reminder: ReminderAnswer = data.reminder ?? 'none';
      track('newsletter_signup', {
        ...eventProps,
        team_count: typeof data.team_count === 'number' ? data.team_count : 1,
        variant: resolveBrowserVariant(),
        reminder,
      });
      setSuccess(remindSuccessCopy({ mode, reminder, outcome: successVariant(data.confirmation, data.status), teamName }));
      setStatus('success');
    } catch {
      setError('failed');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p role="status" data-remind-result="" className="m-0 text-[15px] leading-[1.5] text-rd-ink">
        {success}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        {/* 16px text: a smaller size makes iOS Safari zoom the page on focus. */}
        <input
          id={inputId}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@example.com"
          value={email}
          aria-describedby={noteId}
          aria-invalid={status === 'error' && error === 'invalid_email' ? true : undefined}
          onFocus={onFocus}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') {
              setStatus('idle');
              setError(null);
            }
          }}
          className="ph-no-capture h-12 min-w-0 flex-1 rounded-xl border border-rd-line-strong bg-rd-card px-3 font-rd text-[16px] text-rd-ink placeholder:text-rd-ink-faint focus:border-rd-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pp-accent-text)]"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="h-12 shrink-0 rounded-xl bg-[var(--pp-accent)] px-4 font-rd text-[15px] font-semibold text-[var(--pp-accent-ink)] hover:brightness-95 disabled:opacity-70"
        >
          {status === 'submitting' ? 'Sending' : mode === 'reminder' ? 'Remind me' : 'Sign up'}
        </button>
      </div>
      {status === 'error' && error ? (
        <p role="alert" className="m-0 font-rd text-[13px] text-rd-link">
          {ERRORS[error]}
        </p>
      ) : null}
      <p id={noteId} className="m-0 font-rd text-[12px] leading-[1.45] text-rd-ink-faint">
        {consent}
      </p>
    </form>
  );
}
