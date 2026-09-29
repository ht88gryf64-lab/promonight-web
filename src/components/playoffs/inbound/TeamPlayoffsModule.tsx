import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { ClubPlayoffs } from '@/lib/postseason/inbound';
import { InProgressBadge } from '../ui';

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

export function TeamPlayoffsModule({ club, teamId, teamName }: { club: ClubPlayoffs; teamId: string; teamName: string }) {
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
          {club.inProgress && (
            <p className="mt-1 flex items-center gap-2 font-rd text-[13.5px] text-rd-ink-soft">
              <InProgressBadge />
              <span>{club.inProgress} in progress</span>
            </p>
          )}
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
          {/* "The rest" is a claim that there is a rest. It is made only
              while another series is still being played. */}
          <TrackedLink
            href={club.leagueHref}
            surface={SURFACE}
            ctaId="playoffs_module_league"
            ctaLabel={club.leagueActive ? `Follow the rest of the ${club.league} playoffs` : `See the final ${club.league} bracket`}
            teamSlug={teamId}
            className={LINK}
          >
            {club.leagueActive ? `Follow the rest of the ${club.league} playoffs` : `See the final ${club.league} bracket`}
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
