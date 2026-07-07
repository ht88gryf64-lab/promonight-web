import type { MlbHubStats } from '@/lib/data';

// Authority stat bar. Renders only the stats that are actually present. The
// score-derived stats (total promos tracked, average per team) are null when
// teamScores is stale or missing, and "teams with a promo this week" is dropped
// when it would read zero, so the hub never shows a broken or unimpressive stat.
// Sits inside the dark hero, so text is white.
export function HubStatBar({ stats }: { stats: MlbHubStats }) {
  const items: { value: string; label: string }[] = [];

  if (stats.totalMlbPromos != null) {
    items.push({
      value: stats.totalMlbPromos.toLocaleString('en-US'),
      label: 'MLB promos tracked',
    });
  }
  if (stats.teamsWithPromosThisWeek > 0) {
    items.push({
      value: stats.teamsWithPromosThisWeek.toString(),
      label: 'teams with a promo this week',
    });
  }
  if (stats.avgPerTeam != null) {
    items.push({
      value: stats.avgPerTeam.toFixed(1),
      label: 'avg promos per team',
    });
  }

  if (items.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-4">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="rd-numerals text-3xl font-bold text-white md:text-4xl">{it.value}</dt>
          <dd className="mt-1 font-rd text-[11px] uppercase tracking-[0.12em] text-white/55">
            {it.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}
