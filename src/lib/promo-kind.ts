// The entity kind of a promo doc (entity model, phase 1: schema and tolerance).
//
// `kind` is ONE additive field on teams/{teamId}/promos/{id}, written by the
// pipeline (promo-pipeline lib/scanner/promo-kind.js) in a later phase:
//
//   item     something handed to fans at the game (a bobblehead, a cap, a
//            voucher, a cookie), at the gate or with a ticket package
//   event    a theme night, a deal, entertainment, a home opener or finale,
//            an in-season cup night (NBA Cup, Commissioner's Cup)
//   fixture  the row is only the game itself ("Regular Season Match",
//            "Friday Night Hockey", a playoff match)
//
// RULES (Matt's rulings, 2026-11-25).
//  - ABSENT MEANS TODAY'S BEHAVIOR. Every doc lacks the field today, and a row
//    the classifier cannot tell keeps lacking it forever (it goes to a review
//    list; nothing guesses). So `promoKind` returns null for an absent kind
//    and for any value it does not know, and a caller must treat null exactly
//    as it treated the row before this field existed.
//  - kind and type are SEPARATE AXES. A theme night that hands out a
//    bobblehead is kind 'item' and keeps type 'theme', its themeKey and its
//    title. Never derive one from the other.
//  - A ticket package is not a kind. It stays the ticketPackageRequired flag.
//  - There is no stored game key. `promoGameKey` derives it.
//
// NOT WIRED TO ANY READER. mapPromoDoc does not copy `kind` onto a Promo, so
// it reaches no component and no RSC payload (CLAUDE.md: anything on a doc
// that reaches a client component is published). The tripwire in
// src/lib/__tests__/promo-kind.test.ts fails the suite if a reader starts
// importing this module before the phase that is meant to change behavior.

export type PromoKind = 'item' | 'event' | 'fixture';

export const PROMO_KINDS: readonly PromoKind[] = ['item', 'event', 'fixture'];

/** The stored kind of a raw promo doc (or of anything carrying the field), or
 *  null when it is absent or not one of the three known values. Never infers
 *  a kind from type, title or anything else. */
export function promoKind(p: { kind?: unknown } | null | undefined): PromoKind | null {
  const k = p?.kind;
  return typeof k === 'string' && (PROMO_KINDS as readonly string[]).includes(k) ? (k as PromoKind) : null;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The key that joins the docs of one game: an item and the event for the same
 * night share it. Derived, never stored.
 *
 *  - A postseason row is attached to a bracket game, so its key is that game's
 *    id ("bracket:{bracketGameId}"), or null when the row carries none.
 *  - Any other row: "{teamId}|{date}" when the date is a real YYYY-MM-DD.
 *  - null when there is no team or no usable date (the season-long rows with
 *    an empty or null date).
 *
 * A doubleheader date yields ONE key for both games. That is the right join
 * for "same night" and it cannot say which game a row belongs to; the game
 * join (src/lib/promo-game-join.ts) already refuses to assign a time there.
 */
export function promoGameKey(
  teamId: string | null | undefined,
  p: { date?: unknown; isPostseason?: unknown; bracketGameId?: unknown } | null | undefined,
): string | null {
  if (!p) return null;
  if (p.isPostseason === true) {
    const id = typeof p.bracketGameId === 'string' || typeof p.bracketGameId === 'number' ? String(p.bracketGameId).trim() : '';
    return id ? `bracket:${id}` : null;
  }
  // A team id is a slug; a date is a real calendar day ("2026-13-45" has the
  // shape and is not one). The pipeline's promoGameKey is the same rule.
  if (typeof teamId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(teamId)) return null;
  if (typeof p.date !== 'string' || !YMD_RE.test(p.date)) return null;
  const [y, m, d] = p.date.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1]) return null;
  return `${teamId}|${p.date}`;
}
