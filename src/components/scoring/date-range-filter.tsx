'use client';

import { FilterChips, FilterChipsView, type FilterChipOption } from './filter-chips';

export type DateRangeFilterValue = '30d' | '90d' | 'season';

const OPTIONS: readonly FilterChipOption<DateRangeFilterValue>[] = [
  { value: '30d', label: 'Next 30 days' },
  { value: '90d', label: 'Next 90 days' },
  { value: 'season', label: 'Rest of season' },
];

// Closed value set, exported so controlled callers can validate raw URL
// params against it without duplicating the option list.
export const DATE_RANGE_FILTER_VALUES: readonly DateRangeFilterValue[] =
  OPTIONS.map((o) => o.value);

// Date-range chips. Default ('90d') matches what the brief specified as
// the page's initial window. "Rest of season" is a pragmatic 180-day
// forward window since end-of-season dates vary by league and the scoring
// pipeline only writes ~6 months out in any case.
//
// Two modes, same contract as LeagueFilter: URL-synced by default,
// controlled (hook-free) when `value` + `onSelect` are provided so the
// parent stays out of the useSearchParams prerender bailout.
type DateRangeFilterProps = {
  onChange?: (from: DateRangeFilterValue, to: DateRangeFilterValue) => void;
  variant?: 'dark' | 'light';
  value?: DateRangeFilterValue;
  onSelect?: (next: DateRangeFilterValue) => void;
};

export function DateRangeFilter({ onChange, variant = 'dark', value, onSelect }: DateRangeFilterProps = {}) {
  if (value !== undefined && onSelect) {
    return (
      <FilterChipsView
        options={OPTIONS}
        current={value}
        onSelect={onSelect}
        ariaLabel="Filter by date range"
        variant={variant}
      />
    );
  }
  return (
    <FilterChips
      paramKey="range"
      options={OPTIONS}
      defaultValue="90d"
      ariaLabel="Filter by date range"
      onChange={onChange}
      variant={variant}
    />
  );
}
