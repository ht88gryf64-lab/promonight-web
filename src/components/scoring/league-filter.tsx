'use client';

import { FilterChips, FilterChipsView, type FilterChipOption } from './filter-chips';

export type LeagueFilterValue = 'All' | 'MLB' | 'MLS' | 'WNBA' | 'NBA' | 'NHL';

const OPTIONS: readonly FilterChipOption<LeagueFilterValue>[] = [
  { value: 'All', label: 'All' },
  { value: 'MLB', label: 'MLB' },
  { value: 'MLS', label: 'MLS' },
  { value: 'WNBA', label: 'WNBA' },
];

// Closed value set, exported so controlled callers can validate raw URL
// params against it without duplicating the option list.
export const LEAGUE_FILTER_VALUES: readonly LeagueFilterValue[] = OPTIONS.map(
  (o) => o.value,
);

// The chips /best-promos shows when its list holds NBA or NHL rows (the
// upcoming list, since the 2026-11 fix round). A caller passes the leagues its
// rows actually hold; the default set above is unchanged, and it is the only
// set /team-rankings ever shows, since NBA and NHL teams are not ranked.
const EXTRA_OPTIONS: readonly FilterChipOption<LeagueFilterValue>[] = [
  { value: 'NBA', label: 'NBA' },
  { value: 'NHL', label: 'NHL' },
];

/** The default chips (All, MLB, MLS, WNBA), always, plus NBA and NHL when
 *  `present` holds them. A list without NBA or NHL rows shows exactly the
 *  chips it always did. */
export function leagueFilterOptions(present?: ReadonlySet<string>): readonly FilterChipOption<LeagueFilterValue>[] {
  if (!present) return OPTIONS;
  return [...OPTIONS, ...EXTRA_OPTIONS.filter((o) => present.has(o.value))];
}

// League chips. The default option set is closed at MLB, MLS and WNBA.
//
// Two modes:
// - URL-synced (default): FilterChips owns the ?league= param. Default
//   ('All') is implicit so a clean URL means "all scored leagues". Used by
//   team-rankings, which reads the param at its own level.
// - Controlled (`value` + `onSelect` provided): renders the hook-free
//   FilterChipsView so the parent stays out of the useSearchParams
//   prerender bailout and owns state + URL writes itself (best-promos).
type LeagueFilterProps = {
  onChange?: (from: LeagueFilterValue, to: LeagueFilterValue) => void;
  variant?: 'dark' | 'light';
  value?: LeagueFilterValue;
  onSelect?: (next: LeagueFilterValue) => void;
  /** Controlled mode only: the leagues the caller's rows hold (see leagueFilterOptions). */
  leagues?: ReadonlySet<string>;
};

export function LeagueFilter({ onChange, variant = 'dark', value, onSelect, leagues }: LeagueFilterProps = {}) {
  if (value !== undefined && onSelect) {
    return (
      <FilterChipsView
        options={leagueFilterOptions(leagues)}
        current={value}
        onSelect={onSelect}
        ariaLabel="Filter by league"
        variant={variant}
      />
    );
  }
  return (
    <FilterChips
      paramKey="league"
      options={OPTIONS}
      defaultValue="All"
      ariaLabel="Filter by league"
      onChange={onChange}
      variant={variant}
    />
  );
}
