'use client';

import { useMemo, useState } from 'react';
import type { Team } from '@/lib/types';
import { LEAGUE_ORDER, SPORT_ICONS } from '@/lib/types';
import { StarIcon } from '@/components/star-icon';

// Controlled team star picker: searchable, league-grouped toggle list plus a
// removable selected-chips row. Selection state and the analytics side effects
// live in the parent (FollowForm fires teams_starred on add; PreferencesForm
// does not), so this component is purely presentational over `selected` +
// `onToggle`. Shared by the capture form and the preferences page so the star
// UI stays identical in both.
//
// Optional geo ordering: `nearTeamIds` floats the visitor's nearest teams into
// a "Teams near you" group at the top. It is a SOFT reorder only, shown when not
// searching; the near teams are lifted out of their league groups so they appear
// once, never hidden, and search always spans all 167 teams.

interface TeamStarPickerProps {
  teams: Team[];
  selected: string[];
  onToggle: (slug: string) => void;
  searchPlaceholder?: string;
  // Ordered "near you" slugs. Optional: the preferences page renders without it.
  nearTeamIds?: string[];
}

function PickerTeamButton({
  team,
  on,
  onToggle,
}: {
  team: Team;
  on: boolean;
  onToggle: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(team.id)}
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
        style={{ backgroundColor: team.primaryColor }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-rd text-sm font-bold text-rd-ink">
          {team.city} {team.name}
        </span>
        <span className="block font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">
          {team.abbreviation}
        </span>
      </span>
      <StarIcon filled={on} size={20} surface="light" />
    </button>
  );
}

export function TeamStarPicker({
  teams,
  selected,
  onToggle,
  searchPlaceholder = 'Search 167 teams…',
  nearTeamIds = [],
}: TeamStarPickerProps) {
  const [query, setQuery] = useState('');
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Geo group only when not actively searching (search spans every team).
  const showNear = query.trim() === '' && nearTeamIds.length > 0;

  const nearTeams = useMemo(
    () =>
      showNear
        ? nearTeamIds.map((id) => teamById.get(id)).filter((t): t is Team => !!t)
        : [],
    [showNear, nearTeamIds, teamById],
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    // When the geo group is shown, lift those teams out of the league groups so
    // each appears once. Search (q non-empty) sets showNear false, so every
    // matching team stays in its league group.
    const nearSet = new Set(showNear ? nearTeamIds : []);
    const matches = (t: Team) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.league.toLowerCase().includes(q) ||
      t.abbreviation.toLowerCase().includes(q);
    return LEAGUE_ORDER.map((league) => ({
      league,
      teams: teams.filter((t) => t.league === league && matches(t) && !nearSet.has(t.id)),
    })).filter((g) => g.teams.length > 0);
  }, [teams, query, showNear, nearTeamIds]);

  const nothingToShow = nearTeams.length === 0 && grouped.length === 0;

  return (
    <div>
      <label className="sr-only" htmlFor="team-search">
        Search teams
      </label>
      <input
        id="team-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
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
                onClick={() => onToggle(slug)}
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

      <div className="max-h-72 overflow-y-auto rounded-xl border border-rd-line bg-rd-cream/40 p-2">
        {nothingToShow ? (
          <p className="px-2 py-6 text-center font-rd text-sm text-rd-ink-soft">
            No teams match “{query.trim()}”.
          </p>
        ) : (
          <>
            {nearTeams.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 font-rd text-[10px] font-semibold uppercase tracking-[0.12em] text-rd-red">
                  📍 Teams near you
                </div>
                <div className="space-y-1">
                  {nearTeams.map((t) => (
                    <PickerTeamButton
                      key={`near-${t.id}`}
                      team={t}
                      on={selected.includes(t.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </div>
            )}
            {grouped.map((group) => (
              <div key={group.league} className="mb-2 last:mb-0">
                <div className="px-2 py-1 font-rd text-[10px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
                  {SPORT_ICONS[group.league]} {group.league}
                </div>
                <div className="space-y-1">
                  {group.teams.map((t) => (
                    <PickerTeamButton
                      key={t.id}
                      team={t}
                      on={selected.includes(t.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
