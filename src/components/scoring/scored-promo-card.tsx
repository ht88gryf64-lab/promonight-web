import Link from 'next/link';
import type { ScoredPromoWithTeam } from '@/lib/types';
import { teamDisplayName } from '@/lib/promo-helpers';
import { PromoBadge } from '../promo-badge';
import { TicketsBlock, type TicketsBlockPlacement } from '../affiliates/TicketsBlock';
import { ScoreBadge } from './score-badge';

type ScoredPromoCardProps = {
  promo: ScoredPromoWithTeam;
  // When true, an inline TicketsBlock renders below the promo info. The
  // brief calls this surface "best_promos_card"; the bobblehead-specific
  // page uses "best_promos_bobbleheads_card" so click attribution can
  // split by page.
  showTickets?: boolean;
  ticketsPlacement?: Extract<
    TicketsBlockPlacement,
    'best_promos_card' | 'best_promos_bobbleheads_card'
  >;
};

function formatDateParts(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

// Promo row card for /best-promos and /best-promos/bobbleheads. Structure
// mirrors the existing aggregator-paginated-groups row (date column +
// title + matchup) with three additions sourced from the scoring layer:
// a score badge in the top-right, an item-type tag inline with the type
// chip when present, and an optional "First N fans · Presented by X" line
// underneath the team name. The card itself is a Link to the team page
// (no per-promo URL exists); when showTickets is set, a TicketsBlock
// renders as a sibling of the link inside the wrapper article so the
// star-of-david "button-inside-an-anchor" trap from the homepage strips
// is avoided.
export function ScoredPromoCard({
  promo,
  showTickets = false,
  ticketsPlacement = 'best_promos_card',
}: ScoredPromoCardProps) {
  const { team, derivedSignals } = promo;
  const teamName = teamDisplayName(team);
  const { day, weekday, month } = formatDateParts(promo.date);
  const itemType = derivedSignals.itemType;
  const quantityCap = derivedSignals.quantityCap;
  const sponsor = derivedSignals.sponsor;

  return (
    <article className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden hover:border-border-hover transition-colors">
      <Link
        href={`/${team.sportSlug}/${team.id}`}
        className="group flex items-start gap-4 p-4"
      >
        <div className="flex-shrink-0 w-14 text-center">
          <div className="font-mono text-[9px] tracking-[1px] text-text-muted">
            {month}
          </div>
          <div className="font-display text-2xl leading-none">{day}</div>
          <div className="font-mono text-[9px] tracking-[1px] text-text-dim">
            {weekday}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-base" aria-hidden="true">
              {promo.icon}
            </span>
            <PromoBadge type={promo.type} />
            {promo.highlight && (
              <span className="text-[10px] font-mono text-accent-red">HOT</span>
            )}
            {itemType && (
              <span className="text-[10px] font-mono tracking-[1px] uppercase text-text-secondary">
                {itemType}
              </span>
            )}
          </div>
          <div className="text-white font-semibold text-sm group-hover:text-accent-red transition-colors leading-snug">
            {promo.title}
          </div>
          <div className="text-text-secondary text-xs mt-1 truncate">
            {teamName}
            {promo.opponent && (
              <span className="text-text-dim"> vs {promo.opponent}</span>
            )}
            <span className="text-text-dim"> · {team.league}</span>
          </div>
          {(quantityCap || sponsor) && (
            <div className="text-text-muted text-[11px] font-mono mt-1.5">
              {quantityCap && (
                <span>First {quantityCap.toLocaleString()} fans</span>
              )}
              {quantityCap && sponsor && <span className="mx-1.5">·</span>}
              {sponsor && <span>Presented by {sponsor}</span>}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 self-start">
          <ScoreBadge score={promo.score} size="md" />
        </div>
      </Link>
      {showTickets && (
        <div className="px-4 pb-4 pt-3 border-t border-border-subtle">
          <TicketsBlock
            team={team}
            surface="web_best_promos"
            placement={ticketsPlacement}
            variant="card"
          />
        </div>
      )}
    </article>
  );
}
