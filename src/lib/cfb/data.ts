// CFB read layer for the /cfb route (Phase 3). Reads the cfb* collections written
// by Phase 2 and shapes them for the ONE template. Verify-gate discipline lives
// here: a game's kickoff renders "Kickoff TBA" unless it is verified AND has an
// announced time — a verified=false value (the flagged date-error games) or an
// unannounced July kickoff never shows a contradicted/unconfirmed time.

import { cache } from 'react';
import { db } from '@/lib/firebase';
import type { CfbSchool, CfbVenue, CfbGame, CfbRivalry } from '@/lib/cfb/types';
import { CFB_COLLECTIONS } from '@/lib/cfb/types';
// Reuse the pipeline's SINGLE time parser (guards.ts). normTime honors the AM/PM
// meridiem and returns 24-hour "HH:MM". The display layer must NOT re-derive AM/PM
// with its own parser (that was the bug); it consumes normTime's output. One parser,
// used everywhere — the display and the verify stage cannot drift.
import { normTime } from '../../../scripts/cfb/lib/guards';

const TZ_ABBR: Record<string, string> = {
  'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT',
  'America/Boise': 'MT', 'America/Phoenix': 'MST', 'America/Los_Angeles': 'PT',
};

export interface CfbGameView {
  id: string;
  date: string; // YYYY-MM-DD
  week: number;
  isHome: boolean;
  neutralSite: boolean;
  opponentId: string;
  opponentName: string;
  kickoffDisplay: string; // "7:30 PM ET" only when verified+announced; else "Kickoff TBA"
  kickoffVerified: boolean;
  networkDisplay: string | null; // only when broadcast.confirmed
  // tag-as-fact, crown none. sourceUrl = the stored corroborating trophy-article
  // URL (cfbRivalries.source — the trophy's own Wikipedia page, never the list),
  // surfaced so the tag can link out; null when no valid URL is stored.
  rivalry: { name: string; trophy: string | null; sourceUrl: string | null } | null;
  // Road-trip planner (away games only): the opponent's school+venue, present only
  // when the opponent is one of the 86 tracked schools AND has a resolved venue.
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

// FIX 1: format ONLY what normTime parsed. normTime("7:00 PM") -> "19:00" (24h),
// so `h >= 12` is now a correct 24-hour test (the old code read the 12-hour "7" and
// mislabeled it AM). Handles both stored shapes — 12-hour-with-meridiem ("7:00 PM",
// the current stored form) and bare 24-hour ("19:00").
function to12h(time: string, tz: string): string | null {
  const hhmm = normTime(time); // 24h "HH:MM" or "TBD"
  if (hhmm === 'TBD') return null;
  const [hStr, min] = hhmm.split(':');
  let h = parseInt(hStr, 10); // 0..23
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  const abbr = TZ_ABBR[tz] || tz;
  return `${h}:${min} ${ap} ${abbr}`;
}

// A rendered kickoff in the 1:00–6:00 AM local window is categorically impossible
// for CFB (earliest real kickoffs are ~11 AM local) — such a value is almost
// certainly a bug (storage corruption or a render regression). FIX 2 lives here at
// the DISPLAY layer because that is where the meridiem bug was; a storage-verify
// guard cannot catch a render regression. Zero false positives: no CFB game exists
// in this window.
function isImpossibleAmRender(display: string): boolean {
  return /^[1-6]:\d{2} AM\b/.test(display);
}

// The verify-gate: an announced time shows ONLY when the game is verified AND not
// tbd AND parses. Everything else — unannounced (most of July) or a flagged
// date-error (verified=false) — renders identically as "Kickoff TBA".
function kickoffDisplay(g: CfbGame): { display: string; verified: boolean } {
  const tbd = g.kickoff?.tbd || !g.kickoff?.time || /tbd|tba/i.test(g.kickoff?.time || '');
  if (g.verified && !tbd) {
    const t = to12h(g.kickoff.time, g.kickoff.tz);
    if (t && isImpossibleAmRender(t)) {
      // Better to show TBA than an impossible time; flag it so it is visible.
      console.warn(`[cfb-kickoff-guard] suspect kickoff "${g.kickoff.time}" (${g.kickoff.tz}) -> "${t}" for game ${g.id}; rendering TBA`);
      return { display: 'Kickoff TBA', verified: false };
    }
    if (t) return { display: t, verified: true };
  }
  return { display: 'Kickoff TBA', verified: false };
}

// ── Read-efficiency layer (CFB-isolated; MLB path untouched) ─────────────────
// The /cfb build renders 86 school pages, each calling getCfbSchoolPage TWICE
// (generateMetadata + Page). The naive reader did a FULL-collection read of
// schools+venues+rivalries AND two games queries PER call → ~68,500 Firestore
// reads/build and full-collection latency on every page (the prerender-timeout
// root cause). The three static collections (schools 86, venues 86, rivalries
// 212) and the games collection (670) are identical for every school, so we read
// each ONCE and reuse it.
//
// Two cache layers, both process-local:
//  • React cache() on getCfbSchoolPage — dedupes the generateMetadata+Page
//    double-call within ONE page render (the house pattern; see getMlbSlate).
//  • A module-level TTL cache on the four collections — reuses the single read
//    ACROSS all 86 pages within a build (React cache() resets per page during
//    SSG, so it alone can't do cross-page). TTL = the page's own ISR window
//    (21600s), so at runtime each server instance re-reads on the same cadence
//    the page revalidates — never staler than the page itself. A build is a
//    short-lived process with an empty cache, so it never serves stale data
//    ACROSS builds; each `next build` reads fresh.
const STATIC_TTL_MS = 21600 * 1000; // matches `export const revalidate = 21600`

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
  return snap.docs.map((d) => ({ docId: d.id, data: d.data() as CfbGame }));
});

/** All school ids — for generateStaticParams. */
export async function getAllCfbSchoolIds(): Promise<string[]> {
  const schools = await loadSchools();
  return schools.map((s) => s.id);
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
    const kd = kickoffDisplay(g);
    const riv = g.rivalryId ? rivalryById.get(g.rivalryId) : null;
    // Road-trip planner: for a true away game (not home, not neutral), resolve the
    // opponent's school+venue so the template can render hotels/parking near the
    // destination stadium. Only when the opponent is a tracked school with a venue.
    const oppSchool = !isHome && !g.neutralSite ? schoolById.get(opponentId) || null : null;
    const oppVenue = oppSchool?.venueId ? venueById.get(oppSchool.venueId) || null : null;
    games.push({
      id: g.id, date: g.date, week: g.week, isHome, neutralSite: !!g.neutralSite,
      opponentId, opponentName: nameById.get(opponentId) || prettifySlug(opponentId),
      kickoffDisplay: kd.display, kickoffVerified: kd.verified,
      networkDisplay: g.broadcast?.confirmed && g.broadcast.network && !/tbd/i.test(g.broadcast.network) ? g.broadcast.network : null,
      rivalry: riv ? { name: riv.name, trophy: riv.trophy, sourceUrl: safeHttpUrl(riv.source) } : null,
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
