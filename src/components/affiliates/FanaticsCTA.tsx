import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildFanaticsUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';

// Branded white-card CTA for the team-page PREPARE FOR THE GAME cluster.
// Visual spec mirrors the CTACluster.jsx mockup: white card, 1.5px black
// border, F-flag badge with red accent, Outfit wordmark.
//
// URL routing is governed entirely by buildFanaticsUrl, which switches
// between Pattern A (Impact wrap) and Pattern B (direct fanatics.com with
// canonical Impact attribution params) based on
// NEXT_PUBLIC_FANATICS_IMPACT_WRAP. Users see no visual difference between
// the two; the upgrade is silent. PostHog `affiliate_tracking_active` flips
// false → true at the moment the env var is set, giving a clean reporting
// boundary between the bridge period and the wrap-active period.

type Props = {
  team: Team;
  surface: AnalyticsSurface;
  placement: string;
  /** 'full' (default) — team-page cluster card.
   *  'compact' — tighter padding for modal stacks / playoff cards. */
  size?: 'full' | 'compact';
};

export function FanaticsCTA({ team, surface, placement, size = 'full' }: Props) {
  const href = buildFanaticsUrl({ team, surface });

  const padding = size === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3.5';

  return (
    <TrackedAffiliateLink
      href={href}
      partner="fanatics"
      teamId={team.id}
      sport={team.league}
      surface={surface}
      placement={placement}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex items-center gap-2.5 w-full rounded-[14px] bg-white border-[1.5px] border-[#1A1A1A] ${padding} shadow-[0_3px_12px_rgba(26,26,26,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(26,26,26,0.28)]`}
    >
      {/* F-flag badge: black square, italic white "F", red flag accent on
       *  the right edge. The accent uses clipPath to render a small triangle
       *  flag rather than an image — keeps the component image-free and
       *  inline-renderable in the prerender output. */}
      <span className="relative flex items-center justify-center w-[26px] h-[26px] rounded-md bg-[#1A1A1A] shrink-0">
        <span
          className="font-outfit font-black italic text-[16px] text-white"
          style={{ letterSpacing: '-1px' }}
        >
          F
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-[2px] top-1 w-[6px] h-[8px] bg-[#E31837]"
          style={{ clipPath: 'polygon(0 0, 100% 25%, 100% 75%, 0 100%)' }}
        />
      </span>

      <span
        className="font-outfit font-extrabold text-[15px] text-[#1A1A1A]"
        style={{ letterSpacing: '-0.2px' }}
      >
        Fanatics
      </span>

      <span className="font-outfit font-semibold text-[14px] text-[#0a0a0a]">
        Shop Fan Gear
      </span>

      <span
        aria-hidden="true"
        className="ml-auto text-[#E31837] text-[17px] leading-none transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </TrackedAffiliateLink>
  );
}
