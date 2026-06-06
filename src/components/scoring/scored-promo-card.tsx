import { IconFlame } from '@tabler/icons-react';
import type { ScoredPromoWithTeam } from '@/lib/types';
import type { ScoringPageSurface } from '@/lib/analytics';
import { teamDisplayName } from '@/lib/promo-helpers';
import { PromoBadge } from '../promo-badge';
import { TrackedTapLink } from '../analytics/TrackedTapLink';
import { TicketsBlock, type TicketsBlockPlacement } from '../affiliates/TicketsBlock';
import { categoryFor } from '../redesign/categories';
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
  // Page-level surface tag for the scored_promo_card_tap event. Excludes
  // 'team_rankings' since that page doesn't render this card.
  trackingSurface: Exclude<ScoringPageSurface, 'team_rankings'>;
  // 'dark' (default) is byte-identical when the gate is off; 'light' is the
  // cream-house card. Same data + scored_promo_card_tap event + tickets.
  variant?: 'dark' | 'light';
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
  trackingSurface,
  variant = 'dark',
}: ScoredPromoCardProps) {
  const { team, derivedSignals } = promo;
  const teamName = teamDisplayName(team);
  const { day, weekday, month } = formatDateParts(promo.date);
  const itemType = derivedSignals.itemType;
  const quantityCap = derivedSignals.quantityCap;
  const sponsor = derivedSignals.sponsor;

  if (variant === 'light') {
    const { color, label, Icon } = categoryFor(promo.type);
    return (
      <article className="overflow-hidden rounded-2xl border border-rd-line bg-rd-card transition-colors hover:border-rd-line-strong">
        <TrackedTapLink
          href={`/${team.sportSlug}/${team.id}`}
          trackEvent="scored_promo_card_tap"
          trackProps={{
            surface: trackingSurface,
            promo_id: promo.promoId,
            team_id: team.id,
            league: team.league,
            score: promo.score,
            item_type: itemType,
          }}
          className="group flex items-start gap-4 p-4"
        >
          <div className="w-14 flex-shrink-0 text-center">
            <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
            <div className="rd-numerals text-2xl leading-none text-rd-ink">{day}</div>
            <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}1a`, color }}>
                <Icon size={12} stroke={2.25} />
                <span>{label}</span>
              </span>
              {promo.highlight && (
                <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
                  <IconFlame size={12} stroke={2.25} />HOT
                </span>
              )}
              {itemType && (
                <span className="font-rd text-[10px] uppercase tracking-[0.08em] text-rd-ink-faint">{itemType}</span>
              )}
            </div>
            <div className="text-sm font-semibold leading-snug text-rd-ink transition-colors group-hover:text-rd-red">
              {promo.title}
            </div>
            <div className="mt-1 truncate font-rd text-xs text-rd-ink-soft">
              {teamName}
              {promo.opponent && <span className="text-rd-ink-faint"> vs {promo.opponent}</span>}
              <span className="text-rd-ink-faint"> · {team.league}</span>
            </div>
            {(quantityCap || sponsor) && (
              <div className="mt-1.5 font-rd text-[11px] text-rd-ink-faint">
                {quantityCap && <span>First {quantityCap.toLocaleString()} fans</span>}
                {quantityCap && sponsor && <span className="mx-1.5">·</span>}
                {sponsor && <span>Presented by {sponsor}</span>}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 self-start">
            <ScoreBadge score={promo.score} size="md" variant="light" />
          </div>
        </TrackedTapLink>
        {showTickets && (
          <div className="border-t border-rd-line px-4 pb-4 pt-3">
            <TicketsBlock team={team} surface="web_best_promos" placement={ticketsPlacement} variant="card" />
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden hover:border-border-hover transition-colors">
      <TrackedTapLink
        href={`/${team.sportSlug}/${team.id}`}
        trackEvent="scored_promo_card_tap"
        trackProps={{
          surface: trackingSurface,
          promo_id: promo.promoId,
          team_id: team.id,
          league: team.league,
          score: promo.score,
          item_type: itemType,
        }}
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
      </TrackedTapLink>
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
