import { NextResponse, type NextRequest } from 'next/server';
import { getGameById, getTeamBySlug } from '@/lib/data';
import { tnSubId } from '@/lib/affiliates';
import { buildFuboUrl, fuboBlockedByBroadcast, fuboLiveLeague, fuboSubId1, isFuboSurface } from '@/lib/affiliates/fubo';
import { teamDisplayName } from '@/lib/team-display-name';
import { NOINDEX_HEADER } from '@/lib/social-bridge';

// The Fubo out-redirect (2026-11-20, rulings 3 and 4): every "Stream on Fubo"
// link is /go/fubo/{league}/{gameId}?s={surface}&t={teamId} on our own
// domain, and this route answers 307 to the tagged fubo.tv URL
// (src/lib/affiliates/fubo.ts). The club names for sharedid come from the
// game doc and the team docs, never from the query string; the surface must
// be on FUBO_SURFACES and the team must be one of the game's two clubs.
// affiliate_click has already fired in the browser before this request.
//
// Marked noindex and uncached like /p/[code]: it is a hop, not a page.
//
// Answers:
//   valid link                -> fubo.tv with irad, sharedid, subId1
//   game doc unreadable/gone  -> the league's fubo.tv landing, irad + subId1,
//                                no sharedid (the click still lands tagged)
//   anything else (bad league, surface or team; an NFL game on Prime,
//   Netflix or Amazon)        -> the homepage

export const dynamic = 'force-dynamic';

const HOP_HEADERS = { ...NOINDEX_HEADER, 'cache-control': 'private, no-store' };

function hop(target: string, request: NextRequest): Response {
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), { status: 307, headers: HOP_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ league: string; gameId: string }> },
): Promise<Response> {
  const { league: rawLeague, gameId: rawGameId } = await params;
  const league = rawLeague === rawLeague.toLowerCase() ? fuboLiveLeague(rawLeague) : null;
  const surface = request.nextUrl.searchParams.get('s');
  const teamId = request.nextUrl.searchParams.get('t') ?? '';
  if (!league || !isFuboSurface(surface) || !teamId) return hop('/', request);
  let gameId: string;
  try {
    gameId = decodeURIComponent(rawGameId);
  } catch {
    return hop('/', request);
  }

  let game: Awaited<ReturnType<typeof getGameById>> = null;
  let readFailed = false;
  try {
    game = await getGameById(gameId);
  } catch (err) {
    readFailed = true;
    console.error('[go/fubo] game read failed; sending the league landing', err);
  }

  if (!game) {
    // Gone or unreadable: the league landing, tagged, when the team is real.
    const team = await getTeamBySlug(teamId).catch(() => null);
    if (!team || team.sportSlug !== league) return hop('/', request);
    if (!readFailed) console.warn('[go/fubo] no game doc', { league, gameId });
    return hop(buildFuboUrl({ league, subId1: tnSubId(surface, teamId), names: null }), request);
  }

  if (game.league !== league) return hop('/', request);
  if (teamId !== game.homeTeamSlug && teamId !== game.awayTeamSlug) return hop('/', request);
  if (fuboBlockedByBroadcast(league, game.broadcast?.network)) return hop('/', request);

  const [home, away] = await Promise.all([getTeamBySlug(game.homeTeamSlug), getTeamBySlug(game.awayTeamSlug)]);
  const names = home && away ? { home: teamDisplayName(home), away: teamDisplayName(away) } : null;
  return hop(buildFuboUrl({ league, subId1: fuboSubId1(surface, teamId, game), names }), request);
}

export const HEAD = GET;
