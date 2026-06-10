'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Team } from '@/lib/types';
import { track } from '@/lib/analytics';
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
      const data: { ok?: boolean; error?: string } | null = await res
        .json()
        .catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      track('newsletter_signup', { surface, team_count: selected.length });
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  if (status === 'success') {
    return <SuccessCard email={email.trim()} count={selected.length} />;
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

function SuccessCard({ email, count }: { email: string; count: number }) {
  return (
    <div className="rounded-2xl border border-rd-line bg-rd-card p-8 text-center">
      <div aria-hidden="true" className="text-4xl">
        ✉️
      </div>
      <h2 className="rd-display mt-3 text-2xl uppercase text-rd-ink">
        You&apos;re almost in
      </h2>
      <p className="mx-auto mt-2 max-w-md font-rd text-rd-ink-soft">
        We just sent a confirmation link to <strong>{email}</strong>. Tap it to
        start getting{' '}
        {count > 0 ? 'your personalized' : 'the weekly'} promo email.
      </p>
      <p className="mx-auto mt-4 max-w-md font-rd text-[12px] text-rd-ink-faint">
        Didn&apos;t get it? Check spam, or it may take a minute to arrive.
      </p>
    </div>
  );
}
