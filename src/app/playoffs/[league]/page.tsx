import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getAllTeams } from '@/lib/data';
import {
  POSTSEASON_LEAGUES,
  POSTSEASON_SEASON,
  getLeaguePageData,
  getLeaguesWithBracket,
  postseasonLeagueFromSlug,
  postseasonPath,
} from '@/lib/postseason/data';
import { homeGamesThisWeek } from '@/lib/postseason/view';
import { PlayoffsLeague, type LeagueBody } from '@/components/playoffs/PlayoffsLeague';
import { ticketButtons } from '@/components/playoffs/tickets';

// See the hub page: on-demand revalidation is the real path, the timer is
// the backstop for a render that caught a failed read.
export const revalidate = 600;

type Params = { league: string };

/**
 * One page per league that has a bracket document this season. A league in
 * the route table with no document yet is still rendered on demand, as
 * "bracket not available". Anything outside the route table is a 404.
 */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    return (await getLeaguesWithBracket()).map((l) => ({ league: l.toLowerCase() }));
  } catch (err) {
    console.error('[postseason] listing bracket documents failed at build; league pages render on demand', err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { league: slug } = await params;
  const league = postseasonLeagueFromSlug(slug);
  if (!league) return {};
  // State-neutral on purpose, so the head cannot contradict the body. Open
  // Graph and JSON-LD land at G3.
  return {
    title: `${POSTSEASON_SEASON} ${league} Playoffs Bracket`,
    description: `The ${POSTSEASON_SEASON} ${league} postseason bracket: every series, seed and result, with game times in Eastern and the home games this week.`,
    alternates: { canonical: `https://www.getpromonight.com${postseasonPath(league)}` },
  };
}

export default async function PlayoffsLeaguePage({ params }: { params: Promise<Params> }) {
  const { league: slug } = await params;
  const league = postseasonLeagueFromSlug(slug);
  if (!league) notFound();

  const page = await getLeaguePageData(league);

  let body: LeagueBody;
  let tickets = {};
  if (page.state === 'ok') {
    const weekGames = page.view.phase.kind === 'active' ? homeGamesThisWeek(page.view, new Date()) : [];
    body = { state: 'ok', view: page.view, predictionsLocked: page.predictionsLocked, weekGames };
    if (weekGames.length > 0) {
      const teams = new Map((await getAllTeams()).map((t) => [t.id, t]));
      tickets = ticketButtons(
        weekGames.map((g) => g.hostTeamId),
        teams,
        'web_playoffs_league',
        'playoffs_league',
      );
    }
  } else {
    body = { state: page.state };
  }

  // The cross link goes only to a league whose postseason is underway.
  const others = await Promise.all(POSTSEASON_LEAGUES.filter((l) => l !== league).map((l) => getLeaguePageData(l)));
  const otherLeagues = others.flatMap((o) =>
    o.state === 'ok' && o.view.phase.kind === 'active' ? [{ league: o.league, href: postseasonPath(o.league) }] : [],
  );

  return (
    <div className={`${archivoHouse.variable} ${barlowCondensed.variable} rd-root min-h-screen bg-rd-cream`}>
      <PlayoffsLeague league={league} season={POSTSEASON_SEASON} body={body} tickets={tickets} otherLeagues={otherLeagues} />
    </div>
  );
}
