import type { ReactNode } from 'react';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { GameView, SeriesView, SlotView } from '@/lib/postseason/view';
import { ParkLink } from './links';
import { CONDENSED, InProgressBadge } from './ui';

const SURFACE = 'web_playoffs_league' as const;

function GameRow({ g, league }: { g: GameView; league: string }) {
  return (
    <li data-game={g.gameNumber} className="grid grid-cols-[2.25rem_1fr] gap-x-2 text-[13.5px] leading-snug">
      <span className="font-bold uppercase text-rd-ink" style={{ fontFamily: CONDENSED, fontSize: 15 }}>
        G{g.gameNumber}
      </span>
      <span className="min-w-0">
        <span className="block text-rd-ink">{g.when}</span>
        {g.hostName && (
          <span className="block text-rd-ink-soft">
            Host: {g.hostName}
            {g.park && ' · '}
            {g.park && g.parkPage && g.hostTeamId ? (
              <ParkLink
                page={g.parkPage}
                teamId={g.hostTeamId}
                league={league}
                surface={SURFACE}
                placement="playoffs_series_game"
                className="underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red"
              >
                {g.park}
              </ParkLink>
            ) : (
              g.park
            )}
          </span>
        )}
        {g.state === 'final' && g.result && <span className="block font-semibold text-rd-ink">Final: {g.result}</span>}
        {g.state === 'live' && (
          <span className="mt-0.5 block">
            <InProgressBadge />
          </span>
        )}
        {g.state !== 'final' && g.state !== 'live' && g.stateLabel !== 'Scheduled' && (
          <span className="block text-rd-ink-faint">{g.stateLabel}</span>
        )}
      </span>
    </li>
  );
}

function ClubLink({ slot }: { slot: SlotView }) {
  if (slot.kind !== 'club' || !slot.teamHref || !slot.teamId) return null;
  return (
    <li>
      <TrackedLink
        href={slot.teamHref}
        surface={SURFACE}
        ctaId="playoffs_series_team"
        ctaLabel={`${slot.fullName} promotions`}
        teamSlug={slot.teamId}
        data-club-link={slot.teamId}
        className="font-semibold text-rd-red underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red-dark"
      >
        {slot.fullName} promotions
      </TrackedLink>
    </li>
  );
}

/**
 * The detail of one series: every game, the ticket block for the host of
 * the next one, and a link to each club's page.
 *
 * Its id is the series id, so /playoffs/mlb#wild_card-2 lands on it. Every
 * panel is in the server HTML; which one is displayed is decided by the
 * bracket's state, or by the URL fragment before any script has run.
 */
export function SeriesPanel({
  series,
  league,
  open,
  tickets,
  onClose,
}: {
  series: SeriesView;
  league: string;
  open: boolean;
  tickets: ReactNode;
  onClose: () => void;
}) {
  const titleId = `${series.id}-title`;
  const undecided = series.higher.kind === 'placeholder' || series.lower.kind === 'placeholder';
  return (
    <section
      id={series.id}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-series-panel={series.id}
      data-open={open ? 'true' : 'false'}
      className="po-panel scroll-mt-32 rounded-[10px] border border-rd-line bg-rd-card px-4 py-4 shadow-sm outline-none target:border-rd-red focus-visible:border-rd-red"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rd-ink-faint">
            {series.roundLabel}
            {series.conference ? ` · ${series.conference}` : ''}
          </p>
          <h3 id={titleId} className="mt-0.5 text-[24px] font-extrabold uppercase leading-tight text-rd-ink" style={{ fontFamily: CONDENSED }}>
            {series.higher.label} vs {series.lower.label}
          </h3>
          <p className="mt-0.5 text-[13px] text-rd-ink-soft">{series.formatLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-panel-close={series.id}
          className="po-controls shrink-0 rounded border border-rd-line px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-rd-ink-soft hover:border-rd-red hover:text-rd-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-red"
        >
          Close
        </button>
      </div>

      <div className="mt-2 space-y-0.5">
        {series.scoreLine && <p className="text-[14.5px] font-semibold text-rd-ink">{series.scoreLine}</p>}
        {series.liveLabel && series.next && (
          <p className="flex items-center gap-2 text-[13.5px] text-rd-ink-soft">
            <InProgressBadge />
            <span>{series.next.title} in progress</span>
          </p>
        )}
        {series.nextLabel && (
          <p className="text-[13.5px] text-rd-ink-soft">
            <span className="font-semibold text-rd-ink">Next:</span> {series.nextLabel}
          </p>
        )}
        {!series.scoreLine && !series.liveLabel && !series.nextLabel && <p className="text-[13.5px] text-rd-ink-soft">{series.headline}</p>}
      </div>

      {series.games.length > 0 ? (
        <ol className="mt-4 space-y-2.5">
          {series.games.map((g) => (
            <GameRow key={g.gameNumber} g={g} league={league} />
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-[13.5px] text-rd-ink-soft">No games are listed for this series yet.</p>
      )}

      {tickets ? <div className="mt-4 max-w-sm">{tickets}</div> : null}

      {!undecided || series.higher.kind === 'club' || series.lower.kind === 'club' ? (
        <ul className="mt-4 space-y-1.5 text-[14px]">
          <ClubLink slot={series.higher} />
          <ClubLink slot={series.lower} />
        </ul>
      ) : null}
    </section>
  );
}
