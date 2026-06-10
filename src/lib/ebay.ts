// eBay Partner Network resale links for completed bobblehead giveaways.
// Website-only per EPN approval scope — never import this from email/digest
// code. Follows the affiliates.ts pattern: tracking ID from a NEXT_PUBLIC_*
// env var, CTA components gate render on isEbayResaleActive() so an unset
// campid means no link at all (an untagged eBay search link earns nothing
// and a placeholder campid would misattribute).

import { synthPromoId } from './promo-helpers';
import type { Promo } from './types';

const EBAY_CAMPID = process.env.NEXT_PUBLIC_EBAY_CAMPID ?? '';
// EPN rotation ID for ebay.com US.
const EBAY_MKRID = '711-53200-19255-0';

export type EbayResalePlacement = 'bobbleheads_hub' | 'team_page';

export function isEbayResaleActive(): boolean {
  return EBAY_CAMPID.length > 0;
}

// Deliberately narrower than the /promos/bobbleheads inclusion filter (which
// also matches descriptions): a promo whose description merely mentions a
// bobblehead must not grow a resale CTA, so only giveaway-typed promos with
// "bobblehead" in the title qualify.
export function isBobbleheadGiveaway(promo: Pick<Promo, 'type' | 'title'>): boolean {
  return promo.type === 'giveaway' && /bobblehead/i.test(promo.title);
}

// "{year} {team nickname} {item} bobblehead" — the title minus the words the
// trailing "bobblehead" keyword already covers, so "Aaron Judge Bobblehead
// Giveaway" searches as "2026 Yankees Aaron Judge bobblehead" rather than
// repeating itself.
function resaleQuery(promo: Pick<Promo, 'date' | 'title'>, teamNickname: string): string {
  const item = promo.title
    .replace(/bobbleheads?/gi, ' ')
    .replace(/giveaways?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [promo.date.slice(0, 4), teamNickname, item, 'bobblehead']
    .filter(Boolean)
    .join(' ');
}

// EPN customid: alphanumeric + underscore only, max 256 chars. The synthetic
// promo id carries colons, spaces, and whatever punctuation the title has —
// all collapsed to single underscores.
export function ebayCustomId(placement: EbayResalePlacement, promoId: string): string {
  return `web_${placement}_${promoId}`
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 256);
}

export function buildEbayResaleUrl(opts: {
  promo: Pick<Promo, 'date' | 'title'>;
  teamSlug: string;
  teamNickname: string;
  placement: EbayResalePlacement;
}): string {
  const url = new URL('https://www.ebay.com/sch/i.html');
  url.searchParams.set('_nkw', resaleQuery(opts.promo, opts.teamNickname));
  url.searchParams.set('mkcid', '1');
  url.searchParams.set('mkrid', EBAY_MKRID);
  url.searchParams.set('siteid', '0');
  url.searchParams.set('campid', EBAY_CAMPID);
  url.searchParams.set(
    'customid',
    ebayCustomId(opts.placement, synthPromoId(opts.teamSlug, opts.promo)),
  );
  url.searchParams.set('toolid', '10001');
  url.searchParams.set('mkevt', '1');
  return url.toString();
}
