import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { ClubPlayoffs } from '@/lib/postseason/inbound';
import type { TeamPickView } from '@/lib/postseason/team-pick';

// The postseason module on a club's team page. Server-rendered; the only
// client code in it is the click handler on its link.
//
// It uses the team page's own faces (rd-display, font-rd). The playoffs
// pages' condensed face is not imported here: a font module is preloaded by
// every route that imports it, and this component is on 169 of them.

const SURFACE = 'web_team_page' as const;
const LINK = 'mt-3 inline-block font-rd text-sm font-semibold text-rd-red underline decoration-rd-line-strong underline-offset-2 hover:text-rd-red-dark';

function Stamp({ at }: { at: string | null }) {
  if (!at) return null;
  return (
    <p data-bracket-updated className="mt-2 font-rd text-[12px] text-rd-ink-faint">
      {`Bracket updated ${at}`}
    </p>
  );
}

/** The PromoNight Predicts line: the locked pick, its status, and a link to
 *  every pick. Inside the module's own section, so it adds no anchor for the
 *  ad placer and no element of its own to the page's column. */
function PickLine({ pick, teamId }: { pick: TeamPickView; teamId: string }) {
  return (
    <div data-team-pick={pick.kind} className="mt-3 border-t border-rd-line pt-3">
      <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">PromoNight Predicts</p>
      <p className="mt-1 font-rd text-[14px] font-semibold text-rd-ink">{pick.pickLine}</p>
      <p className="mt-0.5 font-rd text-[13.5px] text-rd-ink-soft">{pick.statusLine}</p>
      <TrackedLink
        href={pick.href}
        surface={SURFACE}
        ctaId="predicts_team_pick"
        ctaLabel="See every PromoNight Predicts pick"
        teamSlug={teamId}
        className={LINK}
      >
        See every PromoNight Predicts pick
      </TrackedLink>
    </div>
  );
}

export function TeamPlayoffsModule({
  club,
  teamId,
  teamName,
  pick = null,
}: {
  club: ClubPlayoffs;
  teamId: string;
  teamName: string;
  /** The PromoNight Predicts line, or null for none. */
  pick?: TeamPickView | null;
}) {
  const section = moduleSection(club, teamId, teamName);
  // With no pick, the section is returned as it is: the markup and the RSC
  // payload are the module's as they were before the line existed. With a
  // pick, the same section gets one more child, last. A conditional child
  // written into the JSX would serialize a null into every page without one.
  if (!pick) return section;
  return withLastChild(section, <PickLine pick={pick} teamId={teamId} />);
}

function withLastChild(el: ReactElement<{ children?: ReactNode }>, child: ReactNode): ReactElement {
  const kids = el.props.children;
  return cloneElement(el, undefined, ...(Array.isArray(kids) ? kids : [kids]), child);
}

function moduleSection(club: ClubPlayoffs, teamId: string, teamName: string): ReactElement<{ children?: ReactNode }> {
  const headingId = 'team-playoffs';
  return (
    <section
      aria-labelledby={headingId}
      data-playoffs-module="team"
      data-playoffs-state={club.state}
      className="mt-8 rounded-[14px] border border-rd-line bg-rd-card p-4 shadow-[0_1px_3px_rgba(33,29,24,0.06)]"
      style={{ borderLeft: '3px solid var(--color-rd-red)' }}
    >
      <p className="font-rd text-[11px] font-semibold uppercase tracking-[0.14em] text-rd-ink-faint">
        {club.season} {club.league} Playoffs
      </p>

      {club.state === 'alive' && (
        <>
          <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink">
            {club.roundLabel}
          </h2>
          <p className="mt-1 font-rd text-[15px] font-semibold text-rd-ink">
            {teamName} vs {club.opponent}
          </p>
          {club.scoreLine && <p className="mt-0.5 font-rd text-[14px] text-rd-ink">{club.scoreLine}</p>}
          {club.nextLabel && (
            <p className="mt-1 font-rd text-[13.5px] text-rd-ink-soft">
              <span className="font-semibold text-rd-ink">Next:</span> {club.nextLabel}
            </p>
          )}
          {club.nextHost && <p className="font-rd text-[13.5px] text-rd-ink-soft">{club.nextHost}</p>}
          <TrackedLink href={club.seriesHref} surface={SURFACE} ctaId="playoffs_module_series" ctaLabel="See the series" teamSlug={teamId} className={LINK}>
            See the series
          </TrackedLink>
          <Stamp at={club.updatedLabel} />
        </>
      )}

      {club.state === 'advanced' && (
        <>
          <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink">
            {club.roundLabel}
          </h2>
          <p className="mt-1 font-rd text-[15px] font-semibold text-rd-ink">
            {teamName} vs {club.opponent}
          </p>
          <p className="mt-0.5 font-rd text-[14px] text-rd-ink">{club.wonLine}</p>
          <TrackedLink href={club.leagueHref} surface={SURFACE} ctaId="playoffs_module_league" ctaLabel={`Open the ${club.league} bracket`} teamSlug={teamId} className={LINK}>
            Open the {club.league} bracket
          </TrackedLink>
          <Stamp at={club.updatedLabel} />
        </>
      )}

      {club.state === 'eliminated' && (
        <>
          <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink">
            Season over
          </h2>
          <p className="mt-1 font-rd text-[14px] text-rd-ink-soft">{club.lostLine}</p>
          {/* One label whatever the league's state. "The rest of the
              playoffs" was a claim that there is a rest, and a club that is
              out is not in the series whose end would revalidate its page,
              so the claim could stand for a day after the champion was
              crowned. The bracket is there in every state. */}
          <TrackedLink
            href={club.leagueHref}
            surface={SURFACE}
            ctaId="playoffs_module_league"
            ctaLabel={`See the full ${club.league} playoff bracket`}
            teamSlug={teamId}
            className={LINK}
          >
            See the full {club.league} playoff bracket
          </TrackedLink>
          <Stamp at={club.updatedLabel} />
        </>
      )}

      {club.state === 'champion' && (
        <>
          <h2 id={headingId} className="rd-display mt-1 text-2xl uppercase text-rd-ink">
            {club.season} champion
          </h2>
          <p className="mt-1 font-rd text-[14px] text-rd-ink">{club.summary}</p>
          <TrackedLink href={club.leagueHref} surface={SURFACE} ctaId="playoffs_module_league" ctaLabel={`See the final ${club.league} bracket`} teamSlug={teamId} className={LINK}>
            See the final {club.league} bracket
          </TrackedLink>
          <Stamp at={club.updatedLabel} />
        </>
      )}
    </section>
  );
}
