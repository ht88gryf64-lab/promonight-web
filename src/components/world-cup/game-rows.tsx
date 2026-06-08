'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { IconBallFootball } from '@tabler/icons-react';
import type { GameContext } from '@/lib/data';
import type { PromoType, Team } from '@/lib/types';
import { normalizeSport, track } from '@/lib/analytics';
import { isSoccerJerseyPromo } from '@/lib/soccer-jersey';
import { categoryFor } from '@/components/redesign/categories';
import { Modal } from '@/components/ui/modal';

// The game-detail content is the SAME light redesign expand the team-page
// calendar renders. Lazy-loaded (ssr:false) so its affiliate CTAs (TicketsBlock,
// ParkingCTA, HotelsCTA, ShareButton) are not in the initial /world-cup bundle
// or HTML — the modal is mounted only once a row is first opened. The clickable
// rows themselves render server-side (this is a client island, SSR'd to HTML)
// so crawlers still see every game.
const GameExpand = dynamic(
  () => import('@/components/redesign/GameExpand').then((m) => m.GameExpand),
  {
    ssr: false,
    loading: () => (
      <div className="py-10 text-center font-rd text-sm text-rd-ink-soft">Loading game details…</div>
    ),
  },
);

function ymd(date: string): { weekday: string; mon: string; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    mon: dt.toLocaleDateString('en-US', { month: 'short' }),
    day: d,
  };
}

function PromoBadge({ type, title, soccer }: { type: PromoType; title: string; soccer: boolean }) {
  const { color, Icon } = categoryFor(type);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-rd text-[11px] font-semibold ${soccer ? 'ring-1 ring-rd-red' : ''}`}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon size={12} stroke={2.25} className="shrink-0" />
      <span className="truncate">{title}</span>
      {soccer && (
        <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-rd-red px-1.5 text-[9px] uppercase tracking-[0.06em] text-white">
          <IconBallFootball size={9} stroke={2.5} /> WC jersey
        </span>
      )}
    </span>
  );
}

function GameRowButton({
  ctx,
  league,
  onOpen,
}: {
  ctx: GameContext;
  league?: string;
  onOpen: (ctx: GameContext) => void;
}) {
  const { weekday, mon, day } = ymd(ctx.game.date);
  const opponent = ctx.opponentTeam?.name ?? ctx.game.awayTeamSlug;
  return (
    <button
      type="button"
      onClick={() => onOpen(ctx)}
      aria-label={`Game details, vs ${opponent}, ${weekday} ${mon} ${day}`}
      className="flex w-full items-start gap-3 py-2.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red/40"
    >
      <div className="w-11 shrink-0 text-center">
        <div className="font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">{weekday}</div>
        <div className="rd-numerals text-lg leading-none text-rd-ink">{day}</div>
        <div className="font-rd text-[9px] uppercase tracking-[0.08em] text-rd-ink-faint">{mon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-rd text-sm font-semibold text-rd-ink">vs {opponent}</div>
        {ctx.promos.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ctx.promos.map((p, i) => (
              <PromoBadge key={i} type={p.type} title={p.title} soccer={isSoccerJerseyPromo(p, league)} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

interface WorldCupGameRowsProps {
  games: GameContext[];
  /** Live Team object — always present when there are home games to render. */
  team: Team;
  /** Team URL slug / id, e.g. 'boston-red-sox'. */
  teamSlug: string;
  /** Full team name for the reused share payload. */
  teamName: string;
  /** City slug for analytics attribution, e.g. 'boston'. */
  citySlug: string;
}

export function WorldCupGameRows({ games, team, teamSlug, teamName, citySlug }: WorldCupGameRowsProps) {
  const [selected, setSelected] = useState<GameContext | null>(null);

  const onOpen = (ctx: GameContext) => {
    // Same event the team-page calendar fires, attributed to the hub surface.
    track('game_tap', {
      surface: 'web_world_cup',
      team_slug: teamSlug,
      sport: normalizeSport(team.sportSlug),
      game_id: ctx.game.id,
      is_home: ctx.isHome,
      has_promo: ctx.promos.length > 0,
      opponent_slug: ctx.isHome ? ctx.game.awayTeamSlug : ctx.game.homeTeamSlug,
      placement: 'world_cup_card',
      city: citySlug,
    });
    setSelected(ctx);
  };

  const selectedOpponent = selected
    ? selected.opponentTeam?.name ?? selected.game.awayTeamSlug
    : '';

  return (
    <>
      <div className="divide-y divide-rd-line border-t border-rd-line">
        {games.map((ctx) => (
          <GameRowButton
            key={`${ctx.game.date}-${ctx.game.doubleheaderGame ?? 0}`}
            ctx={ctx}
            league={team.league}
            onOpen={onOpen}
          />
        ))}
      </div>

      {selected && (
        <Modal
          isOpen
          variant="light"
          onClose={() => setSelected(null)}
          ariaLabel={`Game details: vs ${selectedOpponent}`}
        >
          <GameExpand
            dateStr={selected.game.date}
            contexts={[selected]}
            team={team}
            teamSlug={teamSlug}
            teamName={teamName}
            surface="web_world_cup"
          />
        </Modal>
      )}
    </>
  );
}
