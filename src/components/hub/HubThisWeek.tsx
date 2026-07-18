import type { PromoWithTeam } from '@/lib/types';
import { categoryFor } from '@/components/redesign/categories';
import { teamDisplayName, synthPromoId } from '@/lib/promo-helpers';
import { normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import { TrackedTapLink } from '@/components/analytics/TrackedTapLink';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { IconFlame, IconArrowRight } from '@tabler/icons-react';

// Cap the rail so it stays a focused lead-in. getMlbSlate is already one promo
// per team, date-sorted, so this is the soonest teams. Exhaustive, crawlable
// team coverage lives in the division grid below.
const RAIL_LIMIT = 8;

// Chicago-anchored today, matching getMlbSlate's window anchor, so days_out on
// the tap event is consistent with the slate bounds. Duplicated small helper,
// consistent with the existing date helpers scattered across the app.
function chicagoTodayYMD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// "This week across MLB" rail. Light house cards grouped by date, promo-type
// dots via categoryFor, team-color top accent, and the reused white-card
// TicketsBlock (variant='card', the wrapper-less form GameExpand uses that
// reads on cream). Server component; taps and ticket clicks fire via client
// leaves (TrackedTapLink / TicketsBlock's TrackedAffiliateLink).
export function HubThisWeek({
  slate,
  heading,
  sectionId,
  surface,
}: {
  slate: PromoWithTeam[];
  /** Section heading, e.g. "This week across MLB". */
  heading: string;
  /** DOM id / aria-labelledby anchor, e.g. "mlb-this-week". */
  sectionId: string;
  /** Analytics surface for the card taps and the reused TicketsBlock. */
  surface: AnalyticsSurface;
}) {
  if (slate.length === 0) return null;

  const today = chicagoTodayYMD();
  const items = slate.slice(0, RAIL_LIMIT);

  const byDate = new Map<string, PromoWithTeam[]>();
  for (const p of items) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const groups = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section aria-labelledby={sectionId}>
      <div className="flex items-end justify-between gap-4">
        <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
          {heading}
        </h2>
        <a
          href="/promos/this-week"
          className="inline-flex shrink-0 items-center gap-1 font-rd text-sm font-semibold text-rd-red hover:underline"
        >
          See all
          <IconArrowRight size={15} stroke={2} />
        </a>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map(([date, list]) => (
          <div key={date}>
            <h3 className="font-rd text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
              {formatDayLabel(date)}
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {list.map((p) => {
                const cat = categoryFor(p.type);
                const name = teamDisplayName(p.team);
                return (
                  <div
                    key={p.team.id}
                    className="overflow-hidden rounded-2xl border border-rd-line bg-rd-card"
                    style={{ borderTopColor: p.team.primaryColor, borderTopWidth: 3 }}
                  >
                    <TrackedTapLink
                      href={`/${p.team.sportSlug}/${p.team.id}`}
                      trackEvent="this_week_card_tap"
                      trackProps={{
                        surface,
                        team_id: p.team.id,
                        sport: normalizeSport(p.team.league),
                        promo_id: synthPromoId(p.team.id, p),
                        promo_type: p.type,
                        is_highlight: p.highlight,
                        days_out: daysBetween(today, p.date),
                      }}
                      className="group block p-5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-rd text-[11px] font-semibold"
                          style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                        >
                          <cat.Icon size={12} stroke={2.25} />
                          {cat.label}
                        </span>
                        {p.highlight && (
                          <span className="inline-flex items-center gap-1 font-rd text-[10px] font-bold uppercase tracking-wide text-rd-red">
                            <IconFlame size={12} stroke={2.25} />
                            Hot
                          </span>
                        )}
                      </div>
                      <div className="mt-2 font-rd font-semibold text-rd-ink transition-colors group-hover:text-rd-red">
                        {p.title}
                      </div>
                      <div className="mt-0.5 font-rd text-[13px] text-rd-ink-soft">
                        {name}
                        {p.opponent ? (
                          <span className="text-rd-ink-faint"> vs {p.opponent}</span>
                        ) : null}
                      </div>
                    </TrackedTapLink>
                    <div className="border-t border-rd-line px-5 py-4">
                      <TicketsBlock
                        team={p.team}
                        surface={surface}
                        placement="promo_card"
                        promoId={`${p.team.id}:${p.date}:${p.title}`}
                        variant="card"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
