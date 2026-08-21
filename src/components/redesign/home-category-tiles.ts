import type { PromoWithTeam } from '@/lib/types';
import type { CollectionTileTapProperties } from '@/lib/analytics';
import { isSoccerJerseyPromo } from '@/lib/soccer-jersey';

// The redesigned category grid: 7 tiles, one per real aggregator route, per
// the design target's audit correction 3 ("Hot this week" was cut because it
// counted all future highlights, not a week). Every count derives from the
// corpus the homepage already fetches (zero new reads), and each tile's
// filter MIRRORS its destination page's own filter so the number on the tile
// matches the list the tap lands on. Source of truth for each filter is the
// destination page, cited inline; if a destination filter changes, this file
// must follow.
//
// League-agnostic by construction: nothing here names a league or a season.
// A tile whose count is zero is dropped (the precedent set by the retired
// four-tile builder), so in a December corpus the grid shrinks to
// whichever categories the NFL/NHL/NBA inventory actually stocks instead of
// advertising empty lists.

type CollectionTileName = CollectionTileTapProperties['collection_name'];

export interface HomeCategoryTile {
  key: string;
  /** collection_tile_tap value. Separate from `key` because tile keys are
   *  kebab-case for routing while the analytics union is snake_case, the same
   *  split the retired four-tile builder already used. */
  trackName: CollectionTileName;
  label: string;
  blurb: string;
  count: number;
  href: string;
  /** Count + icon ink. AA-tuned darker inks from CategoryMeta where the tile
   *  maps to a promo type; brand red / kids ink for the date-scoped tiles. */
  ink: string;
}

// Mirrors the page-local helper at src/app/page.tsx:54 (UTC-safe day math on
// YMD strings; no Date-now dependence beyond the caller's anchor).
function plusDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Destination filters, mirrored:
//  - /promos/bobbleheads re at bobbleheads/page.tsx:35
//  - /promos/jersey-giveaways re at jersey-giveaways/page.tsx:33
const BOBBLEHEAD_RE = /bobblehead/i;
const JERSEY_RE = /\b(jersey|jerseys|cap|caps|hat|hats|jacket|jackets|shirt|shirts|hoodie|hoodies)\b/i;

export function buildHomeCategoryTiles(
  allFuture: PromoWithTeam[],
  todayYMD: string,
): HomeCategoryTile[] {
  // /promos/this-week lists HIGHLIGHTED promos in getPromosInDateRange(today,
  // today+7), end-inclusive (this-week/page.tsx:38-40, data.ts:312).
  const weekEnd = plusDays(todayYMD, 7);

  const defs: Array<Omit<HomeCategoryTile, 'count'> & { match: (p: PromoWithTeam) => boolean }> = [
    {
      key: 'today',
      trackName: 'today',
      label: 'Today',
      blurb: "Every promo at today's games",
      href: '/promos/today',
      ink: '#da2d20',
      // Destination's "today" board bucket (today/page.tsx: getTodayPromos).
      match: (p) => p.date === todayYMD,
    },
    {
      key: 'this-week',
      trackName: 'this_week',
      label: 'This Week',
      blurb: 'Highlighted picks in the next seven days',
      href: '/promos/this-week',
      ink: '#1d54ad',
      match: (p) => p.highlight === true && p.date <= weekEnd,
    },
    {
      key: 'bobbleheads',
      trackName: 'bobbleheads',
      label: 'Bobbleheads',
      blurb: 'Every bobblehead night tracked',
      href: '/promos/bobbleheads',
      ink: '#a35a08',
      match: (p) => BOBBLEHEAD_RE.test(p.title) || BOBBLEHEAD_RE.test(p.description),
    },
    {
      key: 'theme-nights',
      trackName: 'theme_nights',
      label: 'Theme Nights',
      blurb: 'Star Wars, heritage nights and more',
      href: '/promos/theme-nights',
      ink: '#5b2fbd',
      // theme-nights/page.tsx:72
      match: (p) => p.type === 'theme',
    },
    {
      key: 'jersey-giveaways',
      trackName: 'jerseys',
      label: 'Jersey Giveaways',
      blurb: 'Wear it home from the game',
      href: '/promos/jersey-giveaways',
      ink: '#a35a08',
      match: (p) => JERSEY_RE.test(p.title) || JERSEY_RE.test(p.description),
    },
    {
      key: 'soccer-jerseys',
      trackName: 'soccer_jerseys',
      label: 'Soccer Jersey Nights',
      blurb: 'Kit giveaways on the pitch',
      href: '/promos/soccer-jersey-nights',
      ink: '#0d6b31',
      // soccer-jersey-nights/page.tsx:79 (shared predicate, reused directly)
      match: (p) => isSoccerJerseyPromo(p, p.team.league),
    },
    {
      key: 'food-deals',
      trackName: 'food_deals',
      label: 'Food Deals',
      blurb: 'Dollar dogs and pregame specials',
      href: '/promos/food-deals',
      ink: '#0d6b31',
      // food-deals/page.tsx:31
      match: (p) => p.type === 'food',
    },
  ];

  return defs
    .map(({ match, ...tile }) => ({ ...tile, count: allFuture.filter(match).length }))
    .filter((t) => t.count > 0);
}
