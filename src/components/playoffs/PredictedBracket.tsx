'use client';

import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type SyntheticEvent } from 'react';
import { track } from '@/lib/analytics';
import type { PickOutcome, PickRoundView, PickSeriesView, PickSideView } from '@/lib/postseason/predictions';
import { useBracketControls } from './controls';
import { CONDENSED } from './ui';

// The computer's bracket, with its own controls.
//
// IT NEVER MOVES. Every card is the locked pick for its slot, whatever the
// real bracket did since. What changes is the mark on it: correct, busted or
// alive, and a dimmed card for a matchup that can no longer happen.
//
// ITS CONTROLS ARE THE REAL BRACKET'S STATE. The pills and the toggle here
// read and write the same BracketControlsProvider as the real bracket's, so
// pressing either set moves both. A swipe here moves the shared round too,
// and the real bracket's row follows it.
//
// WHAT IT RECEIVES. A PickRoundView list and nothing else: names, seeds, the
// pick, its chance, its length, the coin flip, the mark. No series key and
// no fingerprint has a field on those types, so neither can be serialized
// into this component's props.
//
// PROGRESSIVE ENHANCEMENT. Every round and every pick is in the server HTML.
// Each card is a <details>: it opens with no script at all. With scripts off
// the no-script rule shows both conferences and removes the controls.

const SURFACE = 'web_playoffs_league' as const;
const PILL =
  'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red';
const ON = 'border-rd-ink bg-rd-ink text-white';
const OFF = 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink';

function motion(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

const OUTCOME: Record<PickOutcome, { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'bg-[#1f7a3d] text-white' },
  busted: { label: 'Busted', className: 'bg-rd-ink text-white' },
  alive: { label: 'Alive', className: 'border border-rd-line-strong bg-rd-card text-rd-ink-soft' },
};

export function OutcomeBadge({ outcome }: { outcome: PickOutcome }) {
  const o = OUTCOME[outcome];
  return (
    <span
      data-outcome-badge={outcome}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] ${o.className}`}
    >
      {o.label}
    </span>
  );
}

function Side({ side, busted }: { side: PickSideView; busted: boolean }) {
  return (
    <span data-pick-side={side.picked ? 'pick' : 'other'} className="flex items-center gap-2.5 px-2.5 py-1.5">
      <span className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded border border-rd-line bg-rd-cream px-1 text-[12px] font-semibold tabular-nums text-rd-ink-soft">
        <span className="sr-only">Seed </span>
        {side.seed}
      </span>
      <span aria-hidden className="h-5 w-[4px] shrink-0 rounded-sm" style={{ background: side.color }} />
      <span
        className={`min-w-0 flex-1 truncate text-[19px] uppercase leading-tight tracking-[0.02em] ${
          side.picked ? `font-extrabold text-rd-ink ${busted ? 'line-through decoration-2' : ''}` : 'font-semibold text-rd-ink-soft'
        }`}
        style={{ fontFamily: CONDENSED }}
      >
        {side.label}
      </span>
      {side.picked && (
        <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rd-red">
          Pick
        </span>
      )}
    </span>
  );
}

function PickCard({ s, onOpen }: { s: PickSeriesView; onOpen: (s: PickSeriesView) => void }) {
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) onOpen(s);
  };
  const busted = s.outcome === 'busted';
  return (
    <details
      id={s.id}
      onToggle={onToggle}
      className={`group overflow-hidden rounded-[10px] border border-rd-line bg-rd-card shadow-sm open:border-rd-red ${s.dimmed ? 'opacity-55' : ''}`}
    >
      <summary className="block cursor-pointer list-none px-1.5 pb-3 pt-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2 px-2.5 pb-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-rd-ink-faint">{s.formatLabel}</span>
          <OutcomeBadge outcome={s.outcome} />
        </span>
        <span className="block space-y-1">
          <Side side={s.higher} busted={busted} />
          <Side side={s.lower} busted={busted} />
        </span>
        <span className="mt-2 block px-2.5 text-[14px] font-semibold text-rd-ink">
          {s.pickLabel} {s.lengthLabel} · {s.chanceLabel}
        </span>
        {s.dimmed && <span className="mt-0.5 block px-2.5 text-[12.5px] text-rd-ink-soft">{s.decided ? 'Did not happen' : 'Can no longer happen'}</span>}
      </summary>
      <div data-pick-detail className="space-y-1 border-t border-rd-line px-4 py-3 text-[13.5px] leading-relaxed text-rd-ink-soft">
        <p>
          <span className="font-semibold text-rd-ink">PromoNight&apos;s pick:</span> {s.pickName} {s.lengthLabel}
          {s.coinFlip ? ', a coin flip at lock.' : `, ${s.chanceLabel} at lock.`}
        </p>
        <p>
          <span className="font-semibold text-rd-ink">Result:</span> {s.resultLine ? `${s.resultLine}.` : 'Not decided yet.'}
        </p>
        {s.note && <p>{s.note}</p>}
      </div>
    </details>
  );
}

export function PredictedBracket({
  league,
  leagueSlug,
  season,
  rounds,
}: {
  league: string;
  leagueSlug: string;
  season: number;
  rounds: readonly PickRoundView[];
}) {
  const { round, roundCause, conference, setRound, setConference } = useBracketControls();
  const scroller = useRef<HTMLDivElement>(null);
  const steering = useRef(0);
  // See the same ref in BracketExplorer: a swipe here is already where it is.
  const ownSwipe = useRef<string | null>(null);

  const conferences = useMemo(() => {
    const out: string[] = [];
    for (const r of rounds) for (const g of r.groups) if (g.conference !== null && !out.includes(g.conference)) out.push(g.conference);
    return out;
  }, [rounds]);
  const selected = rounds.find((r) => r.key === round) ?? rounds[0];
  const roundIsSplit = selected.groups.filter((g) => g.conference !== null).length > 1;
  const roundLabel = (r: PickRoundView) => r.shortLabel ?? r.label;
  const base = { surface: SURFACE, league: leagueSlug, season };

  useEffect(() => {
    const own = roundCause === 'swipe' && ownSwipe.current === round;
    ownSwipe.current = null;
    if (own || (roundCause === 'initial' && round === rounds[0].key)) return;
    const box = scroller.current;
    const col = box?.querySelector<HTMLElement>(`[data-pick-round="${round}"]`);
    if (!box || !col || box.scrollWidth <= box.clientWidth) return;
    const left = col.offsetLeft - box.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft || '0');
    steering.current = Date.now() + 700;
    box.scrollTo({ left, behavior: roundCause === 'pill' ? motion() : 'auto' });
  }, [round, roundCause, rounds]);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (Date.now() < steering.current || box.scrollWidth <= box.clientWidth) return;
      const pad = parseFloat(getComputedStyle(box).paddingLeft || '0');
      let best: { key: string; gap: number } | null = null;
      for (const col of box.querySelectorAll<HTMLElement>('[data-pick-round]')) {
        const gap = Math.abs(col.offsetLeft - box.offsetLeft - pad - box.scrollLeft);
        if (!best || gap < best.gap) best = { key: col.dataset.pickRound as string, gap };
      }
      if (best && best.key !== round) {
        ownSwipe.current = best.key;
        setRound(best.key, 'swipe');
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      box.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [round, setRound]);

  const pickRound = useCallback(
    (r: PickRoundView) => {
      setRound(r.key, 'pill');
      const split = r.groups.filter((g) => g.conference !== null).length > 1;
      track('predictions_round_select', { ...base, round_key: r.key, conference: split ? conference : null, control: 'round_pill' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conference, leagueSlug, season, setRound],
  );

  const pickConference = useCallback(
    (c: string) => {
      setConference(c);
      track('predictions_round_select', { ...base, round_key: round, conference: c, control: 'conference_toggle' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, leagueSlug, season, setConference],
  );

  const onOpen = useCallback(
    (s: PickSeriesView) => {
      track('predictions_series_open', { ...base, round_key: s.round, series_id: s.seriesId, pick_outcome: s.outcome });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leagueSlug, season],
  );

  const columns = { '--po-rounds': rounds.length } as CSSProperties;

  return (
    <div
      className="po-picks mt-5"
      data-predicted-bracket={league}
      data-round={round}
      data-conference={conference ?? undefined}
    >
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: ".po-picks [data-conf][data-shown='false']{display:revert!important}.po-picks .po-controls{display:none!important}",
          }}
        />
      </noscript>

      {/* top-14: the site's brand bar is itself sticky and 56px tall. */}
      <div
        className="po-controls sticky top-14 z-10 -mx-4 px-4 pb-2.5 pt-3 lg:hidden"
        style={{ background: 'linear-gradient(var(--color-rd-cream) 88%, transparent)' }}
      >
        {conferences.length > 1 && roundIsSplit && (
          <div role="group" aria-label={conferences.join(' or ')} data-control="conference" className="mb-2.5 inline-flex rounded-full border border-rd-line-strong bg-rd-card p-0.5">
            {conferences.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === conference}
                data-conference-option={c}
                onClick={() => pickConference(c)}
                className={`rounded-full px-5 py-1.5 text-[14px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red ${
                  c === conference ? 'bg-rd-red text-white' : 'text-rd-ink-soft hover:text-rd-ink'
                }`}
                style={{ fontFamily: CONDENSED }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div role="group" aria-label="Round" data-control="round" className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {rounds.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={r.key === round}
              data-round-option={r.key}
              onClick={() => pickRound(r)}
              className={`${PILL} ${r.key === round ? ON : OFF}`}
            >
              {roundLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* RELATIVE IS LOAD-BEARING, as in BracketExplorer: the seeds carry
          screen-reader-only text, which must be clipped by this scroller and
          not by a box further up. */}
      <div
        ref={scroller}
        data-pick-rounds
        style={columns}
        className="relative -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--po-rounds),minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {rounds.map((r) => (
          <section
            key={r.key}
            aria-labelledby={`pick-round-${r.key}`}
            data-pick-round={r.key}
            data-current={r.key === round ? 'true' : undefined}
            className="flex w-[84%] shrink-0 snap-start flex-col sm:w-[58%] lg:w-auto"
          >
            <h3
              id={`pick-round-${r.key}`}
              className="border-b-2 border-rd-line pb-2 text-[20px] font-extrabold uppercase leading-none text-rd-ink"
              style={{ fontFamily: CONDENSED }}
            >
              {r.label}
            </h3>
            <div className="mt-3 flex flex-1 flex-col gap-4">
              {r.groups.map((g) => {
                const shown = g.conference === null || conference === null || g.conference === conference;
                return (
                  <div key={g.conference ?? 'all'} data-conf={g.conference ?? undefined} data-shown={shown ? 'true' : 'false'} className="lg:flex-1">
                    {g.conference && (
                      <h4 className="mb-2 text-[16px] font-bold uppercase tracking-[0.06em] text-rd-ink-soft" style={{ fontFamily: CONDENSED }}>
                        {g.conference}
                      </h4>
                    )}
                    <ul className="flex flex-col gap-2.5 lg:h-[calc(100%-2rem)] lg:justify-around">
                      {g.series.map((s) => (
                        <li
                          key={s.id}
                          data-pick={s.seriesId}
                          data-pick-outcome={s.outcome}
                          data-pick-decided={s.decided ? 'true' : 'false'}
                          data-dimmed={s.dimmed ? 'true' : 'false'}
                        >
                          <PickCard s={s} onOpen={onOpen} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
