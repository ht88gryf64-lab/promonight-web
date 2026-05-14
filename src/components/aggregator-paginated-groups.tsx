'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PromoWithTeam } from '@/lib/types';
import { PromoBadge } from './promo-badge';
import { teamDisplayName } from '@/lib/promo-helpers';
import type { AggregatorGroup } from './aggregator-layout';
import { StarToggleInline } from './star-toggle';

const INITIAL_COUNT = 50;
const STEP = 50;

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function AggregatorPaginatedGroups({ groups }: { groups: AggregatorGroup[] }) {
  const total = groups.reduce((acc, g) => acc + g.promos.length, 0);
  const [shown, setShown] = useState(INITIAL_COUNT);

  // Walk groups in order, taking promos until we hit the shown threshold.
  // Trimming overflow promos (rather than display:none-hiding them) is what
  // actually drops HTML payload — the SSR'd DOM contains only what's rendered.
  let remaining = shown;
  const visibleGroups: AggregatorGroup[] = [];
  for (const g of groups) {
    if (remaining <= 0) break;
    if (g.promos.length === 0) continue;
    const take = g.promos.slice(0, remaining);
    visibleGroups.push({ label: g.label, promos: take });
    remaining -= take.length;
  }

  // Inline stars use a first-occurrence-only rule across the whole rendered
  // list. Each team gets exactly one star in the page — on the row where it
  // first appears as the user scrolls. The seenSlugs set is local to this
  // render so a "Show more" click reruns the walk over the new visible set
  // (which still places the star on the same earliest occurrence, since the
  // first 50 entries don't shuffle when 50 more append). Mutating a local
  // Set during the map is safe: it isn't user-observable state, just a
  // render-pass accumulator.
  const seenSlugs = new Set<string>();

  return (
    <>
      <div className="space-y-10">
        {visibleGroups.map((group) => (
          <section key={group.label}>
            <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mb-4">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.promos.map((p, i) => {
                const { day, weekday, month } = formatDateParts(p.date);
                const showStar = !seenSlugs.has(p.team.id);
                if (showStar) seenSlugs.add(p.team.id);
                return (
                  <Link
                    key={`${group.label}-${i}`}
                    href={`/${p.team.sportSlug}/${p.team.id}`}
                    className="group bg-bg-card border border-border-subtle rounded-xl p-4 flex items-center gap-4 hover:border-border-hover transition-colors"
                  >
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className="font-mono text-[9px] tracking-[1px] text-text-muted">{month}</div>
                      <div className="font-display text-2xl leading-none">{day}</div>
                      <div className="font-mono text-[9px] tracking-[1px] text-text-dim">{weekday}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-base">{p.icon}</span>
                        <PromoBadge type={p.type} />
                        {p.highlight && (
                          <span className="text-[10px] font-mono text-accent-red">HOT</span>
                        )}
                      </div>
                      <div className="text-white font-semibold text-sm group-hover:text-accent-red transition-colors truncate">
                        {p.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        {showStar ? (
                          <StarToggleInline
                            teamSlug={p.team.id}
                            teamName={teamDisplayName(p.team)}
                            league={p.team.league}
                            sport={p.team.sportSlug}
                            placement="promo_aggregator_inline"
                          />
                        ) : (
                          // Empty same-size spacer keeps the team-name baseline
                          // aligned with rows where the star renders.
                          <span
                            aria-hidden="true"
                            className="inline-block"
                            style={{ width: 20, height: 20 }}
                          />
                        )}
                        <div className="text-text-secondary text-xs truncate min-w-0">
                          {teamDisplayName(p.team)}
                          {p.opponent && (
                            <span className="text-text-dim"> vs {p.opponent}</span>
                          )}
                          <span className="text-text-dim"> &middot; {p.team.league}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {shown < total && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((s) => s + STEP)}
            className="px-6 py-3 rounded-full border border-border-subtle bg-bg-card text-white text-sm font-mono tracking-[1px] uppercase hover:border-accent-red hover:text-accent-red transition-colors"
          >
            Show more &middot; {Math.min(STEP, total - shown)} of {total - shown} remaining
          </button>
        </div>
      )}
    </>
  );
}

// Type re-export so PromoWithTeam stays importable from the original module.
export type { PromoWithTeam };
