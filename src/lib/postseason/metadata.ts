// Titles, descriptions and JSON-LD for the playoffs pages. PURE.
//
// THE HEAD SAYS WHAT THE BODY SAYS. The page this replaced served "Playoff
// Promos & Giveaways 2026" and "See what's on tonight" over a body that said
// the playoffs were complete, for six weeks, because its head and its body
// read different conditions. Here both are built from the same value: the
// page body's own state is the argument, and there is one branch per state
// the body can render.
//
// Titles do not change with the state. A title is the page's name, and the
// name of "the 2026 MLB bracket" is the same before, during and after. The
// description carries the state.
//
// No Event markup. The pages list games, and a game is an event, but the
// bracket document is not a ticketing source: it names no building, and a
// start time in it can be a placeholder. WebPage and BreadcrumbList only.
import type { PostseasonLeague } from './types';
import type { LeagueView } from './view';

export const SITE_URL = 'https://www.getpromonight.com';
export const HUB_PATH = '/playoffs';

export interface PageCopy {
  title: string;
  description: string;
  canonical: string;
}

/** A league the hub rendered a card for. A league whose read failed is not
 *  a state: the read throws and the last good page stands. */
export type HubLeagueState = { league: PostseasonLeague; state: 'ok'; view: LeagueView };

function list(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The hub. `routeLeagues` is every league with a playoffs route, which is
 * what the title names; `leagues` is what the body rendered a card for.
 */
export function hubCopy(season: number, routeLeagues: readonly PostseasonLeague[], leagues: readonly HubLeagueState[]): PageCopy {
  const title = `${season} Playoffs: ${list(routeLeagues)} Brackets`;
  const canonical = `${SITE_URL}${HUB_PATH}`;
  const active = leagues.filter((l) => l.view.phase.kind === 'active');

  if (active.length > 0) {
    const rounds = active.map((l) => `${l.league}: ${l.view.phase.kind === 'active' ? l.view.phase.roundLabel : ''}`).join('. ');
    return {
      title,
      canonical,
      description: `The ${season} postseason brackets for ${list(active.map((l) => l.league))}, series by series, with Eastern game times and the next home games. ${rounds}.`,
    };
  }
  if (leagues.length > 0) {
    return {
      title,
      canonical,
      description: `The ${season} ${list(leagues.map((l) => l.league))} postseason is complete. The final ${leagues.length === 1 ? 'bracket' : 'brackets'}, round by round, with each champion.`,
    };
  }
  return {
    title,
    canonical,
    description: `No postseason is underway. The ${list(routeLeagues)} brackets appear here once each league's postseason begins.`,
  };
}

/** A league's page. `view` is null when the body rendered "bracket not
 *  available", and then nothing is said about the bracket. */
export function leagueCopy(season: number, league: PostseasonLeague, path: string, view: LeagueView | null): PageCopy {
  // 60 characters with the site suffix for the longest league name, inside
  // the 65 the title audit aims for.
  const title = `${season} ${league} Playoffs Bracket, Schedule and Scores`;
  const canonical = `${SITE_URL}${path}`;
  if (!view) return { title, canonical, description: `The ${season} ${league} postseason bracket.` };
  if (view.phase.kind === 'concluded') {
    return {
      title,
      canonical,
      description: `The ${season} ${league} postseason bracket, complete. ${view.phase.championName}: ${lowerFirst(view.phase.summary)}. Every series and result, round by round.`,
    };
  }
  return {
    title,
    canonical,
    description: `The ${season} ${league} postseason bracket. Current round: ${view.phase.roundLabel}. Every series, seed and result, with game times in Eastern and the home games coming up.`,
  };
}

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

// ---- JSON-LD ----

type Schema = Record<string, unknown>;
const WEBSITE = { '@type': 'WebSite', name: 'PromoNight', url: SITE_URL };

function webPage(copy: PageCopy, dateModified: string | null): Schema {
  const page: Schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.title,
    description: copy.description,
    url: copy.canonical,
    isPartOf: WEBSITE,
  };
  // The moment the bracket itself last changed. Left out when the page has
  // no bracket: the render clock is not a modification date.
  if (dateModified) page.dateModified = dateModified;
  return page;
}

function breadcrumbs(items: readonly { name: string; url: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function hubJsonLd(copy: PageCopy, lastChanged: readonly (string | null)[]): Schema[] {
  const stamps = lastChanged.filter((s): s is string => typeof s === 'string').sort();
  return [
    webPage(copy, stamps.length ? stamps[stamps.length - 1] : null),
    breadcrumbs([
      { name: 'Home', url: SITE_URL },
      { name: 'Playoffs', url: `${SITE_URL}${HUB_PATH}` },
    ]),
  ];
}

export function leagueJsonLd(copy: PageCopy, league: PostseasonLeague, lastChanged: string | null): Schema[] {
  return [
    webPage(copy, lastChanged),
    breadcrumbs([
      { name: 'Home', url: SITE_URL },
      { name: 'Playoffs', url: `${SITE_URL}${HUB_PATH}` },
      { name: league, url: copy.canonical },
    ]),
  ];
}
