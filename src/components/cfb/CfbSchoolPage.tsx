// THE ONE TEMPLATE (Phase 3 load-bearing rule). Auto and destination pages are
// this same component. Every EDITORIAL block renders ONLY when its data is present
// (`editorial.*`); when absent the page falls back to an auto-clean layout with no
// empty slots. Graduating auto -> destination is a DATA change — NEVER a second
// template.
//
// STYLING = the approved immersive mockup (CfbDestinationMockup.jsx), reproduced
// against real Firestore data and kept CONTRAST-SAFE across all 86 palettes (see
// theme.ts). Immersive hero team-color wash + glow, Instrument Serif italic drama,
// saturated signature card, accent section labels, themed rivalry cards.
//
// AFFILIATE CTAs = the SAME SHARED components the pro team pages use (one source of
// truth, no drift copies): TicketmasterCTA (Ticketmaster + TicketNetwork stacked),
// SpotHeroCTA, ExpediaCTA (hotels), FanaticsCTA (deep-linked to the school's
// discovered Fanatics college store via CFB_FANATICS_STORES). They render
// UNCHANGED; only PLACEMENT matches the mockup. CFB
// passes its OWN venue (name + coords) so hotels/parking name the school's stadium,
// and surface="web_cfb" (+ CFB placements, never away_game_card) so every CFB click
// attributes to web_cfb, not a pro surface.
//
// Verify-gate: kickoffs come pre-resolved from the reader as "Kickoff TBA" unless
// verified+announced. Rivalries are tagged as fact, CROWN NONE; the tag links to
// the trophy's OWN Wikipedia article (the stored corroborating source), or renders
// as plain text when no valid source URL is stored.

import Link from 'next/link';
import type { CfbSchoolPage as CfbSchoolPageData } from '@/lib/cfb/data';
import { CfbThemePersist } from './CfbThemePersist';
import { CfbSchedule } from './CfbSchedule';
import { instrumentSerif } from './fonts';
import { toAffiliateTeam, toAffiliateVenue, getKicker, buildRivalrySentences } from '@/lib/cfb/page-extras';
import { venueCity } from '@/lib/cfb/venue-cities';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { ExpediaCTA } from '@/components/affiliates/ExpediaCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { SERIF, MONO, SANS, fmtMonthDay, fmtDayLong, Eyebrow } from './cfb-bits';

export function CfbSchoolPage({ data }: { data: CfbSchoolPageData }) {
  const { school, venue, games, editorial } = data;
  const rivalryGames = games.filter((g) => g.rivalry);
  const homeCount = games.filter((g) => g.isHome && !g.neutralSite).length;
  const roadCount = games.filter((g) => !g.isHome && !g.neutralSite).length;
  const kicker = getKicker(school.id);
  const conf = school.conferenceBySeason?.['2026'] || '';

  // Rivalry-section prose (pure, data-derived; see buildRivalrySentences). Closes
  // Google's "Missing: rivalry" gap: each sentence uses "rivalry" and names the rival.
  const rivalrySentences = buildRivalrySentences(data);

  // Affiliate adapters — the shared CTAs render UNCHANGED with these. Both ticket
  // vendors + hotels/parking resolve the school's own team/venue. Pass the CLEAN
  // city (venueCity map) not the raw junk city field, so the hotel/parking search
  // destination reads "Husky Stadium, Seattle" rather than a scraped address.
  const heroCity = venueCity(venue);
  const affTeam = toAffiliateTeam(school, heroCity);
  const affVenue = venue ? toAffiliateVenue({ ...venue, city: heroCity ?? '', state: '' }, school) : null;

  const sig = editorial.signatureGameId ? games.find((g) => g.id === editorial.signatureGameId) : null;
  const nextHome = games.find((g) => g.isHome && !g.neutralSite);

  // Hero meta line (venue facts now live in the dedicated panel) + stat strip.
  const metaParts = [school.mascot, conf].filter(Boolean);
  const stats: [number, string][] = ([[homeCount, 'home games'], [roadCount, 'road games'], [rivalryGames.length, 'rivalries']] as [number, string][])
    .filter(([n]) => n > 0);

  return (
    <main className={`min-h-screen text-white ${instrumentSerif.variable}`} style={{ background: '#08070d', fontFamily: SANS }}>
      <CfbThemePersist schoolId={school.id} />

      {/* ── IMMERSIVE HERO — team-color wash bleeds from above the fold into the
          dark base + a secondary accent glow. Wash is dark-safe (theme.ts), so
          white text holds on every palette. Right of the name: the verified venue
          facts panel, filling the hero dead-space. Degrades clean: kicker/panel
          omit when unknown; stat strip always renders from the schedule. ── */}
      <header className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: 'var(--cfb-hero-wash)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: 'var(--cfb-hero-glow)' }} />
        <div className="relative mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-11">
          <Link href="/cfb" className="text-[12px] text-white/70 hover:text-white" style={{ fontFamily: MONO }}>← College Football</Link>

          <div className="mt-7 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
            {/* Left — kicker, name, meta, stats */}
            <div>
              <div className="h-1 w-[60px] rounded-sm" style={{ background: 'var(--cfb-accent)' }} />
              {kicker && (
                <div className="mt-4 italic" style={{ fontFamily: SERIF, fontSize: 'clamp(1.3rem, 3vw, 1.65rem)', color: 'var(--cfb-accent)' }}>{kicker}</div>
              )}
              <h1
                className="mt-1 font-black text-white"
                style={{ fontFamily: SANS, fontSize: 'clamp(3rem, 9vw, 5.25rem)', lineHeight: 0.92, letterSpacing: '-0.036em' }}
              >
                {school.name}
              </h1>
              <div className="mt-3 text-[12px] text-white/70 sm:text-[13px]" style={{ fontFamily: MONO }}>{metaParts.join(' · ')}</div>

              {stats.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
                  {stats.map(([n, l]) => (
                    <div key={l}>
                      <div className="italic text-white" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 5vw, 2.5rem)', lineHeight: 1 }}>{n}</div>
                      <div className="mt-1.5 text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent)' }}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — VENUE FACTS PANEL. Verified structured data only (name,
                location, capacity from cfbVenues). No generated prose; opened-year
                and surface aren't in the schema, so they're OMITTED, not invented. */}
            {venue && (
              <aside className="rounded-2xl p-6 lg:mb-1" style={{ background: '#0e0d14', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[11px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.166em', color: 'var(--cfb-accent)' }}>About the venue</div>
                <div className="mt-3 italic leading-tight text-white" style={{ fontFamily: SERIF, fontSize: '1.55rem' }}>{venue.name}</div>
                <dl className="mt-4 space-y-3">
                  {venueCity(venue) && (
                    <div>
                      <dt className="text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.1em', color: 'var(--cfb-accent)' }}>Location</dt>
                      <dd className="mt-0.5 text-[14px] text-white/85" style={{ fontFamily: SANS }}>{venueCity(venue)}</dd>
                    </div>
                  )}
                  {venue.capacity > 0 && (
                    <div>
                      <dt className="text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.1em', color: 'var(--cfb-accent)' }}>Capacity</dt>
                      <dd className="mt-0.5 text-[14px] text-white/85" style={{ fontFamily: SANS }}>{venue.capacity.toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              </aside>
            )}
          </div>
          <div className="pb-11" />
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
                {/* Eyebrow carries the matchup + date (mono); the marquee serif below
                    takes the EVOCATIVE name (rivalry trophy) so the two never duplicate.
                    accent-card = the accent lifted to read on the saturated gradient. */}
                <div className="text-[11px] font-bold uppercase" style={{ fontFamily: MONO, letterSpacing: '0.14em', color: 'var(--cfb-accent-card)' }}>
                  Your signature game · {fmtDayLong(sig.date)} · {sig.isHome ? 'vs' : 'at'} {sig.opponentName}
                </div>
                <div className="mt-2.5 italic text-white" style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 5vw, 2.9rem)', lineHeight: 0.98 }}>
                  {sig.rivalry ? (sig.rivalry.trophy || sig.rivalry.name) : `${sig.isHome ? 'vs' : 'at'} ${sig.opponentName}`}
                </div>
                {sig.kickoffVerified && <div className="mt-1 text-[13px] text-white/80" style={{ fontFamily: MONO }}>{sig.kickoffDisplay}</div>}
                {/* Inline tickets — the SAME shared ticket CTA (TM + TicketNetwork), on
                    a neutral dark inset so the white cards read over the gradient. */}
                <div className="mt-6 max-w-sm rounded-xl p-3" style={{ background: 'rgba(8,7,13,0.86)' }}>
                  <TicketmasterCTA team={affTeam} surface="web_cfb" placement="cfb_signature" size="compact" />
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

        {/* ── PLAN YOUR GAMEDAY — the SAME shared affiliate stack the pro pages use
            (TicketmasterCTA = TM + TicketNetwork stacked, SpotHero, Expedia,
            Fanatics). Rendered UNCHANGED; surface="web_cfb", CFB placements. Fanatics
            self-gates to null (no CFB mapping). Hotels/parking name THIS venue. ── */}
        <section className="mt-11">
          <Eyebrow right={nextHome ? `vs ${nextHome.opponentName} · ${fmtMonthDay(nextHome.date)}` : undefined}>Plan your gameday</Eyebrow>
          <div className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
            <div className="flex flex-col gap-2.5">
              <TicketmasterCTA team={affTeam} surface="web_cfb" placement="cfb_gameday" size="full" />
            </div>
            <div className="flex flex-col gap-2.5">
              <SpotHeroCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday" />
              <ExpediaCTA team={affTeam} venue={affVenue} surface="web_cfb" placement="cfb_gameday" />
              <FanaticsCTA team={affTeam} surface="web_cfb" placement="cfb_gameday" />
            </div>
          </div>
        </section>

        {/* ── SCHEDULE — always present. Rows are CLICKABLE and open the gameday
            modal (CfbSchedule); per-game tickets/hotels/parking live in that modal,
            never stacked inline. ── */}
        <section className="mt-11">
          <Eyebrow>2026 Schedule</Eyebrow>
          <CfbSchedule games={games} school={school} venue={venue} />
          <p className="mt-2.5 text-[11px] text-white/55" style={{ fontFamily: MONO }}>Tap any game for its venue, kickoff, and gameday links. Kickoff times show once announced and confirmed on a second source; until then, Kickoff TBA.</p>
        </section>

        {/* ── GAMEDAY & TRADITIONS (editorial, destination-only) ── Gated SOLELY on
            what it paints (gamedayCulture) so the labeled section can never orphan.
            Phase 4 TODO: when editorial.traditions gets a defined shape, render the
            mockup's per-tradition card grid here and re-add it to the gate. */}
        {editorial.gamedayCulture && (
          <section className="mt-11">
            <Eyebrow>Gameday &amp; Traditions</Eyebrow>
            <div className="rounded-2xl p-6" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--cfb-accent)' }}>
              <p className="text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>{editorial.gamedayCulture}</p>
            </div>
          </section>
        )}

        {/* ── RIVALRY GAMES — generated prose (uses the word "rivalry" + names the
            rival, closing Google's "Missing: rivalry" gap) leads the fact tags below.
            Prose is DATA-DERIVED (cfbRivalries + schedule), never invented. Cards crown
            none; the trophy name links to its own Wikipedia article when available. ── */}
        {rivalryGames.length > 0 && (
          <section className="mt-11">
            <Eyebrow>Rivalry Games</Eyebrow>
            {rivalrySentences.length > 0 && (
              <p className="mb-6 max-w-3xl text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>
                {rivalrySentences.join(' ')}
              </p>
            )}
            <div className={`grid gap-3.5 ${rivalryGames.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {rivalryGames.map((g) => {
                const riv = g.rivalry!;
                const titleText = riv.trophy || riv.name;
                const titleStyle = { fontFamily: SERIF, fontSize: '1.4rem' } as const;
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'linear-gradient(135deg, var(--cfb-rivalry-from), #08070d)', border: '1px solid var(--cfb-rivalry-border)' }}
                  >
                    {riv.sourceUrl ? (
                      <a
                        href={riv.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${titleText} — Wikipedia`}
                        className="italic leading-tight text-white underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[color:var(--cfb-accent)]"
                        style={titleStyle}
                      >
                        {titleText}
                      </a>
                    ) : (
                      <div className="italic leading-tight text-white" style={titleStyle}>{titleText}</div>
                    )}
                    <div className="mt-1.5 text-[13px] text-white/55" style={{ fontFamily: SANS }}>{g.isHome ? 'vs' : 'at'} {g.opponentName}</div>
                    {riv.trophy && riv.name !== riv.trophy && (
                      <div className="mt-2 text-[9px] uppercase text-white/40" style={{ fontFamily: MONO, letterSpacing: '0.06em' }}>{riv.name}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── VENUE editorial (destination-only) — the auto venue FACTS live in the
            hero panel; this shows only when there's editorial prose. ── */}
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
