import Link from 'next/link';
import type { CfbSchool } from '@/lib/cfb/types';
import type { MatchupPage } from '@/lib/cfb/matchups';
import type { TripStepKey } from '@/lib/cfb/trip-steps';
import { planTripSteps } from '@/lib/cfb/trip-steps';
import { resolveCfbTheme } from '@/lib/cfb/theme';
import { buildMatchupDescription } from '@/lib/cfb/matchup-description';
import { renderedKickoff } from '@/lib/cfb/metadata';
import { toAffiliateTeam } from '@/lib/cfb/page-extras';
import { buildTicketNetworkLink, buildSpotHeroUrl } from '@/lib/affiliates';
import { resolveHotelLink } from '@/lib/hotel-link';
import { TripStepAffiliate, TripStepInternal } from '@/components/cfb/rivalry/TripStep';
import type { Team, Venue } from '@/lib/types';

const PAGE_BG = '#08070d';
const SEASON = 2026; // hardcoded by house rule, never getFullYear() in SEO copy

// Generic by design and identical on all 32 pages. The trip is the same trip;
// per-rivalry variants would be 32 pieces of copy to maintain for no gain.
const STEP_COPY = {
  tickets: { title: 'Get in', blurb: 'Rivalry games sell out. Resale is usually the route.', cta: 'Find tickets' },
  hotels: { title: 'Book a room', blurb: 'Rooms near campus go early on rivalry weekend.', cta: 'Find hotels' },
  parking: { title: 'Park', blurb: 'Reserve ahead and walk in.', cta: 'Reserve parking' },
  gates: { title: 'Gates and bags', blurb: 'Bag rules, gate times and transit for this stadium.', cta: 'Gameday guide' },
} as const;

function formatDayMonth(date: string): { weekday: string; monthDay: string } {
  const d = new Date(`${date}T12:00:00`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    monthDay: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

/** School name in the ACCENT colour, which resolveCfbTheme has already lifted to
 *  clear AA on dark for all 86 palettes. An untracked school (Apple Cup's
 *  washington-state) has no colours and no page, so it renders as plain text. */
function schoolAccent(school: CfbSchool | null): string | null {
  if (!school) return null;
  return resolveCfbTheme(school.primaryColor ?? null, school.secondaryColor ?? null).accent;
}

function SchoolName({ school, fallback }: { school: CfbSchool & { id: string } | null; fallback: string }) {
  if (!school) return <span className="text-white/70">{fallback}</span>;
  return (
    <Link href={`/cfb/${school.id}`} className="underline-offset-4 hover:underline" style={{ color: schoolAccent(school)! }}>
      {school.shortName || school.name}
    </Link>
  );
}

function SchoolCard({ school, fallback }: { school: CfbSchool & { id: string } | null; fallback: string }) {
  // No link, no spear, no accent for an untracked school. The card still holds
  // its place so the two-up grid does not collapse.
  if (!school) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-sm font-semibold text-white/70">{fallback}</div>
        <div className="mt-0.5 text-xs text-white/40">Not tracked yet</div>
      </div>
    );
  }
  const theme = resolveCfbTheme(school.primaryColor ?? null, school.secondaryColor ?? null);
  return (
    <Link
      href={`/cfb/${school.id}`}
      className="block rounded-lg border border-white/10 bg-white/[0.03] p-3 pl-4 transition-colors hover:bg-white/[0.06]"
      // Raw team colour, solid fill only. A solid fill carries no contrast
      // requirement; the readable variant is theme.accent, used for the text.
      style={{ borderLeft: `4px solid ${theme.primary}` }}
    >
      <div className="text-sm font-semibold" style={{ color: theme.accent }}>
        {school.shortName || school.name}
      </div>
      <div className="mt-0.5 text-xs text-white/50">{school.mascot}</div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

export function RivalryMatchupPage({ data }: { data: MatchupPage }) {
  const { rivalry, game, schools, resolvedVenue, siblings } = data;
  const [a, b] = schools;
  const [aId, bId] = rivalry.schoolIds;
  const aFallback = prettyId(aId);
  const bFallback = prettyId(bId);

  const date = game?.date ? formatDayMonth(game.date) : null;
  // "Kickoff TBA" verbatim, no embellishment.
  const kickoff = game && !game.kickoff?.tbd && game.kickoff?.time && !/tbd/i.test(game.kickoff.time)
    ? `${game.kickoff.time}${game.kickoff.tz && game.kickoff.tz !== 'TBD' ? ` ${game.kickoff.tz}` : ''}`
    : 'Kickoff TBA';

  // Visible lede: byte-identical to the meta description (same builder, same
  // inputs as buildCfbMatchupMetadata), so the hand-written 140-160 char
  // matchup description finally renders as body copy instead of head-only.
  const lede = buildMatchupDescription({
    displayName: data.displayName,
    schoolA: a?.name ?? aFallback,
    schoolB: b?.name ?? bFallback,
    date: game?.date ?? null,
    kickoff: renderedKickoff(game),
    venueName: resolvedVenue?.name ?? null,
    venueCity: resolvedVenue?.city ?? null,
  });

  // Corroborating source links (cfbRivalries.source, sometimes "urlA + urlB").
  // Rendered as citation links in the trophy section; never rendered as prose.
  const sourceLinks = rivalry.source
    .split(/\s+\+\s+/)
    .filter((u) => u.startsWith('http'))
    .slice(0, 2);

  // ── affiliate hrefs, all from the SHARED builders ──
  // The sub-ID keys on the rivalry slug rather than a team id, so the click is
  // attributed to the matchup. Landing pages still resolve from the home school,
  // which is who actually sells the tickets.
  const ticketSchool = a ?? b;
  let ticketsHref: string | null = null;
  let hotelsHref: string | null = null;
  let parkingHref: string | null = null;

  if (ticketSchool) {
    const affTeam = toAffiliateTeam(ticketSchool, resolvedVenue?.city ?? null);
    const keyed: Team = { ...affTeam, id: data.slug };
    ticketsHref = buildTicketNetworkLink({ team: keyed, surface: 'web_cfb_rivalry' });

    if (resolvedVenue) {
      const affVenue = {
        name: resolvedVenue.name,
        address: [resolvedVenue.city, resolvedVenue.state].filter(Boolean).join(', '),
        team: affTeam.name,
        sport: 'football',
        sportIcon: '\u{1F3C8}',
        primaryColor: ticketSchool.primaryColor || '#000000',
        accentColor: ticketSchool.secondaryColor || '#FFFFFF',
        lat: resolvedVenue.lat ?? 0,
        lng: resolvedVenue.lng ?? 0,
        hasAmenityData: false,
        amenityCount: 0,
        league: 'ncaaf',
        teamId: data.slug,
      } as Venue;

      const hotel = resolveHotelLink({ team: keyed, venue: affVenue, surface: 'web_cfb_rivalry' });
      hotelsHref = hotel?.href ?? null;

      // The Park step is gated HERE, not by SpotHeroCTA. SpotHeroCTA never
      // returns null: with no coords it renders a tracked link to spothero.com's
      // homepage under a "Reserve Parking" label, which is a dead end wearing a
      // useful hat. No coords means no step.
      if (resolvedVenue.lat !== null && resolvedVenue.lng !== null) {
        parkingHref = buildSpotHeroUrl({
          latitude: resolvedVenue.lat,
          longitude: resolvedVenue.lng,
          subKey: `web_cfb_rivalry_${data.slug}`,
        });
      }
    }
  }

  const gatesHref = resolvedVenue?.hubSlug && resolvedVenue.hubIndexable ? `/venues/${resolvedVenue.hubSlug}` : null;

  // planTripSteps holds the gating rule and is unit-tested; the hrefs above only
  // supply the destinations. A step is rendered when the rule allows it AND its
  // href actually resolved.
  const allowed = planTripSteps({ hasTicketSchool: !!ticketSchool, venue: resolvedVenue });
  const hrefFor: Record<string, { href: string | null; partner?: 'ticketnetwork' | 'spothero' | 'expedia' }> = {
    tickets: { href: ticketsHref, partner: 'ticketnetwork' },
    hotels: { href: hotelsHref, partner: 'expedia' },
    parking: { href: parkingHref, partner: 'spothero' },
    gates: { href: gatesHref },
  };
  const steps = allowed
    .map((key) => ({ key, ...hrefFor[key] }))
    .filter((s): s is { key: TripStepKey; href: string; partner?: 'ticketnetwork' | 'spothero' | 'expedia' } => !!s.href)
    .map((s) => ({ kind: (s.partner ? 'aff' : 'internal') as 'aff' | 'internal', key: s.key as keyof typeof STEP_COPY, href: s.href, partner: s.partner }));

  return (
    <main className="min-h-screen text-white" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        {/* 1. breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-wider text-white/45">
          <Link href="/cfb" className="hover:text-white">College Football</Link>
          <span className="px-1.5 text-white/25">/</span>
          <Link href="/cfb/rivalries" className="hover:text-white">Rivalries</Link>
        </nav>

        {/* 2. H1: the rivalry name leads, the trophy is not the headline */}
        {/* The display name, not rivalry.name: the H1 is a search target, and
            cfbRivalries.name holds the trophy or historical name, which is not
            always what anyone searches. The trophy block below still shows
            rivalry.trophy, so nothing is lost. */}
        <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
          {data.displayName} {SEASON}
        </h1>

        {/* 3. matchup line */}
        <p className="mt-2 text-lg font-semibold">
          <SchoolName school={a} fallback={aFallback} />
          <span className="px-2 text-white/40">vs</span>
          <SchoolName school={b} fallback={bFallback} />
        </p>

        {/* 3b. lede: the hand-written matchup description, surfaced as body
            copy (identical string to the meta description by construction). */}
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-white/70">{lede}</p>

        {/* 4. fact card, the direct answer */}
        <section className="mt-4 rounded-xl border border-white/12 bg-white/[0.04] p-4">
          {date ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold leading-none">{date.monthDay}</span>
              <span className="text-sm text-white/60">{date.weekday}</span>
            </div>
          ) : (
            <div className="text-xl font-bold text-white/70">Not scheduled in {SEASON}</div>
          )}
          <div className="mt-2 text-sm text-white/80">{kickoff}</div>
          {resolvedVenue && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="text-sm font-semibold">{resolvedVenue.name}</div>
              {(resolvedVenue.city || resolvedVenue.state) && (
                <div className="text-sm text-white/55">
                  {[resolvedVenue.city, resolvedVenue.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. two school cards */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SchoolCard school={a} fallback={aFallback} />
          <SchoolCard school={b} fallback={bFallback} />
        </div>

        {/* 6. plan the trip */}
        <section className="mt-8">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">Plan the trip</h2>
          <ol className="mt-3">
            {steps.map((s, i) => {
              const copy = STEP_COPY[s.key];
              const common = {
                index: i + 1,
                isLast: i === steps.length - 1,
                title: copy.title,
                blurb: copy.blurb,
                cta: copy.cta,
                tone: (i === 0 ? 'solid' : 'ghost') as 'solid' | 'ghost',
              };
              return s.kind === 'aff' ? (
                <TripStepAffiliate key={s.key} {...common} href={s.href} partner={s.partner!} rivalrySlug={data.slug} />
              ) : (
                <TripStepInternal key={s.key} {...common} href={s.href} />
              );
            })}
          </ol>
        </section>

        {/* 7. the trophy */}
        <section className="mt-8">
          <h2 className="text-[11px] uppercase tracking-wider text-white/45">The trophy</h2>
          {data.rivalrySentence && <p className="mt-3 text-sm leading-relaxed text-white/75">{data.rivalrySentence}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Series began" value={String(rivalry.seriesStartYear)} />
            {data.conference && <Stat label="Conference" value={data.conference} />}
            {/* The trophy's proper name, previously rendered only inside the
                generated sentence (and dropped there whenever it matched the
                title). Suppressed when it merely repeats the H1. */}
            {rivalry.trophy && rivalry.trophy !== data.displayName && (
              <Stat label="Trophy" value={rivalry.trophy} />
            )}
            {/* Only when present, 11 of 212. Kept visually separate from the
                series start: they are different facts and conflating them was a
                prior bug. */}
            {rivalry.trophyCreatedYear !== null && rivalry.trophyCreatedYear !== undefined && (
              <Stat label="Trophy created" value={String(rivalry.trophyCreatedYear)} />
            )}
          </div>
          {/* Corroborating citation links (cfbRivalries.source). Labels only,
              never raw URLs as text: the CFB quoted-source-URL incident rule. */}
          {sourceLinks.length > 0 && (
            <p className="mt-3 text-[11px] text-white/40">
              Source:{' '}
              {sourceLinks.map((u, i) => (
                <span key={u}>
                  {i > 0 ? ', ' : ''}
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70">
                    {new URL(u).hostname.replace(/^www\./, '')}
                  </a>
                </span>
              ))}
            </p>
          )}
        </section>

        {/* 8. sibling rail. Omitted entirely below 2. */}
        {siblings.length >= 2 && (
          <section className="mt-8">
            <h2 className="text-[11px] uppercase tracking-wider text-white/45">
              {data.siblingsAreSameWeek ? 'More rivalry week' : 'More rivalries'}
            </h2>
            <ul className="mt-3 space-y-2">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/cfb/rivalries/${s.slug}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.date && <span className="text-white/45">{formatDayMonth(s.date).monthDay}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function prettyId(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
