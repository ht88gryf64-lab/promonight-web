import type { Metadata } from 'next';
import { canonicalOpenGraph } from '@/lib/og';
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
import { homeGamesWindow } from '@/lib/postseason/view';
import { leagueCopy, leagueJsonLd } from '@/lib/postseason/metadata';
import { PlayoffsLeague, type LeagueBody } from '@/components/playoffs/PlayoffsLeague';
import { seriesTickets, ticketButtons } from '@/components/playoffs/tickets';

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
  // Written from the same read the body renders, which is cached for the
  // request, so the head says what the body says.
  const page = await getLeaguePageData(league);
  const copy = leagueCopy(POSTSEASON_SEASON, league, postseasonPath(league), page.state === 'ok' ? page.view : null);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: copy.canonical },
    // og:url is the canonical, from the same string, so the two cannot drift.
    openGraph: canonicalOpenGraph(copy.canonical),
  };
}

export default async function PlayoffsLeaguePage({ params }: { params: Promise<Params> }) {
  const { league: slug } = await params;
  const league = postseasonLeagueFromSlug(slug);
  if (!league) notFound();

  const page = await getLeaguePageData(league);

  let body: LeagueBody;
  let tickets = {};
  let panelTickets = {};
  if (page.state === 'ok') {
    const homeGames = page.view.phase.kind === 'active' ? homeGamesWindow([page.view], new Date()) : { primary: [], rest: [] };
    body = { state: 'ok', view: page.view, predictionsLocked: page.predictionsLocked, homeGames };
    const teams = new Map((await getAllTeams()).map((t) => [t.id, t]));
    tickets = ticketButtons(
      [...homeGames.primary, ...homeGames.rest].map((g) => g.hostTeamId),
      teams,
      'web_playoffs_league',
      'playoffs_league',
    );
    // A series' detail sells tickets for the host of its next game that is
    // still to be played, and only when that host is a club.
    const upcoming = page.view.rounds.flatMap((r) =>
      r.groups.flatMap((g) =>
        g.series.map((s) => ({ id: s.id, hostTeamId: s.next && s.next.state === 'scheduled' ? s.next.hostTeamId : null })),
      ),
    );
    panelTickets = seriesTickets(upcoming, teams, 'web_playoffs_league', 'playoffs_league');
  } else {
    body = { state: page.state };
  }

  const copy = leagueCopy(POSTSEASON_SEASON, league, postseasonPath(league), page.state === 'ok' ? page.view : null);
  const schemas = leagueJsonLd(copy, league, page.state === 'ok' ? page.view.updatedAt : null);

  // The cross link goes only to a league whose postseason is underway.
  const others = await Promise.all(POSTSEASON_LEAGUES.filter((l) => l !== league).map((l) => getLeaguePageData(l)));
  const otherLeagues = others.flatMap((o) =>
    o.state === 'ok' && o.view.phase.kind === 'active' ? [{ league: o.league, href: postseasonPath(o.league) }] : [],
  );

  return (
    <div className={`${archivoHouse.variable} ${barlowCondensed.variable} rd-root min-h-screen bg-rd-cream`}>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <PlayoffsLeague
        league={league}
        season={POSTSEASON_SEASON}
        body={body}
        tickets={tickets}
        panelTickets={panelTickets}
        otherLeagues={otherLeagues}
      />
    </div>
  );
}
