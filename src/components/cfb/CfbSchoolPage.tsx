// THE ONE TEMPLATE (Phase 3 load-bearing rule). Auto and destination pages are
// this same component. Every EDITORIAL block below renders ONLY when its data is
// present (`editorial.*`); when absent the page falls back to an auto-clean layout
// with no empty slots. Graduating auto -> destination is a DATA change (the
// editorial fields populate + editorialStatus flips) — NEVER a second template.
//
// THEMING (Phase 3 immersive): the ENVIRONMENT is team-colored (hero wash/glow,
// accent section rules, saturated signature card) — all contrast-safe via theme.ts
// (wash alpha capped by primary luminance; onPrimary chosen by contrast). The
// AFFILIATE CTAs (TicketsBlock/HotelsCTA/ParkingCTA) are reused SITE-STANDARD and
// UNCHANGED — never team-toned — so PostHog conversion stays comparable across
// sports. They sit on NEUTRAL dark insets, never a team-colored fill.
//
// Verify-gate: kickoffs come pre-resolved from the reader as "Kickoff TBA" unless
// verified+announced. Rivalries are tagged as fact, CROWN NONE (no signature on
// auto pages — signature is a destination-only editorial field).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { archivo } from '@/components/redesign/fonts';
import type { CfbSchoolPage as CfbSchoolPageData, CfbGameView } from '@/lib/cfb/data';
import { CfbThemePersist } from './CfbThemePersist';
import { toAffiliateTeam, toAffiliateVenue, getKicker } from '@/lib/cfb/page-extras';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Accent-ruled section heading — the team color ties the page together without
// touching legibility (the rule is decoration; the text stays white).
function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-4 w-1 rounded" style={{ background: 'var(--cfb-accent)' }} />
      <h2 className="text-lg font-bold text-white">{children}</h2>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--cfb-accent)' }}>{label}</dt>
      <dd className="text-2xl font-bold text-white">{value}</dd>
    </div>
  );
}

function ScheduleRow({ g }: { g: CfbGameView }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="w-16 shrink-0 text-sm text-white/60">{fmtDate(g.date)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-white/40">{g.isHome ? 'vs' : 'at'}</span>
          <span className="font-medium text-white">{g.opponentName}</span>
          {g.neutralSite && <span className="text-xs text-white/40">(neutral)</span>}
          {g.rivalry && (
            // Rivalry tag = FACT, crown none. Trophy name only; no "the big one".
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--cfb-accent)', color: 'var(--cfb-accent-on)' }}
              title={g.rivalry.trophy ? `${g.rivalry.name} — ${g.rivalry.trophy}` : g.rivalry.name}
            >
              {g.rivalry.trophy || g.rivalry.name}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={g.kickoffVerified ? 'text-sm text-white' : 'text-sm text-white/45'}>{g.kickoffDisplay}</div>
        {g.networkDisplay && <div className="text-xs text-white/40">{g.networkDisplay}</div>}
      </div>
    </li>
  );
}

export function CfbSchoolPage({ data }: { data: CfbSchoolPageData }) {
  const { school, venue, games, editorial } = data;
  const rivalryGames = games.filter((g) => g.rivalry);
  const homeCount = games.filter((g) => g.isHome && !g.neutralSite).length;
  const roadCount = games.filter((g) => !g.isHome && !g.neutralSite).length;
  const kicker = getKicker(school.id);
  const conf = school.conferenceBySeason?.['2026'] || '';

  // Site-standard affiliate adapters (the CTAs render UNCHANGED with these).
  const affTeam = toAffiliateTeam(school, venue?.city ?? null);
  const affVenue = venue ? toAffiliateVenue(venue, school) : null;

  // Road-trip planner: away games at a tracked opponent with a resolved venue.
  const roadTrips = games.filter((g) => !g.isHome && !g.neutralSite && g.awayVenue && g.awaySchool);

  const sig = editorial.signatureGameId ? games.find((g) => g.id === editorial.signatureGameId) : null;

  return (
    <main className={`min-h-screen bg-[#0b0b0d] text-white ${archivo.className}`}>
      <CfbThemePersist schoolId={school.id} />

      {/* IMMERSIVE HERO — full-bleed team-color wash + secondary glow over the dark
          base. Wash alpha is contrast-capped in theme.ts (a white/very-light primary
          gets a low-alpha wash), so white hero text always holds. Degrades cleanly:
          kicker is omitted when unknown; the stat strip always renders from the
          schedule, so even a sparse auto page reads intentional. */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(130% 120% at 15% -10%, var(--cfb-wash), transparent 60%), radial-gradient(120% 120% at 95% 0%, var(--cfb-glow), transparent 55%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-6 pb-9">
          <Link href="/cfb" className="text-sm text-white/50 hover:text-white">← College Football</Link>
          {kicker && (
            <div className="mt-6 text-sm font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--cfb-accent)' }}>
              {kicker}
            </div>
          )}
          <h1 className={`${kicker ? 'mt-2' : 'mt-6'} text-4xl font-extrabold leading-[1.05] sm:text-5xl md:text-6xl`}>
            {school.name}
          </h1>
          <p className="mt-3 text-base text-white/70">
            {school.mascot}
            {conf ? ` · ${conf}` : ''}
            {venue ? ` · ${venue.name}${venue.city ? `, ${venue.city}` : ''}` : ''}
          </p>
          {/* EDITORIAL (destination-only): why-you-go. Hidden on auto pages. */}
          {editorial.whyYouGo && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85">{editorial.whyYouGo}</p>}
          {/* Stat strip — always present (schedule-derived). Accent labels tie in. */}
          <dl className="mt-7 flex flex-wrap gap-x-9 gap-y-3">
            <Stat label="Games" value={games.length} />
            <Stat label="Home" value={homeCount} />
            {roadCount > 0 && <Stat label="Road" value={roadCount} />}
            {rivalryGames.length > 0 && <Stat label="Rivalries" value={rivalryGames.length} />}
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* PLAN YOUR GAMEDAY — SITE-STANDARD affiliate CTAs (NOT team-toned). The
            heading/environment is accent; the CTA components render their own
            unchanged styling on neutral dark insets. Surface 'web_cfb'. */}
        <section>
          <SectionHead>Plan your gameday</SectionHead>
          <p className="mt-1 text-sm text-white/50">
            {venue ? `Tickets, hotels, and parking for a Saturday at ${venue.name}.` : 'Tickets, hotels, and parking for gameday.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <TicketsBlock team={affTeam} surface="web_cfb" placement="team_page_inline" variant="card" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <HotelsCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday_cluster" variant="modal-row" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <ParkingCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday_cluster" compact />
            </div>
          </div>
        </section>

        {/* EDITORIAL (destination-only): signature game. Auto pages CROWN NONE.
            Saturated team-color gradient (contrast-safe onPrimary text). The inline
            Get Tickets is the SITE-STANDARD CTA on a neutral dark inset — never
            team-toned — so it reads against the saturated gradient. */}
        {sig && (
          <section
            className="mt-8 overflow-hidden rounded-2xl p-6"
            style={{ background: 'linear-gradient(135deg, var(--cfb-card-from), var(--cfb-card-to))', color: 'var(--cfb-on-primary)' }}
          >
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ opacity: 0.85 }}>The one to plan around</div>
            <div className="mt-2 text-2xl font-extrabold sm:text-3xl">{sig.isHome ? 'vs' : 'at'} {sig.opponentName}</div>
            <div className="mt-1 text-sm" style={{ opacity: 0.85 }}>
              {fmtDate(sig.date)}
              {sig.kickoffVerified ? ` · ${sig.kickoffDisplay}` : ''}
            </div>
            <div className="mt-5 inline-block rounded-xl bg-[#0b0b0d]/85 p-4">
              <TicketsBlock team={affTeam} surface="web_cfb" placement="team_page_hero" variant="card" />
            </div>
          </section>
        )}

        {/* Schedule — always present */}
        <section className="mt-10">
          <SectionHead>2026 Schedule</SectionHead>
          <ul className="mt-4 space-y-2">
            {games.map((g) => <ScheduleRow key={g.id} g={g} />)}
          </ul>
          <p className="mt-2 text-xs text-white/40">Kickoff times show once announced and confirmed on a second source; until then, “Kickoff TBA.”</p>
        </section>

        {/* Rivalries — tag as fact, CROWN NONE (equal weight, no ordering-by-importance) */}
        {rivalryGames.length > 0 && (
          <section className="mt-10">
            <SectionHead>Rivalry games this season</SectionHead>
            <ul className="mt-4 flex flex-wrap gap-2">
              {rivalryGames.map((g) => (
                <li key={g.id} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm">
                  <span className="font-semibold" style={{ color: 'var(--cfb-on-dark)' }}>{g.rivalry!.trophy || g.rivalry!.name}</span>
                  <span className="text-white/50"> · {g.isHome ? 'vs' : 'at'} {g.opponentName}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ROAD TRIPS — per-away-game SITE-STANDARD clusters keyed to the DESTINATION
            (the host school + its stadium): tickets to that game, hotels + parking
            near the away stadium. The travel-planner money. Hidden when no away game
            resolves to a tracked venue (sparse pages degrade cleanly). */}
        {roadTrips.length > 0 && (
          <section className="mt-10">
            <SectionHead>Road trips</SectionHead>
            <p className="mt-1 text-sm text-white/50">Traveling to an away game? Book near the stadium.</p>
            <div className="mt-4 space-y-4">
              {roadTrips.map((g) => {
                const destTeam = toAffiliateTeam(g.awaySchool!, g.awayVenue!.city ?? null);
                const destVenue = toAffiliateVenue(g.awayVenue!, g.awaySchool!);
                return (
                  <div key={g.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="font-semibold text-white">at {g.opponentName}</div>
                      <div className="text-sm text-white/50">
                        {fmtDate(g.date)} · {g.awayVenue!.name}{g.awayVenue!.city ? `, ${g.awayVenue!.city}` : ''}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <TicketsBlock team={destTeam} surface="web_cfb" placement="away_game_card" variant="card" />
                      <HotelsCTA team={destTeam} venue={destVenue} surface="web_cfb" placement="cfb_road_trip" variant="modal-row" />
                      <ParkingCTA team={destTeam} venue={destVenue} surface="web_cfb" placement="cfb_road_trip" compact tone="secondary" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Venue */}
        {venue && (
          <section className="mt-10">
            <SectionHead>{venue.name}</SectionHead>
            <p className="mt-1 text-white/60">
              {[venue.city, venue.state].filter(Boolean).join(', ')}
              {venue.capacity ? ` · ${venue.capacity.toLocaleString()} capacity` : ''}
            </p>
            {/* EDITORIAL (destination-only): venue in their words. Hidden on auto. */}
            {editorial.venueInTheirWords && (
              <p className="mt-3 border-l-2 pl-4 text-white/80" style={{ borderColor: 'var(--cfb-accent)' }}>{editorial.venueInTheirWords}</p>
            )}
          </section>
        )}

        {/* EDITORIAL (destination-only): traditions + gameday culture. Hidden on auto. */}
        {(editorial.traditions.length > 0 || editorial.gamedayCulture) && (
          <section className="mt-10">
            <SectionHead>Gameday</SectionHead>
            {editorial.gamedayCulture && (
              <p className="mt-3 border-l-2 pl-4 text-white/80" style={{ borderColor: 'var(--cfb-accent)' }}>{editorial.gamedayCulture}</p>
            )}
          </section>
        )}

        {/* Contributor CTA — invite depth, don't apologize. Ships on every auto page. */}
        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-bold">Know this place?</h2>
          <p className="mt-1 text-white/70">Help us tell the story of a {school.shortName} Saturday — the traditions, the tailgate, why you go. Written by people who actually go.</p>
          <Link
            href={`/cfb/contribute?school=${school.id}`}
            className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--cfb-accent)', color: 'var(--cfb-accent-on)' }}
          >
            Contribute to this page
          </Link>
          {editorial.contributor && <p className="mt-3 text-xs text-white/40">Gameday section by {editorial.contributor.credit}.</p>}
        </section>
      </div>
    </main>
  );
}
