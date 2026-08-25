// FTC-compliant disclosure. One per page is enough; place it near the bottom
// of any page that renders affiliate CTAs.
//
// `tone`: 'light' (default) keeps the original ink for the cream and dark-legacy
// pro surfaces; 'dark' is for the CFB surfaces (#08070d base), where the
// default #444 ink would sit under 1.5:1. white/55 on that base measures 6.3:1.
export function AffiliateDisclosure({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const ink = tone === 'dark' ? 'text-white/55' : 'text-text-dim';
  return (
    <p
      className={`font-mono text-[10px] tracking-[0.08em] ${ink} leading-relaxed ${className}`}
    >
      PromoNight may earn a commission on purchases made through links on this
      page. Prices and availability are set by the listed partners.
    </p>
  );
}
