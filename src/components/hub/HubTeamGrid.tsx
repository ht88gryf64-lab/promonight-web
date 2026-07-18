'use client';

import { useState } from 'react';
import type { HubTeamGroup } from '@/lib/data';
import type { Team } from '@/lib/types';
import { track } from '@/lib/analytics';
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

// Division team grid. ALL 30 team links are rendered in the DOM at all times.
// The initial server render is the full, unfiltered grid (active = "all"), so
// every anchor is present in view-source and crawlable. The selector toggles
// VISIBILITY only, via the Tailwind `hidden` class (display:none) which keeps
// the elements in the DOM: it never conditionally renders or lazy-fetches, so
// filtering to one division cannot remove a link from the source. Client
// component only because the selector holds interactive state.
export function HubTeamGrid({ groups }: { groups: HubTeamGroup[] }) {
  const [active, setActive] = useState<string>(ALL_DIVISIONS);

  const handleSelect = (division: string) => {
    if (division === active) return;
    track('league_filter_change', {
      surface: 'web_mlb_hub_team_card',
      collection: 'mlb_hub',
      from_league: active,
      to_league: division,
    });
    setActive(division);
  };

  const conferences: { key: 'AL' | 'NL'; label: string; groups: HubTeamGroup[] }[] = [
    { key: 'AL', label: 'American League', groups: groups.filter((g) => g.superGroup === 'AL') },
    { key: 'NL', label: 'National League', groups: groups.filter((g) => g.superGroup === 'NL') },
  ];

  return (
    <section aria-labelledby="mlb-browse-team">
      <h2 id="mlb-browse-team" className="rd-display text-2xl text-rd-ink md:text-3xl">
        Browse by team
      </h2>
      <p className="mt-2 max-w-2xl font-rd text-[15px] text-rd-ink-soft">
        All 30 MLB clubs by division. Open any team for its full 2026 promotional schedule.
      </p>

      <div className="mt-6">
        <HubTeamSelector groups={groups} active={active} onSelect={handleSelect} />
      </div>

      <div className="mt-8 space-y-10">
        {conferences.map((conf) => {
          // Hide the whole conference block only when a specific division is
          // active and it belongs to the other conference. Child links stay in
          // the DOM either way (display:none, still crawlable).
          const confHidden =
            active !== ALL_DIVISIONS && !conf.groups.some((g) => g.key === active);
          return (
            <div key={conf.key} className={confHidden ? 'hidden' : ''}>
              <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
                {conf.label}
              </p>
              <div className="mt-4 grid gap-x-6 gap-y-8 md:grid-cols-3">
                {conf.groups.map((g) => {
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
