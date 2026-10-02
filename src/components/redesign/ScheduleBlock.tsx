import type { GameContext } from '@/lib/data';
import type { Team } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { formatGameTime } from '@/lib/format-game-time';
import { gamesLabel, groupByMonth, regularSeasonContexts, type ScheduleMonth } from '@/lib/schedule-months';
import { TITLE_SEASON_YEAR } from '@/lib/title-treatment';
import { IconChevronDown } from '@tabler/icons-react';
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
  /** The page's one clock read (YYYY-MM-DD). Decides only whether the date
   *  list may invite a visitor to open a row for tickets. Absent reads as
   *  "no game remains", the direction that cannot make a false claim. */
  today?: string;
}

export function ScheduleBlock({ contexts, team, teamName, today }: ScheduleBlockProps) {
  // Regular season only, one entry per game; see src/lib/schedule-months.ts.
  // The identity on NFL, which the NFL golden test holds byte for byte.
  const regular = regularSeasonContexts(contexts, today);
  const rows = buildRows(regular);
  if (rows.length === 0) return null;

  // THE MONTH SECTIONS ARE MLB ONLY. MLB docs carry no week, so buildRows
  // returns a date list and MLB takes the month sections. Every other league
  // takes the original markup below, unchanged: NFL docs all carry a week (a
  // week grid), and even an NFL slate missing a week renders main's flat list
  // rather than months, so no NFL data state can reach the new path.
  const isWeekGrid = rows.every((r) => r.week !== null);
  if (team.league === 'MLB' && !isWeekGrid) {
    // A game still to be played: scheduled and not before today. A game
    // played today is over even though its date is not past, and a page
    // rendered that evening holds for a day under ISR.
    const remaining =
      today !== undefined && regular.some((c) => c.game.status === 'scheduled' && c.game.date >= today);
    return (
      <DateListSchedule
        rows={rows as GameRow[]}
        teamName={teamName}
        remaining={remaining}
        renderRow={(row) => renderGameRow(row, team, teamName)}
      />
    );
  }

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

            return renderGameRow(row, team, teamName);
          })}
        </ul>

        {tbdNote && (
          <p className="mt-4 font-rd text-xs leading-relaxed text-rd-ink-faint">{tbdNote}</p>
        )}
      </div>
    </section>
  );
}

type GameRow = Extract<Row, { kind: 'game' }>;

// One game row. Shared by the week grid and the date list so the two can never
// render a game differently; moved here verbatim from the week-grid map.
function renderGameRow(row: GameRow, team: Team, teamName: string) {
  const { ctx } = row;
  const { game, isHome, opponentTeam } = ctx;
  const oppName = opponentTeam ? teamDisplayName(opponentTeam) : 'TBD';

  // Away rows get a visible opponent anchor under the toggle. Home
  // rows do not: home is this team's own surface, and the away
  // expand (parking/hotels) is where cross-team travel intent lives.
  // Computed here so the row stays a strings-only client component.
  const opponentHref =
    !isHome && opponentTeam
      ? `/${opponentTeam.sportSlug}/${opponentTeam.id}`
      : null;

  // Kickoff: branch on timeTbd BEFORE formatting. The stored 05:00
  // placeholder is a valid-looking UTC time, so formatting it would
  // print a confident wrong kickoff that no field can flag.
  const kickoffLabel = game.timeTbd
    ? 'TBD'
    : formatGameTime(game.gameTimeTz, game.gameTime, game.date, game.gameTimeZoneAbbrev);

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
      opponentHref={opponentHref}
      opponentName={opponentHref ? oppName : null}
      team={team}
      teamSlug={team.id}
      teamName={teamName}
      sport={team.league}
    />
  );
}

// ── The date list (MLB): the season as collapsed month sections ──
//
// In MLB's offseason this list is an archive of 162 played games, and as one
// flat list it was about 23,400px on a phone and gave the ad placer no anchor
// before its end (first in-content unit ~25,000px down on all 30 clubs,
// measured 2026-10-01). Matt's ruling: an archive, not a wall.
//
// NATIVE <details>/<summary>, ALL COLLAPSED. No `open` attribute is ever
// written, so every month starts shut and the browser, not React, owns the
// state: keyboard toggling and the expanded/collapsed announcement are the
// platform's own. The summary keeps its native role; nothing here sets a
// role, a tabIndex or an outline style that would take any of that away.
//
// EVERY ROW IS IN THE SERVER HTML while collapsed. Closed details content is
// still in the document, so crawlers read all 162 games; nothing loads on
// open, and nothing is virtualized.
//
// AD ANCHORS SIT BETWEEN MONTHS, NEVER INSIDE ONE. Raptive's Content rule is
// `.page-content > *` (skip 2, insert after each remaining child). Each month
// is wrapped in a plain <div> and those wrappers are the page-content
// children, so an inserted unit becomes a sibling of a wrapper: outside every
// <details>, row and expanded panel, whatever the open state. Nothing inside a
// month carries page-content or any other anchor class, and opening a month
// adds no anchor (Raptive does not rescan). Same shape as the promo-row
// groups (src/lib/promo-row-groups.ts): the last month renders OUTSIDE the
// wrapper, so no unit lands between the schedule and the block after it, and a
// single month gets no wrapper at all. Rule tests:
// src/components/redesign/__tests__/schedule-months.test.tsx.
function DateListSchedule({
  rows,
  teamName,
  remaining,
  renderRow,
}: {
  rows: GameRow[];
  teamName: string;
  remaining: boolean;
  renderRow: (row: GameRow) => React.ReactNode;
}) {
  const months = groupByMonth(rows, (r) => r.ctx.game.date);

  const month = (m: ScheduleMonth<GameRow>) => (
    <details className="group/month">
      <summary className="block cursor-pointer list-none rounded-2xl border border-rd-line bg-rd-card px-4 py-3.5 transition-colors hover:bg-rd-cream sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span className="font-rd text-sm font-semibold text-rd-ink sm:text-base">
            {`${m.label} · ${gamesLabel(m.rows.length)}`}
          </span>
          <IconChevronDown
            size={16}
            stroke={2}
            aria-hidden
            className="shrink-0 text-rd-ink-decor transition-transform group-open/month:rotate-180"
          />
        </span>
      </summary>
      <ul className="mt-2 space-y-2">{m.rows.map((row) => renderRow(row))}</ul>
    </details>
  );

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
          {`${TITLE_SEASON_YEAR} season`}
        </div>
        <h2 className="rd-display mt-1 text-2xl text-rd-ink md:text-3xl">
          {`${teamName} ${TITLE_SEASON_YEAR} Game Schedule`}
        </h2>
        {/* Says what the list is: regular-season games, by month. The ticket
            invitation only while a game is still ahead; over a fully played
            season it would point at expands for games already over. */}
        <p className="mt-2 max-w-2xl font-rd text-sm leading-relaxed text-rd-ink-soft">
          {remaining
            ? `Every game of the ${TITLE_SEASON_YEAR} regular season, by month. Open a month to see its games, and a game for tickets, parking and hotels on the road.`
            : `Every game of the ${TITLE_SEASON_YEAR} regular season, by month. Open a month to see its games.`}
        </p>

        {months === null ? (
          // Unreachable with date-ordered docs; a malformed date must not
          // invent a month, so the rows render as the plain list instead.
          <ul className="mt-6 space-y-2">{rows.map((row) => renderRow(row))}</ul>
        ) : months.length === 1 ? (
          <div className="mt-6">{month(months[0])}</div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* `page-content` here is a Raptive hook, not a style; do not
                rename it, restyle it, or move it onto the <details>. */}
            <div className="space-y-3 page-content">
              {months.slice(0, -1).map((m) => (
                <div key={m.key}>{month(m)}</div>
              ))}
            </div>
            <div>{month(months[months.length - 1])}</div>
          </div>
        )}
      </div>
    </section>
  );
}
