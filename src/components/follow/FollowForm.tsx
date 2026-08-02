'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Team } from '@/lib/types';
import { track } from '@/lib/analytics';
import { resolveBrowserVariant } from '@/lib/capture/variant';
import type { CaptureSurface } from '@/lib/follow-surface';
import { TeamStarPicker } from './TeamStarPicker';

// Combined capture form: star teams (optional) + email, single submit. The
// team selection is the form's OWN state (a plain slug array), independent of
// the localStorage starred set used by the /my-teams feature. This selection
// is persisted server-side to the subscriber record, seeded only by entry
// context. Posts to /api/subscribe and dual-emits the funnel events through
// track().

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

// What /api/subscribe reports about the confirmation email.
export type ConfirmationOutcome = 'sent' | 'not_needed' | 'failed';

// Which success copy to render. A failed send is NOT an error state: the request
// succeeded and the record exists, so it is a variant of success.
export type SuccessVariant = 'confident' | 'failed' | 'already_subscribed';

/**
 * Pick the success copy from what the API reported.
 *
 * 'not_needed' splits on status, which the response already carries:
 *   pending   a suppressed re-submit. A link was delivered for the token the
 *             record still holds (both suppressors now require that), so it is
 *             live and usable and the confident copy is true.
 *   confirmed nothing was sent and nothing needs to be. Promising a link here
 *             is false in every clause, which is what this split fixes.
 *
 * An unknown or missing value falls back to 'confident', which is exactly
 * today's behavior, so a client running against an older deploy degrades to what
 * it did before rather than to a wrong failure message.
 */
export function successVariant(
  confirmation: ConfirmationOutcome | undefined,
  status: string | undefined,
): SuccessVariant {
  if (confirmation === 'failed') return 'failed';
  if (confirmation === 'not_needed' && status === 'confirmed') return 'already_subscribed';
  return 'confident';
}

interface FollowFormProps {
  teams: Team[];
  // Slug pre-starred from entry context (team-page CTA). null for hub/homepage.
  initialTeam: string | null;
  surface: CaptureSurface;
  // Ordered "near you" team slugs from server-side geo. Floated to the top of
  // the picker and used to tag the teams_starred event. Empty = no geo group.
  nearTeamIds: string[];
}

export function FollowForm({ teams, initialTeam, surface, nearTeamIds }: FollowFormProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    initialTeam && teams.some((t) => t.id === initialTeam) ? [initialTeam] : [],
  );
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [variant, setVariant] = useState<SuccessVariant>('confident');
  const [errorMsg, setErrorMsg] = useState('');

  // Membership lookup for the geo "near you" set, so a star can be tagged with
  // whether geo proximity surfaced the team.
  const nearSet = new Set(nearTeamIds);

  // follow_page_view fires once on mount, carrying how many teams entry context
  // pre-selected. Ref guard so React strict-mode's double-mount doesn't double
  // count.
  const firedView = useRef(false);
  useEffect(() => {
    if (firedView.current) return;
    firedView.current = true;
    track('follow_page_view', {
      surface,
      seeded_team_count: selected.length,
    });
    // selected is intentionally read once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute the next set OUTSIDE setState so the analytics side effect isn't
  // double-invoked under strict mode. Fire teams_starred only on an add (the
  // funnel signal is "user engaged with team selection"), with the new count.
  const toggle = (slug: string) => {
    const isOn = selected.includes(slug);
    const next = isOn ? selected.filter((s) => s !== slug) : [...selected, slug];
    setSelected(next);
    if (!isOn) {
      track('teams_starred', {
        surface,
        team_count: next.length,
        near_you: nearSet.has(slug),
      });
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Enter a valid email address.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, teams: selected, source: surface }),
      });
      const data: {
        ok?: boolean;
        error?: string;
        status?: string;
        confirmation?: ConfirmationOutcome;
      } | null = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      track('newsletter_signup', {
        surface,
        team_count: selected.length,
        // Called inline rather than bound to a local. This component already has
        // a `variant` in scope for the success copy (SuccessVariant), and a
        // second one under the same name would shadow it for the next reader.
        variant: resolveBrowserVariant(),
      });
      setVariant(successVariant(data.confirmation, data.status));
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return <SuccessCard email={email.trim()} count={selected.length} variant={variant} />;
  }

  const submitLabel =
    status === 'submitting'
      ? 'Signing you up…'
      : selected.length > 0
        ? `Get alerts for ${selected.length} team${selected.length > 1 ? 's' : ''}`
        : 'Get the weekly promo email';

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-rd-line bg-rd-card p-5 md:p-6">
      {/* Step 1: teams */}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-rd text-[11px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">
          Star your teams · optional
        </span>
        <span className="font-rd text-[11px] text-rd-ink-soft">
          {selected.length} selected
        </span>
      </div>

      <div className="mb-5">
        <TeamStarPicker
          teams={teams}
          selected={selected}
          onToggle={toggle}
          nearTeamIds={nearTeamIds}
        />
      </div>

      {/* Step 2: email */}
      <label
        htmlFor="follow-email"
        className="mb-2 block font-rd text-[11px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint"
      >
        Your email
      </label>
      <input
        id="follow-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === 'error') setStatus('idle');
        }}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-rd-line-strong bg-white px-4 py-3 font-rd text-rd-ink placeholder:text-rd-ink-faint focus:border-rd-red focus:outline-none focus:ring-2 focus:ring-rd-red/20"
      />

      {status === 'error' && (
        <p className="mt-2 font-rd text-[13px] text-rd-red" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-rd-red px-6 py-3.5 font-rd text-base font-semibold text-white transition-colors hover:bg-rd-red-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>

      <p className="mt-3 text-center font-rd text-[12px] leading-relaxed text-rd-ink-faint">
        One email a week. No spam, unsubscribe anytime. By signing up you agree
        to our{' '}
        <a href="/privacy" className="underline hover:text-rd-ink">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}

function SuccessCard({
  email,
  count,
  variant,
}: {
  email: string;
  count: number;
  variant: SuccessVariant;
}) {
  const shell = (children: React.ReactNode) => (
    <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
      <div aria-hidden="true" className="text-4xl">
        ✉️
      </div>
      {children}
    </div>
  );

  if (variant === 'already_subscribed') {
    // Nothing was sent and nothing needs to be. Deliberately says nothing about
    // whether teams changed, because the merge may or may not have grown and
    // this card does not know which. Both sentences are true either way.
    return shell(
      <>
        <h2 className="rd-display mt-3 text-2xl uppercase text-rd-ink">
          You&apos;re already subscribed
        </h2>
        <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
          We&apos;ve got your teams saved. Your next{' '}
          {count > 0 ? 'personalized' : 'weekly'} promo email is on its way as usual.
        </p>
      </>,
    );
  }

  if (variant === 'failed') {
    // The send did not go out. Naming the retry is only honest because a failed
    // send leaves the delivery marker unset, so a resubmit genuinely re-sends
    // rather than being swallowed by the resend cooldown.
    //
    // DO NOT "improve" this toward a more precise statement of what went wrong.
    // "We could not confirm your link went out" is more literally accurate and
    // produces worse outcomes. The dominant failure here is an 8s abort, and an
    // abort can happen AFTER Resend accepted the message, in which case the
    // email is already on its way. Copy that reads as failure pushes the visitor
    // into an immediate retry, and an immediate retry rotates the token and
    // kills the link that was about to land, so they end up with two emails and
    // a dead one. This wording steers them to wait first and retry only if
    // nothing arrives, which resolves cleanly whichever way the abort went.
    // Accuracy about our internal state is worth less than steering the visitor
    // into the sequence that works.
    return shell(
      <>
        <h2 className="rd-display mt-3 text-2xl uppercase text-rd-ink">
          You&apos;re almost in
        </h2>
        <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
          Your confirmation link for <strong>{email}</strong> may take a minute to
          arrive. If it does not, submit again and we will resend it.
        </p>
        <p className="mx-auto mt-4 max-w-md font-rd text-[12px] text-rd-ink-faint">
          Check your spam folder too.
        </p>
      </>,
    );
  }

  // Confident: a link is live and usable, either sent on this request or already
  // delivered for the token this record still holds. "We sent", not "we just
  // sent", because on the suppressed path it went out earlier rather than now.
  return shell(
    <>
      <h2 className="rd-display mt-3 text-2xl uppercase text-rd-ink">
        You&apos;re almost in
      </h2>
      <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
        We sent a confirmation link to <strong>{email}</strong>. Tap it to start
        getting {count > 0 ? 'your personalized' : 'the weekly'} promo email.
      </p>
      <p className="mx-auto mt-4 max-w-md font-rd text-[12px] text-rd-ink-faint">
        Didn&apos;t get it? Check spam, or it may take a minute to arrive.
      </p>
    </>,
  );
}
