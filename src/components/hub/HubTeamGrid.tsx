'use client';

import { useState } from 'react';
import type { HubTeamGroup, HubSuperGroup } from '@/lib/data';
import type { Team } from '@/lib/types';
import { track, type AnalyticsSurface } from '@/lib/analytics';
import { IconChevronRight } from '@tabler/icons-react';
import { chipInk } from '@/lib/chip-contrast';
import { HubTeamSelector, ALL_DIVISIONS } from './HubTeamSelector';

function TeamCard({ team }: { team: Team }) {
  const name = `${team.city} ${team.name}`;
  return (
    <a
      href={`/${team.sportSlug}/${team.id}`}
      aria-label={`${name} promotional schedule`}
      className="group flex items-center gap-3 rounded-xl border border-rd-line bg-rd-card p-3 transition-all hover:-translate-y-px hover:border-rd-line-strong hover:shadow-[0_2px_12px_rgba(33,29,24,0.08)]"
    >
      <span
        aria-hidden
        className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] font-rd text-[13px] font-extrabold"
        style={{ backgroundColor: team.primaryColor, color: chipInk(team.primaryColor) }}
      >
        {team.abbreviation}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-rd text-[15.5px] font-semibold text-rd-ink">{name}</span>
        <span className="block font-rd text-[12.5px] text-rd-ink-faint transition-colors group-hover:text-rd-red">
          Promotional schedule
        </span>
      </span>
      <IconChevronRight
        size={18}
        stroke={2}
        aria-hidden
        className="shrink-0 text-rd-line-strong transition-colors group-hover:text-rd-red"
      />
    </a>
  );
}

// Team grid for a league hub. EVERY team link is rendered in the DOM at all
// times. The initial server render is the full, unfiltered grid (active =
// "all"), so every anchor is present in view-source and crawlable. The selector
// toggles VISIBILITY only, via the Tailwind `hidden` class (display:none) which
// keeps the elements in the DOM: it never conditionally renders or lazy-fetches,
// so filtering to one group cannot remove a link from the source. Groups render
// under optional super-header bands (MLB AL/NL) or flat (WNBA/MLS Eastern/
// Western). Client component only because the selector holds interactive state.
export function HubTeamGrid({
  groups,
  superGroups,
  sectionId,
  surface,
  collection,
  intro,
  selectorLabel,
  allLabel,
}: {
  groups: HubTeamGroup[];
  /** Super-header bands (MLB AL/NL). Empty => render groups flat (WNBA/MLS). */
  superGroups: HubSuperGroup[];
  /** DOM id / aria-labelledby anchor, e.g. "mlb-browse-team". */
  sectionId: string;
  /** Analytics surface for the selector filter-change event. */
  surface: AnalyticsSurface;
  /** Analytics collection tag for the filter-change event, e.g. "mlb_hub". */
  collection: string;
  /** Intro copy under the heading. */
  intro: string;
  selectorLabel: string;
  allLabel: string;
}) {
  const [active, setActive] = useState<string>(ALL_DIVISIONS);

  const handleSelect = (division: string) => {
    if (division === active) return;
    track('league_filter_change', {
      surface,
      collection,
      from_league: active,
      to_league: division,
    });
    setActive(division);
  };

  // When the league has super-headers (MLB AL/NL), render each as a band that
  // filters its member groups. Otherwise render one label-less band holding
  // every group, so WNBA/MLS show their conferences (Eastern/Western) as
  // top-level buckets with no super-header wrapper.
  const bands: { key: string; label: string | null; groups: HubTeamGroup[] }[] =
    superGroups.length > 0
      ? superGroups.map((sg) => ({
          key: sg.key,
          label: sg.label,
          groups: groups.filter((g) => g.superGroup === sg.key),
        }))
      : [{ key: 'all', label: null, groups }];

  return (
    <section aria-labelledby={sectionId}>
      <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
        Browse by team
      </h2>
      <p className="mt-2 max-w-2xl font-rd text-[15px] text-rd-ink-soft">
        {intro}
      </p>

      <div className="mt-6">
        <HubTeamSelector
          groups={groups}
          active={active}
          onSelect={handleSelect}
          selectorLabel={selectorLabel}
          allLabel={allLabel}
        />
      </div>

      <div className="mt-8 space-y-10">
        {bands.map((band) => {
          // Hide a whole band only when a specific group is active and belongs to
          // another band. Child links stay in the DOM either way (display:none,
          // still crawlable).
          const bandHidden =
            active !== ALL_DIVISIONS && !band.groups.some((g) => g.key === active);
          return (
            <div key={band.key} className={bandHidden ? 'hidden' : ''}>
              {band.label ? (
                <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
                  {band.label}
                </p>
              ) : null}
              <div
                className={
                  band.label
                    ? 'mt-4 grid gap-x-6 gap-y-8 md:grid-cols-3'
                    : 'grid gap-x-6 gap-y-8 md:grid-cols-3'
                }
              >
                {band.groups.map((g) => {
                  const divHidden = active !== ALL_DIVISIONS && active !== g.key;
                  return (
                    <div key={g.key} className={divHidden ? 'hidden' : ''}>
                      <h3 className="rd-display text-base text-rd-ink">{g.key}</h3>
                      <ul className="mt-3 space-y-2">
                        {g.teams.map((t) => (
                          <li key={t.id}>
                            <TeamCard team={t} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
