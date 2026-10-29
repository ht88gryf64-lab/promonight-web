// Per-promo pages (Phase 3b, 2026-10-29): the SERVER half.
//
// Resolves /{league}/{team}/promos/{pageSlug} to its rows and gathers what
// the page links to. The words and the schema come from the pure half
// (src/lib/promo-page-copy.ts); this module only reads.
//
// THE FLAG. PROMO_PAGES_LIVE gates the route, the card route and the sitemap
// section together. Unset or anything but "true", the route is a 404 and the
// sitemap carries no promo URLs. The pipeline reads the same variable to arm
// its post-write emit (promo-pipeline/lib/promo-pages-notify.js), so the two
// sides go live on one switch.
//
// READS. One subcollection read for the team (its rows, the siblings and the
// previous edition all come out of it), the team's own games (the two
// equality reads the team page makes, never a cross-league date window) for
// the display slots, the building hub the team page already reads, the team's
// scan stamp,
// and, for the cross-team block and the sitemap, the upcoming index: every
// promo dated today or later, one collection-group read on the date index
// the other cross-team readers use (there is no collection-group index on
// themeKey or pageSlug, so a theme match is a filter over this read), held
// for five minutes per server instance like the static collections.

import 'server-only';
import { cache } from 'react';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';
import { getAllTeams, getGamesForTeam, getVenueForTeam, mapPromoDoc } from './data';
import { applyGameDisplay, buildGameIndex } from './promo-game-join';
import { makeKeyedTtlCache, STATIC_TTL_MS } from './collection-cache';
import { getVenueHub, getVenueHubForTeam, type TeamVenueHubLink } from './venue-hub';
import { buildCondensedLogistics, type CondensedLine } from './venue-hub-condensed';
import { isTicketPackageDoc, isTicketPackageLeague } from './ticket-packages';
import { isVisiblePromo, promoDisplayOpponent, promoDisplayTime, teamDisplayName } from './promo-helpers';
import type { Promo, PromoType, PromoWithTeam, Team, Venue } from './types';
import {
  baseSlugOf,
  laterSeason,
  promoPagePath,
  seasonLabelFor,
  YMD_RE,
  type ImageTier,
  type PromoPageLocation,
  type PromoPageRow,
} from './promo-page-copy';

export function isPromoPagesLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.PROMO_PAGES_LIVE ?? '').trim().toLowerCase() === 'true';
}

// ── document mapping ─────────────────────────────────────────────────────────

function isoOf(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate().toISOString();
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return new Date(Date.parse(v)).toISOString();
  return null;
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const tierOf = (v: unknown): ImageTier | null => (v === 1 || v === 3 ? v : null);

/** The page row from a mapped promo (display slots filled) and its raw data.
 *  The special-ticket fields are read for NHL and NBA only: outside those two
 *  leagues the stored flag is the extractor's raw guess the site ignores
 *  everywhere (src/lib/ticket-packages.ts), so the page ignores it too. */
function toPageRow(promoId: string, promo: Promo, data: FirebaseFirestore.DocumentData, league: string): PromoPageRow {
  const packages = isTicketPackageLeague(league);
  return {
    promoId,
    date: typeof promo.date === 'string' && YMD_RE.test(promo.date) ? promo.date : '',
    title: typeof promo.title === 'string' ? promo.title : '',
    description: promo.description || '',
    type: promo.type,
    displayTime: promoDisplayTime(promo),
    displayOpponent: promoDisplayOpponent(promo),
    highlight: promo.highlight === true,
    attendanceCap: typeof data.attendanceCap === 'number' ? data.attendanceCap : null,
    presentedBy: str(data.presentedBy),
    whileSuppliesLast: bool(data.whileSuppliesLast),
    gateOpenTime: str(data.gateOpenTime),
    ageRestriction: str(data.ageRestriction),
    redemptionLocation: str(data.redemptionLocation),
    ticketPackageRequired: packages ? bool(data.ticketPackageRequired) : null,
    ticketPackageName: packages ? str(data.ticketPackageName) : null,
    sourceUrl: str(data.sourceUrl),
    pageSlug: str(data.pageSlug) ?? '',
    pageSeason: str(data.pageSeason),
    themeKey: str(data.themeKey),
    imageTier: tierOf(data.imageTier),
    imageRef: str(data.imageRef),
    imageSourceUrl: str(data.imageSourceUrl),
    imageCredit: str(data.imageCredit),
    updatedAt: isoOf(data.updatedAt),
    tombstoned: data.tombstoned === true,
    tombstonedAt: isoOf(data.tombstonedAt),
  };
}

interface TeamDoc {
  id: string;
  data: FirebaseFirestore.DocumentData;
}

/** The team's whole promo subcollection, once per request. Postseason rows
 *  are left out here, as every regular reader leaves them out. */
const loadTeamPromoDocs = cache(async (teamId: string): Promise<TeamDoc[]> => {
  const snap = await db.collection('teams').doc(teamId).collection('promos').get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() })).filter((d) => d.data.isPostseason !== true);
});

/** Page rows for a team, display slots filled from the team's own games (the
 *  same two equality reads the team page makes, src/lib/data.ts
 *  getGamesForTeam; a cross-league date window pulled up to 2,400 docs per
 *  render, review finding 1). Tombstoned rows are KEPT here (the page resolver
 *  needs them for the removed state); every list built from this filters them. */
const loadTeamPageRows = cache(async (team: Team): Promise<PromoPageRow[]> => {
  const [docs, games, teams] = await Promise.all([loadTeamPromoDocs(team.id), getGamesForTeam(team.id, team.sportSlug), getAllTeams()]);
  const mapped = docs.map((d) => ({ id: d.id, data: d.data, promo: { ...mapPromoDoc({ id: d.id, data: () => d.data } as FirebaseFirestore.DocumentSnapshot), team } as PromoWithTeam }));
  applyGameDisplay(mapped.map((m) => m.promo), buildGameIndex(games), new Map(teams.map((t) => [t.id, t])));
  return mapped.map((m) => toPageRow(m.id, m.promo, m.data, team.league));
});

// ── the page ─────────────────────────────────────────────────────────────────

export interface PromoPage {
  team: Team;
  slug: string;
  /** The season the resolved rows belong to. */
  season: string | null;
  /** Live rows, date-ascending, one per date. */
  rows: PromoPageRow[];
  /** Tombstoned rows under the slug, date-ascending, one per date. */
  removedRows: PromoPageRow[];
  /** Their dates, ascending, unique, valid only. */
  removedDates: string[];
  /** 'removed' when every row under the slug is tombstoned. */
  state: 'live' | 'removed';
  /** The row the head and the hero describe: the next upcoming live row, else
   *  the last live row, else the last removed row. */
  primary: PromoPageRow;
  /** Live dates, ascending, unique. Empty on a removed page. */
  dates: string[];
  /** The latest updatedAt across every row under the slug (the dateModified). */
  updatedAt: string | null;
  /** The latest tombstonedAt, for the removed line. */
  removedAt: string | null;
}

function groupBySeason(rows: PromoPageRow[]): Map<string, PromoPageRow[]> {
  const m = new Map<string, PromoPageRow[]>();
  for (const r of rows) {
    const k = r.pageSeason ?? '';
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

const byDate = (a: PromoPageRow, b: PromoPageRow) => a.date.localeCompare(b.date) || a.promoId.localeCompare(b.promoId);
const maxIso = (a: string | null, b: string | null): string | null => (a && b ? (a >= b ? a : b) : (a ?? b));

/**
 * Resolve a slug for a team on the site's day. The rows under a slug are
 * grouped by pageSeason; the current season's group wins, else the latest
 * season, so a prior edition under its suffixed slug resolves too. Null when
 * no row carries the slug.
 */
export const resolvePromoPage = cache(async (team: Team, slug: string, today: string): Promise<PromoPage | null> => {
  // The cheap check first: a slug no document carries is a 404 before the
  // games read and the display join.
  if (!(await loadTeamPromoDocs(team.id)).some((d) => d.data.pageSlug === slug)) return null;
  const all = (await loadTeamPageRows(team)).filter((r) => r.pageSlug === slug);
  if (all.length === 0) return null;
  const groups = groupBySeason(all);
  const current = seasonLabelFor(team.league, today);
  const season = current && groups.has(current) ? current : [...groups.keys()].sort().pop() ?? '';
  const under = groups.get(season) ?? [];
  // One row per date: two live documents on one date under one slug (a
  // same-date, same-title twin) are one game line and one Event.
  const rows = onePerKey(under.filter((r) => !r.tombstoned).sort(byDate), (r) => r.date);
  const removedRows = onePerKey(under.filter((r) => r.tombstoned).sort(byDate), (r) => r.date);
  const state: PromoPage['state'] = rows.length > 0 ? 'live' : 'removed';
  const dates = [...new Set(rows.map((r) => r.date).filter((d) => YMD_RE.test(d)))].sort();
  const removedDates = [...new Set(removedRows.map((r) => r.date).filter((d) => YMD_RE.test(d)))].sort();
  const primary = rows.find((r) => r.date >= today) ?? rows[rows.length - 1] ?? removedRows[removedRows.length - 1];
  let updatedAt: string | null = null;
  let removedAt: string | null = null;
  for (const r of under) {
    updatedAt = maxIso(updatedAt, r.updatedAt);
    removedAt = maxIso(removedAt, r.tombstonedAt);
  }
  return { team, slug, season: season || null, rows, removedRows, removedDates, state, primary, dates, updatedAt, removedAt };
});

// ── the links and the building ───────────────────────────────────────────────

export interface LinkedPromo {
  href: string;
  title: string;
  date: string;
  type: PromoType;
  teamId: string;
  teamName: string;
  displayTime: string;
  displayOpponent: string;
}

export interface PromoPageContext {
  /** The team's `venues` record (street address, coordinates for parking and hotels). */
  venue: Venue | null;
  /** The building hub link (slug, display name, index floor) the team page uses. */
  hub: TeamVenueHubLink | null;
  /** Quick facts from the building's published view, the condensed lines the
   *  school pages print: bag, transit, parking, outside food, gates. */
  quickFacts: CondensedLine[];
  /** The Event location, from the hub (name, city, state) and the venue doc (street). */
  location: PromoPageLocation | null;
  /** The building's coordinates (the hub's, else the venue doc's) for parking. */
  coords: { lat: number; lng: number } | null;
  /** When the team's source was last read: the scan stamp
   *  (scannerState/{LEAGUE}/hashes/{team}.updatedAt), null when the team has
   *  none. NOT the row's updatedAt: that is a write instant (the backfill and
   *  the image step stamp it too), not a read (review finding 2). */
  observedAt: string | null;
  /** Other promos on the same team and date(s), one per slug. */
  alsoAtGame: LinkedPromo[];
  /** The team's next two upcoming promos under other slugs. */
  nextTeamPromos: LinkedPromo[];
  /** The section 10 block: the same theme at other clubs (3 to 5), else the
   *  league's other clubs with the same kind of promo, else the league's other
   *  clubs with any promo, else the same kind of promo across the leagues.
   *  Each step needs 3 to fire; `kind` names which one did. Null when none
   *  reaches 3. The cascade is what keeps the 8-link floor on a kids or food
   *  page with no theme (review finding 6). */
  crossTeam: { kind: 'theme' | 'league-type' | 'league' | 'type'; links: LinkedPromo[] } | null;
  /** The prior season's page under the same base slug, when one exists. */
  previousEdition: { href: string; season: string; date: string } | null;
}

const link = (team: Team, r: Pick<PromoPageRow, 'pageSlug' | 'title' | 'date' | 'type' | 'displayTime' | 'displayOpponent'>): LinkedPromo => ({
  href: promoPagePath(team.sportSlug, team.id, r.pageSlug),
  title: r.title,
  date: r.date,
  type: r.type,
  teamId: team.id,
  teamName: teamDisplayName(team),
  displayTime: r.displayTime,
  displayOpponent: r.displayOpponent,
});

/** A row another page may link to: live, dated, named, with a slug, and not
 *  an NHL or NBA special-ticket row (not a promotion anywhere the site lists
 *  promotions, WEB6 G2). */
function linkable(r: PromoPageRow, league: string): boolean {
  return !r.tombstoned && YMD_RE.test(r.date) && !!r.title.trim() && !!r.pageSlug && !(isTicketPackageLeague(league) && r.ticketPackageRequired === true);
}

function onePerKey<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

// ── the upcoming index ───────────────────────────────────────────────────────

export interface IndexedPromo {
  teamId: string;
  promoId: string;
  date: string;
  title: string;
  type: PromoType;
  pageSlug: string;
  pageSeason: string | null;
  themeKey: string | null;
  updatedAt: string | null;
  /** An NHL or NBA special-ticket row. */
  ticketPackage: boolean;
}

async function readUpcomingDocs(today: string, teams: Team[]): Promise<{ teamId: string; id: string; data: FirebaseFirestore.DocumentData }[]> {
  try {
    const snap = await db.collectionGroup('promos').where('date', '>=', today).orderBy('date', 'asc').get();
    return snap.docs.map((d) => ({ teamId: d.ref.parent.parent?.id ?? '', id: d.id, data: d.data() }));
  } catch {
    const perTeam = await Promise.all(
      teams.map(async (t) => {
        const s = await db.collection('teams').doc(t.id).collection('promos').where('date', '>=', today).get();
        return s.docs.map((d) => ({ teamId: t.id, id: d.id, data: d.data() }));
      }),
    );
    return perTeam.flat().sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)));
  }
}

const upcomingIndexCache = makeKeyedTtlCache<IndexedPromo[]>(STATIC_TTL_MS);

/** Every visible promo dated `today` or later with a page slug, keyed on the
 *  day so a new day is a new read. Tombstoned and postseason rows are out;
 *  special-ticket rows are flagged, not dropped (their pages exist). */
export const getUpcomingPromoIndex = cache(async (today: string): Promise<IndexedPromo[]> => {
  return upcomingIndexCache(today, async () => {
    const teams = await getAllTeams();
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const docs = await readUpcomingDocs(today, teams);
    const out: IndexedPromo[] = [];
    for (const d of docs) {
      const team = teamById.get(d.teamId);
      if (!team) continue;
      const data = d.data;
      if (!isVisiblePromo({ tombstoned: data.tombstoned, isPostseason: data.isPostseason })) continue;
      const pageSlug = str(data.pageSlug);
      const date = typeof data.date === 'string' && YMD_RE.test(data.date) ? data.date : null;
      const title = str(data.title);
      if (!pageSlug || !date || !title) continue;
      out.push({
        teamId: team.id,
        promoId: d.id,
        date,
        title,
        type: data.type as PromoType,
        pageSlug,
        pageSeason: str(data.pageSeason),
        themeKey: str(data.themeKey),
        updatedAt: isoOf(data.updatedAt),
        ticketPackage: isTicketPackageLeague(team.league) && isTicketPackageDoc(data),
      });
    }
    return out;
  });
});

// ── context ──────────────────────────────────────────────────────────────────

/** The team's scan stamp (scannerState/{LEAGUE}/hashes/{team}.updatedAt), one
 *  document, when the team has been scanned. */
const loadTeamScanStamp = cache(async (league: string, teamId: string): Promise<string | null> => {
  try {
    const doc = await db.collection('scannerState').doc(league).collection('hashes').doc(teamId).get();
    return doc.exists ? isoOf(doc.data()?.updatedAt) : null;
  } catch {
    return null;
  }
});

const QUICK_FACT_KEYS: readonly CondensedLine['key'][] = ['bag', 'transit', 'parking', 'outsideFood', 'gates'];

/** Everything the page links to and the building it names. */
export const loadPromoPageContext = cache(async (page: PromoPage, today: string): Promise<PromoPageContext> => {
  const { team } = page;
  const [teamRows, venue, hub, scanStamp] = await Promise.all([
    loadTeamPageRows(team),
    getVenueForTeam(team.id),
    getVenueHubForTeam(team.id),
    loadTeamScanStamp(team.league, team.id),
  ]);
  const building = hub ? await getVenueHub(hub.slug) : null;

  // Quick facts: only for a verified building, through its published view
  // (the condensed builder waives the verified flag for the college corpus by
  // ruling; a pro building that nobody signed off shows nothing here).
  const quickFacts = building && building.verified
    ? buildCondensedLogistics(building, team.id).filter((l) => QUICK_FACT_KEYS.includes(l.key))
    : [];

  const location: PromoPageLocation | null = building
    ? { name: building.name, streetAddress: venue?.address ?? null, locality: building.city, region: building.state }
    : venue
      ? { name: venue.name, streetAddress: venue.address ?? null, locality: null, region: null }
      : null;

  const pageDates = new Set(page.dates);
  const others = teamRows.filter((r) => r.pageSlug !== page.slug && linkable(r, team.league)).sort(byDate);
  const alsoAtGame = onePerKey(others.filter((r) => pageDates.has(r.date)), (r) => r.pageSlug).map((r) => link(team, r));
  // The next two by date, after this page's own game(s): a same-date sibling
  // is already in "Also at this game", so it is not the next one.
  const nextTeamPromos = onePerKey(others.filter((r) => r.date >= today && !pageDates.has(r.date)), (r) => r.pageSlug).slice(0, 2).map((r) => link(team, r));

  // Previous edition: the same base slug in an earlier season, bare or
  // carrying that season's suffix (the collision rule, promo-page-fields.js).
  const base = baseSlugOf(page.slug, page.season);
  let previousEdition: PromoPageContext['previousEdition'] = null;
  let prevSeason: string | null = null;
  for (const r of teamRows) {
    if (r.tombstoned || !r.pageSeason || !page.season || r.pageSeason >= page.season) continue;
    if (baseSlugOf(r.pageSlug, r.pageSeason) !== base) continue;
    if (!YMD_RE.test(r.date) || !r.title.trim()) continue;
    // The latest earlier season wins; within it, the latest date.
    if (prevSeason !== null && laterSeason(prevSeason, r.pageSeason) !== r.pageSeason) continue;
    if (prevSeason === r.pageSeason && previousEdition && previousEdition.date >= r.date) continue;
    prevSeason = r.pageSeason;
    previousEdition = { href: promoPagePath(team.sportSlug, team.id, r.pageSlug), season: r.pageSeason, date: r.date };
  }

  // Cross-team (section 10): the same theme at other clubs, else the cascade
  // documented on PromoPageContext. On a removed page too: a reader who came
  // for a promotion that is gone is offered the next one.
  let crossTeam: PromoPageContext['crossTeam'] = null;
  {
    const themeKey = page.primary.themeKey && page.primary.themeKey !== 'none' ? page.primary.themeKey : null;
    const index = await getUpcomingPromoIndex(today);
    const teams = await getAllTeams();
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const toLink = (r: IndexedPromo): LinkedPromo | null => {
      const t = teamById.get(r.teamId);
      return t ? link(t, { pageSlug: r.pageSlug, title: r.title, date: r.date, type: r.type, displayTime: '', displayOpponent: '' }) : null;
    };
    const elsewhere = index.filter((r) => r.teamId !== team.id && !r.ticketPackage);
    const sameLeague = (r: IndexedPromo) => teamById.get(r.teamId)?.league === team.league;
    const sameType = (r: IndexedPromo) => r.type === page.primary.type;
    const steps: ['theme' | 'league-type' | 'league' | 'type', (r: IndexedPromo) => boolean][] = [
      ['theme', (r) => !!themeKey && r.themeKey === themeKey],
      ['league-type', (r) => sameLeague(r) && sameType(r)],
      ['league', sameLeague],
      ['type', sameType],
    ];
    for (const [kind, keep] of steps) {
      const picks = onePerKey(elsewhere.filter(keep), (r) => r.teamId).slice(0, 5).map(toLink).filter((x): x is LinkedPromo => !!x);
      if (picks.length >= 3) {
        crossTeam = { kind, links: picks };
        break;
      }
    }
  }

  const coords =
    building && typeof building.lat === 'number' && typeof building.lng === 'number' && building.lat !== 0 && building.lng !== 0
      ? { lat: building.lat, lng: building.lng }
      : venue && Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && venue.lat !== 0 && venue.lng !== 0
        ? { lat: venue.lat, lng: venue.lng }
        : null;

  return {
    venue,
    hub,
    quickFacts,
    location,
    coords,
    observedAt: scanStamp,
    alsoAtGame,
    nextTeamPromos,
    crossTeam,
    previousEdition,
  };
});

// ── sitemap (brief C.11) ─────────────────────────────────────────────────────

export interface PromoSitemapEntry {
  path: string;
  lastModified: Date | null;
}

/** One URL per upcoming page (team + slug), lastmod = the latest updatedAt of
 *  its rows, omitted when no row carries one. Empty when the flag is off. */
export async function getPromoPageSitemapEntries(today: string): Promise<PromoSitemapEntry[]> {
  if (!isPromoPagesLive()) return [];
  const [index, teams] = await Promise.all([getUpcomingPromoIndex(today), getAllTeams()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const byPage = new Map<string, PromoSitemapEntry>();
  for (const r of index) {
    const team = teamById.get(r.teamId);
    if (!team) continue;
    const path = promoPagePath(team.sportSlug, team.id, r.pageSlug);
    const stamp = r.updatedAt ? new Date(r.updatedAt) : null;
    const prior = byPage.get(path);
    if (!prior) byPage.set(path, { path, lastModified: stamp });
    else if (stamp && (!prior.lastModified || stamp > prior.lastModified)) prior.lastModified = stamp;
  }
  return [...byPage.values()];
}

/** The card route's one document read: the row named by team and promo id,
 *  display slots filled from the team's games. Null for a missing or
 *  postseason row. A tombstoned row IS returned: the removed page's card
 *  draws it with the Removed badge. */
export const getPromoCardRow = cache(async (teamId: string, promoId: string): Promise<{ team: Team; row: PromoPageRow } | null> => {
  const teams = await getAllTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  const doc = await db.collection('teams').doc(teamId).collection('promos').doc(promoId).get();
  if (!doc.exists) return null;
  const data = doc.data() ?? {};
  if (data.isPostseason === true) return null;
  const promo = { ...mapPromoDoc(doc), team } as PromoWithTeam;
  const games = await getGamesForTeam(team.id, team.sportSlug);
  applyGameDisplay([promo], buildGameIndex(games), new Map(teams.map((t) => [t.id, t])));
  return { team, row: toPageRow(doc.id, promo, data, team.league) };
});
