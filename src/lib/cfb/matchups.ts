// The rivalry matchup family: /cfb/rivalries/{slug}.
//
// Ahrefs resolves trophy names to MATCHUPS, not trophies ("the game" ->
// "michigan vs ohio state", TP 78,000), so the matchup is the canonical unit and
// the rivalry name is the head term. Schedule-intent queries are unwinnable
// against Google's own sports panel, which is why this family exists separately
// from /cfb/{school}.
//
// The slug is CURATED, not derived. Slugifying rivalry names collides: three
// distinct rivalries are all named "Victory Bell" and three more are all
// "Florida Cup". An explicit registry keeps the URL stable even if a rivalry doc
// is renamed upstream, and keeps the family scoped to the ~30 named
// high-demand rivalries rather than all 212 docs (97 of which are auto-generated
// "SchoolA-SchoolB" pair labels and are permanently out of scope).

import { cache } from 'react';
import type { CfbGame, CfbRivalry, CfbSchool, CfbVenue } from '@/lib/cfb/types';
import { getCfbCorpus, getCfbSchoolPage } from '@/lib/cfb/data';
import { getVenueHub, getVenueHubForTeam, venueHubIsIndexable } from '@/lib/venue-hub';
import { buildRivalrySentences } from '@/lib/cfb/page-extras';
import { venueCity } from '@/lib/cfb/venue-cities';
import { MATCHUP_REGISTRY, type MatchupRegistryEntry } from '@/lib/cfb/matchup-registry';
import { resolveMatchupDisplayName, findDisplayNameCollisions } from '@/lib/cfb/display-name';
import type { RivalryIndexRow } from '@/lib/cfb/rivalry-index';

// Re-exported so existing importers keep one entry point.
export { MATCHUP_REGISTRY, resolveMatchupDisplayName, findDisplayNameCollisions };
export type { MatchupRegistryEntry };



const BY_SLUG = new Map(MATCHUP_REGISTRY.map((e) => [e.slug, e]));

/** Registry slugs. Static and cheap: no Firestore read. */
export function getAllMatchupSlugs(): string[] {
  return MATCHUP_REGISTRY.map((e) => e.slug);
}

export function matchupSlugForRivalryId(rivalryId: string): string | null {
  return MATCHUP_REGISTRY.find((e) => e.rivalryId === rivalryId)?.slug ?? null;
}

/** Where the game is actually played, whichever collection knows it.
 *
 *  Two sources by design. A non-neutral game resolves its campus stadium from
 *  cfbVenues via the home school, which is what the school pages already do. A
 *  neutral-site game cannot: cfbVenues holds one campus stadium per school and
 *  no neutral buildings, so it resolves through cfbGames.neutralVenueHubSlug
 *  against venueHubs instead. This type flattens both so the template never
 *  branches on which collection answered. */
export interface ResolvedMatchupVenue {
  name: string;
  city: string | null;
  state: string | null;
  /** Null coords are load-bearing: the Park step is dropped without them,
   *  because SpotHeroCTA never returns null and would otherwise render a
   *  tracked link to spothero.com's homepage. */
  lat: number | null;
  lng: number | null;
  /** venueHubs slug, when a logistics hub exists for this building. */
  hubSlug: string | null;
  /** Above the venueHubs indexing floor. Gates the Gates-and-bags step, which
   *  must not link into a hub with nothing in it. */
  hubIndexable: boolean;
  /** Which collection answered, for the audit trail. */
  source: 'cfbVenues' | 'venueHubs';
}

export interface MatchupSibling {
  slug: string;
  name: string;
  date: string | null;
  /** Each side's cfbSchools.primaryColor, schoolIds order; null when untracked
   *  or missing. Drives the sibling card's split spine; a null side falls back
   *  to the single neutral spine. Never inferred. */
  colors: [string | null, string | null];
}

export interface MatchupPage {
  slug: string;
  /** What the page leads with: the registry override, else the rivalry name. */
  displayName: string;
  rivalry: CfbRivalry & { id: string };
  /** The 2026 meeting, or null when the rivalry is dormant this season. */
  game: (CfbGame & { id: string }) | null;
  /** Both sides, in registry pair order. null when the school is not one of the
   *  87 tracked cfbSchools (an FCS opponent, for example). A null side renders
   *  as plain text: no link, no spear, no accent color. */
  schools: [(CfbSchool & { id: string }) | null, (CfbSchool & { id: string }) | null];
  /** Campus venue for a non-neutral game, resolved from the home school. */
  venue: (CfbVenue & { id: string }) | null;
  /** venueHubs doc id for a neutral-site game. NOT a cfbVenues id. */
  neutralVenueHubSlug: string | null;
  /** The flattened answer the template actually renders. */
  resolvedVenue: ResolvedMatchupVenue | null;
  /** 2026 conference of the first tracked school, for the trophy stat block. */
  conference: string | null;
  /** One sentence from the shared generator (page-extras.ts:35-60). Null when
   *  the rivalry has no 2026 game or neither school is tracked. */
  rivalrySentence: string | null;
  /** Up to 3 other matchup pages, resolved same week, then same conference,
   *  then nearest by date. */
  siblings: MatchupSibling[];
  /** True only when the same-week rule filled the sibling list, so the heading
   *  can stay honest. */
  siblingsAreSameWeek: boolean;
}

/** ISO week key, so "same calendar week" is a real comparison rather than a
 *  7-day window around whichever date happens to be first. */
function weekKey(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function daysApart(a: string, b: string): number {
  return Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000;
}

/** Slug, name and date for every registry matchup. Cheap enough to build once
 *  and reuse for the sibling rail and the /cfb/rivalries index. */
export const getMatchupIndex = cache(async (): Promise<Array<{ slug: string; name: string; date: string | null; conference: string | null; schoolIds: string[]; colors: [string | null, string | null] }>> => {
  const { schools, rivalries, games } = await getCfbCorpus();
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const out = [];
  for (const e of MATCHUP_REGISTRY) {
    const rivalry = rivalries.find((r) => r.id === e.rivalryId);
    if (!rivalry) continue;
    const game = games.find((g) => g.data.rivalryId === e.rivalryId) ?? null;
    const first = rivalry.schoolIds.map((id) => schoolById.get(id)).find(Boolean);
    // Stored primaryColor or null (untracked school / missing field). The null
    // rides through to the card, which falls back to the neutral spine — the
    // display layer never invents a color.
    const [colorA, colorB] = rivalry.schoolIds.map((id) => schoolById.get(id)?.primaryColor || null);
    out.push({
      slug: e.slug,
      // The display name, so the sibling rail and the /cfb/rivalries index show
      // the same string the destination page leads with.
      name: resolveMatchupDisplayName(e, rivalry.name),
      date: game?.data.date ?? null,
      conference: first?.conferenceBySeason?.['2026'] ?? null,
      schoolIds: rivalry.schoolIds,
      colors: [colorA ?? null, colorB ?? null] as [string | null, string | null],
    });
  }
  return out;
});

/** Index rows for /cfb/rivalries: display matchup string plus the stadium and
 *  trophy the index renders. venueName resolves exactly as getMatchupPage does
 *  (campus stadium via the home school for a non-neutral game, venueHubs for a
 *  neutral site) but is PLAIN TEXT on the index — never a link — so it carries
 *  no indexability gate and cannot overstate what the detail page links. */
export const getMatchupIndexRows = cache(async (): Promise<RivalryIndexRow[]> => {
  const { schools, venues, rivalries, games } = await getCfbCorpus();
  const byId = new Map(schools.map((s) => [s.id, s]));
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const rivalryById = new Map(rivalries.map((r) => [r.id, r]));
  const index = await getMatchupIndex();
  return Promise.all(index.map(async (r) => {
    const entry = BY_SLUG.get(r.slug)!; // index rows only exist for registry slugs
    const rivalry = rivalryById.get(entry.rivalryId) ?? null;
    const game = games.find((g) => g.data.rivalryId === entry.rivalryId) ?? null;

    let venueName: string | null = null;
    if (game?.data.neutralSite && game.data.neutralVenueHubSlug) {
      const hub = await getVenueHub(game.data.neutralVenueHubSlug);
      venueName = hub?.name ?? null;
    } else if (game && !game.data.neutralSite) {
      // !neutralSite mirrors getMatchupPage exactly: a neutral game missing its
      // hub slug shows NO stadium rather than the home school's campus stadium.
      const home = byId.get(game.data.homeSchoolId);
      venueName = home?.venueId ? venueById.get(home.venueId)?.name ?? null : null;
    }

    return {
      slug: r.slug,
      name: r.name,
      date: r.date,
      matchup: r.schoolIds
        .map((id) => byId.get(id)?.shortName || byId.get(id)?.name || id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
        .join(' vs '),
      venueName,
      trophy: rivalry?.trophy ?? null,
      colors: r.colors,
    };
  }));
});

/** Full payload for one matchup, or null when the slug is not in the registry
 *  or its rivalry doc has gone missing. Callers 404 on null. */
export const getMatchupPage = cache(async (slug: string): Promise<MatchupPage | null> => {
  const entry = BY_SLUG.get(slug);
  if (!entry) return null;

  const { schools, venues, rivalries, games } = await getCfbCorpus();

  const rivalry = rivalries.find((r) => r.id === entry.rivalryId);
  if (!rivalry) return null;

  const [aId, bId] = rivalry.schoolIds;
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const schoolA = schoolById.get(aId) ?? null;
  const schoolB = schoolById.get(bId) ?? null;

  // loadGames already drops tombstoned docs, so this cannot pick a redundant one.
  const game = games.find((g) => g.data.rivalryId === entry.rivalryId) ?? null;

  const homeSchool = game ? schoolById.get(game.data.homeSchoolId) ?? null : null;
  const venue = game && !game.data.neutralSite && homeSchool?.venueId
    ? venues.find((v) => v.id === homeSchool.venueId) ?? null
    : null;
  const neutralVenueHubSlug = game?.data.neutralVenueHubSlug ?? null;

  // ── resolve the venue the template renders ──
  let resolvedVenue: ResolvedMatchupVenue | null = null;
  if (game?.data.neutralSite && neutralVenueHubSlug) {
    const hub = await getVenueHub(neutralVenueHubSlug);
    if (hub) {
      resolvedVenue = {
        name: hub.name,
        city: hub.city,
        state: hub.state,
        lat: hub.lat,
        lng: hub.lng,
        hubSlug: hub.slug,
        hubIndexable: venueHubIsIndexable(hub),
        source: 'venueHubs',
      };
    }
  } else if (venue) {
    // The campus stadium answers name/city/coords. Its logistics hub, if any, is
    // a separate lookup keyed on the home school, exactly as the school pages do.
    const hub = homeSchool ? await getVenueHubForTeam(homeSchool.id) : null;
    resolvedVenue = {
      name: venue.name,
      // venueCity(), NEVER the raw cfbVenues.city, which is junk for 59 of the
      // 86 venues. Reading it raw shipped "Notre Dame Stadium | coordinates ="
      // to the fact card on legends-trophy and megaphone-trophy. The map returns
      // null for an unmapped id, so the caller falls back to name only. The
      // school pages and the schedule modal have always gone through this;
      // this reader was the one place that did not.
      city: venueCity(venue) ?? null,
      state: venue.state ?? null,
      lat: venue.lat ?? null,
      lng: venue.lng ?? null,
      hubSlug: hub?.slug ?? null,
      hubIndexable: hub?.indexable ?? false,
      source: 'cfbVenues',
    };
  }

  // ── the one prose sentence, from the SHARED generator ──
  let rivalrySentence: string | null = null;
  const proseSchool = schoolA ?? schoolB;
  if (proseSchool && game) {
    const page = await getCfbSchoolPage(proseSchool.id);
    if (page) {
      const only = { ...page, games: page.games.filter((g) => g.id === game.docId) };
      rivalrySentence = buildRivalrySentences(only)[0] ?? null;
    }
  }

  // ── siblings: same week, then same conference, then nearest by date ──
  const index = await getMatchupIndex();
  const me = index.find((x) => x.slug === slug);
  const others = index.filter((x) => x.slug !== slug && x.date);
  let siblings: typeof others = [];
  let siblingsAreSameWeek = false;
  if (me?.date) {
    const sameWeek = others.filter((x) => weekKey(x.date!) === weekKey(me.date!));
    if (sameWeek.length >= 3) {
      siblings = sameWeek.slice(0, 3);
      siblingsAreSameWeek = true;
    } else {
      const picked = [...sameWeek];
      const sameConf = others.filter((x) => !picked.includes(x) && me.conference && x.conference === me.conference);
      picked.push(...sameConf);
      if (picked.length < 3) {
        const rest = others
          .filter((x) => !picked.includes(x))
          .sort((p, q) => daysApart(p.date!, me.date!) - daysApart(q.date!, me.date!));
        picked.push(...rest);
      }
      siblings = picked.slice(0, 3);
      // Honest heading: "More rivalry week" only when the same-week rule alone
      // filled every slot.
      siblingsAreSameWeek = sameWeek.length >= 3;
    }
  }

  return {
    slug,
    displayName: resolveMatchupDisplayName(entry, rivalry.name),
    rivalry,
    game: game ? { ...game.data, id: game.docId } : null,
    schools: [schoolA, schoolB],
    venue,
    neutralVenueHubSlug,
    resolvedVenue,
    conference: (schoolA ?? schoolB)?.conferenceBySeason?.['2026'] ?? null,
    rivalrySentence,
    siblings: siblings.map((s) => ({ slug: s.slug, name: s.name, date: s.date, colors: s.colors })),
    siblingsAreSameWeek,
  };
});
