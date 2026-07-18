import type { LeagueHubStats } from '@/lib/data';

// Authority stat bar. Renders only the stats that are actually present. The
// score-derived stats (total promos tracked, average per team) are null when
// teamScores is stale or missing, and "teams with a promo this week" is dropped
// when it would read zero, so the hub never shows a broken or unimpressive stat.
// Sits inside the dark hero, so text is white.
export function HubStatBar({
  stats,
  leagueLabel,
}: {
  stats: LeagueHubStats;
  /** League code shown in the "X promos tracked" stat, e.g. 'MLB' / 'WNBA'. */
  leagueLabel: string;
}) {
  const items: { value: string; label: string }[] = [];

  if (stats.totalPromos != null) {
    items.push({
      value: stats.totalPromos.toLocaleString('en-US'),
      label: `${leagueLabel} promos tracked`,
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
