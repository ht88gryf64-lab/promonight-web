// The eBay listings guard (step 5a, 2026-11-08), pure and dependency-free:
// the stoplist, the tokenizer, the promo's confirming tokens, the year rule
// and the heading word the view prints. src/lib/ebay-browse.ts (server-only)
// runs the call and re-exports these; the view imports this file directly,
// so a client-side test can render the block without the server-only import.

/** Words that describe the KIND of thing and so can never confirm that a
 *  listing is this promo's item. The promo type's own nouns, the giveaway
 *  boilerplate, product modifiers, the leagues and the sports, and the
 *  function words a title carries. Lowercase, singular and plural both. */
export const IMAGE_TOKEN_STOPLIST: ReadonlySet<string> = new Set([
  // the kind
  'bobblehead', 'bobbleheads', 'bobble', 'head', 'heads', 'figure', 'figures', 'figurine', 'figurines', 'statue', 'doll', 'collectible', 'collectibles', 'replica',
  // the giveaway boilerplate
  'giveaway', 'giveaways', 'night', 'nights', 'game', 'games', 'gameday', 'promo', 'promotion', 'promotions', 'sga', 'stadium', 'arena', 'center', 'centre', 'presented', 'sponsored', 'fans', 'fan', 'first', 'free', 'all', 'ticket', 'tickets', 'package', 'holder', 'holders',
  // modifiers that name an edition, not an item
  'edition', 'editions', 'statement', 'limited', 'special', 'exclusive', 'premium', 'official', 'licensed', 'commemorative', 'anniversary', 'celebration', 'tribute', 'legends', 'legend', 'series', 'mini', 'talking', 'singing', 'dancing', 'light', 'up', 'mystery', 'blind', 'box', 'remix', 'hometown', 'alumni', 'retro', 'throwback', 'classic', 'vintage', 'new', 'sealed', 'nib', 'mint', 'rare', 'lot',
  // leagues, sports and the words around them
  'nhl', 'nba', 'mlb', 'nfl', 'mls', 'wnba', 'hockey', 'basketball', 'baseball', 'football', 'soccer', 'team', 'teams', 'club', 'league', 'home', 'season', 'player', 'players', 'coach', 'star', 'stars', 'hall', 'fame', 'hof', 'captain', 'goalie', 'mascot',
  // function words
  'the', 'and', 'of', 'with', 'for', 'from', 'vs', 'at', 'in', 'on', 'to', 'by', 'a', 'an', 'his', 'her', 'their', 'your', 'our',
]);

/** Lowercase word tokens: letters and digits only, possessives dropped. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The promo name's confirming tokens: three letters or more (or a letter
 *  and digit mix such as "r2" and "d2"), not a bare number, not in the
 *  stoplist, not one of the club's own words (city, nickname, abbreviation).
 *  Empty means nothing can confirm a listing. */
export function productTokens(title: string, team: { city: string; name: string; abbreviation?: string }): string[] {
  // Each club word on its own (never a city + name join: teamDisplayName owns that).
  const club = new Set([...tokenize(team.city), ...tokenize(team.name), ...tokenize(team.abbreviation ?? '')]);
  const out = new Set<string>();
  for (const t of tokenize(title)) {
    const short = t.length < 3 && !(/\d/.test(t) && /[a-z]/.test(t));
    if (short || /^\d+$/.test(t) || IMAGE_TOKEN_STOPLIST.has(t) || club.has(t)) continue;
    out.add(t);
  }
  return [...out];
}

/** What a listing must satisfy: a confirming token, and no year that says
 *  it is another edition. */
export interface ListingGuard {
  tokens: readonly string[];
  /** The promo's year (from its date), or null when the date is unusable. */
  year: number | null;
}

/** The four-digit years a listing title names ("2012-13" names 2012 and
 *  2013; "76ers", "11/18" and "80's" name none). */
export function titleYears(title: string): number[] {
  const out = new Set<number>();
  for (const m of title.matchAll(/\b((?:19|20)\d{2})(?:[-\u2013/](\d{2}))?\b/g)) {
    const y = Number(m[1]);
    out.add(y);
    if (m[2]) out.add(Math.floor(y / 100) * 100 + Number(m[2]));
  }
  return [...out];
}

/** Whether a listing title carries one of the confirming tokens, as a whole
 *  word ("Ovechkin's" confirms "ovechkin"; "Sorokin" never confirms "soro"),
 *  and names no year outside the promo's own (the season spans two, so the
 *  year before and after pass; "2012-13 Julius Erving ... 76ers" against a
 *  2026 giveaway is another edition and is out, ux-review D2, 2026-11-08). */
export function listingConfirmed(listingTitle: string, guard: ListingGuard): boolean {
  if (!guard.tokens.length) return false;
  const words = new Set(tokenize(listingTitle));
  if (!guard.tokens.some((t) => words.has(t))) return false;
  if (guard.year !== null) {
    const years = titleYears(listingTitle);
    if (years.length && !years.some((y) => Math.abs(y - (guard.year as number)) <= 1)) return false;
  }
  return true;
}


/** The word the block's heading names: the confirming token the most
 *  listings matched on (a tie goes to the later token in the promo's name,
 *  the surname position), printed as the promo title spells it ("Erving",
 *  "Snoopy", "R2-D2"). Null when nothing confirmed. Ruling 2026-11-08: the
 *  heading is "{word} bobbleheads on eBay", never a claim about the item. */
export function ebayHeadingWord(promoTitle: string, team: { city: string; name: string; abbreviation?: string }, listingTitles: readonly string[]): string | null {
  const tokens = productTokens(promoTitle, team);
  if (!tokens.length || !listingTitles.length) return null;
  const counts = new Map<string, number>(tokens.map((t) => [t, 0]));
  for (const lt of listingTitles) {
    const words = new Set(tokenize(lt));
    for (const t of tokens) if (words.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const t of tokens) {
    const n = counts.get(t) ?? 0;
    if (n >= bestN && n > 0) {
      best = t;
      bestN = n;
    }
  }
  if (!best) return null;
  for (const raw of promoTitle.split(/\s+/)) {
    const word = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').replace(/[\u2019']s$/i, '');
    if (word && tokenize(word).includes(best)) return word;
  }
  return best;
}

export function ebayHeading(word: string | null): string {
  return word ? `${word} bobbleheads on eBay` : 'Bobbleheads on eBay';
}
