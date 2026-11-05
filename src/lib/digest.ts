import 'server-only';
import { getAllTeams, getGamesInDateRange, getPromosInDateRange } from './data';
import { PROMO_TYPE_LABELS, SPORT_ICONS, type Promo, type PromoWithTeam, type Team } from './types';
import { addDaysYmd, siteYmd } from './site-today';
import { promoDisplayOpponent, promoDisplayTime } from './promo-helpers';
import { promoPageHref } from './promo-page-href';
import { teamDisplayName, teamShortName } from '@/lib/team-display-name';
import { getUpcomingPromoIndex, type IndexedPromo } from './promo-pages';
import { quantityLine, type ImageTier } from './promo-page-copy';
import { attachPromoPageFields, stampPromoPageCanonical } from './promo-page-stamp';
import { buildGameIndex, resolveGameForPromo } from './promo-game-join';

// Weekly-digest assembly. The window's promos are fetched ONCE per run via
// getPromosInDateRange (a single deduped collection-group query, deduped by
// teamId::date::title upstream), then filtered in memory per subscriber:
// personalized = the subscriber's teams; generic = the highlighted "hot" set.
// No email lives here; this is pure data shaping.

export const DIGEST_WINDOW_DAYS = 7;
// Generic email featured-promo cap and personalized digest cap.
const GENERIC_FEATURED_CAP = 8;
const PERSONALIZED_CAP = 40;

export interface DigestPromo {
  date: string; // YYYY-MM-DD
  title: string;
  typeLabel: string;
  icon: string;
  highlight: boolean;
  time: string;
  opponent: string;
  teamId: string;
  teamName: string; // "City Name"
  league: string;
  leagueIcon: string;
  sportSlug: string;
  /** Root-relative link for the row (Phase 3c): the promo's own page when it
   *  has one, else the team page. The email builder makes it absolute and
   *  appends its subId1. */
  href: string;
  // ── Redesign fields (2026-11-05, docs/digest-redesign) ──────────────────
  // Read server-side for the email only. None of these touch mapPromoDoc:
  // the card fields come from the upcoming index (src/lib/promo-pages.ts),
  // matched on team, date and page slug, so nothing new rides the Promo
  // objects other surfaces hand to client components.
  /** True when `href` is the promo's own page (promoPageHref), false when it
   *  is the team-page fallback. Only a row with a page gets a card image,
   *  can be the hero, or has a "See this game" target. */
  hasPage: boolean;
  /** The page slug `href` resolves to (the canonical winner's), for subId3. */
  pageSlug: string | null;
  /** The promo document id and its updatedAt: the share card's key. Null when
   *  the index did not match the row (no page, or the index read failed). */
  promoId: string | null;
  updatedAt: string | null;
  imageTier: ImageTier | null;
  themeKey: string | null;
  /** "First 5,000 fans", "While supplies last", or null (quantityLine). */
  quantity: string | null;
  /** The building of the promo's own home game (Game.venueName), or null
   *  when the join found no single game. Never the team's default venue: a
   *  neutral-site or international game would name the wrong building. */
  venueName: string | null;
  /** Short team label for the row's eyebrow ("Panthers"). */
  teamShort: string;
}

/** A team as the digest renderer needs it: names for the copy, and the two
 *  ticket fields the (gated) hero ticket link reads. */
export interface DigestTeam {
  id: string;
  name: string;
  short: string;
  sportSlug: string;
  league: string;
  ticketNetworkSlug?: string;
  tnHomeUnavailable?: true;
}

/** One upcoming promo with a page, for "Coming up" and "at other clubs". */
export interface DigestUpcoming {
  teamId: string;
  date: string;
  title: string;
  themeKey: string | null;
  /** Root-relative promo page, through promoPageHref (canonical stamped). */
  href: string;
  pageSlug: string;
}

/** What every email in a run shares beyond the window's own rows. */
export interface DigestContext {
  window: { start: string; end: string };
  teams: ReadonlyMap<string, DigestTeam>;
  /** Every visible upcoming promo with a page, from the window start on,
   *  date-ascending. Empty when the index read failed (both sections omit). */
  upcoming: readonly DigestUpcoming[];
}

export interface DigestCollection {
  label: string;
  href: string; // root-relative; the email builder makes it absolute
}

// Aggregator collection pages the generic email links to.
export const DIGEST_COLLECTIONS: DigestCollection[] = [
  { label: 'Hot this week', href: '/promos/this-week' },
  { label: 'Bobblehead giveaways', href: '/promos/bobbleheads' },
  { label: 'Jersey giveaways', href: '/promos/jersey-giveaways' },
  { label: 'Theme nights', href: '/promos/theme-nights' },
  { label: 'Food deals', href: '/promos/food-deals' },
];

// Inclusive [start, end] YYYY-MM-DD window covering today plus the next 6 days =
// 7 calendar days. Ending at now + (DAYS - 1) keeps it a true 7-day span: with
// the weekly Tuesday cron, consecutive windows are contiguous (Tue..Mon, next
// Tue..Mon) and never share a boundary date, so a promo can't land in two
// back-to-back digests.
//
// The window starts on the site's Eastern day (src/lib/site-today.ts), like
// every page the email links to. It was the server's local day (UTC on Vercel)
// until WEB6 G3; the Tuesday 17:00 UTC cron sat on the same date either way,
// a manual run between 00:00 and 05:00 UTC did not.
export function digestWindow(now: Date): { start: string; end: string } {
  const start = siteYmd(now);
  return { start, end: addDaysYmd(start, DIGEST_WINDOW_DAYS - 1) };
}

interface RowMeta {
  promoId: string;
  updatedAt: string | null;
  imageTier: ImageTier | null;
  themeKey: string | null;
}

const metaKey = (teamId: string, date: string, pageSlug: string) => `${teamId}|${date}|${pageSlug}`;

/** The upcoming index keyed for the window rows. Best-effort: a failed read
 *  costs the email its images and hero, never the send. */
async function readIndex(start: string): Promise<IndexedPromo[]> {
  try {
    return await getUpcomingPromoIndex(start);
  } catch (e) {
    console.warn(`[digest] upcoming index read failed, sending without cards: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

function indexMeta(index: readonly IndexedPromo[]): Map<string, RowMeta> {
  const out = new Map<string, RowMeta>();
  for (const r of index) {
    const k = metaKey(r.teamId, r.date, r.pageSlug);
    if (!out.has(k)) out.set(k, { promoId: r.promoId, updatedAt: r.updatedAt, imageTier: r.imageTier, themeKey: r.themeKey });
  }
  return out;
}

/** Building per window row, from the row's own home game. Best-effort. */
async function venueByRow(rows: PromoWithTeam[], start: string, end: string): Promise<Map<PromoWithTeam, string>> {
  const out = new Map<PromoWithTeam, string>();
  if (rows.length === 0) return out;
  try {
    const [games, teams] = await Promise.all([getGamesInDateRange(start, end), getAllTeams()]);
    const index = buildGameIndex(games);
    const teamsById = new Map(teams.map((t) => [t.id, t]));
    for (const p of rows) {
      const resolved = resolveGameForPromo(p, index, teamsById);
      // One game only: a doubleheader's two games share a building, but the
      // rule elsewhere is never to guess which game a promo belongs to.
      if (resolved && resolved.games.length === 1 && resolved.venueName) out.set(p, resolved.venueName);
    }
  } catch (e) {
    console.warn(`[digest] games read failed, rows carry no building: ${e instanceof Error ? e.message : e}`);
  }
  return out;
}

function toDigestPromo(p: PromoWithTeam, meta?: RowMeta, venueName?: string): DigestPromo {
  const pageHref = promoPageHref(p);
  return {
    date: p.date,
    title: p.title,
    typeLabel: PROMO_TYPE_LABELS[p.type] ?? 'Promo',
    icon: p.icon,
    highlight: p.highlight,
    time: promoDisplayTime(p),
    opponent: promoDisplayOpponent(p),
    teamId: p.team.id,
    teamName: teamDisplayName(p.team),
    league: p.team.league,
    leagueIcon: SPORT_ICONS[p.team.league] ?? '',
    sportSlug: p.team.sportSlug,
    href: pageHref ?? `/${p.team.sportSlug}/${p.team.id}`,
    hasPage: pageHref !== null,
    pageSlug: pageHref ? (p.pageCanonicalSlug || p.pageSlug || null) : null,
    promoId: pageHref && meta ? meta.promoId : null,
    updatedAt: pageHref && meta ? meta.updatedAt : null,
    imageTier: pageHref && meta ? meta.imageTier : null,
    themeKey: meta?.themeKey ?? null,
    quantity: quantityLine({
      attendanceCap: typeof p.attendanceCap === 'number' ? p.attendanceCap : null,
      whileSuppliesLast: typeof p.whileSuppliesLast === 'boolean' ? p.whileSuppliesLast : null,
    }),
    venueName: venueName ?? null,
    teamShort: teamShortName(p.team),
  };
}

// Every promo in the window, deduped + date-sorted, fetched once per run.
// The window read itself is unchanged; the index and games reads that follow
// only decorate the rows, and either may fail without failing the run.
export async function fetchWindowPromos(start: string, end: string): Promise<DigestPromo[]> {
  const promos = await getPromosInDateRange(start, end);
  const [index, venues] = await Promise.all([readIndex(start), venueByRow(promos, start, end)]);
  const meta = indexMeta(index);
  return promos.map((p) =>
    toDigestPromo(p, p.pageSlug ? meta.get(metaKey(p.team.id, p.date, p.pageSlug)) : undefined, venues.get(p)),
  );
}

export function toDigestTeam(t: Team): DigestTeam {
  return {
    id: t.id,
    name: teamDisplayName(t),
    short: teamShortName(t),
    sportSlug: t.sportSlug,
    league: t.league,
    ...(t.ticketNetworkSlug ? { ticketNetworkSlug: t.ticketNetworkSlug } : {}),
    ...(t.tnHomeUnavailable === true ? { tnHomeUnavailable: true } : {}),
  };
}

/** The index rows as promo-page links, canonical-stamped the way every
 *  loader stamps its rows, then resolved through promoPageHref. Special
 *  ticket rows are left out, as the window read leaves them out. */
export function upcomingLinks(index: readonly IndexedPromo[], teams: ReadonlyMap<string, Pick<Team, 'id' | 'sportSlug' | 'league'>>): DigestUpcoming[] {
  const rows: { promo: Promo; team: Pick<Team, 'id' | 'sportSlug' | 'league'>; src: IndexedPromo }[] = [];
  for (const r of index) {
    if (r.ticketPackage) continue;
    const team = teams.get(r.teamId);
    if (!team) continue;
    const promo = {
      date: r.date, time: '', opponent: '', type: r.type, title: r.title, description: '',
      highlight: false, icon: '', recurring: false, displayTime: '', displayOpponent: '',
    } as Promo;
    attachPromoPageFields(promo, { pageSlug: r.pageSlug, pageSeason: r.pageSeason, imageTier: r.imageTier });
    rows.push({ promo, team, src: r });
  }
  const byPromo = new Map(rows.map((x) => [x.promo, x.team]));
  stampPromoPageCanonical(rows.map((x) => x.promo), (p) => byPromo.get(p)!);
  const out: DigestUpcoming[] = [];
  const seen = new Set<string>();
  for (const { promo, team, src } of rows) {
    const href = promoPageHref(promo, team);
    if (!href || seen.has(href)) continue; // canonical twins collapse to one link
    seen.add(href);
    out.push({ teamId: team.id, date: src.date, title: src.title, themeKey: src.themeKey, href, pageSlug: promo.pageCanonicalSlug || promo.pageSlug! });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Teams and upcoming links shared by every email in a run. */
export async function fetchDigestContext(window: { start: string; end: string }): Promise<DigestContext> {
  const allTeams = await getAllTeams();
  const teams = new Map(allTeams.map((t) => [t.id, toDigestTeam(t)]));
  const index = await readIndex(window.start);
  return { window, teams, upcoming: upcomingLinks(index, teams) };
}

// Promos in the window for a personalized subscriber's followed teams. Returns
// the capped list AND the true pre-cap total so the email can report an honest
// count and show an overflow note instead of silently dropping later promos.
// total === 0 is the signal to SKIP that subscriber for the week (no empty send).
export function personalizedFor(
  windowPromos: DigestPromo[],
  teamIds: string[],
): { promos: DigestPromo[]; total: number } {
  const set = new Set(teamIds);
  const filtered = windowPromos.filter((p) => set.has(p.teamId));
  return { promos: filtered.slice(0, PERSONALIZED_CAP), total: filtered.length };
}

// Featured "hot" promos for the generic email: highlighted first (the same
// signal the aggregator surfaces), backfilled with the soonest non-highlighted
// if there aren't enough highlighted ones, capped. windowPromos is already
// date-sorted, so order is preserved within each band.
export function genericFeatured(windowPromos: DigestPromo[]): DigestPromo[] {
  const highlighted = windowPromos.filter((p) => p.highlight);
  if (highlighted.length >= GENERIC_FEATURED_CAP) {
    return highlighted.slice(0, GENERIC_FEATURED_CAP);
  }
  const rest = windowPromos.filter((p) => !p.highlight);
  return [...highlighted, ...rest].slice(0, GENERIC_FEATURED_CAP);
}
