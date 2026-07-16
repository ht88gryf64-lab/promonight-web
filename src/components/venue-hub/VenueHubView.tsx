import type { ReactNode } from 'react';
import type { Team } from '@/lib/types';
import type { HubFaqItem } from '@/components/hub/HubFaq';
import { HubFaq } from '@/components/hub/HubFaq';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { FanaticsCTA } from '@/components/affiliates/FanaticsCTA';
import { SpotHeroCTA } from '@/components/affiliates/SpotHeroCTA';
import { ExpediaCTA } from '@/components/affiliates/ExpediaCTA';
import { VenueHubJsonLd } from './VenueHubJsonLd';
import { VenuePhotoHero } from './VenuePhotoHero';
import { HubTeamLink } from './HubTeamLink';
import {
  type VenueHub,
  type TenantTeamLink,
  displayVenueName,
  leadSentences,
  cityState,
  spotHeroCovers,
  dimsString,
  bagCapsule,
  venueHubDescription,
} from '@/lib/venue-hub';

// House Light venue logistics hub. Server component (the photo hero's onError
// degrade is the only client leaf, VenuePhotoHero). Reads only the VenueHub it
// is given. The layout is the approved A+B hybrid: a photo-or-charcoal hero, a
// full-width quick-facts band, then a desktop two-column split (main + sticky
// booking rail) that stacks to a single column on mobile. Four rules are
// enforced HERE, in code, not in the data:
//   1. Conditional render: a card returns null when it has no data. No "coming soon".
//   2. Verified gate: fact cards render only when hub.verified; a held building
//      (verified:false) shows the hero and nothing else. Per-tenant gate times gate
//      on the tenant overlay's own verified flag.
//   3. Bag-capsule length budget: dimensions block + at most two sentences; the
//      remainder of a long bagPolicyNotes overflows into the FAQ, never the capsule.
//   4. Empty-venue parking: no parking data AND no widget inventory renders a
//      "no data yet" line linking to contact, never an empty booking box.
// Affiliate attribution and analytics are UNCHANGED by the layout: every CTA is
// the same component with the same web_venue_{slug} props as before.

const CONTACT_URL = 'https://www.getpromonight.com/contact';

function Card({ children, accent, tint }: { children: ReactNode; accent?: boolean; tint?: boolean }) {
  return (
    <section
      className={`mb-3 rounded-xl bg-rd-card p-4 shadow-[0_1px_3px_rgba(33,29,24,0.08)] ${
        accent ? 'border-t-[3px] border-rd-red' : ''
      } ${tint ? 'bg-[#faf7f0]' : ''}`}
    >
      {children}
    </section>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 mb-2.5 font-rd text-[13px] font-extrabold uppercase tracking-[0.08em] text-rd-ink-faint">
      {children}
    </h2>
  );
}

// Gate-open minutes -> a short scan-chip label: "90 min before", "2h before",
// "2h30 before".
function formatMinutesBefore(m: number): string {
  if (m < 60) return `${m} min before`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h before` : `${h}h${mm} before`;
}

// Transit lines/notes -> a one- or two-word mode chip. Keyword-derived, never a
// prose dump. Rail detection requires explicit rail vocabulary or a rail-transit
// authority acronym: a bare "line" is NOT a rail signal, since bus routes are
// commonly named "lines" too (e.g. RideKC's "47 Broadway line" at Arrowhead is a
// bus route, not rail).
function transitMode(pt: { lines: string[]; notes: string | null }): string {
  const text = [...pt.lines, pt.notes ?? ''].join(' ').toLowerCase();
  const rail =
    /\brail\b|\bmetro\b|subway|light[\s-]?rail|\btrain\b|streetcar|monorail|\btram\b|\btrolley\b|commuter rail|\bbart\b|\bmarta\b|\bmbta\b|\bsepta\b|\bcta\b|\bpath\b|\blirr\b|\bmetrolink\b|\bel\b|the l\b/.test(
      text,
    );
  const bus = /\bbus(es)?\b|shuttle|coach|\bbrt\b/.test(text);
  return rail && bus ? 'Rail + bus' : rail ? 'Rail' : bus ? 'Bus' : 'Nearby transit';
}

export function VenueHubView({
  hub,
  canonicalUrl,
  ticketTeam,
  tenantLinks,
}: {
  hub: VenueHub;
  canonicalUrl: string;
  ticketTeam: Team | null;
  tenantLinks: TenantTeamLink[];
}) {
  const short = displayVenueName(hub.name);
  const loc = cityState(hub);
  const tenantNames = hub.tenantOverlays.map((t) => t.displayName);
  const primaryTenant = tenantNames[0] ?? null;
  const verified = hub.verified;
  const subtitle = [loc, ...tenantNames].filter(Boolean).join(' · ');

  // ── bag capsule (rule 3: length budget; label fix in bagCapsule) ──
  const hasBag =
    verified &&
    (hub.bagMaxDimensions !== null ||
      hub.clearBagRequired !== null ||
      hub.bagsProhibited === true ||
      !!hub.bagPolicyNotes);
  const cap = bagCapsule(hub);
  const dimStr = dimsString(hub.bagMaxDimensions);
  const bagSplit = hub.bagPolicyNotes ? leadSentences(hub.bagPolicyNotes, 2) : { lead: '', overflow: '' };
  const noOutsideFood = verified && hub.outsideFoodAllowed === false;
  const bagPolicyLink = hub.bagPolicyUrl;

  // ── FAQ (rule: overflow bag text + long-tail queries land here) ──
  const faqs: HubFaqItem[] = [];
  if (hasBag) {
    const bagAnswer = [
      dimStr ? `${short} requires a clear bag no larger than ${dimStr}.` : `${short} enforces a clear bag policy.`,
      hub.bagPolicyNotes || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (bagAnswer) faqs.push({ question: `What size bag can I bring into ${short}?`, answer: bagAnswer });
  }
  if (verified && (hub.outsideFoodAllowed !== null || hub.outsideFoodRules)) {
    const foodAns =
      hub.outsideFoodRules ||
      (hub.outsideFoodAllowed === false
        ? `Outside food and drink are not permitted at ${short}.`
        : `Outside food is permitted at ${short}.`);
    faqs.push({ question: `Can you bring outside food into ${short}?`, answer: foodAns });
  }
  const gateTenants = hub.tenantOverlays.filter((t) => t.verified && t.gatesOpen?.ruleText);
  const lotOpenTenants = hub.tenantOverlays.filter((t) => t.verified && t.tailgateWindow);
  const lotOpenLines = lotOpenTenants.map((t) => ({
    key: t.teamId,
    label: lotOpenTenants.length > 1 ? t.displayName : null,
    text: t.tailgateWindow as string,
  }));
  if (gateTenants.length) {
    const gateAns =
      gateTenants.length === 1
        ? `${gateTenants[0].gatesOpen!.ruleText}.`
        : gateTenants.map((t) => `${t.displayName}: ${t.gatesOpen!.ruleText}.`).join(' ');
    faqs.push({ question: `When do gates open at ${short}?`, answer: gateAns });
  }
  if (verified && (hub.parkingLots.length > 0 || hub.parkingLotMapUrl)) {
    const lotNames = hub.parkingLots.slice(0, 8).map((l) => l.name).join(', ');
    faqs.push({
      question: primaryTenant ? `Where do you park for a ${primaryTenant} game?` : `Where do you park at ${short}?`,
      answer: `${short} has on-site lots${lotNames ? ` including ${lotNames}` : ''}. Reserve a nearby spot in advance through SpotHero on this page.`,
    });
  }

  // ── parking / booking data ──
  const hasParkingData = verified && (hub.parkingLots.length > 0 || hub.parkingLotMapUrl);
  const point = hub.lat !== null && hub.lng !== null ? { lat: hub.lat, lng: hub.lng } : null;
  const canSpotHero = spotHeroCovers(hub) && point !== null && ticketTeam !== null;

  // ── getting-in rows ──
  const gettingRows: { label: string; body: ReactNode }[] = [];
  for (const t of gateTenants) {
    gettingRows.push({
      label: gateTenants.length > 1 ? `Gates (${t.displayName})` : 'Gates',
      body: `${t.gatesOpen!.ruleText}.${t.gateVariance ? ` ${t.gateVariance}.` : ''}`,
    });
  }
  if (verified && hub.publicTransit && (hub.publicTransit.lines.length > 0 || hub.publicTransit.notes)) {
    gettingRows.push({ label: 'Transit', body: hub.publicTransit.notes || hub.publicTransit.lines.join(', ') });
  }
  if (verified && hub.rideshareDropoff) gettingRows.push({ label: 'Rideshare', body: hub.rideshareDropoff });
  if (verified && hub.tailgating?.allowed === true) {
    gettingRows.push({ label: 'Tailgating', body: hub.tailgating.rules || 'Tailgating is permitted in the parking lots.' });
  } else if (verified && hub.tailgating?.allowed === false) {
    gettingRows.push({ label: 'Tailgating', body: 'Tailgating is not permitted at this venue.' });
  }
  if (verified && hub.accessibility) gettingRows.push({ label: 'Accessibility', body: hub.accessibility });
  if (verified && hub.venueAccessRestrictions) gettingRows.push({ label: 'Entry', body: hub.venueAccessRestrictions });

  // ── fact band chips (each conditional; band omitted below 2 chips) ──
  const chips: { k: string; v: string }[] = [];
  if (verified) {
    if (dimStr) chips.push({ k: hub.clearBagRequired ? 'CLEAR BAG' : 'MAX BAG', v: dimStr });
    else if (hub.bagsProhibited === true) chips.push({ k: 'BAGS', v: 'Not allowed' });
  }
  const gateMins = new Set(
    hub.tenantOverlays
      .filter((t) => t.verified && typeof t.gatesOpen?.minutesBefore === 'number')
      .map((t) => t.gatesOpen!.minutesBefore as number),
  );
  if (verified && gateMins.size === 1) {
    chips.push({ k: 'GATES', v: formatMinutesBefore([...gateMins][0]) });
  } else if (verified && gateMins.size > 1) {
    chips.push({ k: 'GATES', v: 'Varies by event' });
  }
  if (verified && hub.publicTransit && (hub.publicTransit.lines.length > 0 || hub.publicTransit.notes)) {
    chips.push({ k: 'TRANSIT', v: transitMode(hub.publicTransit) });
  }
  if (verified && hub.outsideFoodAllowed !== null) {
    chips.push({ k: 'OUTSIDE FOOD', v: hub.outsideFoodAllowed ? 'Allowed' : 'Not allowed' });
  }
  if (verified && hub.rideshareDropoff) {
    chips.push({ k: 'RIDESHARE', v: 'Available' });
  }
  const showFactBand = chips.length >= 2;

  const metaDescription = venueHubDescription(hub);

  // ── reusable cards (rail on desktop, inline on mobile — rendered once each,
  //    the DOM copy visible at each breakpoint is toggled with lg: utilities) ──
  const bagCard = hasBag ? (
    <Card accent>
      <CardLabel>What size bag can I bring?</CardLabel>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="rounded-lg bg-rd-ink px-3.5 py-2.5 text-center text-white">
          {cap.dims ? (
            <div className="text-xl font-extrabold leading-none">{cap.dims}</div>
          ) : (
            <div className="text-base font-extrabold leading-none">{cap.bigText}</div>
          )}
          <div className="mt-1 font-rd text-[10px] tracking-[0.1em] text-white/75">{cap.label}</div>
        </div>
        <div className="min-w-[180px] flex-1 font-rd text-[13px] leading-[1.5] text-rd-ink">
          {bagSplit.lead ? <span>{bagSplit.lead}</span> : <span>Review the official bag policy before you arrive.</span>}
          {noOutsideFood ? (
            <>
              {' '}
              <strong>No outside food or drink.</strong>
            </>
          ) : null}
          {bagPolicyLink ? (
            <div className="mt-1 text-[11px]">
              <a href={bagPolicyLink} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                Official bag policy &rsaquo;
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  ) : null;

  // Teams that play here: the RETURN internal links (hub -> team pages), closing
  // the loop the hub otherwise leaves open. Building-agnostic (renders on held
  // buildings too — who plays here is known regardless of fact verification).
  // Each row is a crawlable <Link> firing hub_to_team. Only resolved tenants
  // appear, so there are no dead links.
  const teamsCard = tenantLinks.length ? (
    <Card>
      <CardLabel>Teams that play here</CardLabel>
      <div className="grid gap-2">
        {tenantLinks.map((t) => (
          <HubTeamLink
            key={t.teamId}
            teamId={t.teamId}
            league={t.league}
            href={t.href}
            name={t.name}
            isCfb={t.isCfb}
            buildingSlug={hub.slug}
            buildingName={short}
          />
        ))}
      </div>
    </Card>
  ) : null;

  // Plan your visit: parking (SpotHero, aff_sub web_venue_{slug}) + hotels
  // (Expedia, pubref web_venue_{slug}) + the official lot map. Rule 4 governs the
  // parking degrade. Renders only for verified buildings.
  const planCard = verified ? (
    <Card>
      <CardLabel>Plan your visit</CardLabel>
      <div className="grid gap-2.5">
        {canSpotHero && ticketTeam ? (
          <SpotHeroCTA
            team={ticketTeam}
            surface="web_venue"
            placement="venue_hub"
            venueSlug={hub.slug}
            coords={point}
          />
        ) : hasParkingData ? (
          <p className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
            SpotHero does not list reservable parking near {short} yet.
            {hub.parkingLotMapUrl ? ' Use the official lot map below.' : ''}
          </p>
        ) : (
          <p className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
            We do not have verified parking details for {short} yet.{' '}
            <a href={CONTACT_URL} className="font-semibold text-rd-red">
              Know the lots? Tell us &rsaquo;
            </a>
          </p>
        )}
        {ticketTeam ? (
          <ExpediaCTA
            team={ticketTeam}
            surface="web_venue"
            placement="venue_hub"
            venueSlug={hub.slug}
            building={{ name: short, city: hub.city, lat: hub.lat, lng: hub.lng }}
          />
        ) : null}
      </div>
      {lotOpenLines.length ? (
        <div className="mt-2 space-y-0.5">
          {lotOpenLines.map((l) => (
            <p key={l.key} className="font-rd text-[12px] text-rd-ink-soft">
              {l.label ? <strong>{l.label}. </strong> : null}
              {l.text}
            </p>
          ))}
        </div>
      ) : null}
      {hub.parkingLotMapUrl ? (
        <div className="mt-2 font-rd text-[11px]">
          <a href={hub.parkingLotMapUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
            Official parking lot map &rsaquo;
          </a>
        </div>
      ) : null}
    </Card>
  ) : null;

  const gettingInCard = gettingRows.length ? (
    <Card>
      <CardLabel>Getting in</CardLabel>
      <div className="grid grid-cols-1 gap-2.5 font-rd text-[13px] leading-[1.5] text-rd-ink md:grid-cols-2">
        {gettingRows.map((r) => (
          <div key={r.label}>
            <strong>{r.label}.</strong> {r.body}
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  const foodCard =
    verified && hub.food ? (
      <Card>
        <CardLabel>Food worth the line</CardLabel>
        <p className="font-rd text-[13px] leading-relaxed text-rd-ink">{hub.food}</p>
      </Card>
    ) : null;

  // Tickets & gear: Ticketmaster (primary) + TicketNetwork paired inside
  // TicketmasterCTA, plus Fanatics. Building-agnostic (renders on every hub with
  // a resolvable team, held or not). Impact /c/ attribution with subId
  // web_venue_{slug} — unchanged by the move into the rail.
  const ticketsCard = ticketTeam ? (
    <Card>
      <CardLabel>Tickets &amp; gear</CardLabel>
      <TicketmasterCTA team={ticketTeam} surface="web_venue" placement="venue_hub" venueSlug={hub.slug} promoId={hub.slug} />
      <div className="mt-2">
        <FanaticsCTA team={ticketTeam} surface="web_venue" placement="venue_hub" venueSlug={hub.slug} />
      </div>
    </Card>
  ) : null;

  const faqCard = faqs.length ? (
    <Card tint>
      <HubFaq faqs={faqs} />
    </Card>
  ) : null;

  const heldNotice = !verified ? (
    <Card>
      <p className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
        We are still confirming gameday details for {short}. Check back closer to the season.
      </p>
    </Card>
  ) : null;

  return (
    <>
      <VenueHubJsonLd
        name={short}
        description={metaDescription}
        url={canonicalUrl}
        city={hub.city}
        state={hub.state}
        lat={hub.lat}
        lng={hub.lng}
        faqs={faqs}
      />

      {/* Hero: photo when a self-hosted photoUrl is present, else the house
          charcoal treatment (identical to the pre-photo hero). */}
      {hub.photoUrl ? (
        <VenuePhotoHero photoUrl={hub.photoUrl} attribution={hub.photoAttribution} title={short} subtitle={subtitle} />
      ) : (
        <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#211d18' }}>
          <div
            aria-hidden
            className="absolute right-[-40px] top-[-40px] h-44 w-44 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(218,45,32,0.42), transparent 70%)' }}
          />
          <div className="relative z-10 mx-auto max-w-[980px] px-4 pb-5 pt-5 md:px-8 md:pb-6 md:pt-7">
            <p className="font-rd text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Gameday Guide</p>
            <h1 className="rd-display mt-1 text-2xl text-white md:text-4xl">{short}</h1>
            <p className="mt-0.5 font-rd text-[12px] text-white/65">{subtitle}</p>
          </div>
        </section>
      )}

      {/* Fact band: full-width dark strip of scan chips, each conditional. Omitted
          entirely below 2 chips (a one-chip band reads as broken). Scrolls
          horizontally on narrow screens. */}
      {showFactBand ? (
        <div className="w-full overflow-x-auto border-t border-[#3a342c] bg-[#2b2620]">
          <div className="mx-auto flex max-w-[1160px] gap-7 px-4 py-3 md:gap-11 md:px-8">
            {chips.map((c) => (
              <div key={c.k} className="whitespace-nowrap">
                <div className="font-rd text-[10px] font-bold uppercase tracking-[0.12em] text-[#a79f90]">{c.k}</div>
                <div className="mt-0.5 font-rd text-[14px] font-extrabold text-white md:text-[16px]">{c.v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Content: single stack on mobile, two columns + sticky rail from lg up.
          The rail cards (planCard, ticketsCard) render inline on mobile and in
          the sticky rail on desktop; the copy hidden at each breakpoint is
          toggled with lg: utilities so no CTA fires twice. */}
      <div className="mx-auto max-w-[1160px] px-3 py-4 md:px-8 md:py-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
          {/* main column */}
          <div className="min-w-0">
            {bagCard}
            {/* Return links: prominent (first for held buildings, which have no
                bag capsule), high in the DOM for link equity + AI crawlers. */}
            {teamsCard}
            {/* mobile: Plan-your-visit sits directly under the bag capsule */}
            {planCard ? <div className="lg:hidden">{planCard}</div> : null}
            {gettingInCard}
            {foodCard}
            {/* mobile: Tickets & gear sits above the FAQ */}
            {ticketsCard ? <div className="lg:hidden">{ticketsCard}</div> : null}
            {faqCard}
            {heldNotice}
          </div>

          {/* desktop sticky rail */}
          <aside className="hidden lg:block lg:sticky lg:top-5">
            {planCard}
            {ticketsCard}
          </aside>
        </div>
      </div>
    </>
  );
}
