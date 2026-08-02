import type { GameContext } from '@/lib/data';
import type { Team } from '@/lib/types';
import type { CapturePageType } from '@/lib/analytics';
import { getTeamBySlug } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';
import { VENUE_CITY_OVERRIDES } from '@/lib/venue-cities';
import {
  EMPTY_CHIP_POOL,
  venueCitySiblingSlugs,
  type CaptureChipPool,
  type CaptureChipTeam,
} from '@/lib/capture/chips';
import { CaptureTrigger } from './CaptureTrigger';

// Server half of the capture trigger: resolves the chip candidates, hands them
// to the client half, renders nothing itself.
//
// WHY A SEPARATE COMPONENT. Chips need a display name, a league and a sport for
// teams that are not the page's team, and none of that exists on the client. The
// alternative was threading a prop from the route through RedesignTeamPage,
// which would have put capture plumbing in the signature of the whole team page.
// An async server component sitting exactly where the trigger already mounted
// keeps the change to one element.
//
// WHAT IT COSTS. Opponents come free out of gameContexts, which the page already
// has. Venue-city siblings are one Firestore doc read each, and only for the
// handful of teams that have any: VENUE_CITY_OVERRIDES holds about two dozen
// entries and only a third of those pair up, so across 167 statically generated
// pages this is on the order of ten extra reads at build time.

function toChipTeam(team: Team): CaptureChipTeam {
  return {
    id: team.id,
    // The nickname alone. Three chips have to share one row at 320px.
    name: team.name,
    displayName: teamDisplayName(team),
    league: team.league,
    sportSlug: team.sportSlug,
  };
}

/**
 * Distinct opponents across the page team's schedule, in schedule order.
 *
 * The client picks from this by the opponent_slug it saw on the games the
 * visitor actually opened, so the whole set has to be here: which ones matter is
 * not knowable until they tap.
 */
function opponentsFrom(gameContexts: GameContext[] | undefined): CaptureChipTeam[] {
  if (!gameContexts?.length) return [];
  const seen = new Set<string>();
  const out: CaptureChipTeam[] = [];
  for (const ctx of gameContexts) {
    const opponent = ctx.opponentTeam;
    // Null whenever the opponent slug is not a team we hold, which is routine
    // for international and exhibition fixtures.
    if (!opponent || seen.has(opponent.id)) continue;
    seen.add(opponent.id);
    out.push(toChipTeam(opponent));
  }
  return out;
}

async function venueCityFrom(teamId: string): Promise<CaptureChipTeam[]> {
  const slugs = venueCitySiblingSlugs(teamId, VENUE_CITY_OVERRIDES);
  if (slugs.length === 0) return [];
  const teams = await Promise.all(slugs.map((slug) => getTeamBySlug(slug)));
  return teams.filter((t): t is Team => t !== null).map(toChipTeam);
}

export interface CaptureTriggerHostProps {
  pageType: CapturePageType;
  /** Null on aggregators, which have no page-level team and so no chip pool. */
  team: Team | null;
  gameContexts?: GameContext[];
}

export async function CaptureTriggerHost({
  pageType,
  team,
  gameContexts,
}: CaptureTriggerHostProps) {
  if (!team) {
    return <CaptureTrigger pageType={pageType} team={null} pool={EMPTY_CHIP_POOL} />;
  }

  const pool: CaptureChipPool = {
    opponents: opponentsFrom(gameContexts),
    venueCity: await venueCityFrom(team.id),
  };

  return <CaptureTrigger pageType={pageType} team={toChipTeam(team)} pool={pool} />;
}
