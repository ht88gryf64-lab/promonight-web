// Editions of a promotion (docs/per-promo-pages-v2-spec.md, archive pass,
// step 6, 2026-11-08), pure and dependency-free so the view and the tests
// share one definition with the loader.
//
// AN EDITION is a promo page: the rows under one pageSlug in one pageSeason.
// Two editions are the same promotion when they share the team and the
// pipeline's themeKey; a promo with no theme ("none") falls back to its
// normalized name. Prior editions are the ones in an earlier season than
// the page's, never the page itself and never a date still to come. Newest
// first, at most five. The forward link is the current season's edition
// when one exists, else the earliest later one.
import { previousSeasonLabel, seasonLabelFor, storageImageUrl, YMD_RE, type PromoPageRow } from './promo-page-copy';

export interface PromoEdition {
  href: string;
  title: string;
  season: string;
  /** The edition's latest date (a series is named by its last game). */
  date: string;
  displayOpponent: string;
  type: PromoPageRow['type'];
  themeKey: string | null;
  /** The tier 1 photo of one of the edition's rows, or null. */
  thumbnailUrl: string | null;
}

export const PREVIOUS_EDITIONS_MAX = 5;

/** The name with the season tokens, punctuation and case removed, so "Star
 *  Wars Night" and "Star Wars Night 2025-26" are one promotion. */
export function normalizedPromoName(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(?:19|20)\d{2}(?:[-–/]\d{2,4})?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The key two editions must share: the theme, else the normalized name. */
export function editionKey(row: Pick<PromoPageRow, 'themeKey' | 'title'>): string {
  const theme = (row.themeKey ?? '').trim();
  return theme && theme !== 'none' ? `theme:${theme}` : `name:${normalizedPromoName(row.title)}`;
}

type Pathing = (pageSlug: string) => string;

/** One edition per (slug, season) out of the rows, each named by its latest
 *  date, with the tier 1 photo of any of its rows. */
export function editionsOf(rows: readonly PromoPageRow[], href: Pathing): PromoEdition[] {
  const byPage = new Map<string, PromoEdition>();
  for (const r of rows) {
    if (r.tombstoned || !r.pageSlug || !r.pageSeason || !YMD_RE.test(r.date) || !r.title.trim()) continue;
    const k = `${r.pageSlug}|${r.pageSeason}`;
    const thumb = r.imageTier === 1 && r.imageRef ? storageImageUrl(r.imageRef) : null;
    const prior = byPage.get(k);
    if (!prior) {
      byPage.set(k, { href: href(r.pageSlug), title: r.title, season: r.pageSeason, date: r.date, displayOpponent: r.displayOpponent, type: r.type, themeKey: r.themeKey ?? null, thumbnailUrl: thumb });
    } else {
      if (r.date > prior.date) {
        prior.date = r.date;
        prior.displayOpponent = r.displayOpponent;
      }
      if (!prior.thumbnailUrl && thumb) prior.thumbnailUrl = thumb;
    }
  }
  return [...byPage.values()];
}

export interface EditionPage {
  slug: string;
  season: string | null;
  themeKey: string | null;
  title: string;
}

/** The prior editions of `page` among the team's rows: the same theme (else
 *  the same normalized name), an earlier season, played dates only, never the
 *  page itself; newest first, at most PREVIOUS_EDITIONS_MAX. */
export function previousEditionsFor(rows: readonly PromoPageRow[], page: EditionPage, today: string, href: Pathing): PromoEdition[] {
  if (!page.season) return [];
  const key = editionKey(page);
  const candidates = rows.filter((r) => r.pageSeason && r.pageSeason < (page.season as string) && r.date < today && !(r.pageSlug === page.slug && r.pageSeason === page.season) && editionKey(r) === key);
  return editionsOf(candidates, href)
    .sort((a, b) => b.date.localeCompare(a.date) || a.href.localeCompare(b.href))
    .slice(0, PREVIOUS_EDITIONS_MAX);
}

/** The forward link of a page: the current season's edition of the same
 *  promotion when one exists (and is not this page), else the earliest later
 *  season's; within a season the earliest date. Null when the page is the
 *  latest edition. */
export function nextEditionFor(rows: readonly PromoPageRow[], page: EditionPage, league: string, today: string, href: Pathing): PromoEdition | null {
  if (!page.season) return null;
  const key = editionKey(page);
  const later = editionsOf(
    rows.filter((r) => r.pageSeason && r.pageSeason > (page.season as string) && !(r.pageSlug === page.slug && r.pageSeason === page.season) && editionKey(r) === key),
    href,
  );
  if (!later.length) return null;
  const current = seasonLabelFor(league, today);
  const inCurrent = later.filter((e) => e.season === current);
  const pool = inCurrent.length ? inCurrent : later;
  // Earliest season, then earliest date: editionsOf names an edition by its
  // latest date, so re-derive the earliest from the rows.
  const earliestSeason = pool.map((e) => e.season).sort()[0];
  const inSeason = pool.filter((e) => e.season === earliestSeason);
  const firstDate = (e: PromoEdition) => rows.filter((r) => r.pageSlug && href(r.pageSlug) === e.href && r.pageSeason === e.season && YMD_RE.test(r.date) && !r.tombstoned).map((r) => r.date).sort()[0] ?? e.date;
  inSeason.sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
  const pick = inSeason[0];
  return { ...pick, date: firstDate(pick) };
}

export interface ArchiveSeason {
  season: string;
  editions: PromoEdition[];
}

/** The team's played editions grouped by season, newest season first and
 *  newest date first inside it. Empty when the team has no played row. */
export function archiveSeasons(rows: readonly PromoPageRow[], today: string, href: Pathing): ArchiveSeason[] {
  const played = rows.filter((r) => YMD_RE.test(r.date) && r.date < today);
  const bySeason = new Map<string, PromoEdition[]>();
  for (const e of editionsOf(played, href)) bySeason.set(e.season, [...(bySeason.get(e.season) ?? []), e]);
  return [...bySeason.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([season, editions]) => ({ season, editions: editions.sort((a, b) => b.date.localeCompare(a.date) || a.href.localeCompare(b.href)) }));
}

/** The index window for a played page (ruling 2026-11-08): the current
 *  season and the one before it, by the league's own season labels. */
export function indexWindow(league: string, today: string): { current: string | null; previous: string | null } {
  const current = seasonLabelFor(league, today);
  return { current, previous: current ? previousSeasonLabel(current) : null };
}

/** Whether a played date is inside the index window for its league. */
export function playedDateIndexable(league: string, ymd: string, today: string): boolean {
  const season = seasonLabelFor(league, ymd);
  if (!season) return false;
  const w = indexWindow(league, today);
  return season === w.current || season === w.previous;
}
