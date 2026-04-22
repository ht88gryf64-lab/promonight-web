// FTC-compliant disclosure. One per page is enough; place it near the bottom
// of any page that renders affiliate CTAs.
export function AffiliateDisclosure({ className = '' }: { className?: string }) {
  return (
    <p
      className={`font-mono text-[10px] tracking-[0.08em] text-text-dim leading-relaxed ${className}`}
    >
      PromoNight may earn a commission on purchases made through links on this
      page. Prices and availability are set by the listed partners.
    </p>
  );
}
