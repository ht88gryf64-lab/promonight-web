import type { ReactNode } from 'react';
import { PromoBadge } from './promo-badge';
import { AppPushPitch } from './app-push-pitch';
import { ShareButton, formatShareDate, type ShareItem } from './share';
import { EbayResaleLink } from './affiliates/EbayResaleLink';
import { RedesignPromoRow } from '@/components/redesign/RedesignPromoRow';
import { LazyPromoRows } from '@/components/redesign/LazyPromoRows';
import { PromoArrivalHighlight } from '@/components/redesign/PromoArrivalHighlight';
import { isBobbleheadGiveaway, isEbayResaleActive } from '@/lib/ebay';
import { splitCompletedForRender } from '@/lib/render-windows';
import { promoAnchorId, splitPromosByDate } from '@/lib/promo-helpers';
import { seasonSpan, completedHeading, completedSubline } from '@/lib/season-label';
import type { Promo, PromoType, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';
import { isPurchaseGated } from '@/lib/promo-helpers';

// SEASON_YEAR = 2026 used to live here. Its comment was right about the hazard
// it was avoiding: these strings label promos that have ALREADY HAPPENED, so a
// getFullYear() would have rendered "COMPLETED 2027 PROMOS" over a list of 2026
// events at midnight on Jan 1. But the replacement carried a second assumption,
// that a season IS a calendar year, and that is false for NHL, NBA and NFL, and
// for any MLS or MLB page whose archive happens to cross a New Year.
//
// The label is now derived from the rows it labels (src/lib/season-label.ts),
// which is neither clock-derived nor constant. Single-year output is
// byte-identical to what the constant produced, so the 30 MLB and 15 WNBA pages
// do not move.

// Fields shared by every promo row's ShareItem — the per-promo bits (icon,
// title, date, type) are filled in per row.
type PromoShareContext = {
  teamName: string;
  teamSlug: string;
  sport: string;
  primaryColor?: string;
  venueName?: string | null;
};

function formatPromoDate(dateStr: string): { day: string; weekday: string; month: string } {
  const date = new Date(dateStr + 'T12:00:00');
  return {
    day: date.getDate().toString(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

const TYPE_COLORS: Record<PromoType, string> = {
  giveaway: '#34d399',
  theme: '#a78bfa',
  kids: '#60a5fa',
  food: '#fb923c',
};

function PromoRow({
  promo,
  share,
  completed = false,
  resaleSlot,
  scopeLive = false,
}: {
  promo: Promo;
  share: PromoShareContext;
  completed?: boolean;
  resaleSlot?: ReactNode;
  /** Whether this league's rollout gate has opened. The Ticket Package pill is
   *  a visible change, and the rollback-only template is still an MLB render
   *  path, so it holds with everything else rather than being the one thing in
   *  the change with no gate. */
  scopeLive?: boolean;
}) {
  const { day, weekday, month } = formatPromoDate(promo.date);
  const typeColor = TYPE_COLORS[promo.type];

  const shareItem: ShareItem = {
    icon: promo.icon,
    promoTitle: promo.title,
    teamName: share.teamName,
    date: formatShareDate(promo.date),
    venue: share.venueName ?? null,
    sport: share.sport,
    teamSlug: share.teamSlug,
    promoType: promo.type,
    primaryColor: share.primaryColor ?? null,
  };

  return (
    <div
      className={`group relative bg-bg-card border border-border-subtle rounded-2xl p-4 md:p-5 transition-all flex gap-4 ${
        completed
          ? ''
          : 'hover:border-border-hover'
      }`}
      style={{ borderLeftWidth: '3px', borderLeftColor: typeColor }}
    >
      <ShareButton
        item={shareItem}
        placement="promo_card"
        className="absolute top-2.5 right-2.5 inline-flex items-center justify-center w-8 h-8 rounded-full text-text-muted hover:text-white hover:bg-white/10 active:bg-white/[0.15] transition-colors"
        label={`Share ${promo.title}`}
      />
      <div className="flex-shrink-0 w-14 text-center">
        <div className="font-mono text-[9px] tracking-[1px] text-text-muted">{month}</div>
        <div className="font-display text-3xl leading-none">{day}</div>
        <div className="font-mono text-[9px] tracking-[1px] text-text-dim">{weekday}</div>
      </div>

      <div className="flex-1 min-w-0 pr-8">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-lg" aria-hidden="true">{promo.icon}</span>
          <PromoBadge type={promo.type} gated={scopeLive && isPurchaseGated(promo)} />
          {completed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.5px] uppercase text-text-dim border border-border-subtle rounded-full px-2 py-0.5">
              Completed
            </span>
          )}
          {!completed && promo.highlight && !isPurchaseGated(promo) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-red">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse-dot" />
              HOT
            </span>
          )}
          {promo.time && (
            <span className="text-text-dim text-[10px] font-mono">{promo.time}</span>
          )}
        </div>
        <div className="text-white font-semibold text-sm md:text-base">
          {promo.title}
        </div>
        {promo.description && (
          <p className="text-text-secondary text-xs md:text-sm mt-1">
            {promo.description}
          </p>
        )}
        {promo.opponent && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-text-dim text-[10px] font-mono tracking-[0.5px] uppercase">
            vs {promo.opponent}
          </div>
        )}
        {resaleSlot && <div>{resaleSlot}</div>}
      </div>
    </div>
  );
}

const UPCOMING_VISIBLE = 10;
const COMPLETED_VISIBLE = 5;

/**
 * How many completed rows the LIGHT variant server-renders when the page has
 * published a season count.
 *
 * WHY ANY AT ALL. A season-scoped page says "98 promotions in the 2026 season"
 * and then server-renders the upcoming rows and a button. The count is honest,
 * but a crawler never clicks the button, so the page asserts a season it does
 * not show. Eight rows put the most recent completed nights in the HTML behind
 * the claim. That matters most in the season-complete state, where the upcoming
 * list is empty and these are the only promo rows in the served HTML.
 *
 * WHY EIGHT AND NOT ALL OF THEM. Completed rows are client-mounted because
 * data-rich pages sit near Bing's 1 MB HTML ceiling, and that constraint is
 * unchanged.
 *
 * THE COST PER ROW, MEASURED PROPERLY. An earlier version of this comment put
 * it at 6,478 B (4,009 DOM + 2,469 flight) and was wrong by 1.93x, in two ways.
 * React Flight DEDUPLICATES: a collapsed row is not serialized as an object
 * inside LazyPromoRows' props, it is a path pointer into gameContexts, which
 * already carries every promo. Measured on the served Dodgers payload, all 76
 * collapsed rows cost 5,264 B TOTAL, about 68 B each, not 2,469 B each. And the
 * 4,009 B DOM figure was taken from lifted resale rows, which carry an 862 B
 * eBay CTA block that these rows deliberately do not.
 *
 * Marginal cost of moving one row from collapsed to server-rendered:
 *   ~3,030 B DOM  +  389 B flight element  -  68 B pointer reclaimed  =  ~3,350 B
 *
 * Baselines, cache-busting curl of production 2026-09-04, uncompressed:
 *   mlb/texas-rangers        846,229 B   80.7% of 1 MiB   <- heaviest page on the site
 *   mlb/minnesota-twins      819,655 B   78.2%
 *   mlb/miami-marlins        800,512 B   76.3%
 *   nhl/detroit-red-wings    772,271 B   73.6%   (falls back, so unaffected)
 *   mlb/los-angeles-dodgers  732,902 B   69.9%
 *
 * Eight rows cost about 26.8 KB, so the worst page lands near 83% even if the
 * calendar trim saves nothing. The change is in fact net NEGATIVE on weight:
 * restricting the calendar's prerender window to home days removes 92 to 140 KB
 * of hidden away-game blocks from every MLB and NFL page, far more than these
 * rows add.
 *
 * The eight are IN ADDITION to the up-to-three lifted resale rows, so the
 * server-rendered completed block tops out at eleven. Only the lifted three
 * carry the eBay CTA; these eight are passed no resale slot, so the affiliate
 * surface does not grow with them.
 *
 * The remainder stays behind the expander with its count in the button label.
 * On a team whose archive is eight rows or fewer after the lift there is no
 * remainder and the expander does not render at all, which is correct rather
 * than a regression: nothing is hidden.
 */
const COMPLETED_SSR_WHEN_SEASON_SCOPED = 8;

const RESALE_LIFT_VISIBLE = 3;

export function PromoList({
  promos,
  teamSlug,
  teamName,
  league,
  teamNickname,
  sport,
  primaryColor,
  venueName,
  variant = 'dark',
  showAppPitch = true,
  seasonScoped = false,
  scopeLive = false,
  team,
  gameContexts,
}: {
  promos: Promo[];
  teamSlug: string;
  teamName: string;
  /** Team league; gates the app pitch to the leagues the app covers. */
  league: string;
  /** Short brand name (Team.name, e.g. "Yankees") for the eBay resale search
   *  query. Falls back to teamName, which over-specifies the query slightly. */
  teamNickname?: string;
  sport: string;
  primaryColor?: string;
  venueName?: string | null;
  variant?: 'dark' | 'light';
  // When false, the trailing app push pitch is suppressed (the team page renders
  // it separately in the email+app pairing). Default true keeps every other
  // surface unchanged.
  showAppPitch?: boolean;
  /** True when the page published a SEASON count above this list. Server-renders
   *  a bounded slice of the completed archive so the HTML carries evidence for
   *  the claim. False leaves the list byte-identical to before. */
  seasonScoped?: boolean;
  /** Whether this league's rollout gate has opened. Only the rollback-only dark
   *  variant reads it, for the Ticket Package pill. */
  scopeLive?: boolean;
  /** Full team object — enables the upcoming rows to open the shared game modal
   *  (light variant only). Absent → rows render static, as before. */
  team?: Team;
  /** The team's already-resolved season GameContexts (same set the calendar
   *  uses). Reused here to map each upcoming promo's date to its home-game
   *  context(s) with ZERO additional Firestore reads. */
  gameContexts?: GameContext[];
}) {
  const share: PromoShareContext = {
    teamName,
    teamSlug,
    sport,
    primaryColor,
    venueName,
  };
  // Map each date to its HOME-game context(s) from the calendar's already-
  // resolved set (the promo lives at the home venue). Built in memory — no
  // extra Firestore reads. Drives the upcoming rows' modal content; absent for
  // game-less leagues, where rows fall back to the legacy promo body.
  const homeCtxByDate = new Map<string, GameContext[]>();
  if (gameContexts) {
    for (const c of gameContexts) {
      if (!c.isHome) continue;
      const list = homeCtxByDate.get(c.game.date) ?? [];
      list.push(c);
      homeCtxByDate.set(c.game.date, list);
    }
  }
  const contextsFor = (p: Promo): GameContext[] | null => homeCtxByDate.get(p.date) ?? null;

  // The shared split. This file used to own the only correct date filter on the
  // page while every count around it was all-time, which is how the hero came to
  // advertise promos this list reported as gone. The predicate now lives in
  // promo-helpers so both read the same definition.
  const { upcoming, past } = splitPromosByDate(promos);

  // The archive labels itself from its own rows. splitPromosByDate is untouched:
  // `p.date >= today` is correct on all 169 teams and is not what was wrong.
  const pastSpan = seasonSpan(past.map((p) => p.date));
  const pastHeading = completedHeading(pastSpan);
  const pastCount = completedSubline(past.length, pastSpan);
  // Byte-identical to "See completed 2026 promos below." on a single-year
  // archive. This line renders when a club has run out of upcoming promos, so
  // it IS an MLB surface at season end, not an NHL-only one.
  const pastPointerYears = pastSpan ? `${pastSpan.yearLabel} ` : '';

  // State (b) from src/lib/season-scope.ts, recomputed here from the rows this
  // component already holds rather than threaded as a fourth prop.
  const seasonComplete = seasonScoped && upcoming.length === 0 && past.length > 0;

  const upcomingVisible = upcoming.slice(0, UPCOMING_VISIBLE);
  const upcomingHidden = upcoming.slice(UPCOMING_VISIBLE);
  const pastVisible = past.slice(0, COMPLETED_VISIBLE);
  const pastHidden = past.slice(COMPLETED_VISIBLE);

  // Completed bobblehead giveaways are exempt from the light variant's full
  // collapse: up to 3 (most recent) render above the expander carrying the
  // eBay resale CTA. The lifted rows are content and render regardless of the
  // campid (same contract as the hub's Earlier-this-season section) — only the
  // CTA itself is env-gated, so unsetting the var never silently changes page
  // content.
  //
  // These three stay the ONLY server-rendered rows carrying the resale CTA. The
  // season-scoped slice below adds up to eight more completed rows to the HTML
  // and deliberately passes them no slot, so this cap is a cap on the affiliate
  // surface and not merely on the lift.
  // A partition of `past`: every completed row lands in exactly one group. The
  // arithmetic lives in src/lib/render-windows.ts and is tested there.
  const {
    resale: pastResale,
    ssr: pastSsr,
    collapsed: pastCollapsed,
  } = splitCompletedForRender(
    past,
    isBobbleheadGiveaway,
    RESALE_LIFT_VISIBLE,
    seasonScoped ? COMPLETED_SSR_WHEN_SEASON_SCOPED : 0,
  );

  // Resolves to undefined (not a null-rendering element) for non-qualifying
  // rows, so the rows' `resaleSlot &&` wrapper never emits an empty div and
  // an unset campid leaves the rendered HTML identical to before.
  const resaleSlotFor = (promo: Promo, slotVariant: 'light' | 'dark') =>
    isEbayResaleActive() && isBobbleheadGiveaway(promo) ? (
      <EbayResaleLink
        promo={promo}
        teamSlug={teamSlug}
        teamNickname={teamNickname ?? teamName}
        sport={sport}
        placement="team_page"
        surface="web_team_page"
        variant={slotVariant}
      />
    ) : undefined;

  if (variant === 'light') {
    return (
      <section className="py-12 px-6">
        <PromoArrivalHighlight />
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            {/* SEASON-COMPLETE HEADING. With a published season count and nothing
             *  left, "Coming up / UPCOMING PROMOS" is a large heading over the
             *  sentence "there are none", which is the single strongest
             *  empty-page signal on the page. Every MLB club enters this state,
             *  and the Dodgers cluster alone carries roughly 26,000 monthly
             *  impressions, so the heading has to name what the page actually
             *  holds: the season. Only the words change; the rows, the archive
             *  below and the ordering are untouched. Held and fallback pages
             *  keep the original heading byte for byte. */}
            <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
              {seasonComplete ? 'The full season' : 'Coming up'}
            </span>
            <h2 className="rd-display text-3xl md:text-4xl text-rd-ink mt-1">
              {seasonComplete ? `${pastSpan?.yearLabel ?? ''} SEASON PROMOS`.trim() : 'UPCOMING PROMOS'}
            </h2>
            {upcoming.length > 0 && (
              <p className="text-rd-ink-faint text-xs font-rd tracking-[0.02em] mt-2">
                {upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'}
                {upcomingHidden.length > 0 ? ' · full schedule below' : ''}
              </p>
            )}
          </div>

          {upcoming.length > 0 ? (
            <>
              <div className="space-y-3">
                {upcomingVisible.map((promo, i) => (
                  <RedesignPromoRow
                    key={`u-${i}`}
                    promo={promo}
                    share={share}
                    team={team}
                    contexts={contextsFor(promo)}
                    interactive
                    anchorId={`promo-${promoAnchorId(promo)}`}
                  />
                ))}
              </div>

              {upcomingHidden.length > 0 && (
                <LazyPromoRows
                  promos={upcomingHidden}
                  share={share}
                  showLabel={`Show all ${upcoming.length} upcoming promos`}
                  hideLabel={`Hide ${upcomingHidden.length} additional promos`}
                  team={team}
                  contexts={upcomingHidden.map(contextsFor)}
                  interactive
                  /* Same id formula as the visible rows above. Without these the
                     hidden rows are unreachable by fragment, which is what made a
                     deep link into a week with more than UPCOMING_VISIBLE promos
                     land at the top of the page. */
                  anchorIds={upcomingHidden.map((p) => `promo-${promoAnchorId(p)}`)}
                />
              )}
            </>
          ) : past.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-rd-ink-soft text-lg">No upcoming promos yet</p>
              <p className="text-rd-ink-faint text-sm mt-1">Check back later for the latest schedule</p>
            </div>
          ) : seasonComplete ? (
            /* States what the page HAS rather than what it lacks. Deliberately
             * not "the season is complete": zero upcoming rows means our data
             * holds nothing ahead, which is not the same as the season being
             * over or our record being exhaustive. */
            <div className="py-2">
              <p className="text-rd-ink-soft text-sm">
                All {past.length} {teamName} {past.length === 1 ? 'promotion' : 'promotions'} on record for the{' '}
                {pastSpan?.yearLabel} season are below.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-rd-ink-soft text-sm">
                No upcoming {teamName} promos scheduled right now. See completed {pastPointerYears}promos below.
              </p>
            </div>
          )}

          {past.length > 0 && (
            <div className="mt-12">
              <div className="mb-4">
                <span className="font-rd text-[11px] uppercase tracking-[0.14em] text-rd-ink-faint">
                  Already happened
                </span>
                <h3 className="rd-display text-2xl md:text-3xl text-rd-ink-soft mt-1">
                  {pastHeading}
                </h3>
                {/* The archive states its own size. This is the ONE count on the
                    page derived from past promos, and it sits under a heading
                    that says COMPLETED, so it describes rather than advertises.
                    Parity with the dark variant below. */}
                <p className="text-rd-ink-faint text-xs font-rd mt-2">
                  {pastCount}
                </p>
              </div>

              {/* Lifted resale rows: at most RESALE_LIFT_VISIBLE, and the only
               *  server-rendered rows that carry the eBay CTA. Together with the
               *  season slice below the collapse admits at most
               *  RESALE_LIFT_VISIBLE + COMPLETED_SSR_WHEN_SEASON_SCOPED rows,
               *  which is what keeps the 1MB SSR-HTML concern handled. */}
              {pastResale.length > 0 && (
                <div className="mb-3 space-y-3">
                  {pastResale.map((promo, i) => (
                    <RedesignPromoRow
                      key={`rb-${i}`}
                      promo={promo}
                      share={share}
                      completed
                      resaleSlot={resaleSlotFor(promo, 'light')}
                    />
                  ))}
                </div>
              )}

              {/* NO resaleSlot on these rows, and that is the point. The eBay
               *  CTA is capped at RESALE_LIFT_VISIBLE lifted rows above; these
               *  eight previously lived inside LazyPromoRows, which passes no
               *  slot, so they carried no CTA. Passing one here would quietly
               *  take the server-rendered affiliate surface from 3 to as many
               *  as 11 and move the placement:'team_page' resale_click
               *  baseline mid-rollout. They are here for the content, not the
               *  CTA. */}
              {pastSsr.length > 0 && (
                <div className="mb-3 space-y-3">
                  {pastSsr.map((promo, i) => (
                    <RedesignPromoRow
                      key={`ps-${i}`}
                      promo={promo}
                      share={share}
                      completed
                    />
                  ))}
                </div>
              )}

              {/* Completed promos are fully collapsed behind the expander. The
               *  count lives in the (server-rendered) button label so the
               *  data-completeness signal is in the HTML; the rows themselves
               *  lazy-mount on click and stay out of the SSR HTML / page weight. */}
              {pastCollapsed.length > 0 && (
                <LazyPromoRows
                  promos={pastCollapsed}
                  share={share}
                  completed
                  showLabel={`Show ${pastCollapsed.length} ${pastResale.length + pastSsr.length > 0 ? 'more ' : ''}completed ${pastCollapsed.length === 1 ? 'promo' : 'promos'}`}
                  hideLabel={`Hide completed ${pastCollapsed.length === 1 ? 'promo' : 'promos'}`}
                />
              )}
            </div>
          )}

          {showAppPitch && (
            <AppPushPitch variant="light" teamName={teamName} teamSlug={teamSlug} league={league} />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Coming up
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-[1px] mt-1">
            UPCOMING PROMOS
          </h2>
          {upcoming.length > 0 && (
            <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-2">
              {upcoming.length} upcoming {upcoming.length === 1 ? 'event' : 'events'}
              {upcomingHidden.length > 0 ? ' · full schedule below' : ''}
            </p>
          )}
        </div>

        {upcoming.length > 0 ? (
          <>
            <div className="space-y-3">
              {upcomingVisible.map((promo, i) => (
                <PromoRow key={`u-${i}`} promo={promo} share={share} scopeLive={scopeLive} />
              ))}
            </div>

            {upcomingHidden.length > 0 && (
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-2 bg-bg-card border border-border-subtle hover:border-accent-red/60 rounded-full px-5 py-2.5 font-mono text-[11px] tracking-[1.5px] uppercase text-white transition-colors">
                  <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
                  <span className="group-open:hidden">Show all {upcoming.length} upcoming promos</span>
                  <span className="hidden group-open:inline">Hide {upcomingHidden.length} additional promos</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {upcomingHidden.map((promo, i) => (
                    <PromoRow key={`uh-${i}`} promo={promo} share={share} scopeLive={scopeLive} />
                  ))}
                </div>
              </details>
            )}
          </>
        ) : past.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No upcoming promos yet</p>
            <p className="text-text-dim text-sm mt-1">Check back later for the latest schedule</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">
              No upcoming {teamName} promos scheduled right now. See completed {pastPointerYears}promos below.
            </p>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-12">
            <div className="mb-4">
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-text-dim">
                Already happened
              </span>
              <h3 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1 text-text-secondary">
                {pastHeading}
              </h3>
              <p className="text-text-muted text-xs font-mono tracking-[0.5px] mt-2">
                {pastCount}
              </p>
            </div>

            {/* No lift here (rollback-only path): recent completed rows are
             *  already visible, so qualifying rows just carry the CTA in place. */}
            <div className="space-y-3">
              {pastVisible.map((promo, i) => (
                <PromoRow
                  key={`rp-${i}`}
                  promo={promo}
                  share={share}
                  scopeLive={scopeLive}
                  completed
                  resaleSlot={resaleSlotFor(promo, 'dark')}
                />
              ))}
            </div>

            {pastHidden.length > 0 && (
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-2 bg-bg-card/50 border border-border-subtle hover:border-border-hover rounded-full px-5 py-2.5 font-mono text-[11px] tracking-[1.5px] uppercase text-text-secondary hover:text-white transition-colors">
                  <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
                  <span className="group-open:hidden">Show earlier completed promos ({pastHidden.length})</span>
                  <span className="hidden group-open:inline">Hide earlier completed promos</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {pastHidden.map((promo, i) => (
                    <PromoRow
                      key={`ph-${i}`}
                      promo={promo}
                      share={share}
                  scopeLive={scopeLive}
                      completed
                      resaleSlot={resaleSlotFor(promo, 'dark')}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {showAppPitch && (
          <AppPushPitch variant="dark" teamName={teamName} teamSlug={teamSlug} league={league} />
        )}
      </div>
    </section>
  );
}
