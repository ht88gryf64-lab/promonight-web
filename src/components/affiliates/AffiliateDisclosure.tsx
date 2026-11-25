import { TICKETNETWORK_RESALE_NOTE } from '@/lib/ticket-labels';

// FTC-compliant disclosure. One per page is enough; place it near the bottom
// of any page that renders affiliate CTAs.
//
// `tone`: 'light' (default) keeps the original ink for the cream and dark-legacy
// pro surfaces; 'dark' is for the CFB surfaces (#08070d base), where the
// default #444 ink would sit under 1.5:1. white/55 on that base measures 6.3:1.
/** The disclosure's wording, for a block that prints its own line under
 *  itself (the eBay listings on a promo page). */
export const AFFILIATE_DISCLOSURE_TEXT = 'PromoNight may earn a commission on purchases made through links on this page. Prices and availability are set by the listed partners.';

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

/** The one line under a TicketNetwork button (src/lib/ticket-labels.ts). A
 *  sibling of the disclosure, not part of it: the disclosure says PromoNight
 *  may earn a commission, this says what kind of seller the button leads to.
 *  `tone`: 'light' for cream and white surfaces, 'dark' for the CFB pages. */
export function ResaleNote({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const ink = tone === 'dark' ? 'text-white/60' : 'text-rd-ink-soft';
  return (
    <p data-resale-note="" className={`m-0 font-rd text-[12px] leading-[1.4] ${ink} ${className}`}>
      {TICKETNETWORK_RESALE_NOTE}
    </p>
  );
}
