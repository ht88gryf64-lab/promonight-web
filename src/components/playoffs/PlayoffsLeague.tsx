import type { ReactNode } from 'react';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { HomeGamesWindow, LeagueView } from '@/lib/postseason/view';
import type { PostseasonLeague } from '@/lib/postseason/types';
import type { LeaguePredictions } from '@/lib/postseason/predictions';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/lib/ads/slots';
import { BracketControlsProvider, type SeriesIndexEntry } from './controls';
import { BracketExplorer } from './BracketExplorer';
import { HomeGames } from './HomeGames';
import { LeagueViewTracker } from './LeagueViewTracker';
import { PredictionsMethodology, PredictionsSection } from './Predictions';
import { SeriesResults } from './SeriesResults';
import { CONDENSED } from './ui';

const SURFACE = 'web_playoffs_league' as const;
const PAGE_TYPE = 'playoffs_league';

/** The page always has a bracket: with no document the route is a 404, and
 *  a read that fails throws before anything renders. `predictions` is the
 *  locked PromoNight Predicts bracket, or null when none was locked. */
export type LeagueBody = { state: 'ok'; view: LeagueView; predictions: LeaguePredictions | null; homeGames: HomeGamesWindow };

/** The round the bracket opens on: the one being played, or the last one
 *  once the postseason is over. */
export function openingRound(view: LeagueView): string {
  return view.phase.kind === 'active' ? view.phase.roundKey : view.rounds[view.rounds.length - 1].key;
}

export function seriesIndex(view: LeagueView): SeriesIndexEntry[] {
  return view.rounds.flatMap((r) =>
    r.groups.flatMap((g) => g.series.map((s) => ({ id: s.id, round: s.round, conference: s.conference, status: s.status }))),
  );
}

export function PlayoffsLeague({
  league,
  season,
  body,
  tickets,
  panelTickets,
  otherLeagues,
}: {
  league: PostseasonLeague;
  season: number;
  body: LeagueBody;
  /** One ticket button by host club id, for the home games rows. */
  tickets: Readonly<Record<string, ReactNode>>;
  /** A ticket block by series id, for the series details. */
  panelTickets: Readonly<Record<string, ReactNode>>;
  /** Other leagues whose postseason is underway, for the cross link. */
  otherLeagues: readonly { league: PostseasonLeague; href: string }[];
}) {
  const { view } = body;
  const slug = league.toLowerCase();
  const firstConference = view.rounds.flatMap((r) => r.groups).find((g) => g.conference !== null)?.conference ?? null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 lg:max-w-6xl">
      <LeagueViewTracker
        league={slug}
        season={season}
        phase={view.phase.kind}
        roundKey={view.phase.kind === 'active' ? view.phase.roundKey : null}
      />
      <div className="pb-3">
        <AdSlot config={AD_SLOTS.HEADER_LEADERBOARD} pageType={PAGE_TYPE} />
      </div>

      {/* THE ARTICLE IS THE AD WRAPPER, and three things about it are
          load-bearing for ads. None of them is decoration.

          It is an <article>. The ad placer sizes its unit count from one
          height: the tallest parent of an anchor, or the tallest <article>
          over 1.5 viewports (known-issues entries 49 and 58). This element is
          both, and it is a real box at every width.

          It carries page-content, so its DIRECT CHILDREN are the anchors
          (".page-content > *", skip 2, insert after each remaining child).
          The order below is chosen against that rule: the heading and the
          introduction are children one and two and take the two skips, so
          the first unit can follow child three, the bracket. Nothing with no
          height is ever a child: a zero-height child is still an anchor.

          Nothing inside the bracket is an anchor. The bracket is one child,
          units are inserted AFTER children, and its state changes re-render
          its own subtree only, so pressing a control cannot disturb a unit.

          The footer notes and the cross link stay outside, so no unit sits
          against the site footer. */}
      <article className="page-content" data-ad-region="content" data-playoffs-article="league">
        <header>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: CONDENSED }}>
              <li>
                <TrackedLink
                  href="/playoffs"
                  surface={SURFACE}
                  ctaId="playoffs_breadcrumb"
                  ctaLabel="Playoffs"
                  className="text-rd-red transition-colors hover:text-rd-red-dark"
                >
                  Playoffs
                </TrackedLink>
              </li>
              <li aria-hidden className="text-rd-ink-faint">
                /
              </li>
              <li aria-current="page" className="text-rd-ink-soft">
                {league}
              </li>
            </ol>
          </nav>
          <h1
            className="mt-1.5 font-extrabold uppercase leading-[0.98] text-rd-ink"
            style={{ fontFamily: CONDENSED, fontSize: 'clamp(38px, 9vw, 56px)' }}
          >
            {season} {league} Playoffs
          </h1>
        </header>

        <div data-page-intro>
          <p data-lede className="mt-2.5 max-w-[52ch] text-[15px] text-rd-ink-soft">
            The {season} {league} postseason bracket: every series, seed and result, with game times in Eastern.
          </p>
          {view.updatedLabel && (
            <p data-bracket-updated className="mt-2 text-[12.5px] text-rd-ink-faint">
              {`Bracket updated ${view.updatedLabel}`}
            </p>
          )}

          {view.phase.kind === 'concluded' && (
            <div
              data-champion={view.phase.championTeamId}
              className="mt-5 rounded-[10px] border border-rd-line bg-rd-card px-4 py-4"
              style={{ borderLeft: '3px solid var(--color-rd-red)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">{season} champion</p>
              <p className="mt-0.5 text-[26px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
                <TrackedLink
                  href={view.phase.championHref}
                  surface={SURFACE}
                  ctaId="playoffs_champion_team"
                  ctaLabel={view.phase.championName}
                  teamSlug={view.phase.championTeamId}
                  className="hover:text-rd-red"
                >
                  {view.phase.championName}
                </TrackedLink>
              </p>
              <p className="mt-0.5 text-[13.5px] text-rd-ink-soft">{view.phase.summary}</p>
            </div>
          )}
        </div>

        {/* The provider renders no element. The bracket and the predicted
            bracket are separate children of the article that share its
            state, so an ad unit can sit between the two and never inside
            either. */}
        <BracketControlsProvider initialRound={openingRound(view)} initialConference={firstConference} index={seriesIndex(view)}>
            <div data-bracket-child className="mt-6">
              <BracketExplorer league={league} leagueSlug={slug} season={season} rounds={view.rounds} panelTickets={panelTickets} />
            </div>
            <AdSlot config={AD_SLOTS.IN_CONTENT_1} pageType={PAGE_TYPE} />
            {/* The PromoNight Predicts bracket, in the place reserved for it. Rendered
                only when a bracket was locked: an empty element here would be
                a child of the article with no height, which is an anchor all
                the same. Shown in both phases; a finished postseason shows
                the final scorecard. */}
            {body.predictions ? (
              <PredictionsSection league={league} leagueSlug={slug} season={season} view={body.predictions.view} />
            ) : null}
        </BracketControlsProvider>

        {view.phase.kind === 'active' && (
          <HomeGames
            id="home-games-this-week"
            heading="Home games this week"
            games={body.homeGames}
            tickets={tickets}
            surface={SURFACE}
            empty="No home game with a confirmed host is listed in the next three days."
          />
        )}
        <SeriesResults view={view} heading={view.phase.kind === 'active' ? 'Results so far' : 'Results'} />
        {/* Outside the controls provider and every client component: the
            fingerprints reach the page here and nowhere else. */}
        {body.predictions ? <PredictionsMethodology view={body.predictions.methodology} /> : null}
        <AdSlot config={AD_SLOTS.IN_CONTENT_2} pageType={PAGE_TYPE} />
      </article>

      {otherLeagues.length > 0 && (
        <p className="mt-10 text-[15px] text-rd-ink">
          {otherLeagues.map((o, i) => (
            <span key={o.league}>
              {i > 0 ? ' ' : ''}
              <TrackedLink
                href={o.href}
                surface={SURFACE}
                ctaId="playoffs_other_league"
                ctaLabel={`Open the ${o.league} bracket`}
                className="font-semibold uppercase tracking-[0.1em] text-rd-red hover:text-rd-red-dark"
                style={{ fontFamily: CONDENSED, fontSize: 16 }}
              >
                Open the {o.league} bracket
              </TrackedLink>
            </span>
          ))}
        </p>
      )}

      <footer className="mt-10 space-y-2 border-t border-rd-line pt-4">
        <p className="text-[12.5px] leading-relaxed text-rd-ink-faint">
          All times are Eastern (ET). A game marked if necessary is played only when the series is still undecided. A slot with a dashed
          outline has no club yet and shows the bracket&apos;s own wording for it.
        </p>
        <AffiliateDisclosure />
      </footer>
    </div>
  );
}
