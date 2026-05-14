'use client';

import { FilterChips, type FilterChipOption } from './filter-chips';

export type LeagueFilterValue = 'All' | 'MLB' | 'MLS' | 'WNBA';

const OPTIONS: readonly FilterChipOption<LeagueFilterValue>[] = [
  { value: 'All', label: 'All' },
  { value: 'MLB', label: 'MLB' },
  { value: 'MLS', label: 'MLS' },
  { value: 'WNBA', label: 'WNBA' },
];

// URL-synced league chips. Default ('All') is implicit so a clean URL means
// "all scored leagues." NBA / NHL intentionally absent; they're not in the
// scoring scope and the option set is closed.
export function LeagueFilter() {
  return (
    <FilterChips
      paramKey="league"
      options={OPTIONS}
      defaultValue="All"
      ariaLabel="Filter by league"
    />
  );
}
