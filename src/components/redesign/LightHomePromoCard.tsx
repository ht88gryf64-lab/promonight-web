import { IconFlame } from '@tabler/icons-react';
import type { PromoWithTeam } from '@/lib/types';
import type { AnalyticsEvent, EventPropertiesMap } from '@/lib/analytics';
import { teamDisplayName } from '@/lib/promo-helpers';
import { categoryFor } from './categories';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { StarToggleInline } from '@/components/star-toggle';
import type { StarPlacement } from '@/hooks/use-starred-teams';

// Light-house promo card for the redesigned homepage Tonight + This Week
// sections. Visually it matches the team-page RedesignPromoRow (date column,
// category pill, HOT tag, title) but it is a TAP target: the content is wrapped
// in a TrackedTapLink that fires the section's existing event (tonight_card_tap /
// this_week_card_tap) with the SAME payload as the dark strips, and it carries
// the same StarToggleInline (same placement) so the star events are preserved
// byte-for-byte. Generic over the event so each section passes its typed props.
//
// Unlike RedesignPromoRow it shows the TEAM NAME (the homepage is cross-team) and
// keeps the star toggle rather than a share button — the homepage analytics
// contract is "preserve existing events; only collection_tile_tap changes", so no
// new promo_card share surface is introduced here.

function dateParts(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function LightHomePromoCard<E extends AnalyticsEvent>({
  promo,
  trackEvent,
  trackProps,
  starPlacement,
}: {
  promo: PromoWithTeam;
  trackEvent: E;
  trackProps: EventPropertiesMap[E];
  starPlacement: StarPlacement;
}) {
  const { day, weekday, month } = dateParts(promo.date);
  const { color, label, Icon } = categoryFor(promo.type);
  const teamName = teamDisplayName(promo.team);

  return (
    <div
      className="group relative flex gap-4 rounded-2xl border border-rd-line bg-rd-card p-4 transition-colors hover:border-rd-line-strong md:p-5"
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      <TrackedTapLink
        href={`/${promo.team.sportSlug}/${promo.team.id}`}
        trackEvent={trackEvent}
        trackProps={trackProps}
        className="flex min-w-0 flex-1 gap-4 pr-8"
      >
        <div className="w-14 flex-shrink-0 text-center">
          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{month}</div>
          <div className="rd-numerals text-3xl leading-none text-rd-ink">{day}</div>
          <div className="font-rd text-[10px] uppercase tracking-[0.1em] text-rd-ink-faint">{weekday}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <Icon size={12} stroke={2.25} />
              <span>{label}</span>
            </span>
            {promo.highlight && (
              <span className="inline-flex items-center gap-0.5 font-rd text-[10px] font-semibold uppercase tracking-[0.05em] text-rd-red">
                <IconFlame size={12} stroke={2.25} />
                HOT
              </span>
            )}
            {promo.time && <span className="font-rd text-[10px] text-rd-ink-faint">{promo.time}</span>}
          </div>
          <div className="line-clamp-2 text-sm font-semibold text-rd-ink transition-colors group-hover:text-rd-red md:text-base">
            {promo.title}
          </div>
          <div className="mt-1 truncate font-rd text-xs text-rd-ink-soft">
            {teamName}
            {promo.opponent && <span className="text-rd-ink-faint"> vs {promo.opponent}</span>}
          </div>
        </div>
      </TrackedTapLink>

      <div className="absolute right-2.5 top-2.5 z-10">
        <StarToggleInline
          teamSlug={promo.team.id}
          teamName={teamName}
          league={promo.team.league}
          sport={promo.team.sportSlug}
          placement={starPlacement}
        />
      </div>
    </div>
  );
}
