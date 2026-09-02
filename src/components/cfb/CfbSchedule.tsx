'use client';

// The 2026 schedule as CLICKABLE rows that open a gameday-detail modal. Replaces
// the old inline per-away-game affiliate stacks: affiliates now live ONLY in the
// top "Plan your gameday" block + this modal (opened on the game a fan actually
// cares about). Reuses the shared <Modal> shell (native <dialog>: focus-trap,
// Esc, backdrop-click, scroll-lock) — no hand-rolled overlay.
//
// Venue name comes from the CLEAN cfbVenues.name; the CITY comes from the
// hand-verified CFB_VENUE_CITY map (the scraped city field is junk for most
// venues) — never the raw address. Home games resolve the school's own venue;
// away games the opponent's (already loaded on the game view from the cached
// collections — no per-game reads).

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import type { CfbSchool, CfbVenue } from '@/lib/cfb/types';
import type { CfbGameView } from '@/lib/cfb/data';
import { toAffiliateTeam, toAffiliateVenue } from '@/lib/cfb/page-extras';
import { venueCity } from '@/lib/cfb/venue-cities';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { ExpediaCTA } from '@/components/affiliates/ExpediaCTA';
import { fmtMonthDay, fmtDayLong, TrophyTag, SERIF, MONO, SANS } from './cfb-bits';

function ScheduleRow({ g, last, onOpen, school, venue }: { g: CfbGameView; last: boolean; onOpen: () => void; school: CfbSchool; venue: CfbVenue | null }) {
  // Server-rendered detail line (2026-08-27): the venue, its city and the
  // home/away/neutral status used to exist only inside the click-to-open modal,
  // so a crawler or a reviewer reading the HTML saw a schedule with no detail.
  // Same resolution the modal uses; visible on every row, never hidden.
  const { gameVenue } = resolveGame(g, school, venue);
  const detail = [gameVenue?.name ?? null, venueCity(gameVenue), g.neutralSite ? 'Neutral site' : g.isHome ? 'Home' : 'Away'].filter(Boolean).join(' · ');
  // A played game (dated before today, America/Chicago) is not a fixture: no
  // gameday modal, no kickoff, no "Kickoff TBA". No result is known, so none is
  // shown; the row reads PLAYED and dims. Rendered as a div, not a button.
  const rowClass = `group grid w-full grid-cols-[56px_1fr_auto_16px] items-center gap-3 px-4 py-3.5 text-left transition-colors sm:grid-cols-[64px_1fr_auto_16px] sm:gap-5 sm:px-6 ${g.played ? 'opacity-50' : g.rivalry ? 'cursor-pointer hover:brightness-110' : 'cursor-pointer hover:bg-white/[0.03]'}`;
  const rowStyle = { borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', background: g.rivalry ? 'var(--cfb-tint)' : undefined };
  const inner = (
    <>
      {/* The date is the row's only label. CFB has no week numbers on this
          site: the stored cfbGames.week is a per-school ordinal on a doc both
          schools share and is not read anywhere. */}
      <div style={{ fontFamily: MONO }}>
        <div className="text-[12px] text-white/55">{fmtMonthDay(g.date)}</div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[10px] uppercase text-white/35" style={{ fontFamily: MONO }}>
          {g.isHome ? (g.neutralSite ? 'N' : 'VS') : 'AT'}
          {/* Conference-game marker, from the stored conferenceGame flag. */}
          {g.conferenceGame ? ' · CONF' : ''}
        </span>
        {/* DECIDED, Phase 2B: the opponent name here stays PLAIN TEXT, permanently.
            Do not link it and do not unwrap the row into a non-button affordance
            to make room for a link. This row is a <button> that opens the gameday
            modal, so an opponent anchor would nest a second <a> inside it, and the
            rivalry card further down the page already carries that exact
            destination. The trade was a duplicate link for invalid nesting on
            every row, which is not worth it. Re-opening this needs a reason
            beyond "the opponent should be clickable". */}
        <span className="text-[15px] font-bold text-white sm:text-[17px]" style={{ fontFamily: SANS }}>{g.opponentName}</span>
        {/* KNOWN, not fixed here: this anchor nests inside the row <button>, which
            is invalid HTML. It predates the matchup pages (it was the Wikipedia
            link) and 5 of 16 rows on /cfb/alabama already carry it. Phase 2
            changed the href, not the nesting, and Phase 2B deliberately left it
            alone: unpicking it means reworking the row affordance itself, which
            belongs in a component pass over the whole row, not in a linking
            change. Tracked so this reads as a decision, not an oversight. */}
        {g.rivalry && <TrophyTag rivalry={g.rivalry} />}
        {/* Theme-night designations ("Checker Neyland"): verified pipeline data,
            previously dark. Sparse today; renders only where tagged. */}
        {g.themes.map((t) => (
          <span
            key={t}
            className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60"
            style={{ fontFamily: MONO }}
          >
            {t}
          </span>
        ))}
        <div className="w-full text-[11px] text-white/55" style={{ fontFamily: MONO }}>{detail}</div>
      </div>
      <div className="text-right" style={{ fontFamily: MONO }}>
        {g.played ? (
          <div className="text-[11px] uppercase tracking-wide text-white/40">Played</div>
        ) : g.kickoffVerified ? (
          <>
            <div className="text-[13px] font-bold text-white">{g.kickoffDisplay}</div>
            {g.networkDisplay && <div className="mt-0.5 text-[10px] text-white/40">{g.networkDisplay}</div>}
          </>
        ) : (
          <div className="text-[12px] text-white/40">{g.kickoffDisplay}</div>
        )}
      </div>
      {/* The chevron is the modal affordance; a played row has no modal. */}
      {g.played ? <span aria-hidden="true" /> : (
        <svg className="h-3.5 w-3.5 text-white/20 transition-colors group-hover:text-[color:var(--cfb-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  );
  return g.played ? (
    <div className={rowClass} style={rowStyle} data-cfb-row="played" data-cfb-played="true" aria-label={`${g.opponentName}, played`}>{inner}</div>
  ) : (
    <button type="button" onClick={onOpen} className={rowClass} style={rowStyle} data-cfb-row="upcoming">{inner}</button>
  );
}

// Resolve the game's venue + the host school (whose tickets/venue the affiliates
// point at). Home -> the school's own venue; away -> the opponent's (present only
// for tracked opponents); neutral/untracked -> no venue (tickets fall back to the
// page team, hotels/parking omitted).
function resolveGame(g: CfbGameView, school: CfbSchool, venue: CfbVenue | null) {
  if (g.neutralSite) return { gameVenue: null, hostSchool: null as CfbSchool | null };
  if (g.isHome) return { gameVenue: venue, hostSchool: school };
  return { gameVenue: g.awayVenue, hostSchool: g.awaySchool };
}

function CfbGameDetail({ g, school, venue }: { g: CfbGameView; school: CfbSchool; venue: CfbVenue | null }) {
  const { gameVenue, hostSchool } = resolveGame(g, school, venue);
  const cityLabel = venueCity(gameVenue);

  // Tickets point at the HOST (opponent for away games), falling back to the page
  // team for neutral / untracked opponents. Hotels + parking need a resolved
  // venue; we pass the CLEAN city (never the junk field) into the affiliate venue.
  const ticketSchool = hostSchool ?? school;
  const affTeam = toAffiliateTeam(ticketSchool, cityLabel ?? null);
  const affVenue =
    gameVenue && hostSchool
      ? toAffiliateVenue({ ...gameVenue, city: cityLabel ?? '', state: '' }, hostSchool)
      : null;

  const homeAway = g.neutralSite ? 'Neutral site' : g.isHome ? 'Home' : 'Away';
  const prefix = g.isHome && !g.neutralSite ? 'vs' : g.neutralSite ? 'vs' : 'at';

  return (
    <div style={{ fontFamily: SANS }}>
      <div className="text-[11px] font-bold uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent)' }}>
        {fmtDayLong(g.date)} · {homeAway}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[26px] font-black leading-tight text-white" style={{ fontFamily: SANS }}>
          {prefix} {g.opponentName}
        </h2>
        {g.rivalry && <TrophyTag rivalry={g.rivalry} />}
      </div>

      <div className="mt-1.5 text-[13px]" style={{ fontFamily: MONO, color: g.kickoffVerified ? '#fff' : 'rgba(255,255,255,0.5)' }}>
        {g.kickoffDisplay}{g.networkDisplay ? ` · ${g.networkDisplay}` : ''}
      </div>

      {gameVenue && (
        <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent)' }}>Venue</div>
          <div className="mt-0.5 text-[15px] text-white" style={{ fontFamily: SANS }}>
            {gameVenue.name}{cityLabel && <span className="text-white/60"> · {cityLabel}</span>}
          </div>
        </div>
      )}

      {/* Per-game affiliate cluster — the ONE place per-game tickets/hotels/parking
          live now. placement="cfb_game_modal" distinguishes these from the top
          block (cfb_gameday) in PostHog; surface stays web_cfb. */}
      <div className="mt-5">
        <div className="mb-2 text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent)' }}>Plan this game</div>
        <div className="flex flex-col gap-2.5">
          <TicketmasterCTA team={affTeam} surface="web_cfb" placement="cfb_game_modal" size="compact" />
          {affVenue && <SpotHeroCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_game_modal" size="compact" />}
          {affVenue && <ExpediaCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_game_modal" size="compact" />}
        </div>
      </div>
    </div>
  );
}

export function CfbSchedule({ games, school, venue }: { games: CfbGameView[]; school: CfbSchool; venue: CfbVenue | null }) {
  const [selected, setSelected] = useState<CfbGameView | null>(null);
  return (
    <>
      <div className="overflow-hidden rounded-2xl" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)' }}>
        {games.map((g, i) => (
          <ScheduleRow key={g.id} g={g} last={i === games.length - 1} onOpen={() => setSelected(g)} school={school} venue={venue} />
        ))}
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        variant="dark"
        size="fit"
        ariaLabel={selected ? `${school.shortName} ${selected.isHome && !selected.neutralSite ? 'vs' : 'at'} ${selected.opponentName} gameday details` : 'Gameday details'}
      >
        {selected && <CfbGameDetail g={selected} school={school} venue={venue} />}
      </Modal>
    </>
  );
}
