import { TrackedLink } from '@/components/analytics/TrackedLink';
import { Card, CardLabel } from '@/components/venue-hub/venue-logistics';
import type { VenueGames } from '@/lib/postseason/inbound';

const SURFACE = 'web_venue' as const;

/**
 * "Postseason games here", on the page of a park that is hosting. Each game
 * with its date, linked to its series. Server-rendered, in the venue page's
 * own card.
 *
 * A game is listed here because the bracket names one of this building's
 * clubs as its host. The bracket does not name a building.
 */
export function VenuePostseasonGames({ games, buildingSlug }: { games: VenueGames; buildingSlug: string }) {
  return (
    <div data-playoffs-module="venue" data-playoffs-state="hosting" data-building={buildingSlug}>
      <Card accent>
        <CardLabel>Postseason games here</CardLabel>
        <ul className="divide-y divide-rd-line">
          {games.games.map((g) => (
            <li key={g.key} data-venue-game={g.key} className="py-2 first:pt-0 last:pb-0">
              <TrackedLink href={g.href} surface={SURFACE} ctaId="playoffs_module_series" ctaLabel={g.matchup} className="group block">
                <span className="block font-rd text-[15px] font-bold leading-snug text-rd-ink group-hover:text-rd-red">{g.matchup}</span>
                <span className="mt-0.5 block font-rd text-[13px] text-rd-ink-soft">
                  {g.roundLabel} · {g.gameTitle}
                  {g.ifNecessary ? ' · If necessary' : ''}
                </span>
                <span className="mt-0.5 block font-rd text-[13.5px] text-rd-ink">{g.when}</span>
              </TrackedLink>
            </li>
          ))}
        </ul>
        {games.updated.map((u) => (
          <p key={u.league} data-bracket-updated className="mt-2 font-rd text-[12px] text-rd-ink-faint">
            {`${games.updated.length > 1 ? `${u.league} bracket` : 'Bracket'} updated ${u.updatedLabel}`}
          </p>
        ))}
      </Card>
    </div>
  );
}
