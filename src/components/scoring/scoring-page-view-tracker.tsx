'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

type Props = {
  pageTitle: string;
  // The server-fetched promo or team count this page mounted with. For
  // /best-promos and /best-promos/bobbleheads this is the cap-applied
  // server fetch length; for /team-rankings it's the total scored team
  // count.
  scoreCount: number;
  // When set, the URL's `league` param (or this default if absent) flows
  // into the page_view event's `league_filter` field. Omit if the page
  // has no league filter.
  defaultLeague?: string;
  // Same shape for the date range chip on the promo pages. Omit on
  // /team-rankings, which has no date filter.
  defaultRange?: string;
};

// Fires `page_view` once per route mount with the scoring-discovery
// metadata bundle (score_count + league_filter + date_range_filter from
// the URL state at mount time). The global PageViewTracker is suppressed
// for /best-promos and /team-rankings paths so this tracker is the
// single source of page_view for those routes. Subsequent filter changes
// don't re-fire page_view; score_filter_changed covers that cadence.
export function ScoringPageViewTracker({
  pageTitle,
  scoreCount,
  defaultLeague,
  defaultRange,
}: Props) {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    // Double-mount guard. React strict mode (dev) double-invokes effects;
    // the ref ensures only one event fires per real mount.
    if (fired.current) return;
    fired.current = true;

    const leagueFilter =
      defaultLeague !== undefined
        ? searchParams.get('league') || defaultLeague
        : undefined;
    const dateRangeFilter =
      defaultRange !== undefined
        ? searchParams.get('range') || defaultRange
        : undefined;

    track('page_view', {
      surface: 'web_best_promos',
      page_title: pageTitle,
      score_count: scoreCount,
      league_filter: leagueFilter,
      date_range_filter: dateRangeFilter,
    });
    // searchParams + defaultLeague + defaultRange are intentionally not in
    // the deps array: this is a fire-once-on-mount tracker, and re-reading
    // searchParams on a filter toggle would double-fire page_view, which
    // is what we explicitly don't want here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
