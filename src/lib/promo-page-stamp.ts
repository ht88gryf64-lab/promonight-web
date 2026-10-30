// The server half of the inbound links (Phase 3c): the page fields a loader
// attaches to a mapped promo, and the canonical stamp it runs over the rows it
// read. Pure over its inputs (no Firestore, no clock) so the loaders' tests
// run it as-is; the env read is the one isPromoPagesLive makes.
//
// WHY A STAMP AND NOT THE HELPER. The canonical rule (ruling 2026-10-29) is a
// property of a team's pages on ONE date, so it needs the siblings. Every
// loader that returns rows reads a complete sibling set (a team's whole
// subcollection, or every team over a date window), so the loader is where
// the losers are known; the helper (promo-page-href.ts) then reads the
// stamped winner. The scored loaders read scored rows only, so a loser whose
// winner is unscored keeps its own slug there; its page points rel=canonical
// at the winner, so the link is still right, one hop later.

import type { DocumentData } from 'firebase-admin/firestore';
import type { Promo } from './types';
import { canonicalGroups, isPromoPagesLive, type ImageTier } from './promo-page-copy';
import { isTicketPackageLeague } from './ticket-packages';

/** What the stamp needs that the published Promo does not carry: the image
 *  tier (a tier 1 giveaway wins its group) and the raw special-ticket flag.
 *  Held by object identity, never serialized (CLAUDE.md: every field on a
 *  promo that reaches a client component is published). */
const pageMeta = new WeakMap<object, { imageTier: ImageTier | null; ticketPackage: boolean }>();

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Attach pageSlug and pageSeason to a mapped promo from its document, only
 *  while the flag is on and the document carries a slug. Returns the promo. */
export function attachPromoPageFields<T extends Promo>(promo: T, data: DocumentData, env: NodeJS.ProcessEnv = process.env): T {
  if (!isPromoPagesLive(env)) return promo;
  const pageSlug = str(data.pageSlug);
  if (!pageSlug) return promo;
  promo.pageSlug = pageSlug;
  promo.pageSeason = str(data.pageSeason);
  pageMeta.set(promo, {
    imageTier: data.imageTier === 1 || data.imageTier === 3 ? data.imageTier : null,
    ticketPackage: data.ticketPackageRequired === true,
  });
  return promo;
}

/**
 * Stamp pageCanonicalSlug on the canonical losers among `rows`, grouped by
 * team and date, and clear the slug of a row whose slug a later season also
 * carries on the same team. Mutates and returns `rows`. Candidates are the
 * rows the page's own lists would name: visible (the caller filtered them),
 * dated, named, with a slug, and not an NHL or NBA special-ticket row.
 */
export function stampPromoPageCanonical<T extends Promo>(rows: T[], teamOf: (row: T) => { id: string; league: string }): T[] {
  type Cand = { pageSlug: string; title: string; type: Promo['type']; imageTier: ImageTier | null; row: T };
  const byTeamDate = new Map<string, Cand[]>();
  const latestSeason = new Map<string, string>();
  for (const row of rows) {
    if (!row.pageSlug || row.tombstoned === true) continue;
    const team = teamOf(row);
    const meta = pageMeta.get(row);
    if (isTicketPackageLeague(team.league) && meta?.ticketPackage) continue;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !String(row.title || '').trim()) continue;
    const slugKey = `${team.id}|${row.pageSlug}`;
    if (row.pageSeason) {
      const prior = latestSeason.get(slugKey);
      if (!prior || row.pageSeason > prior) latestSeason.set(slugKey, row.pageSeason);
    }
    const k = `${team.id}|${row.date}`;
    const list = byTeamDate.get(k) ?? [];
    list.push({ pageSlug: row.pageSlug, title: row.title, type: row.type, imageTier: meta?.imageTier ?? null, row });
    byTeamDate.set(k, list);
  }
  for (const cands of byTeamDate.values()) {
    if (cands.length < 2) continue;
    for (const g of canonicalGroups(cands)) {
      for (const m of g.members) {
        if (m.pageSlug === g.winner.pageSlug) continue;
        // Every row under the losing slug on this date (same-date twins share one slug).
        for (const c of cands) if (c.pageSlug === m.pageSlug) c.row.pageCanonicalSlug = g.winner.pageSlug;
      }
    }
  }
  if (latestSeason.size) {
    for (const row of rows) {
      if (!row.pageSlug || !row.pageSeason) continue;
      const latest = latestSeason.get(`${teamOf(row).id}|${row.pageSlug}`);
      if (latest && row.pageSeason < latest) {
        delete row.pageSlug;
        delete row.pageSeason;
        delete row.pageCanonicalSlug;
      }
    }
  }
  return rows;
}
