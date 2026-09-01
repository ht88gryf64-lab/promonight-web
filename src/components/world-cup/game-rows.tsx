import { IconBallFootball } from '@tabler/icons-react';
import type { GameContext } from '@/lib/data';
import type { PromoType, Team } from '@/lib/types';
import { isSoccerJerseyPromo } from '@/lib/soccer-jersey';
import { categoryFor } from '@/components/redesign/categories';

// Completed fixture rows for the /world-cup retrospective. Server component.
//
// WAS: a client island where each row was a button opening a Modal that
// lazy-loaded GameExpand. That modal is the team page's live game detail, and it
// renders TicketsBlock, ParkingCTA and HotelsCTA. Because the import was
// ssr:false those CTAs never appeared in the served HTML, so an audit that
// counts anchors read the page as carrying 55 affiliate links when it actually
// carried 55 plus a live ticket, parking and hotel CTA one click behind every
// one of 186 game rows.
//
// Removing only the visible rail would have left that behind. A retrospective
// must not sell a ticket to a match played in June, and the row detail has
// nothing else to show once the CTAs are gone, so the rows are now static text.
// The tournament date and opponent were always the informational payload.

function ymd(date: string): { weekday: string; mon: string; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    mon: dt.toLocaleDateString('en-US', { month: 'short' }),
    day: d,
  };
}

// Overflow-safe promo pill. max-w-full keeps a single pill within the
// (min-w-0) game-info column; flex-wrap + overflow-wrap let a long title and the
// soccer "WC JERSEY" sub-pill wrap to a new line on narrow widths instead of
// bleeding past the card's right padding. rounded-2xl reads cleanly when wrapped.
function PromoBadge({ type, title, soccer }: { type: PromoType; title: string; soccer: boolean }) {
  const { color, Icon, ink } = categoryFor(type);
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl px-2 py-0.5 font-rd text-[11px] font-semibold ${soccer ? 'ring-1 ring-rd-red' : ''}`}
      style={{ backgroundColor: `${color}1a`, color: ink }}
    >
      <Icon size={12} stroke={2.25} className="shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
      {soccer && (
        <span className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rd-red px-1.5 text-[9px] uppercase tracking-[0.06em] text-white">
          <IconBallFootball size={9} stroke={2.5} /> WC jersey
        </span>
      )}
    </span>
  );
}

function GameRow({ ctx, league }: { ctx: GameContext; league?: string }) {
  const { weekday, mon, day } = ymd(ctx.game.date);
  const opponent = ctx.opponentTeam?.name ?? ctx.game.awayTeamSlug;
  return (
    <div
      aria-label={`Completed game, vs ${opponent}, ${weekday} ${mon} ${day}, 2026`}
      className="flex w-full items-start gap-3 py-2.5 text-left"
    >
      <div className="w-11 shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">{weekday}</div>
        <div className="rd-numerals text-lg leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[9px] uppercase tracking-[0.08em] text-rd-ink-faint">{mon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-rd text-sm font-semibold text-rd-ink [overflow-wrap:anywhere]">vs {opponent}</div>
        {ctx.promos.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ctx.promos.map((p, i) => (
              <PromoBadge key={i} type={p.type} title={p.title} soccer={isSoccerJerseyPromo(p, league)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorldCupGameRowsProps {
  games: GameContext[];
  /** Live Team object, always present when there are home games to render.
   *  Only `league` is read now, for the soccer-jersey badge test. */
  team: Team;
}

// teamSlug, teamName and citySlug are gone with the modal. They existed to fill
// the GameExpand share payload and the game_tap analytics event, and a static
// row fires neither.

export function WorldCupGameRows({ games, team }: WorldCupGameRowsProps) {
  return (
    <div className="divide-y divide-rd-line border-t border-rd-line">
      {games.map((ctx) => (
        <GameRow
          key={`${ctx.game.date}-${ctx.game.doubleheaderGame ?? 0}`}
          ctx={ctx}
          league={team.league}
        />
      ))}
    </div>
  );
}
