// THE ONE TEMPLATE (Phase 3 load-bearing rule). Auto and destination pages are
// this same component. Every EDITORIAL block renders ONLY when its data is present
// (`editorial.*`); when absent the page falls back to an auto-clean layout with no
// empty slots. Graduating auto -> destination is a DATA change — NEVER a second
// template.
//
// STYLING = the approved immersive mockup (CfbDestinationMockup.jsx), reproduced
// against real Firestore data and kept CONTRAST-SAFE across all 86 palettes (see
// theme.ts). Immersive hero team-color wash + glow, Instrument Serif italic drama,
// saturated signature card, accent section labels, themed rivalry cards. The
// AFFILIATE CTAs (TicketsBlock/HotelsCTA/ParkingCTA) are reused SITE-STANDARD and
// UNCHANGED — never team-toned (PostHog comparability); the mockup's stylized
// buttons are matched on PLACEMENT only.
//
// Verify-gate: kickoffs come pre-resolved from the reader as "Kickoff TBA" unless
// verified+announced. Rivalries are tagged as fact, CROWN NONE.

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CfbSchoolPage as CfbSchoolPageData, CfbGameView } from '@/lib/cfb/data';
import { CfbThemePersist } from './CfbThemePersist';
import { instrumentSerif } from './fonts';
import { toAffiliateTeam, toAffiliateVenue, getKicker } from '@/lib/cfb/page-extras';
import { TicketsBlock } from '@/components/affiliates/TicketsBlock';
import { HotelsCTA } from '@/components/affiliates/HotelsCTA';
import { ParkingCTA } from '@/components/affiliates/ParkingCTA';

const SERIF = 'var(--font-cfb-serif), Georgia, serif';
const MONO = 'var(--font-mono), ui-monospace, monospace';
const SANS = 'var(--font-outfit), system-ui, sans-serif';

function fmtMonthDay(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
function fmtDayLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${wd} · ${fmtMonthDay(iso)}`;
}

// Accent-colored mono section label (+ optional right-aligned meta), mockup style.
function Eyebrow({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="text-[11px] font-semibold uppercase" style={{ fontFamily: MONO, letterSpacing: '0.18em', color: 'var(--cfb-accent)' }}>
        {children}
      </div>
      {right && (
        <div className="shrink-0 text-[10px] uppercase text-white/35" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
          {right}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ g, last }: { g: CfbGameView; last: boolean }) {
  return (
    <div
      className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-3.5 sm:gap-5 sm:px-6"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', background: g.rivalry ? 'var(--cfb-tint)' : 'transparent' }}
    >
      <div className="text-[12px] text-white/55" style={{ fontFamily: MONO }}>{fmtMonthDay(g.date)}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[10px] uppercase text-white/35" style={{ fontFamily: MONO }}>{g.isHome ? (g.neutralSite ? 'N' : 'VS') : 'AT'}</span>
        <span className="text-[15px] font-bold text-white sm:text-[17px]" style={{ fontFamily: SANS }}>{g.opponentName}</span>
        {g.rivalry && (
          // Rivalry tag = FACT, crown none. Trophy/name only.
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ fontFamily: MONO, letterSpacing: '0.03em', background: 'var(--cfb-accent)', color: 'var(--cfb-accent-ink)' }}
            title={g.rivalry.trophy ? `${g.rivalry.name} — ${g.rivalry.trophy}` : g.rivalry.name}
          >
            {g.rivalry.trophy || g.rivalry.name}
          </span>
        )}
      </div>
      <div className="text-right" style={{ fontFamily: MONO }}>
        {g.kickoffVerified ? (
          <>
            <div className="text-[13px] font-bold text-white">{g.kickoffDisplay}</div>
            {g.networkDisplay && <div className="mt-0.5 text-[10px] text-white/40">{g.networkDisplay}</div>}
          </>
        ) : (
          <div className="text-[12px] text-white/40">{g.kickoffDisplay}</div>
        )}
      </div>
    </div>
  );
}

export function CfbSchoolPage({ data }: { data: CfbSchoolPageData }) {
  const { school, venue, games, editorial } = data;
  const rivalryGames = games.filter((g) => g.rivalry);
  const homeCount = games.filter((g) => g.isHome && !g.neutralSite).length;
  const roadCount = games.filter((g) => !g.isHome && !g.neutralSite).length;
  const kicker = getKicker(school.id);
  const conf = school.conferenceBySeason?.['2026'] || '';

  // Site-standard affiliate adapters (CTAs render UNCHANGED with these).
  const affTeam = toAffiliateTeam(school, venue?.city ?? null);
  const affVenue = venue ? toAffiliateVenue(venue, school) : null;

  // Road-trip planner: away games at a tracked opponent with a resolved venue.
  const roadTrips = games.filter((g) => !g.isHome && !g.neutralSite && g.awayVenue && g.awaySchool);

  const sig = editorial.signatureGameId ? games.find((g) => g.id === editorial.signatureGameId) : null;
  const nextHome = games.find((g) => g.isHome && !g.neutralSite);

  // Hero meta line + stat strip (schedule-derived → always present).
  const metaParts = [school.mascot, conf, venue ? `${venue.name}${venue.city ? `, ${venue.city}` : ''}` : '', venue?.capacity ? `Cap. ${venue.capacity.toLocaleString()}` : '']
    .filter(Boolean);
  const stats: [number, string][] = ([[homeCount, 'home games'], [roadCount, 'road games'], [rivalryGames.length, 'rivalries']] as [number, string][])
    .filter(([n]) => n > 0);

  return (
    <main className={`min-h-screen text-white ${instrumentSerif.variable}`} style={{ background: '#08070d', fontFamily: SANS }}>
      <CfbThemePersist schoolId={school.id} />

      {/* ── IMMERSIVE HERO — team-color wash bleeds from above the fold into the
          dark base + a secondary accent glow. Wash is dark-safe (theme.ts), so
          white text holds on every palette. Degrades clean: kicker omitted when
          unknown, stat strip always renders from the schedule. ── */}
      <header className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: 'var(--cfb-hero-wash)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: 'var(--cfb-hero-glow)' }} />
        <div className="relative mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-11">
          <Link href="/cfb" className="text-[12px] text-white/70 hover:text-white" style={{ fontFamily: MONO }}>← College Football</Link>

          <div className="mt-7 h-1 w-[60px] rounded-sm" style={{ background: 'var(--cfb-accent)' }} />
          {kicker && (
            <div className="mt-4 italic" style={{ fontFamily: SERIF, fontSize: 'clamp(1.3rem, 3vw, 1.65rem)', color: 'var(--cfb-accent)' }}>{kicker}</div>
          )}
          <h1
            className="mt-1 font-black text-white"
            style={{ fontFamily: SANS, fontSize: 'clamp(3rem, 9vw, 5.25rem)', lineHeight: 0.92, letterSpacing: '-0.03em' }}
          >
            {school.name}
          </h1>
          <div className="mt-3 text-[12px] text-white/70 sm:text-[13px]" style={{ fontFamily: MONO }}>{metaParts.join(' · ')}</div>

          {stats.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 pb-11">
              {stats.map(([n, l]) => (
                <div key={l}>
                  <div className="italic text-white" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 5vw, 2.5rem)', lineHeight: 1 }}>{n}</div>
                  <div className="mt-1.5 text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent)' }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">

        {/* ── SIGNATURE GAME + WHY YOU GO (editorial, destination-only) ── */}
        {(sig || editorial.whyYouGo) && (
          <div className={`mt-6 grid gap-5 ${sig && editorial.whyYouGo ? 'lg:grid-cols-[1.6fr_1fr]' : 'grid-cols-1'}`}>
            {sig && (
              <div
                className="relative overflow-hidden rounded-2xl p-7 sm:p-8"
                style={{
                  background: 'linear-gradient(140deg, var(--cfb-card-from) 0%, var(--cfb-card-to) 100%)',
                  border: '1px solid var(--cfb-rivalry-border)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                  color: 'var(--cfb-on-primary)',
                }}
              >
                <div className="text-[11px] font-bold uppercase" style={{ fontFamily: MONO, letterSpacing: '0.14em', color: 'var(--cfb-accent)' }}>
                  Your signature game · {fmtDayLong(sig.date)} · {sig.isHome ? 'vs' : 'at'} {sig.opponentName}
                </div>
                <div className="mt-2.5 italic text-white" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 5vw, 2.9rem)', lineHeight: 0.98 }}>
                  {sig.isHome ? 'vs' : 'at'} {sig.opponentName}
                </div>
                {sig.kickoffVerified && <div className="mt-1 text-[13px] text-white/80" style={{ fontFamily: MONO }}>{sig.kickoffDisplay}</div>}
                {/* Inline Get Tickets — SITE-STANDARD, on a neutral dark inset so it reads over the saturated gradient. */}
                <div className="mt-6 inline-block rounded-xl p-4" style={{ background: 'rgba(8,7,13,0.86)' }}>
                  <TicketsBlock team={affTeam} surface="web_cfb" placement="team_page_hero" variant="card" />
                </div>
              </div>
            )}
            {editorial.whyYouGo && (
              <div className="rounded-2xl p-6 sm:p-7" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="mb-2 italic text-white" style={{ fontFamily: SERIF, fontSize: '1.5rem' }}>Why you go</div>
                <p className="text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>{editorial.whyYouGo}</p>
              </div>
            )}
          </div>
        )}

        {/* ── PLAN YOUR GAMEDAY — SITE-STANDARD affiliate cluster (NOT team-toned),
            the mockup's centerpiece placement. Neutral cards; the CTA components
            render their own unchanged styling. Surface 'web_cfb'. ── */}
        <section className="mt-11">
          <Eyebrow right={nextHome ? `vs ${nextHome.opponentName} · ${fmtMonthDay(nextHome.date)}` : undefined}>Plan your gameday</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl p-4" style={{ background: '#0e0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <TicketsBlock team={affTeam} surface="web_cfb" placement="team_page_inline" variant="card" />
            </div>
            <div className="rounded-xl p-4" style={{ background: '#0e0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <HotelsCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday_cluster" variant="modal-row" />
            </div>
            <div className="rounded-xl p-4" style={{ background: '#0e0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <ParkingCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday_cluster" compact />
            </div>
          </div>
        </section>

        {/* ── SCHEDULE — always present ── */}
        <section className="mt-11">
          <Eyebrow>2026 Schedule</Eyebrow>
          <div className="overflow-hidden rounded-2xl" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)' }}>
            {games.map((g, i) => <ScheduleRow key={g.id} g={g} last={i === games.length - 1} />)}
          </div>
          <p className="mt-2.5 text-[11px] text-white/35" style={{ fontFamily: MONO }}>Kickoff times show once announced and confirmed on a second source; until then, Kickoff TBA.</p>
        </section>

        {/* ── ROAD TRIPS — per-away-game SITE-STANDARD clusters keyed to the
            DESTINATION (host tickets + hotels/parking near the away stadium). The
            travel-planner money. Hidden when no away game resolves to a venue. ── */}
        {roadTrips.length > 0 && (
          <section className="mt-11">
            <Eyebrow>Road trips worth the drive</Eyebrow>
            <p className="-mt-2 mb-5 text-[13px] text-white/45" style={{ fontFamily: SANS }}>Away games with tickets, hotels, and parking pre-loaded near the stadium.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {roadTrips.map((g) => {
                const destTeam = toAffiliateTeam(g.awaySchool!, g.awayVenue!.city ?? null);
                const destVenue = toAffiliateVenue(g.awayVenue!, g.awaySchool!);
                const town = [g.awayVenue!.city, g.awayVenue!.state].filter(Boolean).join(', ');
                return (
                  <div key={g.id} className="rounded-2xl p-5 sm:p-6" style={{ background: '#0e0d14', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[17px] font-bold text-white sm:text-[18px]" style={{ fontFamily: SANS }}>at {g.opponentName}</span>
                          {g.rivalry && (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ fontFamily: MONO, background: 'var(--cfb-accent)', color: 'var(--cfb-accent-ink)' }}>
                              {g.rivalry.trophy || g.rivalry.name}
                            </span>
                          )}
                        </div>
                        {town && <div className="mt-0.5 italic" style={{ fontFamily: SERIF, fontSize: '1.25rem', color: 'var(--cfb-accent)' }}>{town}</div>}
                        <div className="mt-1 text-[11px] text-white/40" style={{ fontFamily: MONO }}>{g.awayVenue!.name}</div>
                      </div>
                      <div className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase text-white" style={{ fontFamily: MONO, letterSpacing: '0.04em', background: 'var(--cfb-primary)' }}>
                        {fmtMonthDay(g.date)}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
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

        {/* ── GAMEDAY & TRADITIONS (editorial, destination-only) ── */}
        {(editorial.traditions.length > 0 || editorial.gamedayCulture) && (
          <section className="mt-11">
            <Eyebrow>Gameday &amp; Traditions</Eyebrow>
            {editorial.gamedayCulture && (
              <div className="rounded-2xl p-6" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--cfb-accent)' }}>
                <p className="text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>{editorial.gamedayCulture}</p>
              </div>
            )}
          </section>
        )}

        {/* ── RIVALRIES — tag as fact, CROWN NONE (equal weight) ── */}
        {rivalryGames.length > 0 && (
          <section className="mt-11">
            <Eyebrow>Rivalries</Eyebrow>
            <div className={`grid gap-3.5 ${rivalryGames.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {rivalryGames.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl p-5 sm:p-6"
                  style={{ background: 'linear-gradient(135deg, var(--cfb-rivalry-from), #08070d)', border: '1px solid var(--cfb-rivalry-border)' }}
                >
                  <div className="italic leading-tight text-white" style={{ fontFamily: SERIF, fontSize: '1.4rem' }}>{g.rivalry!.trophy || g.rivalry!.name}</div>
                  <div className="mt-1.5 text-[13px] text-white/55" style={{ fontFamily: SANS }}>{g.isHome ? 'vs' : 'at'} {g.opponentName}</div>
                  {g.rivalry!.trophy && g.rivalry!.name !== g.rivalry!.trophy && (
                    <div className="mt-2 text-[9px] uppercase text-white/40" style={{ fontFamily: MONO, letterSpacing: '0.06em' }}>{g.rivalry!.name}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── VENUE editorial (destination-only) — the auto venue facts already
            live in the hero meta line, so this shows only when there's prose. ── */}
        {venue && editorial.venueInTheirWords && (
          <section className="mt-11">
            <Eyebrow>{venue.name}</Eyebrow>
            <div className="rounded-2xl p-6" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--cfb-accent)' }}>
              <p className="text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>{editorial.venueInTheirWords}</p>
            </div>
          </section>
        )}

        {/* ── CONTRIBUTOR CTA — invite depth. Ships on every auto page. ── */}
        <section className="mt-12 rounded-2xl p-6" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="italic text-white" style={{ fontFamily: SERIF, fontSize: '1.5rem' }}>Know this place?</div>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-white/65" style={{ fontFamily: SANS }}>
            Help us tell the story of a {school.shortName} Saturday — the traditions, the tailgate, why you go. Written by people who actually go.
          </p>
          <Link
            href={`/cfb/contribute?school=${school.id}`}
            className="mt-4 inline-block rounded-lg px-4 py-2 text-[13px] font-bold"
            style={{ fontFamily: SANS, background: 'var(--cfb-accent)', color: 'var(--cfb-accent-ink)' }}
          >
            Contribute to this page
          </Link>
          {editorial.contributor && <p className="mt-3 text-[11px] text-white/40" style={{ fontFamily: MONO }}>Gameday section by {editorial.contributor.credit}.</p>}
        </section>
      </div>
    </main>
  );
}
