import type { Metadata } from 'next';
// Barlow Condensed is the display face here. The shared instance is imported
// from its own module so its preloads land on the routes that render it.
import { barlowCondensed } from '@/components/cfb/rivalry/fonts';
// rd-root resolves its body face through --font-archivo, which exists only
// inside a scope that binds it (known-issues, finding 22 of the Phase 0 sweep).
import { archivoHouse } from '@/components/redesign/fonts-house';
import { getAllTeams } from '@/lib/data';
import { POSTSEASON_LEAGUES, POSTSEASON_SEASON, getLeaguePageData, postseasonPath } from '@/lib/postseason/data';
import { nextHomeGames } from '@/lib/postseason/view';
import { PlayoffsHub, type HubLeague } from '@/components/playoffs/PlayoffsHub';
import { ticketButtons } from '@/components/playoffs/tickets';

// The pipeline revalidates this path whenever a bracket changes, and that is
// the path a change reaches the page by. The timer is the backstop: a render
// that caught a failed read is replaced within ten minutes instead of
// standing until the next bracket change.
export const revalidate = 600;

const PAGE_URL = 'https://www.getpromonight.com/playoffs';
// How many upcoming home games the hub lists across every league.
const NEXT_HOME_GAMES = 8;

// Title, description and canonical only. Open Graph and JSON-LD land with the
// rest of the SEO work at G3. Nothing here depends on the bracket's state, so
// the head cannot contradict the body.
export const metadata: Metadata = {
  title: `${POSTSEASON_SEASON} Playoffs: MLB and WNBA Brackets`,
  description: `The ${POSTSEASON_SEASON} MLB and WNBA postseason brackets, series by series, with game times in Eastern and the home games coming up next.`,
  alternates: { canonical: PAGE_URL },
};

export default async function PlayoffsHubPage() {
  const pages = await Promise.all(POSTSEASON_LEAGUES.map((l) => getLeaguePageData(l)));

  const leagues: HubLeague[] = [];
  for (const p of pages) {
    // A league with no document is simply not in the postseason. It gets no
    // card. A league whose document could not be read gets one that says so.
    if (p.state === 'missing') continue;
    const href = postseasonPath(p.league);
    if (p.state === 'unavailable') leagues.push({ state: 'unavailable', league: p.league, href });
    else leagues.push({ state: 'ok', league: p.league, href, view: p.view, predictionsLocked: p.predictionsLocked });
  }

  const active = leagues.flatMap((l) => (l.state === 'ok' && l.view.phase.kind === 'active' ? [l.view] : []));
  const nextGames = nextHomeGames(active, NEXT_HOME_GAMES);

  let tickets = {};
  if (nextGames.length > 0) {
    const teams = new Map((await getAllTeams()).map((t) => [t.id, t]));
    tickets = ticketButtons(
      nextGames.map((g) => g.hostTeamId),
      teams,
      'web_playoffs',
      'playoffs_hub',
    );
  }

  return (
    <div className={`${archivoHouse.variable} ${barlowCondensed.variable} rd-root min-h-screen bg-rd-cream`}>
      <PlayoffsHub season={POSTSEASON_SEASON} leagues={leagues} nextGames={nextGames} tickets={tickets} />
    </div>
  );
}
