import type { Team } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { buildFanaticsUrl } from '@/lib/affiliates';
import { TrackedAffiliateLink } from '@/components/tracked-affiliate-link';
import { teamDisplayName } from '@/lib/promo-helpers';

export function FanGearCTA({
  team,
  surface,
  placement = 'team_page_footer',
}: {
  team: Team;
  surface: AnalyticsSurface;
  placement?: string;
}) {
  const teamName = teamDisplayName(team);
  const href = buildFanaticsUrl({
    teamSlug: team.id,
    league: team.league,
    surface,
  });

  return (
    <section className="py-10 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto text-center">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          Fan gear
        </span>
        <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 mb-4">
          SHOP OFFICIAL {teamName.toUpperCase()} GEAR
        </h2>
        <TrackedAffiliateLink
          href={href}
          partner="fanatics"
          teamId={team.id}
          sport={team.league}
          surface={surface}
          placement={placement}
          className="inline-flex items-center gap-2 bg-bg-card border border-border-subtle text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:border-border-hover"
        >
          Shop {team.name} Gear on Fanatics →
        </TrackedAffiliateLink>
      </div>
    </section>
  );
}
