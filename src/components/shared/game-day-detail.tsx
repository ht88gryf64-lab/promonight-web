import type { Promo, Team } from '@/lib/types';
import { PROMO_TYPE_COLORS, SPORT_ICONS } from '@/lib/types';
import { PromoBadge } from '@/components/promo-badge';
import { ShareButton, formatShareDate, type ShareItem } from '@/components/share';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { teamDisplayName } from '@/lib/promo-helpers';
import type { GameContext } from '@/lib/data';
import { formatGameTime } from '@/lib/format-game-time';

// Shared modal-body renderers for a single calendar day. Extracted verbatim from
// team-calendar.tsx so the homepage's Upcoming-Promos modal renders byte-identical
// content to the team-page calendar modal. The team calendar imports these back.
//
// These are pure presentational components — no analytics fire here. The
// surface-attributed `game_tap` / `promo_card_tap` events are emitted by each
// entry point (the calendar's onCellClick, the homepage card wrapper), not by
// the body, so reusing the body never double-fires or mis-attributes a tap.

export function dayHeader(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function GameDayDetail({
  dateStr,
  contexts,
  team,
  teamSlug,
  teamName,
}: {
  dateStr: string;
  contexts: GameContext[];
  team: Team | null;
  teamSlug?: string;
  teamName: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      {contexts.map((c, i) => (
        <GameDetailRow
          key={`${c.game.id}-${i}`}
          dateStr={dateStr}
          ctx={c}
          team={team}
          teamSlug={teamSlug}
          teamName={teamName}
          showDate={i === 0}
        />
      ))}
    </div>
  );
}

export function GameDetailRow({
  dateStr,
  ctx,
  team,
  teamSlug,
  teamName,
  showDate,
}: {
  dateStr: string;
  ctx: GameContext;
  team: Team | null;
  teamSlug?: string;
  teamName: string;
  showDate: boolean;
}) {
  const { game, isHome, opponentTeam, opponentVenue, promos } = ctx;
  // NFL games whose kickoff is still flex-pending render "TBD" rather than
  // ESPN's 05:00Z (midnight Eastern) placeholder.
  const timeLabel = game.timeTbd
    ? 'TBD'
    : formatGameTime(game.gameTimeTz, game.gameTime, game.date);
  const oppName = opponentTeam ? teamDisplayName(opponentTeam) : '';
  const oppSlug = isHome ? game.awayTeamSlug : game.homeTeamSlug;

  const placement = isHome ? 'home_game_card' : 'away_game_card';

  // For international games (NFL-only today) the eyebrow flips to a
  // neutral-site label rather than "Home game" / "At {opponentVenue.name}".
  // The actual venue (Melbourne Cricket Ground etc.) is captured on
  // game.venueName and could be surfaced as a follow-up; for now the
  // city alone gives enough context.
  const eyebrow = game.isInternational
    ? `International · ${game.internationalLocation ?? game.venueName}`
    : isHome
      ? 'Home game'
      : `At ${opponentVenue?.name || 'opponent venue'}`;

  // Share payload for this game. Gated on `team` (always present on team
  // pages); leads with the matchup, falls back to the sport emoji when the
  // game carries no promo of its own.
  const shareItem: ShareItem | null = team
    ? {
        icon: promos[0]?.icon ?? SPORT_ICONS[team.league] ?? '🎟️',
        promoTitle: `${isHome ? 'vs' : 'at'} ${oppName}`.trim(),
        teamName,
        date: formatShareDate(dateStr),
        venue: game.venueName || null,
        sport: team.sportSlug,
        teamSlug: team.id,
        promoType: promos[0]?.type ?? 'game',
        primaryColor: team.primaryColor,
      }
    : null;

  return (
    <div
      className={`bg-bg-card rounded-2xl p-5 ${isHome ? 'border border-accent-red/30' : 'border border-border-subtle'}`}
    >
      {showDate && (
        <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent-red mb-3">
          {dayHeader(dateStr)}
          {game.league === 'nfl' && game.week != null && ` · Week ${game.week}`}
          {game.doubleheaderGame && ` · Doubleheader Game ${game.doubleheaderGame}`}
          {game.status !== 'scheduled' && ` · ${game.status.toUpperCase()}`}
          {game.isPostseason && ` · Playoffs`}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted">
            {eyebrow}
          </div>
          <div className="font-display text-lg md:text-xl tracking-[0.5px] text-white mt-1">
            {isHome ? 'vs' : 'at'} {oppName}
          </div>
          {game.isInternational && (
            <div className="text-text-secondary text-xs mt-1">
              {game.venueName}
            </div>
          )}
          {!game.isInternational && opponentVenue && !isHome && (
            <div className="text-text-secondary text-xs mt-1">
              {opponentVenue.name}
              {opponentVenue.address ? ` · ${opponentVenue.address.split(',').slice(-3, -2)[0]?.trim() || opponentVenue.address}` : ''}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {shareItem && (
            <ShareButton
              item={shareItem}
              placement="game_card"
              label={`Share ${isHome ? 'vs' : 'at'} ${oppName}`}
            />
          )}
          {timeLabel && (
            <div className="font-mono text-xs text-text-dim whitespace-nowrap">{timeLabel}</div>
          )}
        </div>
      </div>

      {promos.length > 0 && (
        <div className="space-y-2 mb-4">
          {promos.map((p, i) => (
            <div
              key={i}
              className="flex gap-3"
              style={{ borderLeft: `3px solid ${PROMO_TYPE_COLORS[p.type]}`, paddingLeft: '12px' }}
            >
              <span className="text-xl" aria-hidden="true">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <PromoBadge type={p.type} />
                  {p.highlight && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                      HOT
                    </span>
                  )}
                </div>
                <div className="text-white font-semibold text-sm">{p.title}</div>
                {p.description && (
                  <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">
                    {p.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA stack — tickets always; parking + hotels for away games where
       *  the user is travelling to the opponent's venue. All three sections
       *  use the polished `variant='card'` look so the modal reads as a
       *  uniform stack regardless of which CTAs apply.
       *
       *  Parking and Hotels suppress on international neutral-site games:
       *  opponentVenue points to the opponent's HOME city (e.g. SoFi for a
       *  49ers-at-Rams game), but the game is actually in Melbourne or
       *  London. The CTAs would key on the wrong city, and SpotHero is
       *  US-only. TicketsBlock keeps rendering because the team-page
       *  Ticketmaster URL is valid regardless of game venue. */}
      <div className="mt-4 space-y-4">
        {team && (
          <TicketsBlock
            team={team}
            surface="web_team_page"
            placement={placement}
            promoId={teamSlug ? `${teamSlug}:${game.date}:${game.id}` : undefined}
            variant="card"
          />
        )}
        {!isHome && opponentTeam && (
          <>
            {!game.isInternational && (
              <ParkingCTA
                team={opponentTeam}
                venue={opponentVenue}
                surface="web_team_page"
                placement={placement}
                compact
              />
            )}
            {!game.isInternational && (
              <HotelsCTA
                team={opponentTeam}
                venue={opponentVenue}
                surface="web_team_page"
                placement={placement}
                gameDate={game.date}
                variant="modal-row"
              />
            )}
            <a
              href={`/${opponentTeam.sportSlug}/${opponentTeam.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-mono tracking-[0.08em] uppercase text-text-secondary hover:text-white transition-colors"
            >
              View {oppName} full schedule →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function LegacyPromoDetail({
  dateStr,
  promos,
  team,
  teamSlug,
}: {
  dateStr: string;
  promos: Promo[];
  team: Team | null;
  teamSlug?: string;
}) {
  return (
    <div className="mt-4 bg-bg-card border border-accent-red/30 rounded-2xl p-5">
      <div className="font-mono text-[10px] tracking-[1px] uppercase text-accent-red mb-3">
        {dayHeader(dateStr)}
      </div>
      <div className="space-y-3">
        {promos.map((p, i) => (
          <div
            key={i}
            className="flex gap-3"
            style={{ borderLeft: `3px solid ${PROMO_TYPE_COLORS[p.type]}`, paddingLeft: '12px' }}
          >
            <span className="text-xl">{p.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <PromoBadge type={p.type} />
                {p.highlight && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
                    HOT
                  </span>
                )}
                {p.time && (
                  <span className="text-text-dim text-[10px] font-mono">{p.time}</span>
                )}
              </div>
              <div className="text-white font-semibold text-sm">{p.title}</div>
              {p.description && (
                <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">
                  {p.description}
                </p>
              )}
              {p.opponent && (
                <div className="text-text-dim text-[10px] font-mono mt-1 uppercase tracking-[0.5px]">
                  vs {p.opponent}
                </div>
              )}
              {team && teamSlug && (
                <div className="mt-3">
                  <TicketsBlock
                    team={team}
                    surface="web_team_page"
                    placement="promo_card"
                    promoId={`${teamSlug}:${p.date}:${p.title}`}
                    variant="card"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
