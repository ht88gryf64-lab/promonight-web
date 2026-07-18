import { IconArrowRight } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import type { AnalyticsSurface } from '@/lib/analytics';
import { normalizeSport } from '@/lib/analytics';
import { categoryFor } from '@/components/redesign/categories';
import { teamDisplayName, synthPromoId, promoAnchorId } from '@/lib/promo-helpers';
import { formatClock } from '@/components/promos-today/helpers';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';

// Persistent per-league "today's promos" module for a league hub. Data-driven off
// getLeagueTodayPromos(league) — the SAME "promos dated today for league X" query
// the /promos/today page uses — so a future league's hub inherits it with no new
// query logic. Unlike HubThisWeek it NEVER returns null: it renders that league's
// today promos, or a compact "no promos today" line that still points at
// /promos/today. Cards deep-link to the team page promo anchor, matching the
// today board.
//
// Tap tracking reuses `this_week_card_tap` (a hub promo-card tap) with the hub's
// BASE surface (e.g. web_mlb_hub) so it stays distinguishable from the this-week
// rail (web_mlb_hub_this_week) without minting a new analytics event.
export function HubTodayPromos({
  slate,
  label,
  accent,
  sectionId,
  surface,
}: {
  slate: PromoWithTeam[];
  /** Short league label, e.g. "MLB". */
  label: string;
  /** House-palette accent hex for the card left border. */
  accent: string;
  /** DOM id / aria-labelledby anchor, e.g. "mlb-today". */
  sectionId: string;
  /** Base hub analytics surface for the card taps, e.g. "web_mlb_hub". */
  surface: AnalyticsSurface;
}) {
  const seeAllHref = '/promos/today';

  // State B — persistent fallback. Never an empty/broken slot.
  if (slate.length === 0) {
    return (
      <section
        aria-labelledby={sectionId}
        className="flex items-center justify-between gap-3 rounded-2xl border border-rd-line bg-rd-card px-5 py-4"
      >
        <h2 id={sectionId} className="font-rd text-[13px] font-semibold text-rd-ink-soft">
          No {label} promos today
        </h2>
        <a
          href={seeAllHref}
          className="inline-flex shrink-0 items-center gap-1 font-rd text-[13px] font-semibold text-rd-red hover:underline"
        >
          See all today&rsquo;s promos
          <IconArrowRight size={14} stroke={2} />
        </a>
      </section>
    );
  }

  // State A — that league's promos today.
  return (
    <section aria-labelledby={sectionId}>
      <div className="flex items-end justify-between gap-4">
        <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
          Today across {label}
        </h2>
        <a
          href={seeAllHref}
          className="inline-flex shrink-0 items-center gap-1 font-rd text-sm font-semibold text-rd-red hover:underline"
        >
          See all today
          <IconArrowRight size={15} stroke={2} />
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {slate.map((p) => {
          const cat = categoryFor(p.type);
          const clock = formatClock(p.time);
          return (
            <TrackedTapLink
              key={`${p.team.id}-${p.date}-${p.title}`}
              href={`/${p.team.sportSlug}/${p.team.id}#promo-${promoAnchorId(p)}`}
              trackEvent="this_week_card_tap"
              trackProps={{
                surface,
                team_id: p.team.id,
                sport: normalizeSport(p.team.league),
                promo_id: synthPromoId(p.team.id, p),
                promo_type: p.type,
                is_highlight: p.highlight,
                days_out: 0,
              }}
              className="group block rounded-2xl border border-rd-line bg-rd-card p-4"
              style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-rd text-[11px] font-semibold"
                style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
              >
                <cat.Icon size={12} stroke={2.25} />
                {cat.label}
              </span>
              <div className="mt-2 font-rd font-semibold text-rd-ink transition-colors group-hover:text-rd-red">
                {p.title}
              </div>
              <div className="mt-0.5 font-rd text-[13px] text-rd-ink-soft">
                {teamDisplayName(p.team)}
                {clock ? <span className="text-rd-ink-faint"> · {clock}</span> : null}
              </div>
            </TrackedTapLink>
          );
        })}
      </div>
    </section>
  );
}
