'use client';

import { FilterChips, FilterChipsView, type FilterChipOption } from './filter-chips';

export type LeagueFilterValue = 'All' | 'MLB' | 'MLS' | 'WNBA';

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

// League chips. NBA / NHL intentionally absent; they're not in the scoring
// scope and the option set is closed.
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
};

export function LeagueFilter({ onChange, variant = 'dark', value, onSelect }: LeagueFilterProps = {}) {
  if (value !== undefined && onSelect) {
    return (
      <FilterChipsView
        options={OPTIONS}
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
