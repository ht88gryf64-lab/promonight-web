import type { PromoWithTeam } from '@/lib/types';
import { categoryForPromo } from '@/components/redesign/categories';
import { teamDisplayName, synthPromoId, promoAnchorId, promoDisplayOpponent, promoDisplayTime } from '@/lib/promo-helpers';
import { promoPageHref } from '@/lib/promo-page-href';
import { buildHubRail, hubRailCountLine } from '@/lib/hub-rail';
import { normalizeSport, type AnalyticsSurface } from '@/lib/analytics';
import { HubPromoLink } from './HubPromoLink';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { IconFlame, IconArrowRight } from '@tabler/icons-react';
import { siteTodayYmd } from '@/lib/site-today';
import { ticketNetworkForGame } from '@/lib/affiliates';


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

  // The site's day, the same one getLeagueSlate's window starts on, so days_out
  // on the tap event agrees with the slate bounds.
  const today = siteTodayYmd();
  // One card per team (its soonest promo day), up to eight teams; see
  // src/lib/hub-rail.ts. The count line appears only when the rail is cut,
  // and counts the same slate the stat bar's "teams with a promo this week" does.
  const rail = buildHubRail(slate);
  const countLine = hubRailCountLine(rail);

  const byDate = new Map<string, typeof rail.cards>();
  for (const card of rail.cards) {
    const list = byDate.get(card.date) ?? [];
    list.push(card);
    byDate.set(card.date, list);
  }
  const groups = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section aria-labelledby={sectionId} data-ad-item="hub-section">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={sectionId} className="rd-display text-2xl text-rd-ink md:text-3xl">
            {heading}
          </h2>
          {countLine ? <p className="mt-1 font-rd text-[13px] text-rd-ink-soft">{countLine}</p> : null}
        </div>
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
              {list.map((card) => {
                const team = card.team;
                const name = teamDisplayName(team);
                const first = card.promos[0];
                const opponent = promoDisplayOpponent(first);
                const teamHref = `/${team.sportSlug}/${team.id}`;
                return (
                  <div
                    key={`${team.id}-${card.date}`}
                    className="flex flex-col overflow-hidden rounded-2xl border border-rd-line bg-rd-card"
                    style={{ borderTopColor: team.primaryColor, borderTopWidth: 3 }}
                  >
                    {/* flex-1: in a two-column row the shorter card's ticket
                        block sits at the bottom, level with its neighbour's. */}
                    <div className="flex-1 p-5">
                      {/* The team line keeps the team link; each promo below links
                          to its own page (or, without one, its row on the team page). */}
                      <div className="font-rd text-[13px] text-rd-ink-soft">
                        <a href={teamHref} className="inline-flex min-h-[24px] items-center font-semibold text-rd-ink underline decoration-rd-line-strong underline-offset-[3px] hover:text-rd-red hover:decoration-rd-red">
                          {name}
                        </a>
                        {opponent ? <span className="text-rd-ink-faint"> vs {opponent}</span> : null}
                      </div>
                      <ul className="mt-3 space-y-3">
                        {card.promos.map((p) => {
                          const cat = categoryForPromo(p);
                          const pageHref = promoPageHref(p);
                          return (
                            <li key={`${p.date}-${p.title}`}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-rd text-[11px] font-semibold"
                                  style={{ backgroundColor: `${cat.color}1a`, color: cat.ink }}
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
                              <HubPromoLink
                                href={pageHref ?? `${teamHref}#promo-${promoAnchorId(p)}`}
                                toPromoPage={pageHref !== null}
                                tap={{
                                  surface,
                                  team_id: team.id,
                                  sport: normalizeSport(team.league),
                                  promo_id: synthPromoId(team.id, p),
                                  promo_type: p.type,
                                  is_highlight: p.highlight,
                                  days_out: daysBetween(today, p.date),
                                }}
                                className="mt-1.5 inline-block min-h-[24px] font-rd font-semibold text-rd-ink transition-colors hover:text-rd-red hover:underline"
                              >
                                {p.title}
                              </HubPromoLink>
                            </li>
                          );
                        })}
                      </ul>
                      {card.moreDays > 0 && (
                        <a href={teamHref} className="mt-3 inline-flex min-h-[24px] items-center font-rd text-[13px] font-semibold text-rd-red hover:underline">
                          {card.moreDays === 1 ? '1 more promo day this week' : `${card.moreDays} more promo days this week`}
                        </a>
                      )}
                    </div>
                    <div className="border-t border-rd-line px-5 py-4">
                      <TicketsBlock
                        team={team}
                        surface={surface}
                        placement="promo_card"
                        promoId={`${team.id}:${first.date}:${first.title}`}
                        ticketNetwork={ticketNetworkForGame(null, team)}
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

      {/* The disclosure travels with the CTAs, not with the route. Every card
          above carries a TicketsBlock, and this is the only affiliate emitter
          on a league hub, so the rail and its fine print appear and disappear
          together: the early `slate.length === 0` return takes both out.
          Wiring it per route is what left /mlb, /mls and /wnba shipping
          undisclosed affiliate links (Phase 0, NEW-1). */}
      <AffiliateDisclosure className="mt-8" />
    </section>
  );
}
