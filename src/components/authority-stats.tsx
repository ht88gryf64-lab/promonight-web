import type { Promo, PromoType, Team, Venue } from '@/lib/types';
import { getCurrentYear } from '@/lib/promo-helpers';

const HOME_GAMES_BY_LEAGUE: Record<string, number> = {
  MLB: 81,
  NBA: 41,
  NFL: 9, // 8 regular + 1 preseason
  NHL: 41,
  MLS: 17,
  WNBA: 20,
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function AuthorityStats({
  team,
  promos,
  promoCounts,
  venue,
  teamName,
}: {
  team: Team;
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  venue: Venue | null;
  teamName: string;
}) {
  if (promos.length < 15) return null;

  const year = getCurrentYear();
  const homeGames = HOME_GAMES_BY_LEAGUE[team.league] ?? 0;
  const venueName = venue?.name ?? 'their home venue';

  // 1. Promos per home game ratio.
  const ratio =
    homeGames > 0 ? (promos.length / homeGames).toFixed(1) : null;

  // 2. Percent of distinct home dates with at least one promo.
  const distinctPromoDates = new Set(promos.map((p) => p.date)).size;
  const pctHomeGames =
    homeGames > 0
      ? Math.min(Math.round((distinctPromoDates / homeGames) * 100), 100)
      : null;

  // 3. Giveaway concentration by month (top 1–2 months).
  const giveawayByMonth: Record<number, number> = {};
  for (const p of promos) {
    if (p.type !== 'giveaway') continue;
    const m = Number(p.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) giveawayByMonth[m] = (giveawayByMonth[m] ?? 0) + 1;
  }
  const giveawayEntries = Object.entries(giveawayByMonth)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => b[1] - a[1]);
  const topMonths = giveawayEntries.slice(0, 2);
  const topMonthsTotal = topMonths.reduce((sum, [, v]) => sum + v, 0);

  // 4. Promo-heavy weekday.
  const promosByWeekday: Record<number, { count: number; total: number }> = {};
  const totalByWeekday: Record<number, number> = {};
  for (const p of promos) {
    const d = new Date(p.date + 'T12:00:00');
    const wd = d.getDay();
    totalByWeekday[wd] = (totalByWeekday[wd] ?? 0) + 1;
  }
  // We don't have full home-schedule data, so report "N of the team's M
  // scheduled {weekday} promo dates" — phrased as frequency across the
  // promo dataset, not schedule coverage.
  const weekdayEntries = Object.entries(totalByWeekday)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => b[1] - a[1]);
  const topWeekday = weekdayEntries[0];
  const topWeekdayGiveaways = topWeekday
    ? promos.filter((p) => {
        const d = new Date(p.date + 'T12:00:00');
        return d.getDay() === topWeekday[0] && p.type === 'giveaway';
      }).length
    : 0;

  const sentences: string[] = [];

  if (ratio !== null && pctHomeGames !== null) {
    sentences.push(
      `The ${teamName} have ${promos.length} promotional events scheduled across ${homeGames} ${team.league} home ${homeGames === 1 ? 'game' : 'games'} in ${year}, averaging ${ratio} promos per home game. Roughly ${pctHomeGames}% of home dates at ${venueName} have at least one scheduled promotion.`,
    );
  } else if (ratio !== null) {
    sentences.push(
      `The ${teamName} have ${promos.length} promotional events scheduled in ${year}, averaging ${ratio} promos per home game.`,
    );
  } else {
    sentences.push(
      `The ${teamName} have ${promos.length} promotional events scheduled in ${year}.`,
    );
  }

  if (promoCounts.giveaway >= 4 && topMonths.length > 0) {
    const monthList = topMonths.map(([m]) => MONTH_NAMES[m]).join(' and ');
    sentences.push(
      `Giveaways are most concentrated in ${monthList} — ${topMonthsTotal} of the team's ${promoCounts.giveaway} giveaways fall in ${topMonths.length === 1 ? 'that month' : 'those two months'}.`,
    );
  }

  if (topWeekday && topWeekday[1] >= 4 && topWeekdayGiveaways >= 2) {
    sentences.push(
      `${WEEKDAYS[topWeekday[0]]} home games are the most promo-heavy — ${topWeekday[1]} scheduled events with ${topWeekdayGiveaways} giveaway${topWeekdayGiveaways === 1 ? '' : 's'}.`,
    );
  }

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            By the numbers
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            {teamName.toUpperCase()} PROMO PATTERNS
          </h2>
        </div>
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 space-y-3">
          {sentences.map((s, i) => (
            <p key={i} className="text-text-secondary text-sm md:text-base leading-relaxed">
              {s}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
