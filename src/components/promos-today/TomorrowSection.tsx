import Link from 'next/link';
import type { Venue } from '@/lib/types';
import type { LeagueGroup } from './helpers';
import { TodayLeagueSection } from './TodayLeagueSection';

// The persistent "Tomorrow" section below today's board. Reuses the same
// league-grouped card layout (same deep-links, same inline CTA row tagged
// web_today — a planner buying tomorrow's tickets tonight is the conversion we
// want). Three states:
//  - has promos, `dimmed` (today had promos): subdued "preview" treatment so
//    today stays the hero.
//  - has promos, not dimmed (today was empty): full prominence — this section is
//    the page's primary content, so the empty-today page is never thin.
//  - no promos: collapses to a single pointer line at the soonest upcoming date
//    plus the this-week crosslink.
export function TomorrowSection({
  dateLabel,
  groups,
  venueByTeam,
  hasPromos,
  dimmed,
  soonestDateLabel,
}: {
  dateLabel: string;
  groups: LeagueGroup[];
  venueByTeam: Map<string, Venue | null>;
  hasPromos: boolean;
  dimmed: boolean;
  soonestDateLabel: string | null;
}) {
  return (
    <section aria-label="Tomorrow's promos" className="border-t border-rd-line pt-8">
      <div className="mb-1 font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
        Tomorrow
      </div>
      <h2 className="rd-display text-xl text-rd-ink md:text-2xl">{dateLabel}</h2>

      {hasPromos ? (
        <div className="mt-5 space-y-8">
          {groups.map((g) => (
            <TodayLeagueSection
              key={g.league}
              group={g}
              venueByTeam={venueByTeam}
              surface="web_today"
              dimmed={dimmed}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 font-rd text-[14px] leading-relaxed text-rd-ink-soft">
          {soonestDateLabel
            ? `No promos scheduled tomorrow. Next up: ${soonestDateLabel}. `
            : 'No promos scheduled tomorrow. '}
          <Link href="/promos/this-week" className="font-semibold text-rd-red hover:underline">
            See the full week →
          </Link>
        </p>
      )}
    </section>
  );
}
