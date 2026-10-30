// Inbound links to the per-promo pages (Phase 3c, 2026-10-30): the ONE helper
// every surface calls. Pure and client-safe: no clock, no Firestore, no env.
//
// THE RULE (brief, Phase 3c). A promo links to its page by team + pageSeason
// + pageSlug; a canonical loser links to its winner; a tombstoned, dateless,
// nameless or otherwise noindexed promo never links (the caller falls back
// to the team-page anchor it used before). The anchor text is the promo
// name, never "View" or "Details": the helper gives the href, the surface
// renders the title inside it.
//
// THE FLAG rides on the data, not here. mapPromoDoc (src/lib/data.ts) sets
// pageSlug and pageSeason only while PROMO_PAGES_LIVE is "true", so with the
// flag off no promo carries a slug and this returns null on every surface.
// A client component can therefore call it during hydration and read the
// same answer the server read: the env is never consulted on the client.
//
// pageCanonicalSlug is stamped by the loaders (src/lib/promo-page-stamp.ts)
// from the team's rows on the promo's date, the same rule the page applies
// at render (promo-page-copy.ts canonicalSlugFor). pageSeason is carried so
// a row whose slug a later season also holds is not linked (the resolver
// would serve the later season's page): the stamp clears such a row's slug.

import type { Promo, Team } from './types';
import { promoPagePath, YMD_RE } from './promo-page-copy';

export type PromoPageTeam = Pick<Team, 'id' | 'sportSlug'>;

/** The promo's page href, or null when nothing may link to it. `team` may
 *  be omitted for a PromoWithTeam. */
export function promoPageHref(promo: Promo, team?: PromoPageTeam | null): string | null {
  const t = team ?? (promo as Promo & { team?: PromoPageTeam }).team;
  if (!t?.id || !t.sportSlug) return null;
  if (!promo.pageSlug || promo.tombstoned === true || promo.isPostseason === true) return null;
  if (typeof promo.date !== 'string' || !YMD_RE.test(promo.date)) return null;
  if (typeof promo.title !== 'string' || !promo.title.trim()) return null;
  return promoPagePath(t.sportSlug, t.id, promo.pageCanonicalSlug || promo.pageSlug);
}
