'use client';

import type { HubTeamGroup } from '@/lib/data';

// Segmented division filter for the team grid. Presentational: the parent
// (HubTeamGrid) owns the active state and fires analytics; this component only
// renders the chips and reports selections up. "All" is the default and shows
// every division. Filtering is visibility-only in the parent, so these chips
// never remove team links from the DOM.
export const ALL_DIVISIONS = 'all';

export function HubTeamSelector({
  groups,
  active,
  onSelect,
}: {
  groups: HubTeamGroup[];
  active: string;
  onSelect: (division: string) => void;
}) {
  const chip = (key: string, label: string) => {
    const isActive = active === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onSelect(key)}
        aria-pressed={isActive}
        className={
          'rounded-full border px-3.5 py-1.5 font-rd text-[13px] font-semibold transition-colors ' +
          (isActive
            ? 'border-rd-ink bg-rd-ink text-rd-cream'
            : 'border-rd-line bg-rd-card text-rd-ink-soft hover:border-rd-line-strong hover:text-rd-ink')
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter teams by division">
      {chip(ALL_DIVISIONS, 'All divisions')}
      {groups.map((g) => chip(g.key, g.key))}
    </div>
  );
}
