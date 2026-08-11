import Link from 'next/link';
import type { ReactNode } from 'react';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import type { AffiliatePartner } from '@/lib/analytics';

// One step of the Plan the trip timeline.
//
// WHY THIS EXISTS RATHER THAN A FIFTH VARIANT ON THE SHARED CTAs.
// TicketmasterCTA, SpotHeroCTA, ExpediaCTA and FanaticsCTA each hardcode their
// own markup and expose only a `size`/`layout` union; none of them accepts a
// className. Adding a timeline variant would mean editing four components that
// render on every pro team page, for a styling need on 32 CFB pages. Instead the
// steps call TrackedAffiliateLink directly, which DOES accept children and
// className, so presentation is local while URL construction, the sub-ID and the
// PostHog + GA4 dual-emit all stay on the shared code path.

export interface TripStepProps {
  index: number;
  isLast: boolean;
  title: string;
  /** Generic by design and identical on all 32 pages. No per-rivalry variants. */
  blurb: string;
  cta: string;
  /** Solid for the primary step, ghost for the rest. */
  tone: 'solid' | 'ghost';
}

function Rail({ index, isLast }: { index: number; isLast: boolean }) {
  return (
    <div className="relative flex w-8 shrink-0 flex-col items-center" aria-hidden="true">
      <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[11px] font-semibold text-white/80">
        {index}
      </span>
      {!isLast && <span className="mt-1 w-px flex-1 bg-white/15" />}
    </div>
  );
}

function buttonClass(tone: 'solid' | 'ghost'): string {
  const base = 'mt-3 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors';
  return tone === 'solid'
    ? `${base} bg-white text-[#0b0a12] hover:bg-white/90`
    : `${base} border border-white/25 text-white hover:bg-white/10`;
}

function Shell({ index, isLast, title, blurb, children }: TripStepProps & { children: ReactNode }) {
  return (
    <li className="flex gap-3 pb-6 last:pb-0">
      <Rail index={index} isLast={isLast} />
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-snug text-white/60">{blurb}</p>
        {children}
      </div>
    </li>
  );
}

/** A step whose CTA is an affiliate link. Routes through the shared primitive. */
export function TripStepAffiliate(
  props: TripStepProps & {
    href: string;
    partner: AffiliatePartner;
    /** Sub-ID key. The rivalry SLUG, not a team id: a matchup has two schools
     *  and neither owns the click. */
    rivalrySlug: string;
  },
) {
  const { href, partner, rivalrySlug, cta, tone } = props;
  return (
    <Shell {...props}>
      <TrackedAffiliateLink
        href={href}
        partner={partner}
        teamId={rivalrySlug}
        sport="cfb"
        surface="web_cfb_rivalry"
        placement="cfb_rivalry_timeline"
        className={buttonClass(tone)}
      >
        {cta}
      </TrackedAffiliateLink>
    </Shell>
  );
}

/** A step whose CTA is an internal link. No affiliate tracking. */
export function TripStepInternal(props: TripStepProps & { href: string }) {
  return (
    <Shell {...props}>
      <Link href={props.href} className={buttonClass(props.tone)}>
        {props.cta}
      </Link>
    </Shell>
  );
}
