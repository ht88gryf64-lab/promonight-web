'use client';

import { useState } from 'react';
import type { MlbDivisionGroup } from '@/lib/data';
import { track } from '@/lib/analytics';
import { HubTeamSelector, ALL_DIVISIONS } from './HubTeamSelector';

// Division team grid. ALL 30 team links are rendered in the DOM at all times.
// The initial server render is the full, unfiltered grid (active = "all"), so
// every anchor is present in view-source and crawlable. The selector toggles
// VISIBILITY only, via the Tailwind `hidden` class (display:none) which keeps
// the elements in the DOM: it never conditionally renders or lazy-fetches, so
// filtering to one division cannot remove a link from the source. Client
// component only because the selector holds interactive state.
export function HubTeamGrid({ groups }: { groups: MlbDivisionGroup[] }) {
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

  const conferences: { key: 'AL' | 'NL'; label: string; groups: MlbDivisionGroup[] }[] = [
    { key: 'AL', label: 'American League', groups: groups.filter((g) => g.conference === 'AL') },
    { key: 'NL', label: 'National League', groups: groups.filter((g) => g.conference === 'NL') },
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
            active !== ALL_DIVISIONS && !conf.groups.some((g) => g.division === active);
          return (
            <div key={conf.key} className={confHidden ? 'hidden' : ''}>
              <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
                {conf.label}
              </p>
              <div className="mt-4 grid gap-x-8 gap-y-8 md:grid-cols-3">
                {conf.groups.map((g) => {
                  const divHidden = active !== ALL_DIVISIONS && active !== g.division;
                  return (
                    <div key={g.division} className={divHidden ? 'hidden' : ''}>
                      <h3 className="rd-display text-base text-rd-ink">{g.division}</h3>
                      <ul className="mt-3 space-y-1.5">
                        {g.teams.map((t) => (
                          <li key={t.id}>
                            <a
                              href={`/${t.sportSlug}/${t.id}`}
                              className="font-rd text-[15px] text-rd-ink-soft transition-colors hover:text-rd-red"
                            >
                              {t.city} {t.name} promotional schedule
                            </a>
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
