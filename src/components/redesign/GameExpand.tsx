import type { GameContext } from '@/lib/data';
import type { AnalyticsSurface } from '@/lib/analytics';
import type { Promo, Team } from '@/lib/types';
import { SPORT_ICONS } from '@/lib/types';
import { ShareButton, formatShareDate, type ShareItem } from '@/components/share';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { teamDisplayName } from '@/lib/promo-helpers';
import { formatGameTime } from '@/lib/format-game-time';
import { categoryFor } from './categories';
import { IconFlame, IconMapPin, IconArrowRight } from '@tabler/icons-react';

// Redesign v2 in-place game/promo detail. A faithful, restyled fork of the
// GameDayDetail / GameDetailRow / LegacyPromoDetail blocks in team-calendar.tsx:
// SAME affiliate components (TicketsBlock / ParkingCTA / HotelsCTA) with the
// SAME props and the SAME international-suppression rules, so affiliate_click
// fires identically; SAME ShareButton (placement 'game_card') so share_initiated
// is preserved. The whole expand is one continuous light card — the reused
// affiliate CTAs (white Ticketmaster card, brand-red parking/hotels buttons)
// sit on the light surface, separated by a hairline.

function dayHeader(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** CTA section — sits directly on the light card, separated by a hairline so
 *  the whole expand reads as one continuous light surface. The reused affiliate
 *  components (white Ticketmaster card, brand-red parking/hotels buttons) read
 *  fine on the cream/white surface. */
function CtaTray({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 space-y-4 border-t border-rd-line pt-4">{children}</div>
  );
}

function PromoLine({ promo }: { promo: Promo }) {
  const cat = categoryFor(promo.type);
  return (
    <div className="flex gap-3" style={{ borderLeft: `3px solid ${cat.color}`, paddingLeft: 12 }}>
      <cat.Icon size={20} stroke={2} className="mt-0.5 shrink-0" style={{ color: cat.color }} aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-rd font-semibold"
            style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
          >
            <cat.Icon size={12} stroke={2.25} />
            {cat.label}
          </span>
          {promo.highlight && (
            <span className="inline-flex items-center gap-1 text-[10px] font-rd font-bold uppercase tracking-wide text-rd-red">
              <IconFlame size={12} stroke={2.25} />
              Hot
            </span>
          )}
          {promo.time && (
            <span className="text-rd-ink-faint text-[11px] font-rd">{promo.time}</span>
          )}
        </div>
        <div className="text-rd-ink font-rd font-semibold text-sm">{promo.title}</div>
        {promo.description && (
          <p className="text-rd-ink-soft text-xs mt-0.5 leading-relaxed">{promo.description}</p>
        )}
      </div>
    </div>
  );
}

function GameExpandRow({
  dateStr,
  ctx,
  team,
  teamSlug,
  teamName,
  showDate,
  surface = 'web_team_page',
}: {
  dateStr: string;
  ctx: GameContext;
  team: Team | null;
  teamSlug?: string;
  teamName: string;
  showDate: boolean;
  /** Attribution surface for the reused affiliate CTAs. Defaults to the
   *  team-page value so existing call sites are unchanged; the World Cup host
   *  card passes 'web_world_cup' so its modal CTA clicks attribute to the hub. */
  surface?: AnalyticsSurface;
}) {
  const { game, isHome, opponentTeam, opponentVenue, promos } = ctx;
  const timeLabel = game.timeTbd ? 'TBD' : formatGameTime(game.gameTimeTz, game.gameTime, game.date);
  const oppName = opponentTeam ? teamDisplayName(opponentTeam) : '';

  // Placement string preserved verbatim from the live calendar so PostHog
  // home_game_card / away_game_card breakdowns stay continuous.
  const placement = isHome ? 'home_game_card' : 'away_game_card';

  const eyebrow = game.isInternational
    ? `International · ${game.internationalLocation ?? game.venueName}`
    : isHome
      ? 'Home game'
      : `At ${opponentVenue?.name || 'opponent venue'}`;

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
      className={`rounded-2xl bg-rd-card p-5 border ${isHome ? 'border-rd-red/30' : 'border-rd-line'}`}
    >
      {showDate && (
        <div className="font-rd text-[11px] tracking-[0.12em] uppercase text-rd-red font-semibold mb-3">
          {dayHeader(dateStr)}
          {game.league === 'nfl' && game.week != null && ` · Week ${game.week}`}
          {game.doubleheaderGame && ` · Doubleheader Game ${game.doubleheaderGame}`}
          {game.status !== 'scheduled' && ` · ${game.status.toUpperCase()}`}
          {game.isPostseason && ` · Playoffs`}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-rd text-[11px] tracking-[0.12em] uppercase text-rd-ink-faint">
            {eyebrow}
          </div>
          <div className="rd-display text-xl md:text-2xl text-rd-ink mt-1">
            {isHome ? 'vs' : 'at'} {oppName}
          </div>
          {game.isInternational && (
            <div className="text-rd-ink-soft text-xs mt-1">{game.venueName}</div>
          )}
          {!game.isInternational && opponentVenue && !isHome && (
            <div className="inline-flex items-center gap-1 text-rd-ink-soft text-xs mt-1">
              <IconMapPin size={12} stroke={2} />
              {opponentVenue.name}
              {opponentVenue.address
                ? ` · ${opponentVenue.address.split(',').slice(-3, -2)[0]?.trim() || opponentVenue.address}`
                : ''}
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
            <div className="font-rd text-xs text-rd-ink-faint whitespace-nowrap">{timeLabel}</div>
          )}
        </div>
      </div>

      {promos.length > 0 && (
        <div className="space-y-2 mb-1">
          {promos.map((p, i) => (
            <PromoLine key={i} promo={p} />
          ))}
        </div>
      )}

      {/* CTA stack — reused verbatim from the live calendar (same components,
       *  same props, same international-suppression). Housed in a charcoal tray
       *  so the dark CTA styling reads as intentional. */}
      <CtaTray>
        {team && (
          <TicketsBlock
            team={team}
            surface={surface}
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
                surface={surface}
                placement={placement}
                compact
              />
            )}
            {!game.isInternational && (
              <HotelsCTA
                team={opponentTeam}
                venue={opponentVenue}
                surface={surface}
                placement={placement}
                gameDate={game.date}
                variant="modal-row"
              />
            )}
            <a
              href={`/${opponentTeam.sportSlug}/${opponentTeam.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-rd tracking-[0.08em] uppercase text-rd-ink-soft hover:text-rd-ink transition-colors"
            >
              View {oppName} full schedule
              <IconArrowRight size={13} stroke={2} />
            </a>
          </>
        )}
      </CtaTray>
    </div>
  );
}

/** All games on a date (doubleheaders → multiple rows). */
export function GameExpand({
  dateStr,
  contexts,
  team,
  teamSlug,
  teamName,
  surface = 'web_team_page',
  showTeamLink = false,
}: {
  dateStr: string;
  contexts: GameContext[];
  team: Team | null;
  teamSlug?: string;
  teamName: string;
  /** Forwarded to the reused affiliate CTAs. Defaults to the team-page value. */
  surface?: AnalyticsSurface;
  /** When true, render a "View full schedule" link to the team's own page.
   *  Set by callers OFF the team page (the homepage modal); the team-page list
   *  and the calendar's inline expand leave it false — the user is already on
   *  the team page. Gated explicitly (not inferred from surface) because the
   *  team-page list surface is also on the team page. */
  showTeamLink?: boolean;
}) {
  return (
    <div className="space-y-4">
      {contexts.map((c, i) => (
        <GameExpandRow
          key={`${c.game.id}-${i}`}
          dateStr={dateStr}
          ctx={c}
          team={team}
          teamSlug={teamSlug}
          teamName={teamName}
          showDate={i === 0}
          surface={surface}
        />
      ))}
      {showTeamLink && team && (
        <a
          href={`/${team.sportSlug}/${team.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-rd tracking-[0.08em] uppercase text-rd-ink-soft hover:text-rd-ink transition-colors"
        >
          View full schedule
          <IconArrowRight size={13} stroke={2} />
        </a>
      )}
    </div>
  );
}

/** Legacy promo-only detail for a date (non-schedule leagues). */
export function LegacyPromoExpand({
  dateStr,
  promos,
  team,
  teamSlug,
  surface = 'web_team_page',
  showTeamLink = false,
}: {
  dateStr: string;
  promos: Promo[];
  team: Team | null;
  teamSlug?: string;
  /** Attribution surface for the reused affiliate CTA. Defaults to the team-page
   *  value so the calendar's inline use is unchanged. */
  surface?: AnalyticsSurface;
  /** See GameExpand — explicit "View full schedule" gate for off-team-page
   *  callers (the homepage modal). */
  showTeamLink?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-rd-card border border-rd-red/30 p-5">
      <div className="font-rd text-[11px] tracking-[0.12em] uppercase text-rd-red font-semibold mb-3">
        {dayHeader(dateStr)}
      </div>
      <div className="space-y-3">
        {promos.map((p, i) => (
          <div key={i}>
            <PromoLine promo={p} />
            {p.opponent && (
              <div className="text-rd-ink-faint text-[10px] font-rd mt-1 ml-[27px] uppercase tracking-[0.08em]">
                vs {p.opponent}
              </div>
            )}
            {team && teamSlug && (
              <CtaTray>
                <TicketsBlock
                  team={team}
                  surface={surface}
                  placement="promo_card"
                  promoId={`${teamSlug}:${p.date}:${p.title}`}
                  variant="card"
                />
              </CtaTray>
            )}
          </div>
        ))}
      </div>
      {showTeamLink && team && (
        <div className="mt-4">
          <a
            href={`/${team.sportSlug}/${team.id}`}
            className="inline-flex items-center gap-1 text-[11px] font-rd tracking-[0.08em] uppercase text-rd-ink-soft hover:text-rd-ink transition-colors"
          >
            View full schedule
            <IconArrowRight size={13} stroke={2} />
          </a>
        </div>
      )}
    </div>
  );
}
