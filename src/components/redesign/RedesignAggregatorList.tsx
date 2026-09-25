'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { LEAGUE_ORDER } from '@/lib/types';
import { track, type AnalyticsSurface } from '@/lib/analytics';
import { teamDisplayName } from '@/lib/promo-helpers';
import { StarToggleInline } from '@/components/star-toggle';
import type { AggregatorGroup } from '@/components/aggregator-layout';
import { groupPromoRows } from '@/lib/promo-row-groups';

// Gate-ON cross-team collection list. Every promo is server-rendered (the list is
// a client component but its initial state is 'All', so SSR emits every row); the
// league chips only toggle row visibility client-side via a `hidden` class — no
// fetch, crawlers see the full list. Preserves the existing first-occurrence
// StarToggleInline (placement 'promo_aggregator_inline'). The newly-interactive
// league chips emit the dual-emit league_filter_change. Rows stay plain <Link>s
// (no row-tap event today, so none is added).

function dateParts(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-full border px-4 py-1.5 font-rd text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors',
        active
          ? 'border-rd-ink bg-rd-ink text-white'
          : 'border-rd-line-strong bg-rd-card text-rd-ink-soft hover:border-rd-ink hover:text-rd-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

const STEP = 100;

export function RedesignAggregatorList({
  groups,
  accentColor,
  collection,
  surface,
  initialCount = Number.POSITIVE_INFINITY,
}: {
  groups: AggregatorGroup[];
  accentColor: string;
  /** Page slug for the analytics payload, e.g. 'bobbleheads'. */
  collection: string;
  surface: AnalyticsSurface;
  /** Cap on rows rendered up-front; the rest lazy-mount via "Show more". Pages
   *  under the cap render everything (no button). Keeps theme-nights < 1MB. */
  initialCount?: number;
}) {
  const [activeLeague, setActiveLeague] = useState<string>('All');
  const total = groups.reduce((acc, g) => acc + g.promos.length, 0);
  const [shown, setShown] = useState<number>(Math.min(initialCount, total));

  const leagues = useMemo(() => {
    const present = new Set<string>();
    for (const g of groups) for (const p of g.promos) present.add(p.team.league);
    return LEAGUE_ORDER.filter((l) => present.has(l));
  }, [groups]);

  // Walk groups in order, mounting promos up to `shown`. Trimming the overflow
  // (vs hiding it) is what keeps the SSR HTML small; the league filter operates
  // on whatever is mounted, and "Show more" mounts the next batch (no fetch).
  const renderedGroups = useMemo(() => {
    let remaining = shown;
    const out: AggregatorGroup[] = [];
    for (const g of groups) {
      if (remaining <= 0) break;
      if (g.promos.length === 0) continue;
      const take = g.promos.slice(0, remaining);
      out.push({ label: g.label, promos: take });
      remaining -= take.length;
    }
    return out;
  }, [groups, shown]);

  const switchLeague = (to: string) => {
    if (to === activeLeague) return;
    track('league_filter_change', {
      surface,
      collection,
      from_league: activeLeague,
      to_league: to,
    });
    setActiveLeague(to);
  };

  // First-occurrence star, computed over the VISIBLE (filtered) rows each render,
  // so a team's single star lands on its earliest still-shown row.
  const seen = new Set<string>();

  return (
    // <article>, NOT <div>, and not for semantics. Raptive sizes the number of
    // in-content units from ONE offsetHeight: the tallest of each matched
    // anchor's parentElement and the tallest <article> over 1.5 viewports.
    // The anchor parents here are per-section groups of a few hundred pixels,
    // so as a <div> this list produced a single unit on /promos/bobbleheads
    // (tallest anchor parent 1,166px); as an <article> it is the measured
    // element and produced seven. Same mechanism as known-issues entry 49.
    // Nothing selects this element by tag. Do not retag it back for tidiness.
    <article>
      {leagues.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip label="All" active={activeLeague === 'All'} onClick={() => switchLeague('All')} />
          {leagues.map((l) => (
            <Chip key={l} label={l} active={activeLeague === l} onClick={() => switchLeague(l)} />
          ))}
        </div>
      )}

      <div className="space-y-10">
        {renderedGroups.map((group) => {
          const groupVisible =
            activeLeague === 'All' ||
            group.promos.some((p) => p.team.league === activeLeague);
          // In-content ad anchors, the promo-list pattern reused. Raptive's
          // Content rule is `.page-content > *` (skip 2, insert after each
          // remaining child). Without anchors inside the list, this page placed
          // ZERO Content units: nothing on it carried the class. The class goes
          // on an anchor parent INSIDE each section's row container, never on
          // the outer wrapper (its first children are the intro and a 0px
          // AdSlot placeholder) and never on `space-y-10` (a whole section is
          // one child, up to 14,700px on theme-nights). Rows are grouped in
          // fours, the last group of each section sits outside the anchor
          // parent as the team list's tail does, and a section with a single
          // group gets no anchor parent at all. Tailwind v4's space-y puts the
          // gap on every non-last child, so nested `space-y-2.5` reproduces
          // the flat list's geometry exactly. Same markup server and client:
          // the grouping depends only on the rows, and initial state is 'All'.
          // Rows mounted later by "Show more" are regrouped by React but get
          // no anchors from Raptive, which does not rescan; accepted.
          const rowGroups = groupPromoRows(group.promos);
          const renderRow = (p: (typeof group.promos)[number], i: number) => {
            const visible = activeLeague === 'All' || p.team.league === activeLeague;
            const showStar = visible && !seen.has(p.team.id);
            if (showStar) seen.add(p.team.id);
            const { day, weekday, month } = dateParts(p.date);
            return (
                    <div
                      key={`${group.label}-${i}`}
                      className={`relative ${visible ? '' : 'hidden'}`}
                    >
                      <Link
                        href={`/${p.team.sportSlug}/${p.team.id}`}
                        className="group flex items-center gap-4 rounded-xl border border-rd-line bg-rd-card py-4 pl-5 pr-12 transition-colors hover:border-rd-line-strong"
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1.5"
                          style={{ backgroundColor: accentColor, borderRadius: 0 }}
                        />
                        <div className="w-12 flex-shrink-0 text-center">
                          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
                          <div className="rd-numerals text-2xl leading-none text-rd-ink">{day}</div>
                          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-rd-ink transition-colors group-hover:text-rd-red md:text-base">
                            {p.title}
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 truncate font-rd text-xs text-rd-ink-soft">
                            <span
                              aria-hidden
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: p.team.primaryColor }}
                            />
                            <span className="truncate">
                              {teamDisplayName(p.team)}
                              {p.opponent && <span className="text-rd-ink-faint"> vs {p.opponent}</span>}
                              <span className="text-rd-ink-faint"> · {p.team.league}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                      {showStar && (
                        <div className="absolute right-3 top-3 z-10">
                          <StarToggleInline
                            teamSlug={p.team.id}
                            teamName={teamDisplayName(p.team)}
                            league={p.team.league}
                            sport={p.team.sportSlug}
                            placement="promo_aggregator_inline"
                          />
                        </div>
                      )}
                    </div>
            );
          };
          // A group whose rows are all filtered out is hidden as a whole, so
          // it contributes no space-y gap. At 'All' no group is ever hidden.
          const renderGroup = (rows: typeof group.promos, start: number, key: string) => {
            const anyVisible =
              activeLeague === 'All' || rows.some((p) => p.team.league === activeLeague);
            return (
              <div key={key} className={anyVisible ? 'space-y-2.5' : 'hidden'}>
                {rows.map((p, j) => renderRow(p, start + j))}
              </div>
            );
          };
          return (
            <section key={group.label} className={groupVisible ? '' : 'hidden'}>
              <h2 className="rd-display mb-4 text-2xl uppercase text-rd-ink md:text-3xl">
                {group.label}
              </h2>
              <div className="space-y-2.5">
                {rowGroups.anchors.length > 0 && (
                  <div className="space-y-2.5 page-content">
                    {rowGroups.anchors.map((g) => renderGroup(g.rows, g.start, `g-${g.start}`))}
                  </div>
                )}
                {rowGroups.anchors.length > 0
                  ? renderGroup(rowGroups.tail.rows, rowGroups.tail.start, `g-${rowGroups.tail.start}`)
                  : rowGroups.tail.rows.map((p, j) => renderRow(p, j))}
              </div>
            </section>
          );
        })}
      </div>

      {shown < total && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((s) => Math.min(s + STEP, total))}
            className="rounded-full border border-rd-line-strong bg-rd-card px-6 py-3 font-rd text-sm font-semibold uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:border-rd-ink hover:text-rd-ink"
          >
            Show more · {Math.min(STEP, total - shown)} of {total - shown} remaining
          </button>
        </div>
      )}
    </article>
  );
}
