import type { ReactNode } from 'react';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { HomeGamesWindow, LeagueView } from '@/lib/postseason/view';
import type { PostseasonLeague } from '@/lib/postseason/types';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { BracketControlsProvider, type SeriesIndexEntry } from './controls';
import { BracketExplorer } from './BracketExplorer';
import { BracketUnavailable } from './BracketUnavailable';
import { HomeGames } from './HomeGames';
import { LeagueViewTracker } from './LeagueViewTracker';
import { PredictedBracketSlot } from './PredictedBracketSlot';
import { PredictionsCard } from './PredictionsCard';
import { CONDENSED } from './ui';

const SURFACE = 'web_playoffs_league' as const;

export type LeagueBody =
  | { state: 'ok'; view: LeagueView; predictionsLocked: boolean; homeGames: HomeGamesWindow }
  | { state: 'missing' }
  | { state: 'unavailable' };

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
  const view = body.state === 'ok' ? body.view : null;
  const slug = league.toLowerCase();
  const firstConference = view ? view.rounds.flatMap((r) => r.groups).find((g) => g.conference !== null)?.conference ?? null : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-9 lg:max-w-6xl">
      <LeagueViewTracker
        league={slug}
        season={season}
        phase={view ? view.phase.kind : 'unavailable'}
        roundKey={view && view.phase.kind === 'active' ? view.phase.roundKey : null}
      />
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
      {/* The lede describes the bracket, so it is shown only with one. */}
      {view && (
        <p data-lede className="mt-2.5 max-w-[52ch] text-[15px] text-rd-ink-soft">
          The {season} {league} postseason bracket: every series, seed and result, with game times in Eastern.
        </p>
      )}
      {view?.updatedLabel && (
        <p data-bracket-updated className="mt-2 text-[12.5px] text-rd-ink-faint">
          {`Bracket updated ${view.updatedLabel}`}
        </p>
      )}

      {body.state !== 'ok' && <BracketUnavailable league={league} season={season} />}

      {view && view.phase.kind === 'concluded' && (
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

      {/* The provider renders no element. The bracket and the predictions
          slot are separate children of this page that share its state. */}
      {view && body.state === 'ok' && (
        <BracketControlsProvider initialRound={openingRound(view)} initialConference={firstConference} index={seriesIndex(view)}>
          <div className="mt-6">
            <BracketExplorer league={league} leagueSlug={slug} season={season} rounds={view.rounds} panelTickets={panelTickets} />
          </div>
          <PredictedBracketSlot>
            {body.predictionsLocked ? <PredictionsCard heading="Our Predictions" headingId="our-predictions" /> : null}
          </PredictedBracketSlot>
        </BracketControlsProvider>
      )}

      {body.state === 'ok' && view && view.phase.kind === 'active' && (
        <HomeGames
          id="home-games-this-week"
          heading="Home games this week"
          games={body.homeGames}
          tickets={tickets}
          surface={SURFACE}
          empty="No home game with a confirmed host is listed in the next three days."
        />
      )}

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
