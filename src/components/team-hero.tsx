import Link from 'next/link';
import type { Team, Venue, PromoType } from '@/lib/types';
import { SPORT_ICONS, PROMO_TYPE_LABELS } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { StarToggle } from './star-toggle';

interface TeamHeroProps {
  team: Team;
  venue: Venue | null;
  promoCount: number;
  promoCounts: Record<PromoType, number>;
}

export function TeamHero({ team, venue, promoCount, promoCounts }: TeamHeroProps) {
  const displayName = teamDisplayName(team);
  return (
    <section
      className="relative pt-28 pb-16 px-6 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${team.primaryColor}25 0%, ${team.secondaryColor}10 40%, var(--color-bg) 100%)`,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
          <Link href="/teams" className="hover:text-white transition-colors">Teams</Link>
          <span>/</span>
          <Link href={`/teams?league=${team.league}`} className="hover:text-white transition-colors">{team.league}</Link>
          <span>/</span>
          <span className="text-text-secondary">{displayName}</span>
        </div>

        {/* Sport badge */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono tracking-[1px] uppercase"
            style={{
              color: team.primaryColor,
              backgroundColor: `${team.primaryColor}20`,
              border: `1px solid ${team.primaryColor}40`,
            }}
          >
            {SPORT_ICONS[team.league]} {team.league} &middot; {team.division}
          </span>
        </div>

        {/* Team name with star toggle. StarToggle is a sibling of the H1
            rather than a child so the heading stays free of nested
            interactive content. Tier 1 sizing (28x28 / 20px icon) per the
            star-placement spec; surface="dark" because the hero sits on
            the team-color gradient and the unstarred outline needs the
            translucent white stroke to read against any team's palette. */}
        <div className="flex items-start gap-4 mb-2">
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl tracking-[1px] leading-[0.95] flex-1 min-w-0">
            {displayName.toUpperCase()}
          </h1>
          <div className="pt-2 md:pt-3 lg:pt-4 shrink-0">
            <StarToggle
              teamSlug={team.id}
              teamName={displayName}
              league={team.league}
              sport={team.sportSlug}
              placement="team_page_hero"
              surface="dark"
            />
          </div>
        </div>
        <p className="font-display text-2xl md:text-3xl tracking-[1px] text-text-secondary mb-2">
          {new Date().getFullYear()} PROMO SCHEDULE
        </p>
        <p className="text-text-muted text-xs font-mono tracking-[0.5px] mb-6">
          Last updated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Venue info */}
        {venue && (
          <p className="text-text-muted text-sm mb-8">
            {venue.name} &middot; {venue.address}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 mb-8">
          <StatBox label="Total Promos" value={promoCount.toString()} color={team.primaryColor} />
          <StatBox label={PROMO_TYPE_LABELS.giveaway + 's'} value={promoCounts.giveaway.toString()} color="#34d399" />
          <StatBox label={PROMO_TYPE_LABELS.theme + 's'} value={promoCounts.theme.toString()} color="#a78bfa" />
          <StatBox label={PROMO_TYPE_LABELS.food + 's'} value={promoCounts.food.toString()} color="#fb923c" />
          <StatBox label={PROMO_TYPE_LABELS.kids} value={promoCounts.kids.toString()} color="#60a5fa" />
        </div>

      </div>
    </section>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-5 py-3 min-w-[100px]">
      <div className="text-2xl font-display tracking-wide" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[9px] tracking-[1px] uppercase text-text-dim mt-0.5">
        {label}
      </div>
    </div>
  );
}
