import type { Metadata } from 'next';
import { pageOpenGraph } from '@/lib/og';
// Barlow Condensed is the display face here. The shared instance is imported
// from its own module so its preloads land on the routes that render it.
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
// rd-root resolves its body face through --font-archivo, which exists only
// inside a scope that binds it (known-issues, finding 22 of the Phase 0 sweep).
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getAllTeams } from '@/lib/data';
import { POSTSEASON_LEAGUES, POSTSEASON_SEASON, getLeaguePageData, postseasonPath } from '@/lib/postseason/data';
import { homeGamesWindow } from '@/lib/postseason/view';
import { HUB_PATH, hubCopy, hubJsonLd, type HubLeagueState } from '@/lib/postseason/metadata';
import { PlayoffsHub, type HubLeague } from '@/components/playoffs/PlayoffsHub';
import { ticketButtons } from '@/components/playoffs/tickets';

// The pipeline revalidates this path whenever a bracket changes, and that is
// the path a change reaches the page by. The timer is the backstop. A render
// whose read fails throws, so it replaces nothing: the last good page stands
// until a render succeeds.
export const revalidate = 600;

/** What the body renders a card for, which is also what the head is written
 *  from. One read for both: getLeaguePageData is cached for the request. */
async function hubStates(): Promise<{ pages: Awaited<ReturnType<typeof getLeaguePageData>>[]; states: HubLeagueState[] }> {
  const pages = await Promise.all(POSTSEASON_LEAGUES.map((l) => getLeaguePageData(l)));
  const states = pages.flatMap((p): HubLeagueState[] => (p.state === 'ok' ? [{ league: p.league, state: 'ok', view: p.view }] : []));
  return { pages, states };
}

export async function generateMetadata(): Promise<Metadata> {
  const { states } = await hubStates();
  const copy = hubCopy(POSTSEASON_SEASON, POSTSEASON_LEAGUES, states);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: copy.canonical },
    // A complete openGraph, with the card and its alt. Without one the page
    // inherits the root layout's, whose og:url is the homepage.
    openGraph: pageOpenGraph(HUB_PATH),
  };
}

export default async function PlayoffsHubPage() {
  const { pages, states } = await hubStates();
  const copy = hubCopy(POSTSEASON_SEASON, POSTSEASON_LEAGUES, states);
  const schemas = hubJsonLd(copy, states.map((s) => (s.state === 'ok' ? s.view.updatedAt : null)));

  const leagues: HubLeague[] = [];
  for (const p of pages) {
    // A league with no document is simply not in the postseason. It gets no
    // card. A league whose document could not be read is not a state: that
    // read threw, this render produced nothing, and the last good page stands.
    if (p.state === 'missing') continue;
    leagues.push({ state: 'ok', league: p.league, href: postseasonPath(p.league), view: p.view, predictions: p.predictions ? p.predictions.hub : null });
  }

  const active = leagues.flatMap((l) => (l.state === 'ok' && l.view.phase.kind === 'active' ? [l.view] : []));
  // The next three days, at most eight rows, across every league. The rest
  // of the week is in the HTML behind "Show all".
  const nextGames = homeGamesWindow(active, new Date());
  const listed = [...nextGames.primary, ...nextGames.rest];

  let tickets = {};
  if (listed.length > 0) {
    const teams = new Map((await getAllTeams()).map((t) => [t.id, t]));
    tickets = ticketButtons(
      listed.map((g) => g.hostTeamId),
      teams,
      'web_playoffs',
      'playoffs_hub',
    );
  }

  return (
    <div className={`${archivoHouse.variable} ${barlowCondensed.variable} rd-root min-h-screen bg-rd-cream`}>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <PlayoffsHub season={POSTSEASON_SEASON} leagues={leagues} nextGames={nextGames} tickets={tickets} />
    </div>
  );
}
