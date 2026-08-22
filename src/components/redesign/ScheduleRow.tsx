'use client';

import { useState } from 'react';
import type { GameContext } from '@/lib/data';
import type { Team } from '@/lib/types';
import { normalizeSport, track } from '@/lib/analytics';
import { GameExpand } from './GameExpand';
import { IconChevronDown, IconArrowRight } from '@tabler/icons-react';

// One expandable game row inside ScheduleBlock. Deliberately thin: every label
// is computed by the server parent and passed in as a string, so the row text
// (week, date, matchup, venue, kickoff) is in the crawlable HTML and this file
// holds nothing but open state, the click handlers, and the analytics calls.
//
// Away rows additionally carry an always-visible opponent anchor UNDER the
// toggle button, a sibling of it, never inside it (an <a> may not nest in a
// <button>). It exists because the expand is lazy-mounted (see below), which
// leaves zero cross-team links in the SSR HTML of a zero-promo page; this
// anchor is the crawlable, tap-visible path to the opponent's page.
//
// GameExpand is LAZY MOUNTED, never server-rendered-and-hidden. That is load
// bearing for two reasons:
//   1. Affiliate anchors. An always-mounted expand puts the full CTA tray in the
//      SSR HTML on every row, which would swamp the crawlable body of a page
//      whose whole purpose is unique schedule text.
//   2. The email capture sheet. away_game_expanded is one of three TriggerSignal
//      values in lib/capture/gesture-counter.ts, at the highest precedence and
//      the lowest threshold. A row that is already open emits no gesture, so
//      server-rendering the expand would silently remove a live capture path.
// SSR and the client first render agree on omitting the expand (open starts
// false), so there is no hydration mismatch.

export interface ScheduleRowProps {
  ctx: GameContext;
  /** Server-computed labels. Strings only, so the row is deterministic. */
  weekLabel: string;
  dateLabel: string;
  matchupLabel: string;
  kickoffLabel: string;
  /** Venue for this specific game, read from game.venueName by the parent. */
  venueLabel: string;
  /** "International, Melbourne" style tag, or null for a domestic game. */
  locationLabel: string | null;
  /** Away rows only: opponent team-page href + display name for the visible
      anchor under the toggle. Null/omitted renders no anchor (home rows, and
      away rows whose opponent doc is missing). */
  opponentHref?: string | null;
  opponentName?: string | null;
  team: Team | null;
  teamSlug: string;
  teamName: string;
  /** League string, normalized inside the analytics call. */
  sport: string;
}

export function ScheduleRow({
  ctx,
  weekLabel,
  dateLabel,
  matchupLabel,
  kickoffLabel,
  venueLabel,
  locationLabel,
  opponentHref,
  opponentName,
  team,
  teamSlug,
  teamName,
  sport,
}: ScheduleRowProps) {
  const [open, setOpen] = useState(false);
  const { game, isHome } = ctx;

  // Analytics mirror CalendarGrid.onCellClick: fire on OPEN only, game_tap for
  // every game and away_game_expanded additionally for away games. Both events
  // carry a placement so this emitter stays separable from the calendar's.
  // Firing only away_game_expanded would raise the numerator of the saved
  // away-expansion ratio while leaving game_tap flat, which would read as thesis
  // movement when it is purely structural.
  const onToggle = () => {
    const shouldOpen = !open;
    setOpen(shouldOpen);
    if (!shouldOpen || !teamSlug) return;

    const normalizedSport = normalizeSport(sport);
    track('game_tap', {
      surface: 'web_team_page',
      team_slug: teamSlug,
      sport: normalizedSport,
      game_id: game.id,
      is_home: isHome,
      has_promo: ctx.promos.length > 0,
      opponent_slug: isHome ? game.awayTeamSlug : game.homeTeamSlug,
      placement: 'schedule_block_row',
    });
    if (!isHome) {
      track('away_game_expanded', {
        surface: 'web_team_page',
        team_slug: teamSlug,
        sport: normalizedSport,
        game_id: game.id,
        opponent_slug: game.homeTeamSlug,
        has_promo: ctx.promos.length > 0,
        placement: 'schedule_block_away_row',
      });
    }
  };

  return (
    <li
      className={`overflow-hidden rounded-2xl border bg-rd-card ${
        isHome ? 'border-rd-red/30' : 'border-rd-line'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-rd-cream sm:gap-4 sm:px-5"
      >
        <span className="w-[52px] shrink-0 sm:w-[60px]">
          <span className="block font-rd text-[10px] uppercase tracking-[0.12em] text-rd-ink-faint">
            {weekLabel}
          </span>
          <span className="block font-rd text-xs text-rd-ink-soft">{dateLabel}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-rd text-sm font-semibold text-rd-ink sm:text-base">
              {matchupLabel}
            </span>
            <span
              className={`inline-flex rounded-full px-1.5 py-px font-rd text-[10px] font-semibold uppercase tracking-[0.08em] ${
                isHome ? 'bg-rd-red/[0.10] text-rd-red' : 'bg-rd-ink/[0.06] text-rd-ink-faint'
              }`}
            >
              {isHome ? 'Home' : 'Away'}
            </span>
            {locationLabel && (
              <span className="inline-flex rounded-full bg-rd-ink/[0.06] px-1.5 py-px font-rd text-[10px] font-semibold uppercase tracking-[0.08em] text-rd-ink-faint">
                {locationLabel}
              </span>
            )}
          </span>
          {venueLabel && (
            <span className="mt-0.5 block truncate font-rd text-xs text-rd-ink-faint">
              {venueLabel}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap font-rd text-xs text-rd-ink-soft sm:text-sm">
            {kickoffLabel}
          </span>
          <IconChevronDown
            size={15}
            stroke={2}
            aria-hidden
            className={`text-rd-ink-decor transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Sibling of the button, never a child: the opponent link must be a
          real crawlable anchor and an <a> cannot nest inside a <button>.
          Rides team_tile_tap (team-discovery family) rather than a new event
          name; from_tab separates it from the rivals grid on the same page.
          Plain <a> is a full-document navigation, so the event fires on
          mousedown (not click) to land before teardown — mirrors the
          VenueHubLink / affiliate-link tracking convention. */}
      {opponentHref && opponentName && (
        <div className="border-t border-rd-line px-4 pb-2.5 pt-2 sm:px-5">
          <a
            href={opponentHref}
            onMouseDown={() => {
              track('team_tile_tap', {
                surface: 'team_page',
                team_id: isHome ? game.awayTeamSlug : game.homeTeamSlug,
                league: sport,
                from_tab: 'schedule_away_row',
                is_homepage_sample: false,
              });
            }}
            className="inline-flex items-center gap-1 font-rd text-[11px] uppercase tracking-[0.08em] text-rd-ink-soft transition-colors hover:text-rd-ink"
          >
            {opponentName} schedule
            <IconArrowRight size={13} stroke={2} aria-hidden />
          </a>
        </div>
      )}

      {open && (
        <div className="border-t border-rd-line px-3 pb-4 pt-4 sm:px-4">
          <GameExpand
            dateStr={game.date}
            contexts={[ctx]}
            team={team}
            teamSlug={teamSlug}
            teamName={teamName}
            showOpponentLink={!opponentHref}
          />
        </div>
      )}
    </li>
  );
}
