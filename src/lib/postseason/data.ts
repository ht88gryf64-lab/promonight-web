import 'server-only';
import { cache } from 'react';
import { db } from '../firebase';
import { makeCollectionLoader } from '../collection-cache';
import { getAllTeams, getVenueForTeam } from '../data';
import { getTeamVenueHubMap } from '../venue-hub';
import { mapBracketDoc } from './map';
import { playoffsLinkState, type PlayoffsLinkState } from './gate';
import { buildLeagueView, clubSlugs, easternYmd, hostSlugs, type ClubInfo, type LeagueView, type ParkInfo } from './view';
import { readPostseasonPromos } from './promos';
import type { InboundLeague } from './inbound';
import type { Bracket, BracketRead, PostseasonLeague } from './types';

// ---- What the web decides, and only that ----
//
// The season is a constant, never new Date().getFullYear(): the year would
// roll on January 1 and every read would miss the document.
export const POSTSEASON_SEASON = 2026;

// The leagues with a playoffs route. This is the route table, not a copy of
// anything in a format file: rounds, labels, seeds and hosts all come from
// the document.
export const POSTSEASON_LEAGUES: readonly PostseasonLeague[] = ['MLB', 'WNBA'];

const BRACKETS = 'postseasonBrackets';
const PREDICTION_INPUTS = 'predictionInputs';

// The only fields of a bracket document that leave Firestore. operatorLog,
// source, runId, seeds, the hashes and unplaced are not requested, so they are
// not in this process to leak. The mapper whitelists again on top of this.
const BRACKET_FIELDS = ['league', 'season', 'series', 'lastChangedAt'];

export function postseasonLeagueFromSlug(slug: string): PostseasonLeague | null {
  return POSTSEASON_LEAGUES.find((l) => l.toLowerCase() === slug) ?? null;
}

export function postseasonPath(league: PostseasonLeague): string {
  return `/playoffs/${league.toLowerCase()}`;
}

function docId(league: PostseasonLeague): string {
  return `${league}_${POSTSEASON_SEASON}`;
}

/**
 * One bracket, read fresh.
 *
 * NOT behind the collection cache. The pipeline writes this document and then
 * revalidates /playoffs and /playoffs/{league}; a cached read would hand the
 * re-render the bracket it is replacing. React cache() only shares the read
 * between generateMetadata and the page body of one render.
 *
 * THROWS when the read fails or the document is not in a shape the web
 * reads. A render that throws is a render that produced no page, so ISR
 * keeps serving the last good one; a render that returned "not available"
 * would replace the last good page with that, cached and indexable, for
 * the whole revalidation window. No document at all is not a failure: it is
 * "missing", and the page for it is a 404.
 */
export const getBracket = cache(async (league: PostseasonLeague): Promise<BracketRead> => {
  const ref = db.collection(BRACKETS).doc(docId(league));
  const [snap] = await db.getAll(ref, { fieldMask: BRACKET_FIELDS });
  if (!snap.exists) return { state: 'missing' };
  const bracket = mapBracketDoc(snap.data(), { league, season: POSTSEASON_SEASON });
  if (!bracket) throw new Error(`[postseason] ${docId(league)} is not in a shape the web reads`);
  return { state: 'ok', bracket };
});

export type LeaguePageData =
  | { state: 'ok'; league: PostseasonLeague; view: LeagueView; predictionsLocked: boolean }
  | { state: 'missing'; league: PostseasonLeague };

/**
 * Everything a league's page needs: the bracket, the clubs it names, the
 * parks its hosts play in, and whether prediction inputs were frozen.
 *
 * `now` is taken once here, on the server, and decides only which scheduled
 * games are still ahead.
 *
 * Throws, like getBracket and for the same reason, when a read it depends on
 * fails or the bracket names a club the web has no team record for.
 */
export const getLeaguePageData = cache(async (league: PostseasonLeague): Promise<LeaguePageData> => {
  const read = await getBracket(league);
  if (read.state !== 'ok') return { state: read.state, league };
  const view = await buildViewFor(read.bracket, new Date());
  if (!view) throw new Error(`[postseason] ${docId(league)} names a club with no team record`);
  const predictionsLocked = await arePredictionInputsFrozen(league);
  return { state: 'ok', league, view, predictionsLocked };
});

/**
 * A bracket as a view: the clubs it names looked up, the parks its hosts
 * play in, and every displayed string built. Null when the bracket names a
 * club the web has no team record for. Throws when a read it depends on
 * fails outright.
 */
async function buildViewFor(bracket: Bracket, now: Date): Promise<LeagueView | null> {
  const teams = await getAllTeams();
  const wanted = new Set(clubSlugs(bracket));
  const clubs = new Map<string, ClubInfo>();
  for (const t of teams) {
    if (!wanted.has(t.id)) continue;
    clubs.set(t.id, {
      id: t.id,
      city: t.city,
      name: t.name,
      abbreviation: t.abbreviation,
      sportSlug: t.sportSlug,
      primaryColor: t.primaryColor,
    });
  }

  // A park is the web's own venue name for the host club. A club with no
  // venue record gets no park line; nothing is filled in for it. The name
  // links to the club's venue page when the web has one above the indexing
  // floor, the same test the team page applies before it links there. A
  // failed lookup costs the link, never the name.
  let venuePages: Awaited<ReturnType<typeof getTeamVenueHubMap>> = new Map();
  try {
    venuePages = await getTeamVenueHubMap();
  } catch (err) {
    console.error('[postseason] venue page lookup failed; park names render as plain text', err);
  }
  const parks = new Map<string, ParkInfo>();
  await Promise.all(
    hostSlugs(bracket).map(async (slug) => {
      try {
        const venue = await getVenueForTeam(slug);
        if (!venue || typeof venue.name !== 'string' || !venue.name.trim()) return;
        const hub = venuePages.get(slug);
        parks.set(slug, {
          name: venue.name,
          page: hub && hub.indexable ? { href: `/venues/${hub.slug}`, buildingSlug: hub.slug, buildingName: hub.displayName } : null,
        });
      } catch (err) {
        console.error(`[postseason] venue lookup failed for ${slug}; its park line is omitted`, err);
      }
    }),
  );

  // The postseason promotions at the hosts' games, today or later. Read by
  // name; no regular reader sees these rows.
  const promos = await readPostseasonPromos(bracket.league, bracket.season, hostSlugs(bracket), easternYmd(now));

  return buildLeagueView(bracket, clubs, parks, now, promos);
}

/**
 * Were this league's prediction inputs frozen?
 *
 * The document holds the whole regular-season corpus (2,429 rows for MLB).
 * The mask asks for frozenAt alone, so the corpus never crosses the wire.
 * True only when the document exists AND carries a freeze stamp. A failed
 * read is false: the card makes a claim, and an unproven claim is not shown.
 */
export const arePredictionInputsFrozen = cache(async (league: PostseasonLeague): Promise<boolean> => {
  try {
    const ref = db.collection(PREDICTION_INPUTS).doc(docId(league));
    const [snap] = await db.getAll(ref, { fieldMask: ['frozenAt'] });
    if (!snap.exists) return false;
    const frozenAt = snap.get('frozenAt');
    return frozenAt !== undefined && frozenAt !== null;
  } catch (err) {
    console.error(`[postseason] reading predictionInputs/${docId(league)} failed; the predictions card is hidden`, err);
    return false;
  }
});

/**
 * The leagues that have a bracket document this season.
 *
 * One batched read of document names only: the mask asks for `league` and
 * nothing else. Behind the five-minute process cache on purpose, unlike the
 * bracket itself, because the root layout asks on every route and the answer
 * changes once a season, when a document is first created. Throws when the
 * read fails, so each caller chooses its own failure: the layout hides the
 * link, the sitemap fails loudly.
 */
export async function readLeaguesWithBracket(): Promise<PostseasonLeague[]> {
  const refs = POSTSEASON_LEAGUES.map((l) => db.collection(BRACKETS).doc(docId(l)));
  const snaps = await db.getAll(...refs, { fieldMask: ['league'] });
  return POSTSEASON_LEAGUES.filter((_, i) => snaps[i].exists);
}

const loadLeaguesWithBracket = makeCollectionLoader(readLeaguesWithBracket);

export async function getLeaguesWithBracket(): Promise<PostseasonLeague[]> {
  return [...(await loadLeaguesWithBracket())];
}

/**
 * Every current-season bracket that can be read, for the link gate.
 *
 * One batched read with the same four-field mask the pages use. A league
 * with no document is left out. A document the mapper refuses is left out
 * and logged: it proves nothing about whether a series is still being
 * played. Throws when the read itself fails, so each caller chooses its own
 * failure.
 */
export async function readCurrentBrackets(): Promise<Bracket[]> {
  const refs = POSTSEASON_LEAGUES.map((l) => db.collection(BRACKETS).doc(docId(l)));
  const snaps = await db.getAll(...refs, { fieldMask: BRACKET_FIELDS });
  const out: Bracket[] = [];
  POSTSEASON_LEAGUES.forEach((league, i) => {
    if (!snaps[i].exists) return;
    const bracket = mapBracketDoc(snaps[i].data(), { league, season: POSTSEASON_SEASON });
    if (bracket) out.push(bracket);
    else console.error(`[postseason] ${docId(league)} is not in a shape the web reads; it is left out of the link gate`);
  });
  return out;
}

// Behind the five-minute process cache, like the list above and for the same
// reason: the root layout asks on every route. The gate moves twice a season,
// so five minutes of lag costs nothing. The clock is NOT cached: `now` is
// taken on every call, against brackets at most five minutes old.
//
// THE LINK GATE IS THE ONLY READER OF THIS LOADER. The inbound modules and
// the sitemap read fresh (see getPlayoffsInbound): a page revalidated for a
// bracket change must see that change.
const loadCurrentBrackets = makeCollectionLoader(readCurrentBrackets);

/** The state of the Playoffs link, with the reason. See ./gate.ts. */
export async function getPlayoffsLinkState(now: Date = new Date()): Promise<PlayoffsLinkState> {
  return playoffsLinkState(await loadCurrentBrackets(), now);
}

/**
 * The gate on the Playoffs link in the nav, the brand bar, the mobile menu
 * and the sitemap. True while any current-season bracket has a series that is
 * not final, and for 14 days after the last series in all of them went final.
 */
export async function isPlayoffsLinkActive(now: Date = new Date()): Promise<boolean> {
  return (await getPlayoffsLinkState(now)).state !== 'hidden';
}

/**
 * What the pages OUTSIDE /playoffs show about the postseason: the team
 * pages, the league hubs, the homepage and the venue pages.
 *
 * One answer for all four, under the same gate as the Playoffs link. When
 * the gate is closed the answer is an empty list and nothing renders
 * anywhere. When it is open, it is every current-season bracket that could
 * be read and built.
 *
 * NOT behind the process cache. The pipeline revalidates the team page of
 * every club in a changed series, the host venue pages and the league hub
 * when a bracket changes, and a re-render served from a cache would be
 * rebuilt from the bracket it is replacing and then held for the page's
 * whole window. The homepage is not revalidated (the endpoint refuses a
 * bare "/"); its module states the round and nothing faster. Every module
 * that states a score or a game time carries the bracket's own change stamp
 * beside it. Throws when the read fails, so each caller fails closed.
 */
export async function buildPlayoffsInbound(brackets: readonly Bracket[], now: Date): Promise<InboundLeague[]> {
  if (playoffsLinkState(brackets, now).state === 'hidden') return [];
  const out: InboundLeague[] = [];
  for (const bracket of brackets) {
    const view = await buildViewFor(bracket, now);
    if (!view) {
      console.error(`[postseason] ${docId(bracket.league)} names a club with no team record; it is left out of the inbound modules`);
      continue;
    }
    out.push({ league: bracket.league, href: postseasonPath(bracket.league), view });
  }
  return out;
}

// A fresh read on every render, shared only between the parts of one render
// (a team page's metadata and body, say) by React cache().
export const getPlayoffsInbound = cache(async (): Promise<InboundLeague[]> => buildPlayoffsInbound(await readCurrentBrackets(), new Date()));

/** The same, for a page that must render whatever happens: a failed read is
 *  logged and answered with nothing, so the page simply has no module. */
export async function getPlayoffsInboundOrNone(where: string): Promise<InboundLeague[]> {
  try {
    return await getPlayoffsInbound();
  } catch (err) {
    console.error(`[postseason] inbound read failed on ${where}; the page renders without a playoffs module`, err);
    return [];
  }
}

/** What the sitemap lists: the hub and each league page that has a bracket,
 *  each with the moment its bracket last changed. Empty when the gate is
 *  closed. Read fresh, so lastmod is the document's current stamp. Throws
 *  when the read fails, so the sitemap fails loudly rather than serving a
 *  copy that is missing these pages. */
export async function getPlayoffsSitemapEntries(now: Date = new Date()): Promise<{ path: string; lastModified: Date }[]> {
  const brackets = await readCurrentBrackets();
  if (playoffsLinkState(brackets, now).state === 'hidden') return [];
  const stamped = brackets.map((b) => ({
    path: postseasonPath(b.league),
    lastModified: b.lastChangedAt ? new Date(b.lastChangedAt) : now,
  }));
  const latest = stamped.reduce((m, e) => (e.lastModified > m ? e.lastModified : m), new Date(0));
  return [{ path: '/playoffs', lastModified: stamped.length ? latest : now }, ...stamped];
}
