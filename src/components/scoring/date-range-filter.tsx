'use client';

import { FilterChips, type FilterChipOption } from './filter-chips';

export type DateRangeFilterValue = '30d' | '90d' | 'season';

const OPTIONS: readonly FilterChipOption<DateRangeFilterValue>[] = [
  { value: '30d', label: 'Next 30 days' },
  { value: '90d', label: 'Next 90 days' },
  { value: 'season', label: 'Rest of season' },
];

// URL-synced date-range chips. Default ('90d') matches what the brief
// specified as the page's initial window. "Rest of season" is a pragmatic
// 180-day forward window since end-of-season dates vary by league and
// the scoring pipeline only writes ~6 months out in any case.
export function DateRangeFilter() {
  return (
    <FilterChips
      paramKey="range"
      options={OPTIONS}
      defaultValue="90d"
      ariaLabel="Filter by date range"
    />
  );
}
