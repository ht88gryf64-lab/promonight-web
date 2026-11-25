// THE TITLE A PROMO CARD PRINTS. Pure and client-safe: strings in, a string out.
//
// Some clubs publish a giveaway before they name it. The Kraken's page lists
// "Giveaway: Bobblehead, Presented by Symetra, First 5,000 fans" for
// 2027-01-31, with no player, and the stored title is a faithful "Bobblehead".
// On a card beside "Fred VanVleet Bobblehead" and "Evgeni Malkin Talking
// Bobblehead" that reads as a broken row. On 2026-11-25 nine of the 192
// upcoming NBA and NHL giveaways at 65 or higher were in that state.
//
// So a BARE ITEM TITLE, one made only of generic item words, is DISPLAYED with
// the club's short name in front: "Kraken Bobblehead", "Canadiens Bobblehead
// Night", "Kings Rally Towel", "Ducks T-Shirt Giveaway". Nothing is written:
// the stored title, the page slug, the score and the scorer are untouched
// (ruling 2026-11-25). The rule heals itself: when the club names the player,
// the weekly scan stores the new title, it is no longer bare, and it prints as
// stored.
//
// NOT THE SCORER'S GENERIC-TITLE RULE. That rule (promo-pipeline,
// lib/scoring/derived-signals.js, isGenericTitle) decides a penalty and
// exempts any title that names an item; changing it is a separate piece of
// work (docs/known-issues.md entry 127, "Bare item titles"). This file only
// decides what a card prints.
//
// Used by every promo card and by the promo page's H1. NOT by the promo
// page's <title>, og:title or JSON-LD name, which already carry the team.

/** Words that name an item or a giveaway and nothing else. A title made only
 *  of these (and of the club's own name) says what is handed out but not whose
 *  or which. Deliberately short: a word is added only when a real bare title
 *  needs it, because every word here can turn a named title bare. */
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and',
  'giveaway', 'giveaways', 'night', 'item', 'free', 'fan', 'mini', 'replica',
  'bobblehead', 'bobbleheads',
  'hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'toque',
  'jersey', 'jerseys', 't', 'tee', 'tees', 'shirt', 'shirts', 'tshirt',
  'rally', 'towel', 'towels', 'scarf', 'scarves',
  'poster', 'posters', 'magnet', 'magnets', 'schedule', 'calendar',
  'pin', 'pins', 'bag', 'tote', 'blanket', 'socks', 'puck', 'pucks', 'flag', 'pennant',
]);

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/** True when the title is made only of generic item words: no player, no
 *  theme, no sponsor, nothing that says which giveaway this is. An empty title
 *  is not bare; it is missing. */
export function isBareItemTitle(title: string | null | undefined): boolean {
  const w = words(title ?? '');
  return w.length > 0 && w.every((x) => GENERIC_WORDS.has(x));
}

/**
 * The title to DISPLAY for a promo, given the team it belongs to.
 *
 * - A bare item title gets the club's short name in front ("Kraken Bobblehead").
 * - A title that already carries the club's name is returned as stored
 *   ("Wizards T-shirt"), bare or not.
 * - Every other title is returned as stored, byte for byte.
 * - With no team (a caller that does not have one), the stored title.
 */
export function promoDisplayTitle(title: string, team: { name?: string | null } | null | undefined): string {
  const club = (team?.name ?? '').trim();
  if (!club || !title) return title;
  const clubWords = words(club);
  const t = words(title);
  // Already names the club: every word of the short name appears, in order.
  const namesClub = clubWords.length > 0 && t.join(' ').split(clubWords.join(' ')).length > 1;
  if (namesClub) return title;
  return isBareItemTitle(title) ? `${club} ${title.trim()}` : title;
}
