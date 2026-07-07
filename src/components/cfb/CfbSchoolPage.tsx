// THE ONE TEMPLATE (Phase 3 load-bearing rule). Auto and destination pages are
// this same component. Every EDITORIAL block below renders ONLY when its data is
// present (`editorial.*`); when absent the page falls back to an auto-clean layout
// with no empty slots. Graduating auto -> destination is a DATA change (the
// editorial fields populate + editorialStatus flips) — NEVER a second template.
//
// Verify-gate: kickoffs come pre-resolved from the reader as "Kickoff TBA" unless
// verified+announced. Rivalries are tagged as fact, CROWN NONE (no signature on
// auto pages — signature is a destination-only editorial field).

import Link from 'next/link';
import { archivo } from '@/components/redesign/fonts';
import type { CfbSchoolPage as CfbSchoolPageData, CfbGameView } from '@/lib/cfb/data';
import { CfbThemePersist } from './CfbThemePersist';

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function ScheduleRow({ g, schoolId }: { g: CfbGameView; schoolId: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="w-16 shrink-0 text-sm text-white/60">{fmtDate(g.date)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-white/40">{g.isHome ? (g.neutralSite ? 'vs' : 'vs') : 'at'}</span>
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

  return (
    <main className={`min-h-screen bg-[#0b0b0d] text-white ${archivo.className}`}>
      <CfbThemePersist schoolId={school.id} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/cfb" className="text-sm text-white/50 hover:text-white">← College Football</Link>

        {/* Hero — team-accented; chrome stays PromoNight dark */}
        <header className="mt-4 border-b border-white/10 pb-6">
          <div className="h-1 w-16 rounded" style={{ background: 'var(--cfb-accent)' }} />
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{school.name}</h1>
          <p className="mt-1 text-white/60">
            {school.mascot}
            {school.conferenceBySeason?.['2026'] ? ` · ${school.conferenceBySeason['2026']}` : ''}
            {venue ? ` · ${venue.name}${venue.city ? `, ${venue.city}` : ''}` : ''}
          </p>
          {/* EDITORIAL (destination-only): why-you-go. Hidden on auto pages. */}
          {editorial.whyYouGo && <p className="mt-4 text-white/80">{editorial.whyYouGo}</p>}
        </header>

        {/* EDITORIAL (destination-only): signature game. Auto pages CROWN NONE. */}
        {editorial.signatureGameId && (() => {
          const sig = games.find((g) => g.id === editorial.signatureGameId);
          return sig ? (
            <section className="mt-6 rounded-2xl p-4" style={{ background: 'var(--cfb-accent)', color: 'var(--cfb-accent-on)' }}>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">The one to plan around</div>
              <div className="mt-1 text-lg font-bold">{sig.isHome ? 'vs' : 'at'} {sig.opponentName} · {fmtDate(sig.date)}</div>
            </section>
          ) : null;
        })()}

        {/* Schedule — always present */}
        <section className="mt-8">
          <h2 className="text-lg font-bold">2026 Schedule</h2>
          <ul className="mt-3 space-y-2">
            {games.map((g) => <ScheduleRow key={g.id} g={g} schoolId={school.id} />)}
          </ul>
          <p className="mt-2 text-xs text-white/40">Kickoff times show once announced and confirmed on a second source; until then, “Kickoff TBA.”</p>
        </section>

        {/* Rivalries — tag as fact, CROWN NONE (equal weight, no ordering-by-importance) */}
        {rivalryGames.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Rivalry games this season</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rivalryGames.map((g) => (
                <li key={g.id} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm">
                  <span className="font-semibold" style={{ color: 'var(--cfb-on-dark)' }}>{g.rivalry!.trophy || g.rivalry!.name}</span>
                  <span className="text-white/50"> · {g.isHome ? 'vs' : 'at'} {g.opponentName}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Venue */}
        {venue && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">{venue.name}</h2>
            <p className="mt-1 text-white/60">
              {[venue.city, venue.state].filter(Boolean).join(', ')}
              {venue.capacity ? ` · ${venue.capacity.toLocaleString()} capacity` : ''}
            </p>
            {/* EDITORIAL (destination-only): venue in their words. Hidden on auto. */}
            {editorial.venueInTheirWords && <p className="mt-3 text-white/80">{editorial.venueInTheirWords}</p>}
          </section>
        )}

        {/* EDITORIAL (destination-only): traditions + gameday culture. Hidden on auto. */}
        {(editorial.traditions.length > 0 || editorial.gamedayCulture) && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Gameday</h2>
            {editorial.gamedayCulture && <p className="mt-2 text-white/80">{editorial.gamedayCulture}</p>}
          </section>
        )}

        {/* Contributor CTA — invite depth, don't apologize. Ships on every auto page. */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
