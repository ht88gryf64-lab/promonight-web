import type { Metadata } from 'next';
import { canonicalOpenGraph } from '@/lib/og';
import { notFound } from 'next/navigation';
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getAllTeams } from '@/lib/data';
import {
  POSTSEASON_LEAGUES,
  POSTSEASON_SEASON,
  getBracket,
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
// the backstop. A failed read throws and replaces nothing.
export const revalidate = 600;

type Params = { league: string };

/**
 * One page per league that has a bracket document this season. A league in
 * the route table with no document yet is a 404 until the document exists,
 * and so is anything outside the route table. Nothing here is ever served
 * as "not available": a read that fails throws, and the last good page
 * stands.
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
  if (page.state !== 'ok') return {};
  const copy = leagueCopy(POSTSEASON_SEASON, league, postseasonPath(league), page.view, page.predictions !== null);
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
  if (page.state !== 'ok') notFound();

  const homeGames = page.view.phase.kind === 'active' ? homeGamesWindow([page.view], new Date()) : { primary: [], rest: [] };
  const body: LeagueBody = { state: 'ok', view: page.view, predictions: page.predictions, homeGames, standing: page.standing };
  const teams = new Map((await getAllTeams()).map((t) => [t.id, t]));
  const tickets = ticketButtons(
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
  const panelTickets = seriesTickets(upcoming, teams, 'web_playoffs_league', 'playoffs_league');

  const copy = leagueCopy(POSTSEASON_SEASON, league, postseasonPath(league), page.view, page.predictions !== null);
  const schemas = leagueJsonLd(copy, league, page.view.updatedAt);

  // The cross link goes only to a league whose postseason is underway: its
  // bracket has a series not yet final. That is decided from the bracket
  // alone, so only the bracket is read, not the other page's clubs, parks,
  // promotions or predictions. The other league's read failing costs the
  // link, never this page: this page is about its own document, and that
  // one was read.
  const others = await Promise.all(
    POSTSEASON_LEAGUES.filter((l) => l !== league).map(async (l) => {
      try {
        const read = await getBracket(l);
        return read.state === 'ok' && read.bracket.series.some((s) => s.status !== 'final') ? { league: l, href: postseasonPath(l) } : null;
      } catch (err) {
        console.error(`[postseason] reading ${l} for the cross link on ${postseasonPath(league)} failed; no link`, err);
        return null;
      }
    }),
  );
  const otherLeagues = others.flatMap((o) => (o ? [o] : []));

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
