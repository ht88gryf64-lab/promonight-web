import Link from 'next/link';
import type { Team, Venue, PromoType } from '@/lib/types';
import { SPORT_ICONS, PROMO_TYPE_LABELS } from '@/lib/types';

interface TeamHeroProps {
  team: Team;
  venue: Venue | null;
  promoCount: number;
  promoCounts: Record<PromoType, number>;
}

export function TeamHero({ team, venue, promoCount, promoCounts }: TeamHeroProps) {
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
          <span className="text-text-secondary">{team.city} {team.name}</span>
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

        {/* Team name */}
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl tracking-[1px] leading-[0.95] mb-2">
          {team.city.toUpperCase()} {team.name.toUpperCase()}
        </h1>
        <p className="font-display text-2xl md:text-3xl tracking-[1px] text-text-secondary mb-6">
          2026 PROMO SCHEDULE
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

        {/* CTA */}
        <Link
          href="/download"
          className="inline-flex items-center gap-2 bg-accent-red text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          Track on PromoNight
        </Link>
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
