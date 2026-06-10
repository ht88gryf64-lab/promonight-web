'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SPORT_ICONS } from '@/lib/types';
import { track } from '@/lib/analytics';
import type { CaptureSurface } from '@/lib/follow-surface';
import { StarIcon } from '@/components/star-icon';

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
}

export function FollowForm({ teams, initialTeam, surface }: FollowFormProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    initialTeam && teams.some((t) => t.id === initialTeam) ? [initialTeam] : [],
  );
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (t: Team) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.league.toLowerCase().includes(q) ||
      t.abbreviation.toLowerCase().includes(q);
    return LEAGUE_ORDER.map((league) => ({
      league,
      teams: teams.filter((t) => t.league === league && matches(t)),
    })).filter((g) => g.teams.length > 0);
  }, [teams, query]);

  // Compute the next set OUTSIDE setState so the analytics side effect isn't
  // double-invoked under strict mode. Fire teams_starred only on an add (the
  // funnel signal is "user engaged with team selection"), with the new count.
  const toggle = (slug: string) => {
    const isOn = selected.includes(slug);
    const next = isOn ? selected.filter((s) => s !== slug) : [...selected, slug];
    setSelected(next);
    if (!isOn) {
      track('teams_starred', { surface, team_count: next.length });
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

      <label className="sr-only" htmlFor="team-search">
        Search teams
      </label>
      <input
        id="team-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search 167 teams…"
        autoComplete="off"
        className="mb-3 w-full rounded-xl border border-rd-line-strong bg-rd-cream px-4 py-2.5 font-rd text-sm text-rd-ink placeholder:text-rd-ink-faint focus:border-rd-ink focus:outline-none"
      />

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((slug) => {
            const t = teamById.get(slug);
            if (!t) return null;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggle(slug)}
                aria-label={`Remove ${t.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-rd-line-strong bg-rd-cream px-2.5 py-1 font-rd text-[12px] font-semibold text-rd-ink transition-colors hover:border-rd-ink"
              >
                <span aria-hidden="true">{SPORT_ICONS[t.league]}</span>
                {t.name}
                <span aria-hidden="true" className="text-rd-ink-faint">
                  ✕
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-5 max-h-72 overflow-y-auto rounded-xl border border-rd-line bg-rd-cream/40 p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center font-rd text-sm text-rd-ink-soft">
            No teams match “{query.trim()}”.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.league} className="mb-2 last:mb-0">
              <div className="px-2 py-1 font-rd text-[10px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
                {SPORT_ICONS[group.league]} {group.league}
              </div>
              <div className="space-y-1">
                {group.teams.map((t) => {
                  const on = selected.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        on
                          ? 'border-rd-red bg-rd-red/5'
                          : 'border-transparent bg-rd-card hover:border-rd-line-strong'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-7 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-rd text-sm font-bold text-rd-ink">
                          {t.city} {t.name}
                        </span>
                        <span className="block font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">
                          {t.abbreviation}
                        </span>
                      </span>
                      <StarIcon filled={on} size={20} surface="light" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
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
