import type { ReactNode } from 'react';
import Link from 'next/link';
import type { HomeGameView, LeagueView } from '@/lib/postseason/view';
import type { PostseasonLeague } from '@/lib/postseason/types';
import { AffiliateDisclosure } from '@/components/affiliates/AffiliateDisclosure';
import { Bracket } from './Bracket';
import { BracketUnavailable } from './BracketUnavailable';
import { HomeGames } from './HomeGames';
import { PredictionsCard } from './PredictionsCard';
import { CONDENSED } from './ui';

export type LeagueBody =
  | { state: 'ok'; view: LeagueView; predictionsLocked: boolean; weekGames: readonly HomeGameView[] }
  | { state: 'missing' }
  | { state: 'unavailable' };

export function PlayoffsLeague({
  league,
  season,
  body,
  tickets,
  otherLeagues,
}: {
  league: PostseasonLeague;
  season: number;
  body: LeagueBody;
  tickets: Readonly<Record<string, ReactNode>>;
  /** Other leagues whose postseason is underway, for the cross link. */
  otherLeagues: readonly { league: PostseasonLeague; href: string }[];
}) {
  const view = body.state === 'ok' ? body.view : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-9 lg:max-w-5xl">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: CONDENSED }}>
          <li>
            <Link href="/playoffs" className="text-rd-red transition-colors hover:text-rd-red-dark">
              Playoffs
            </Link>
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
      <p className="mt-2.5 max-w-[52ch] text-[15px] text-rd-ink-soft">
        The {season} {league} postseason bracket: every series, seed and result, with game times in Eastern.
      </p>
      {view?.updatedLabel && (
        <p data-bracket-updated className="mt-2 text-[12.5px] text-rd-ink-faint">
          Bracket updated {view.updatedLabel}
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
            <Link href={view.phase.championHref} className="hover:text-rd-red">
              {view.phase.championName}
            </Link>
          </p>
          <p className="mt-0.5 text-[13.5px] text-rd-ink-soft">{view.phase.summary}</p>
        </div>
      )}

      {view && (
        <div className="mt-8">
          <Bracket view={view} />
        </div>
      )}

      {body.state === 'ok' && body.predictionsLocked && <PredictionsCard heading="Our Predictions" headingId="our-predictions" />}

      {body.state === 'ok' && view && view.phase.kind === 'active' && (
        <HomeGames
          id="home-games-this-week"
          heading="Home games this week"
          games={body.weekGames}
          tickets={tickets}
          empty="No home game with a confirmed host is listed in the next seven days."
        />
      )}

      {otherLeagues.length > 0 && (
        <p className="mt-10 text-[15px] text-rd-ink">
          {otherLeagues.map((o, i) => (
            <span key={o.league}>
              {i > 0 ? ' ' : ''}
              <Link
                href={o.href}
                className="font-semibold uppercase tracking-[0.1em] text-rd-red hover:text-rd-red-dark"
                style={{ fontFamily: CONDENSED, fontSize: 16 }}
              >
                Open the {o.league} bracket
              </Link>
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
