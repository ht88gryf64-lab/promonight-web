'use client';

import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { track } from '@/lib/analytics';
import type { RoundView, SeriesView } from '@/lib/postseason/view';
import { useBracketControls } from './controls';
import { SeriesCardBody } from './SeriesCard';
import { SeriesPanel } from './SeriesPanel';
import { CONDENSED } from './ui';
import { whenSinksReady } from './when-sinks-ready';

// The bracket, with its controls.
//
// PROGRESSIVE ENHANCEMENT. Everything a reader can reach with the controls is
// in the server HTML: every round, every series of both conferences, every
// series' games. The controls only decide what is displayed and where the
// row of rounds is scrolled to.
//   - Rounds sit side by side in a row that scrolls and snaps on its own,
//     with no script. A pill scrolls it for you.
//   - A series card is a link to its own detail (#wild_card-2). With no
//     script the browser follows it and CSS :target shows the detail. With
//     script the click is handled here and the fragment is kept in step.
//   - With scripts off, the no-script rule below shows both conferences and
//     removes the buttons that cannot work.
// At desktop width the whole bracket shows at once and the controls are
// hidden: there is nothing left for them to choose between.

const SURFACE = 'web_playoffs_league' as const;
const PILL =
  'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red';
const ON = 'border-rd-ink bg-rd-ink text-white';
const OFF = 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink';

function motion(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function BracketExplorer({
  league,
  leagueSlug,
  season,
  rounds,
  panelTickets,
}: {
  league: string;
  leagueSlug: string;
  season: number;
  rounds: readonly RoundView[];
  /** Ticket blocks by series id, rendered on the server. */
  panelTickets: Readonly<Record<string, ReactNode>>;
}) {
  const { round, roundCause, conference, openId, openCause, hydrated, setRound, setConference, setOpen } = useBracketControls();
  const scroller = useRef<HTMLDivElement>(null);
  // While a pill's own scroll is running, the scroll listener must not read
  // the rounds it passes on the way as the reader's choice.
  const steering = useRef(0);
  // Sends still waiting on the analytics sinks. Stopped when the bracket
  // unmounts, and not before: a series opened by the link the reader arrived
  // on is still that, whatever they press while the sinks load.
  const waiting = useRef<(() => void)[]>([]);
  useEffect(
    () => () => {
      for (const cancel of waiting.current) cancel();
      waiting.current = [];
    },
    [],
  );

  const allSeries = useMemo<SeriesView[]>(() => rounds.flatMap((r) => r.groups.flatMap((g) => g.series)), [rounds]);
  const conferences = useMemo(() => {
    const out: string[] = [];
    for (const r of rounds) for (const g of r.groups) if (g.conference !== null && !out.includes(g.conference)) out.push(g.conference);
    return out;
  }, [rounds]);
  const selected = rounds.find((r) => r.key === round) ?? rounds[0];
  // The toggle has something to choose between only in a round that is
  // split by conference. The last round of a bracket is not.
  const roundIsSplit = selected.groups.filter((g) => g.conference !== null).length > 1;
  const roundLabel = (r: RoundView) => r.shortLabel ?? r.label;

  const base = { surface: SURFACE, league: leagueSlug, season };

  // Bring the chosen round to the left edge, when a pill or a link chose it.
  useEffect(() => {
    if (roundCause === 'swipe' || (roundCause === 'initial' && round === rounds[0].key)) return;
    const box = scroller.current;
    const col = box?.querySelector<HTMLElement>(`[data-round="${round}"]`);
    if (!box || !col || box.scrollWidth <= box.clientWidth) return;
    const left = col.offsetLeft - box.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft || '0');
    steering.current = Date.now() + 700;
    box.scrollTo({ left, behavior: roundCause === 'pill' ? motion() : 'auto' });
  }, [round, roundCause, rounds]);

  // Follow the reader's own swipe: the round nearest the left edge is the
  // round the pills show. No event is sent for it; nothing was pressed.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (Date.now() < steering.current || box.scrollWidth <= box.clientWidth) return;
      const pad = parseFloat(getComputedStyle(box).paddingLeft || '0');
      let best: { key: string; gap: number } | null = null;
      for (const col of box.querySelectorAll<HTMLElement>('[data-round]')) {
        const gap = Math.abs(col.offsetLeft - box.offsetLeft - pad - box.scrollLeft);
        if (!best || gap < best.gap) best = { key: col.dataset.round as string, gap };
      }
      if (best && best.key !== round) setRound(best.key, 'swipe');
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

  // When a series opens, take the reader to its detail. A link that named
  // the series has already been scrolled to by the browser.
  useEffect(() => {
    if (!openId) return;
    const panel = document.getElementById(openId);
    if (!panel) return;
    if (openCause === 'tap') {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest', behavior: motion() });
    }
    const s = allSeries.find((x) => x.id === openId);
    if (s) {
      const opened_by = openCause ?? 'tap';
      const send = () =>
        track('playoffs_series_open', { ...base, round_key: s.round, series_id: s.id, series_status: s.status, opened_by });
      // A tap comes long after both sinks are up. A link is read as the page
      // mounts, which can be before either is: see when-sinks-ready.ts.
      if (opened_by === 'tap') send();
      else waiting.current.push(whenSinksReady(send));
    }
    // One event for each opening, keyed on what was opened and how.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, openCause]);

  const pickRound = useCallback(
    (r: RoundView) => {
      setRound(r.key, 'pill');
      const split = r.groups.filter((g) => g.conference !== null).length > 1;
      track('playoffs_round_select', { ...base, round_key: r.key, conference: split ? conference : null, control: 'round_pill' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conference, leagueSlug, season, setRound],
  );

  const pickConference = useCallback(
    (c: string) => {
      setConference(c);
      track('playoffs_round_select', { ...base, round_key: round, conference: c, control: 'conference_toggle' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, leagueSlug, season, setConference],
  );

  const setFragment = (id: string | null) => {
    const url = `${window.location.pathname}${window.location.search}${id ? `#${id}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
  };

  const onSeries = (e: MouseEvent<HTMLAnchorElement>, s: SeriesView) => {
    // A modified click opens the link the way the reader asked: new tab, new
    // window. The plain click is ours.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (openId === s.id) {
      setOpen(null, 'tap');
      setFragment(null);
      return;
    }
    setOpen(s.id, 'tap');
    setFragment(s.id);
  };

  const close = (id: string) => {
    setOpen(null, 'tap');
    setFragment(null);
    scroller.current?.querySelector<HTMLElement>(`a[href="#${id}"]`)?.focus();
  };

  const columns = { '--po-rounds': rounds.length } as CSSProperties;

  return (
    <div
      className="po-bracket"
      data-bracket={league}
      data-round={round}
      data-conference={conference ?? undefined}
      data-hydrated={hydrated ? '' : undefined}
    >
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: ".po-bracket [data-conf][data-shown='false']{display:revert!important}.po-controls{display:none!important}",
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
        {/* relative: see the note on the rounds scroller below. */}
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

      {/* RELATIVE IS LOAD-BEARING. The cards hold screen-reader-only text,
          which is absolutely positioned. A scroller clips only what it is the
          containing block for; without `relative` those labels belong to a
          box further up, escape the clip, and sit at their column's offset in
          the DOCUMENT. The page then measures 956px wide on a 390px phone:
          it pans sideways, and the ad placer reads a tablet. */}
      <div
        ref={scroller}
        data-rounds
        style={columns}
        className="relative -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--po-rounds),minmax(0,1fr))] lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {rounds.map((r) => (
          <section
            key={r.key}
            aria-labelledby={`round-${r.key}`}
            data-round={r.key}
            data-current={r.key === round ? 'true' : undefined}
            className="flex w-[84%] shrink-0 snap-start flex-col sm:w-[58%] lg:w-auto"
          >
            <h2
              id={`round-${r.key}`}
              className="border-b-2 border-rd-line pb-2 text-[22px] font-extrabold uppercase leading-none text-rd-ink"
              style={{ fontFamily: CONDENSED }}
            >
              {r.label}
            </h2>
            <div className="mt-3 flex flex-1 flex-col gap-4">
              {r.groups.map((g) => {
                const shown = g.conference === null || conference === null || g.conference === conference;
                return (
                  <div
                    key={g.conference ?? 'all'}
                    data-conf={g.conference ?? undefined}
                    data-shown={shown ? 'true' : 'false'}
                    className="lg:flex-1"
                  >
                    {g.conference && (
                      <h3 className="mb-2 text-[16px] font-bold uppercase tracking-[0.06em] text-rd-ink-soft" style={{ fontFamily: CONDENSED }}>
                        {g.conference}
                      </h3>
                    )}
                    <ul className="flex flex-col gap-2.5 lg:h-[calc(100%-2rem)] lg:justify-around">
                      {g.series.map((s) => (
                        <li key={s.id} data-series={s.id} data-series-status={s.status}>
                          <a
                            href={`#${s.id}`}
                            aria-expanded={openId === s.id}
                            aria-controls={s.id}
                            onClick={(e) => onSeries(e, s)}
                            className={`block overflow-hidden rounded-[10px] border bg-rd-card shadow-sm transition-[border-color,box-shadow] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red ${
                              openId === s.id ? 'border-rd-red' : 'border-rd-line'
                            }`}
                          >
                            <span className="sr-only">
                              {s.roundLabel}: {s.higher.label} vs {s.lower.label}. Open the games.
                            </span>
                            <SeriesCardBody series={s} />
                          </a>
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

      <div data-series-panels className="mt-4 space-y-3">
        {allSeries.map((s) => (
          <SeriesPanel key={s.id} series={s} league={league} open={openId === s.id} tickets={panelTickets[s.id] ?? null} onClose={() => close(s.id)} />
        ))}
      </div>
    </div>
  );
}
