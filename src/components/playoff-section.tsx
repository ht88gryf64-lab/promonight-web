import Link from 'next/link';
import type { PlayoffPromo, Team } from '@/lib/types';

const ROUND_LABELS: Record<string, string> = {
  first_round: 'First Round',
  conference_semifinals: 'Conference Semifinals',
  conference_finals: 'Conference Finals',
  nba_finals: 'NBA Finals',
  stanley_cup_final: 'Stanley Cup Final',
};

function roundLabel(code: string): string {
  return ROUND_LABELS[code] ?? code.replace(/_/g, ' ');
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function fullTimestamp(iso: string | null): string {
  if (!iso) return 'unknown';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function extractOpponent(gameInfo: string): string | null {
  const m = gameInfo.match(/\bvs\.?\s+([A-Z][^(,]+?)(?:\s*\(|$)/);
  return m ? m[1].trim().replace(/[.,]$/, '') : null;
}

function typeColor(type: string): string {
  switch (type) {
    case 'giveaway':
      return 'var(--color-promo-giveaway)';
    case 'theme':
      return 'var(--color-promo-theme)';
    case 'food':
      return 'var(--color-promo-food)';
    default:
      return 'var(--color-text-muted)';
  }
}

interface PlayoffSectionProps {
  team: Team;
  promos: PlayoffPromo[];
  round: string;
  lastUpdated: string | null;
}

export function PlayoffSection({
  team,
  promos,
  round,
  lastUpdated,
}: PlayoffSectionProps) {
  if (promos.length === 0) return null;

  const dated = promos.filter((p) => p.date);
  const recurring = promos.filter((p) => !p.date);
  const opponent = promos
    .map((p) => extractOpponent(p.gameInfo))
    .find((o): o is string => !!o);
  const roundDisplay = roundLabel(round);

  return (
    <section
      className="py-12 md:py-16 px-6 border-t border-border-subtle"
      style={{ background: 'var(--color-accent-red-bg)' }}
    >
      <div className="max-w-5xl mx-auto">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
          2026 {team.league} Playoffs · {roundDisplay}
        </span>
        <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-2 mb-4">
          {team.city.toUpperCase()} {team.name.toUpperCase()} PLAYOFF PROMOTIONS
        </h2>
        <p className="text-text-secondary text-base leading-relaxed max-w-3xl mb-3">
          The {team.city} {team.name} are in the 2026 {roundDisplay.toLowerCase()} playoffs
          {opponent ? ` against the ${opponent}` : ''}. Their scheduled promotions during this round:
        </p>
        <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-8">
          Playoff data last updated: {fullTimestamp(lastUpdated)}
        </p>

        {dated.length > 0 && (
          <div className="space-y-3 mb-6">
            {dated.map((p, i) => (
              <PromoRow key={`d${i}`} promo={p} />
            ))}
          </div>
        )}

        {recurring.length > 0 && (
          <div>
            {dated.length > 0 && (
              <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-muted mb-3 mt-4">
                Recurring
              </p>
            )}
            <div className="space-y-3">
              {recurring.map((p, i) => (
                <PromoRow key={`r${i}`} promo={p} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-border-subtle">
          <Link
            href="/playoffs"
            className="font-mono text-[11px] tracking-[0.08em] uppercase text-accent-red hover:text-white transition-colors"
          >
            See all playoff teams →
          </Link>
        </div>
      </div>
    </section>
  );
}

function PromoRow({ promo }: { promo: PlayoffPromo }) {
  return (
    <article className="bg-bg-card border border-border-subtle rounded-xl p-4 md:p-5 flex gap-4">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0 mt-2"
        style={{ backgroundColor: typeColor(promo.type) }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
          <h3 className="font-body font-semibold text-base leading-tight">
            {promo.title}
            {promo.highlight && (
              <span className="ml-2 inline-block font-mono text-[9px] tracking-[1.5px] uppercase text-accent-red align-middle">
                Hot
              </span>
            )}
          </h3>
          <span className="font-mono text-[10px] tracking-[1px] uppercase text-text-muted whitespace-nowrap">
            {promo.date
              ? shortDate(promo.date)
              : promo.recurringDetail || 'recurring'}
          </span>
        </div>
        {promo.description && (
          <p className="text-text-secondary text-sm leading-relaxed mt-1">
            {promo.description}
          </p>
        )}
        {promo.gameInfo && (
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-text-muted mt-2">
            {promo.gameInfo}
          </p>
        )}
      </div>
    </article>
  );
}
