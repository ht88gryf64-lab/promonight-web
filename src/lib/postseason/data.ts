import 'server-only';
import { cache } from 'react';
import { db } from '../firebase';
import { makeCollectionLoader } from '../collection-cache';
import { getAllTeams, getVenueForTeam } from '../data';
import { mapBracketDoc } from './map';
import { buildLeagueView, clubSlugs, hostSlugs, type ClubInfo, type LeagueView } from './view';
import type { BracketRead, PostseasonLeague } from './types';

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
 * Never throws. A failed read and a document the mapper refuses both come
 * back as "unavailable", which the page renders as such.
 */
export const getBracket = cache(async (league: PostseasonLeague): Promise<BracketRead> => {
  try {
    const ref = db.collection(BRACKETS).doc(docId(league));
    const [snap] = await db.getAll(ref, { fieldMask: BRACKET_FIELDS });
    if (!snap.exists) return { state: 'missing' };
    const bracket = mapBracketDoc(snap.data(), { league, season: POSTSEASON_SEASON });
    if (!bracket) {
      console.error(`[postseason] ${docId(league)} is not in a shape the web reads; rendering it as unavailable`);
      return { state: 'unavailable' };
    }
    return { state: 'ok', bracket };
  } catch (err) {
    console.error(`[postseason] reading ${docId(league)} failed`, err);
    return { state: 'unavailable' };
  }
});

export type LeaguePageData =
  | { state: 'ok'; league: PostseasonLeague; view: LeagueView; predictionsLocked: boolean }
  | { state: 'missing'; league: PostseasonLeague }
  | { state: 'unavailable'; league: PostseasonLeague };

/**
 * Everything a league's page needs: the bracket, the clubs it names, the
 * parks its hosts play in, and whether prediction inputs were frozen.
 *
 * `now` is taken once here, on the server, and decides only which scheduled
 * games are still ahead.
 */
export const getLeaguePageData = cache(async (league: PostseasonLeague): Promise<LeaguePageData> => {
  const read = await getBracket(league);
  if (read.state !== 'ok') return { state: read.state, league };

  try {
    const teams = await getAllTeams();
    const wanted = new Set(clubSlugs(read.bracket));
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
    // venue record gets no park line; nothing is filled in for it.
    const parks = new Map<string, string>();
    await Promise.all(
      hostSlugs(read.bracket).map(async (slug) => {
        try {
          const venue = await getVenueForTeam(slug);
          if (venue && typeof venue.name === 'string' && venue.name.trim()) parks.set(slug, venue.name);
        } catch (err) {
          console.error(`[postseason] venue lookup failed for ${slug}; its park line is omitted`, err);
        }
      }),
    );

    const view = buildLeagueView(read.bracket, clubs, parks, new Date());
    if (!view) {
      console.error(`[postseason] ${docId(league)} names a club with no team record; rendering it as unavailable`);
      return { state: 'unavailable', league };
    }
    const predictionsLocked = await arePredictionInputsFrozen(league);
    return { state: 'ok', league, view, predictionsLocked };
  } catch (err) {
    console.error(`[postseason] building the ${league} page failed`, err);
    return { state: 'unavailable', league };
  }
});

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

/** The gate on the Playoffs link in the nav, the brand bar and the mobile
 *  menu: a bracket document exists for the current season. */
export async function isPlayoffsLinkActive(): Promise<boolean> {
  return (await loadLeaguesWithBracket()).length > 0;
}
