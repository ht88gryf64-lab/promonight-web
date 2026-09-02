// CFB read layer for the /cfb route (Phase 3). Reads the cfb* collections written
// by Phase 2 and shapes them for the ONE template. Verify-gate discipline lives
// here: a game's kickoff renders "Kickoff TBA" unless it is verified AND has an
// announced time — a verified=false value (the flagged date-error games) or an
// unannounced July kickoff never shows a contradicted/unconfirmed time.

import { cache } from 'react';
import { db } from '@/lib/firebase';
import type { CfbSchool, CfbVenue, CfbGame, CfbRivalry } from '@/lib/cfb/types';
import { CFB_COLLECTIONS } from '@/lib/cfb/types';
import { isVisibleGame } from '@/lib/cfb/human-owned';
// Kickoff display goes through src/lib/cfb/kickoff.ts, which consumes the
// pipeline's SINGLE time parser (guards.ts normTime) and re-expresses the
// corroborated instant in the venue's zone. The display layer must NOT re-derive
// AM/PM with its own parser (that was the bug). One parser, used everywhere.
import { venueLocalKickoff } from '@/lib/cfb/kickoff';
import { resolveVenueZone } from '@/lib/cfb/venue-timezones';
import { venueTodayYMD, isPlayedGame } from '@/lib/cfb/clock';

export interface CfbGameView {
  id: string;
  date: string; // YYYY-MM-DD. The row's only label: CFB has no week numbers here.
  /** Dated before today in the VENUE's zone (clock.ts venueTodayYMD). No result
   *  is known or shown; the row stops presenting the game as a fixture.
   *  cfbGames.status never transitions, so this is derived from the date alone. */
  played: boolean;
  isHome: boolean;
  neutralSite: boolean;
  /** A neutral site abroad with no venueHubs doc (Wembley). Renders as the
   *  venue line and the "International" eyebrow; parking and hotel CTAs are
   *  suppressed as for every neutral game, tickets stay. */
  internationalVenue: { name: string; city: string; country: string; timezone: string; event: string | null } | null;
  /** Conference game flag from the pipeline; null when unknown. */
  conferenceGame: boolean | null;
  /** Theme-night display names ("Checker Neyland"); empty when none tagged. */
  themes: string[];
  opponentId: string;
  opponentName: string;
  kickoffDisplay: string; // "7:30 PM ET" (venue-local) only when verified+announced; else "Kickoff TBA"
  kickoffVerified: boolean;
  networkDisplay: string | null; // only when broadcast.confirmed
  // tag-as-fact, crown none. sourceUrl = the stored corroborating trophy-article
  // URL (cfbRivalries.source — the trophy's own Wikipedia page, never the list),
  // surfaced so the tag can link out; null when no valid URL is stored.
  rivalry: { id: string; name: string; trophy: string | null; sourceUrl: string | null } | null;
  /** True when opponentId is one of the 87 tracked cfbSchools. An untracked
   *  opponent has no page, so it renders as plain text rather than a dead link,
   *  the same rule the matchup pages use for an untracked side. */
  opponentTracked: boolean;
  // Road-trip planner (away games only): the opponent's school+venue, present only
  // when the opponent is one of the 87 tracked schools AND has a resolved venue.
  // Used to build the SITE-STANDARD hotels/parking CTAs near the destination stadium.
  awaySchool: CfbSchool | null;
  awayVenue: CfbVenue | null;
}

export interface CfbSchoolPage {
  school: CfbSchool;
  venue: CfbVenue | null;
  games: CfbGameView[];
  editorialStatus: 'auto' | 'destination';
  // Editorial blocks (Phase 4 populates; ONE template renders them only when present).
  editorial: {
    signatureGameId: string | null;
    traditions: unknown[]; // cfbTraditions later
    gamedayCulture: string | null;
    whyYouGo: string | null;
    venueInTheirWords: string | null;
    contributor: { name: string; credit: string } | null;
  };
}

// Extract the trophy's OWN article link from the stored rivalry provenance.
// cfbRivalries.source is a provenance TRAIL, not a single URL — the re-extraction
// stores "<master list URL> + <trophy/rivalry article URL>". We surface the
// trophy's own article (the specific corroborating second source), never the
// generic list page. Returns null (→ plain-text tag, never a broken link) when
// no non-list en.wikipedia article is present.
function safeHttpUrl(source: string | null | undefined): string | null {
  if (!source) return null;
  const urls = source.match(/https:\/\/en\.wikipedia\.org\/wiki\/[^\s"]+/g);
  if (!urls) return null;
  const trophy = urls.find((u) => !/\/wiki\/List_of/i.test(u));
  if (!trophy) return null;
  try { new URL(trophy); return trophy; } catch { return null; }
}

function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNc\b/, 'NC').replace(/\bUnlv\b/, 'UNLV').replace(/\bUcf\b/, 'UCF')
    .replace(/\bByu\b/, 'BYU').replace(/\bSmu\b/, 'SMU').replace(/\bTcu\b/, 'TCU')
    .replace(/\bUsc\b/, 'USC').replace(/\bUcla\b/, 'UCLA').replace(/\bLsu\b/, 'LSU')
    .replace(/\bTbd\b|\bTba\b/i, 'TBA');
}

// The verify-gate and the venue-local conversion both live in
// src/lib/cfb/kickoff.ts (venueLocalKickoff): an announced time shows ONLY when
// the game is verified AND not tbd AND parses, re-expressed in the zone of the
// building it is played in. Everything else renders "Kickoff TBA". The one
// normTime parser (guards.ts) is consumed there, never re-derived here.

// ── Read-efficiency layer (CFB-isolated; MLB path untouched) ─────────────────
// The /cfb build renders 87 school pages, each calling getCfbSchoolPage TWICE
// (generateMetadata + Page). The naive reader did a FULL-collection read of
// schools+venues+rivalries AND two games queries PER call → ~68,500 Firestore
// reads/build and full-collection latency on every page (the prerender-timeout
// root cause). The three static collections (schools 87, venues 86, rivalries
// 212) and the games collection (670) are identical for every school, so we read
// each ONCE and reuse it.
//
// Two cache layers, both process-local:
//  • React cache() on getCfbSchoolPage — dedupes the generateMetadata+Page
//    double-call within ONE page render (the house pattern; see getMlbSlate).
//  • A module-level TTL cache on the four collections — reuses the single read
//    ACROSS all 87 pages within a build (React cache() resets per page during
//    SSG, so it alone can't do cross-page). A build is a short-lived process
//    with an empty cache, so it never serves stale data ACROSS builds.
//
//    THE TTL IS SHORT ON PURPOSE (2026-09-02). It used to equal the page's ISR
//    window (21600s) on the reasoning "never staler than the page itself".
//    That is wrong the moment something revalidates the page early: the CFB
//    sweep (promo-pipeline cfb-sweep) writes kickoffs and POSTs /api/revalidate,
//    Next re-renders the path, and this cache hands the render the SAME
//    six-hour-old collections, so the regenerated page is byte-identical to the
//    stale one. Measured on the gate-2 execute: two docs written and read back,
//    four paths revalidated (x-vercel-cache: REVALIDATED), rows still "Kickoff
//    TBA". Five minutes bounds that lag; the cost is four collection reads per
//    server instance per five minutes under traffic, which is nothing.
const STATIC_TTL_MS = 5 * 60 * 1000;

function makeCollectionLoader<T>(read: () => Promise<T>): () => Promise<T> {
  let cached: { at: number; data: T } | null = null;
  let inflight: Promise<T> | null = null;
  return async () => {
    // Firestore emulator/prod clock only; Date.now() is fine at runtime (this
    // module never executes inside a Workflow script sandbox).
    if (cached && Date.now() - cached.at < STATIC_TTL_MS) return cached.data;
    if (inflight) return inflight; // coalesce concurrent first-callers (build fan-out)
    inflight = (async () => {
      const data = await read();
      cached = { at: Date.now(), data };
      inflight = null;
      return data;
    })();
    return inflight;
  };
}

// Each loader preserves Firestore's default document-name ordering (the same
// order the old per-page `.get()` / `.where().get()` calls returned), and stamps
// id = docId so downstream keying is byte-identical to the old maps.
const loadSchools = makeCollectionLoader<Array<CfbSchool & { id: string }>>(async () => {
  const snap = await db.collection(CFB_COLLECTIONS.schools).get();
  return snap.docs.map((d) => ({ ...(d.data() as CfbSchool), id: d.id }));
});
const loadVenues = makeCollectionLoader<Array<CfbVenue & { id: string }>>(async () => {
  const snap = await db.collection(CFB_COLLECTIONS.venues).get();
  return snap.docs.map((d) => ({ ...(d.data() as CfbVenue), id: d.id }));
});
const loadRivalries = makeCollectionLoader<Array<CfbRivalry & { id: string }>>(async () => {
  const snap = await db.collection(CFB_COLLECTIONS.rivalries).get();
  return snap.docs.map((d) => ({ ...(d.data() as CfbRivalry), id: d.id }));
});
const loadGames = makeCollectionLoader<Array<{ docId: string; data: CfbGame }>>(async () => {
  const snap = await db.collection(CFB_COLLECTIONS.games).get();
  return snap.docs
    .map((d) => ({ docId: d.id, data: d.data() as CfbGame }))
    // Tombstoned docs are redundant duplicates, hidden not deleted. Same shape
    // as isVisiblePromo (src/lib/promo-helpers.ts:165): an app-code filter where
    // absent and false are both visible and only true hides. Never a Firestore
    // .where(), which would drop every doc that lacks the field.
    .filter((g) => isVisibleGame(g.data));
});

/** The four CFB collections behind one call, sharing the same TTL cache the
 *  school pages use. Exposed so the matchup family (src/lib/cfb/matchups.ts)
 *  reads through the identical loaders rather than opening its own passes, which
 *  would double the Firestore reads per build and could see a different
 *  tombstone state mid-render. */
export async function getCfbCorpus() {
  const [schools, venues, rivalries, games] = await Promise.all([
    loadSchools(), loadVenues(), loadRivalries(), loadGames(),
  ]);
  return { schools, venues, rivalries, games };
}

/** All school ids — for generateStaticParams. */
export async function getAllCfbSchoolIds(): Promise<string[]> {
  const schools = await loadSchools();
  return schools.map((s) => s.id);
}

/** Quality floor (decision record §4): a school page indexes only if it
 *  carries enough verified hard data to be useful — a real schedule (>=8
 *  games) AND a resolved venue. ONE predicate shared by the page (robots
 *  noindex, src/app/cfb/[school]/page.tsx) and the sitemap (URL omitted), so
 *  the two decisions cannot drift. */
export function cfbSchoolBelowIndexFloor(page: CfbSchoolPage | null): boolean {
  if (!page) return true;
  return page.games.length < 8 || !page.venue;
}

/** School ids above the index floor — the sitemap set. A noindex stub
 *  (washington-state: one game, no venue doc) must not be sitemap-listed or
 *  pushed through the IndexNow deploy hook. Cheap: every page here reads the
 *  same TTL-cached collection loaders, so this is in-memory after the first
 *  load. */
export async function getIndexableCfbSchoolIds(): Promise<string[]> {
  const ids = await getAllCfbSchoolIds();
  const pages = await Promise.all(ids.map((id) => getCfbSchoolPage(id)));
  return ids.filter((_, i) => !cfbSchoolBelowIndexFloor(pages[i]));
}

export async function getCfbSchool(id: string): Promise<CfbSchool | null> {
  const schools = await loadSchools();
  return schools.find((s) => s.id === id) ?? null;
}

/** Full page payload for one school. Wrapped in React cache() so the
 *  generateMetadata + Page double-call within one render shares a single build. */
export const getCfbSchoolPage = cache(async (id: string): Promise<CfbSchoolPage | null> => {
  const [schools, venues, rivalries, allGames] = await Promise.all([
    loadSchools(), loadVenues(), loadRivalries(), loadGames(),
  ]);

  const schoolById = new Map<string, CfbSchool>();
  const nameById = new Map<string, string>();
  for (const s of schools) {
    schoolById.set(s.id, s);
    nameById.set(s.id, s.shortName || s.name);
  }
  const school = schoolById.get(id);
  if (!school) return null;

  const venueById = new Map<string, CfbVenue>();
  for (const v of venues) venueById.set(v.id, v);
  const rivalryById = new Map<string, CfbRivalry>();
  for (const r of rivalries) rivalryById.set(r.id, r);

  const venue = school.venueId ? venueById.get(school.venueId) || null : null;

  // Reproduce the old ordering EXACTLY: home games (doc-name order) then away
  // games (doc-name order), deduped by docId, then a stable date sort. loadGames
  // preserves doc-name order, so filtering yields the same pre-sort sequence the
  // old two `.where().get()` queries did.
  const homeGames = allGames.filter((x) => x.data.homeSchoolId === id);
  const awayGames = allGames.filter((x) => x.data.awaySchoolId === id);
  const seen = new Set<string>();
  const games: CfbGameView[] = [];
  for (const x of [...homeGames, ...awayGames]) {
    if (seen.has(x.docId)) continue;
    seen.add(x.docId);
    const g = x.data;
    const isHome = g.homeSchoolId === id;
    const opponentId = isHome ? g.awaySchoolId : g.homeSchoolId;
    // Zone of the building the game is played in: the venue RECORD's timezone
    // field when it carries one, else the render map (campus stadium, untracked
    // home school's campus, or the neutral-site venueHubs building). Null
    // (unmapped, or a neutral game without its hub slug) leaves the kickoff in
    // its stored label. Neutral hubs are not loaded on this path, so a neutral
    // game resolves through the map here; the matchup pages read the hub doc.
    const homeSchoolForZone = schoolById.get(g.homeSchoolId);
    const homeVenueForZone = homeSchoolForZone?.venueId ? venueById.get(homeSchoolForZone.venueId) : undefined;
    const venueZone = resolveVenueZone({
      neutralSite: g.neutralSite, neutralVenueHubSlug: g.neutralVenueHubSlug,
      homeSchoolId: g.homeSchoolId, homeVenueId: homeSchoolForZone?.venueId,
      homeVenueTimezone: homeVenueForZone?.timezone ?? null,
      internationalTimezone: g.internationalVenue?.timezone ?? null,
    });
    const kd = venueLocalKickoff(g, venueZone);
    const riv = g.rivalryId ? rivalryById.get(g.rivalryId) : null;
    // Road-trip planner: for a true away game (not home, not neutral), resolve the
    // opponent's school+venue so the template can render hotels/parking near the
    // destination stadium. Only when the opponent is a tracked school with a venue.
    const oppSchool = !isHome && !g.neutralSite ? schoolById.get(opponentId) || null : null;
    const oppVenue = oppSchool?.venueId ? venueById.get(oppSchool.venueId) || null : null;
    games.push({
      id: g.id, date: g.date, played: isPlayedGame(g.date, venueTodayYMD(venueZone)),
      isHome, neutralSite: !!g.neutralSite,
      internationalVenue: g.internationalVenue ? { name: g.internationalVenue.name, city: g.internationalVenue.city, country: g.internationalVenue.country, timezone: g.internationalVenue.timezone, event: g.internationalVenue.event ?? null } : null,
      conferenceGame: typeof g.conferenceGame === 'boolean' ? g.conferenceGame : null,
      // Gated on the game's verified flag like every other displayed fact
      // (kickoff, network): a parser-written designation carries no signal
      // until the verify pass confirms the game (types.ts LOCKED DECISION 5).
      themes: g.verified === true && Array.isArray(g.themeDesignations)
        ? g.themeDesignations.map((t) => t.displayName).filter(Boolean)
        : [],
      opponentId, opponentName: nameById.get(opponentId) || prettifySlug(opponentId),
      kickoffDisplay: kd.display, kickoffVerified: kd.verified,
      networkDisplay: g.broadcast?.confirmed && g.broadcast.network && !/tbd/i.test(g.broadcast.network) ? g.broadcast.network : null,
      rivalry: riv ? { id: riv.id, name: riv.name, trophy: riv.trophy, sourceUrl: safeHttpUrl(riv.source) } : null,
      opponentTracked: schoolById.has(opponentId),
      awaySchool: oppSchool, awayVenue: oppVenue,
    });
  }
  games.sort((a, b) => a.date.localeCompare(b.date));

  return {
    school, venue, games,
    editorialStatus: school.editorialStatus || 'auto',
    // Phase 3 auto pages: editorial blocks are all empty; the ONE template hides
    // them. Phase 4 populates these as a DATA change (no template change).
    editorial: { signatureGameId: null, traditions: [], gamedayCulture: null, whyYouGo: null, venueInTheirWords: null, contributor: null },
  };
});
