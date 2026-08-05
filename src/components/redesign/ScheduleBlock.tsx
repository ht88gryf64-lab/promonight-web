import type { GameContext } from '@/lib/data';
import type { Team } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { formatGameTime } from '@/lib/format-game-time';
import { ScheduleRow } from './ScheduleRow';

// Full-slate season schedule, rendered on team pages that have no promo data.
// Server component: every label below is computed here and shipped as text, so
// the whole schedule is in the crawlable HTML. Nothing routes through the
// calendar's 30-day prerender window, which on an NFL page today ends before the
// season starts and would leave every kickoff time uncrawlable.
//
// WEEK FIRST. The NFL season is a week grid, not a date list, and week is a
// stored field on the game doc (mapGameDoc reads it), not derived from the date.
// Three things follow:
//   1. The bye is the single missing week integer between the first and last
//      week played, so it can be rendered as a row rather than left as a gap.
//   2. A flex-pending kickoff labelled by week reads as the league not having
//      decided yet, which is the truth, instead of reading as missing data.
//   3. Week is how a fan holds a game in their head, which is what the promo
//      rows will need to join against once a corpus exists.
//
// Home and away rows share one list with two treatments. Home is where promos
// will land; away is the travel surface, and its expand carries the parking and
// hotel CTAs.

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Deterministic YYYY-MM-DD to "Sep 11". Built by hand rather than through Date
// so the string cannot shift with the runtime time zone: this component renders
// on the server and its output is compared against the client render.
function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return '';
  const month = MONTH_ABBR[Number(m[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(m[3])}`;
}

type Row =
  | { kind: 'game'; key: string; week: number | null; ctx: GameContext }
  | { kind: 'bye'; key: string; week: number };

// Orders the slate and inserts a bye row for every week with no game, but ONLY
// when every game carries a numeric week. MLB game docs have no week field, so
// that league falls through to a plain date-ordered list with no bye rows rather
// than inventing a week grid it does not have.
function buildRows(contexts: GameContext[]): Row[] {
  const sorted = [...contexts].sort((a, b) => {
    const aw = a.game.week;
    const bw = b.game.week;
    if (typeof aw === 'number' && typeof bw === 'number' && aw !== bw) return aw - bw;
    return a.game.date.localeCompare(b.game.date);
  });

  const allWeeked =
    sorted.length > 0 && sorted.every((c) => typeof c.game.week === 'number');

  if (!allWeeked) {
    return sorted.map((ctx) => ({
      kind: 'game' as const,
      key: ctx.game.id,
      week: typeof ctx.game.week === 'number' ? ctx.game.week : null,
      ctx,
    }));
  }

  // Grouped rather than keyed one-per-week so a future week holding two games
  // renders both instead of silently dropping one.
  const byWeek = new Map<number, GameContext[]>();
  for (const ctx of sorted) {
    const w = ctx.game.week as number;
    const list = byWeek.get(w) ?? [];
    list.push(ctx);
    byWeek.set(w, list);
  }

  const weeks = sorted.map((c) => c.game.week as number);
  const first = Math.min(...weeks);
  const last = Math.max(...weeks);

  const rows: Row[] = [];
  for (let w = first; w <= last; w++) {
    const games = byWeek.get(w);
    if (games && games.length > 0) {
      for (const ctx of games) {
        rows.push({ kind: 'game', key: ctx.game.id, week: w, ctx });
      }
    } else {
      rows.push({ kind: 'bye', key: `bye-${w}`, week: w });
    }
  }
  return rows;
}

export interface ScheduleBlockProps {
  contexts: GameContext[];
  team: Team;
  teamName: string;
}

export function ScheduleBlock({ contexts, team, teamName }: ScheduleBlockProps) {
  const rows = buildRows(contexts);
  if (rows.length === 0) return null;

  // Weeks whose kickoff the league has not set. Named explicitly under the list
  // so "TBD" reads as a scheduling fact rather than as a hole in our data.
  const tbdWeeks = Array.from(
    new Set(
      rows
        .filter((r) => r.kind === 'game' && r.ctx.game.timeTbd === true && r.week !== null)
        .map((r) => (r as { week: number }).week),
    ),
  ).sort((a, b) => a - b);

  // Built only when there is something to say, so there is no half-formed
  // sentence sitting in scope for a later edit to render by accident.
  let tbdNote = '';
  if (tbdWeeks.length === 1) {
    tbdNote = `Kickoff time for Week ${tbdWeeks[0]} is set by NFL flex scheduling and has not been announced yet.`;
  } else if (tbdWeeks.length > 1) {
    const list =
      tbdWeeks.length === 2
        ? `${tbdWeeks[0]} and ${tbdWeeks[1]}`
        : `${tbdWeeks.slice(0, -1).join(', ')} and ${tbdWeeks[tbdWeeks.length - 1]}`;
    tbdNote = `Kickoff times for Weeks ${list} are set by NFL flex scheduling and have not been announced yet.`;
  }

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
          2026 season
        </div>
        {/* "Game Schedule", not "Schedule". The zero-promo copy block below
            carries a shared H2 reading "{YEAR} {TEAM} PROMO SCHEDULE", and two
            headings a word apart on one page is confusing. Disambiguating from
            THIS side keeps the blast radius to the 32 NFL pages: the shared H2
            also renders on 6 non-NFL pages, and "PROMO SCHEDULE" is the closest
            on-page string to the query this page already ranks for. */}
        <h2 className="rd-display mt-1 text-2xl text-rd-ink md:text-3xl">
          {teamName} 2026 Game Schedule
        </h2>
        <p className="mt-2 max-w-2xl font-rd text-sm leading-relaxed text-rd-ink-soft">
          Every game of the 2026 regular season, week by week. Open a row for tickets, and for
          parking and hotels on the road.
        </p>

        <ul className="mt-6 space-y-2">
          {rows.map((row) => {
            if (row.kind === 'bye') {
              return (
                <li
                  key={row.key}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-rd-line px-4 py-2.5 sm:gap-4 sm:px-5"
                >
                  <span className="w-[52px] shrink-0 font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint sm:w-[60px]">
                    {`Week ${row.week}`}
                  </span>
                  <span className="font-rd text-xs uppercase tracking-[0.08em] text-rd-ink-faint">
                    Bye week, no game
                  </span>
                </li>
              );
            }

            const { ctx } = row;
            const { game, isHome, opponentTeam } = ctx;
            const oppName = opponentTeam ? teamDisplayName(opponentTeam) : 'TBD';

            // Kickoff: branch on timeTbd BEFORE formatting. The stored 05:00
            // placeholder is a valid-looking UTC time, so formatting it would
            // print a confident wrong kickoff that no field can flag.
            const kickoffLabel = game.timeTbd
              ? 'TBD'
              : formatGameTime(game.gameTimeTz, game.gameTime, game.date);

            // Venue is the per-game venueName and nothing else. The page-level
            // venue prop is the team's own building, which is wrong for the
            // neutral-site international games, and opponentVenue is the
            // opponent's building, which is wrong for every home row.
            const venueLabel = game.venueName || '';

            const locationLabel = game.isInternational
              ? `International, ${game.internationalLocation ?? game.venueName}`
              : null;

            return (
              <ScheduleRow
                key={row.key}
                ctx={ctx}
                weekLabel={row.week !== null ? `Week ${row.week}` : ''}
                dateLabel={shortDate(game.date)}
                matchupLabel={`${isHome ? 'vs' : 'at'} ${oppName}`}
                kickoffLabel={kickoffLabel}
                venueLabel={venueLabel}
                locationLabel={locationLabel}
                team={team}
                teamSlug={team.id}
                teamName={teamName}
                sport={team.league}
              />
            );
          })}
        </ul>

        {tbdNote && (
          <p className="mt-4 font-rd text-xs leading-relaxed text-rd-ink-faint">{tbdNote}</p>
        )}
      </div>
    </section>
  );
}
