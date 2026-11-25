import { TICKETNETWORK_RESALE_NOTE, TICKET_TEST_NOTE } from '@/lib/ticket-labels';

// FTC-compliant disclosure. One per page is enough; place it near the bottom
// of any page that renders affiliate CTAs.
//
// `tone`: 'light' (default) keeps the original ink for the cream and dark-legacy
// pro surfaces; 'dark' is for the CFB surfaces (#08070d base), where the
// default #444 ink would sit under 1.5:1. white/55 on that base measures 6.3:1.
/** The disclosure's wording, for a block that prints its own line under
 *  itself (the eBay listings on a promo page). */
export const AFFILIATE_DISCLOSURE_TEXT = 'PromoNight may earn a commission on purchases made through links on this page. Prices and availability are set by the listed partners.';

/** The disclosure's own words for what the line under each TicketNetwork
 *  button says (src/lib/ticket-labels.ts, ruling 2026-11-25). Appended by the
 *  component, and only where the page can carry a TicketNetwork link. */
export const AFFILIATE_DISCLOSURE_RESALE_SENTENCE = 'Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value.';

/** `resale` (default true): append the TicketNetwork sentence. A caller passes
 *  false on a page that has no TicketNetwork link: a club TicketNetwork lists
 *  no events for (Ticketmaster only), or a block that links to eBay alone. */
export function AffiliateDisclosure({ className = '', tone = 'light', resale = true }: { className?: string; tone?: 'light' | 'dark'; resale?: boolean }) {
  const ink = tone === 'dark' ? 'text-white/55' : 'text-text-dim';
  return (
    <p
      className={`font-mono text-[10px] tracking-[0.08em] ${ink} leading-relaxed ${className}`}
    >
      {resale ? `${AFFILIATE_DISCLOSURE_TEXT} ${AFFILIATE_DISCLOSURE_RESALE_SENTENCE}` : AFFILIATE_DISCLOSURE_TEXT}
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

/** The one line under a test team's ticket button or button group (ticket
 *  partner test, Gate 0 ruling 4): the same sentence on both arms, in place of
 *  ResaleNote, with ResaleNote's own type and tones. */
export function TicketTestNote({ className = '', tone = 'inherit' }: { className?: string; tone?: 'inherit' | 'light' }) {
  const ink = tone === 'light' ? 'text-rd-ink-soft' : 'opacity-75';
  return (
    <p data-ticket-test-note="" className={`m-0 font-rd text-[12px] leading-[1.4] ${ink} ${className}`}>
      {TICKET_TEST_NOTE}
    </p>
  );
}
