import { TICKETNETWORK_RESALE_NOTE } from '@/lib/ticket-labels';

// FTC-compliant disclosure. One per page is enough; place it near the bottom
// of any page that renders affiliate CTAs.
//
// `tone`: 'light' (default) keeps the original ink for the cream and dark-legacy
// pro surfaces; 'dark' is for the CFB surfaces (#08070d base), where the
// default #444 ink would sit under 1.5:1. white/55 on that base measures 6.3:1.
/** The disclosure's wording, for a block that prints its own line under
 *  itself (the eBay listings on a promo page). */
// The last sentence (2026-11-25): the disclosure says in its own words what the
// line under each TicketNetwork button says (src/lib/ticket-labels.ts).
export const AFFILIATE_DISCLOSURE_TEXT = 'PromoNight may earn a commission on purchases made through links on this page. Prices and availability are set by the listed partners. Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value.';

export function AffiliateDisclosure({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const ink = tone === 'dark' ? 'text-white/55' : 'text-text-dim';
  return (
    <p
      className={`font-mono text-[10px] tracking-[0.08em] ${ink} leading-relaxed ${className}`}
    >
      {AFFILIATE_DISCLOSURE_TEXT}
    </p>
  );
}

/** The one line under a TicketNetwork button or button group
 *  (src/lib/ticket-labels.ts).
 *  `tone`: 'inherit' (default) takes the surrounding text colour at 75%, so the
 *  line is readable wherever a ticket card is dropped: the shared card renders
 *  on cream, white and the dark CFB and legacy surfaces, and a fixed ink was
 *  2.2:1 on the dark ones. 'light' is the house soft ink for a surface known
 *  to be light. */
export function ResaleNote({ className = '', tone = 'inherit' }: { className?: string; tone?: 'inherit' | 'light' }) {
  const ink = tone === 'light' ? 'text-rd-ink-soft' : 'opacity-75';
  return (
    <p data-resale-note="" className={`m-0 font-rd text-[12px] leading-[1.4] ${ink} ${className}`}>
      {TICKETNETWORK_RESALE_NOTE}
    </p>
  );
}
