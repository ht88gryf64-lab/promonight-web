import { IconChartBar } from '@tabler/icons-react';
import type { Promo, PromoType, Team, Venue } from '@/lib/types';
import { seasonSpan, scheduledPeriodPhrase, remainingPeriodPhrase } from '@/lib/season-label';
import type { ClaimMode } from '@/lib/season-scope';

// SEASON_YEAR = 2026 used to live here, and its comment was right that a
// getFullYear() would flip this copy to the next season at midnight on Jan 1.
// The constant carried the other half of the same mistake: it asserted a
// calendar year over a set of promos that may not sit in one. Detroit's 85
// upcoming rows run 2026-10-02 to 2027-04-09, 38 of them in 2027, under prose
// reading "in 2026".
//
// Derived from the promos in hand instead (src/lib/season-label.ts). Single-year
// output is byte-identical to `in ${SEASON_YEAR}`.

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
  claim = { kind: 'held' },
  variant = 'dark',
}: {
  team: Team;
  /** UPCOMING promos. Still the fallback population when `season` is null. */
  promos: Promo[];
  promoCounts: Record<PromoType, number>;
  venue: Venue | null;
  teamName: string;
  /** How to word the counts. Defaults to 'held', the pre-change rendering. */
  claim?: ClaimMode;
  variant?: 'dark' | 'light';
}) {
  // ── SCOPE. This block held the worst of the four scope defects. ───────────
  //
  // It was passed upcomingPromos and divided them by HOME_GAMES_BY_LEAGUE, a
  // full-season constant. On 2026-09-04 the Dodgers page therefore published
  // "19 promotional events scheduled across 81 MLB home games in 2026,
  // averaging 0.2 promos per home game. Roughly 15% of home dates ... have at
  // least one scheduled promotion." The season figures are 98, 1.2 and 90%.
  // Every number in that paragraph was an upcoming-only numerator over a
  // season denominator, and the sentence said "in 2026" while counting only
  // rows after today.
  //
  // The ratio and the percentage are SEASON-ONLY claims by construction: their
  // denominator is a season. So when the season does not resolve they are not
  // rescoped, they are WITHHELD, and the opening sentence drops the
  // denominator with it. Sentences 2 and 3 describe the shape of whatever
  // population is in hand, so they are rephrased rather than dropped.
  const season = claim.kind === 'season' ? claim.scope : null;
  const held = claim.kind === 'held';
  const stats = season ? season.promos : promos;
  const counts = season ? season.counts : promoCounts;
  if (stats.length < 15) return null;

  const period =
    season || held
      ? scheduledPeriodPhrase(seasonSpan(stats.map((p) => p.date)))
      : remainingPeriodPhrase(stats.map((p) => p.date)).trimStart();
  const homeGames = HOME_GAMES_BY_LEAGUE[team.league] ?? 0;
  const venueName = venue?.name ?? 'their home venue';

  // 1. Promos per home game ratio. Season populations only, except under the
  //    hold, which reproduces the mixed-scope original on purpose.
  const ratio =
    (season || held) && homeGames > 0 ? (stats.length / homeGames).toFixed(1) : null;

  // 2. Percent of distinct home dates with at least one promo. Same rule.
  const distinctPromoDates = new Set(stats.map((p) => p.date)).size;
  const pctHomeGames =
    (season || held) && homeGames > 0
      ? Math.min(Math.round((distinctPromoDates / homeGames) * 100), 100)
      : null;

  // 3. Giveaway concentration by month (top 1–2 months).
  const giveawayByMonth: Record<number, number> = {};
  for (const p of stats) {
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
  for (const p of stats) {
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
    ? stats.filter((p) => {
        const d = new Date(p.date + 'T12:00:00');
        return d.getDay() === topWeekday[0] && p.type === 'giveaway';
      }).length
    : 0;

  const sentences: string[] = [];

  if ((season || held) && ratio !== null && pctHomeGames !== null) {
    // The remaining clause sits INSIDE the first clause, next to the count it
    // describes. Appended to the end of the paragraph its nearest antecedent was
    // "home dates", so "5 are still to come" read as five home dates rather than
    // five events. The hold emits no clause at all, reproducing the original.
    const remaining = !season
      ? ''
      : season.upcomingCount === 0
        ? ', all of them already played'
        : `, ${season.upcomingCount} of them still to come`;
    sentences.push(
      `The ${teamName} have ${stats.length} promotional events scheduled across ${homeGames} ${team.league} home ${homeGames === 1 ? 'game' : 'games'} ${period}${remaining}, averaging ${ratio} promos per home game. Roughly ${pctHomeGames}% of home dates at ${venueName} have at least one scheduled promotion.`,
    );
  } else if (season || held) {
    sentences.push(
      `The ${teamName} have ${stats.length} promotional events scheduled ${period}.`,
    );
  } else {
    // No season denominator, so no ratio and no percentage. The sentence names
    // the population it counts instead of borrowing the season's noun.
    sentences.push(
      `The ${teamName} have ${stats.length} promotional events still to come${period ? ` ${period}` : ''}.`,
    );
  }

  if (counts.giveaway >= 4 && topMonths.length > 0) {
    const monthList = topMonths.map(([m]) => MONTH_NAMES[m]).join(' and ');
    const scope = season || held ? "the team's" : "the team's remaining";
    sentences.push(
      `Giveaways are most concentrated in ${monthList}: ${topMonthsTotal} of ${scope} ${counts.giveaway} giveaways fall in ${topMonths.length === 1 ? 'that month' : 'those two months'}.`,
    );
    // The season giveaway count is published broad (purchase-gated rows
    // included), so it carries its disclosure wherever it appears.
    if (season?.gatedDisclosure) sentences.push(season.gatedDisclosure);
  }

  if (topWeekday && topWeekday[1] >= 4 && topWeekdayGiveaways >= 2) {
    sentences.push(
      `${WEEKDAYS[topWeekday[0]]} home games are the most promo-heavy${season || held ? '' : ' of what is left'}: ${topWeekday[1]} scheduled events with ${topWeekdayGiveaways} giveaway${topWeekdayGiveaways === 1 ? '' : 's'}.`,
    );
  }

  if (variant === 'light') {
    return (
      <section className="py-10">
        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
            <IconChartBar size={13} stroke={2.25} />
            By the numbers
          </span>
          <h2 className="rd-display text-3xl md:text-4xl text-rd-ink mt-1">
            {teamName.toUpperCase()} PROMO PATTERNS
          </h2>
        </div>
        <div className="bg-rd-card border border-rd-line rounded-2xl p-6 space-y-3">
          {sentences.map((s, i) => (
            <p key={i} className="text-rd-ink-soft text-sm md:text-base leading-relaxed">
              {s}
            </p>
          ))}
        </div>
      </section>
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
