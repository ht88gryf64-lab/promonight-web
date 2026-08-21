import type { LeagueHubStats } from '@/lib/data';

// Authority stat bar. Renders only the stats that are actually present. The
// score-derived stats are null when teamScores is stale or missing, and "teams
// with a promo this week" is dropped when it would read zero, so the hub never
// shows a broken or unimpressive stat. Sits inside the dark hero, so text is
// white.
//
// TWO OF THESE THREE STATS ARE LIFETIME AND SAY SO IN THEIR OWN LABEL.
// stats.totalPromos and stats.avgPerTeam are summed from teamScores.promoCount,
// which is a lifetime tally of every non-recurring promo ever scored for the
// league. They are not a current-season or upcoming figure and must never be
// labelled as though they were. The previous labels ("X promos tracked", "avg
// promos per team") read as current state beside a hub whose purpose is what is
// on this week, which is the same class of defect fixed on team pages in
// fix/promo-count-derivation.
//
// The middle stat is the current-state figure on this bar. It is computed at
// render time from getLeagueSlate, so it is genuinely this week and needs no
// scope word beyond the one it already carries.
export function HubStatBar({
  stats,
  leagueLabel,
}: {
  stats: LeagueHubStats;
  /** League code shown in the all-time stat, e.g. 'MLB' / 'WNBA'. */
  leagueLabel: string;
}) {
  const items: { value: string; label: string }[] = [];

  if (stats.totalPromos != null) {
    items.push({
      value: stats.totalPromos.toLocaleString('en-US'),
      label: `${leagueLabel} promos recorded all-time`,
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
      label: 'all-time promos per team',
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
