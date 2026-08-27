import type { ReactNode } from 'react';
import Link from 'next/link';
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
import { HubPromosThisWeek } from './HubPromosThisWeek';
import {
  Card,
  CardLabel,
  formatMinutesBefore,
  transitMode,
  verifiedGateTenants,
  buildGettingInRows,
  GettingInCard,
  ParkingLotsCard,
  FoodCard,
  NearbyCard,
  BagCard,
} from './venue-logistics';
import {
  type VenueHub,
  type TenantTeamLink,
  type VenueHubWeekPromo,
  displayVenueName,
  cityState,
  spotHeroCovers,
  dimsString,
  venueHubDescription,
  bagFaqAnswers,
  stripTrailingPeriod,
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
// The logistics cards (bag capsule, getting in, parking lots, food, neighborhood)
// live in ./venue-logistics.tsx, extracted verbatim so this page renders
// byte-identically and so other pages can mount the same cards.

// The site's one contact affordance (Footer "Contact", /about) — a mailto, not
// a route. The previous value here was https://www.getpromonight.com/contact,
// which has never existed as a route: every empty-parking fallback rendered a
// dead link as its only next step. If a real contact/contribute route ever
// ships, update the Footer and this constant together.
const CONTACT_URL = 'mailto:hello@getpromonight.com';

export function VenueHubView({
  hub,
  canonicalUrl,
  ticketTeam,
  tenantLinks,
  weekPromos,
}: {
  hub: VenueHub;
  canonicalUrl: string;
  ticketTeam: Team | null;
  tenantLinks: TenantTeamLink[];
  /** Tenant promos in the next 7 days, already merged and date-sorted. Empty is
   *  the common off-season case and renders nothing (see HubPromosThisWeek). */
  weekPromos: VenueHubWeekPromo[];
}) {
  const short = displayVenueName(hub.name);
  const loc = cityState(hub);
  // The overlay's stored displayName is the raw slug on 73 of 186 verified
  // tenants, nearly all CFB ("penn-state", "unlv", "purdue"), because
  // getVenueHub falls back to teamId when the field is absent. That leaked into
  // the page subtitle, the parking FAQ question and the multi-tenant gate labels.
  //
  // Resolve ONLY that case, keyed on displayName being literally the slug.
  // Preferring the resolved name unconditionally is wrong: for pro tenants
  // getTeamBySlug().name is the nickname, so it would rewrite the perfectly good
  // stored "Pittsburgh Steelers" to "Steelers" and "Minnesota United FC" to
  // "United FC" across all 222 buildings. Title-casing the slug is not an option
  // either: it yields "Unlv" and "Tcu".
  const resolvedNames = new Map(tenantLinks.map((l) => [l.teamId, l.name]));
  const tenantName = (t: { teamId: string; displayName: string }) =>
    (t.displayName === t.teamId ? resolvedNames.get(t.teamId) : null) ?? t.displayName;
  const tenantNames = hub.tenantOverlays.map(tenantName);
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
  // A building with only a policy URL has no FACT to put in the capsule, but it
  // can still answer "has this venue published a bag policy" (the fifth case in
  // bagFaqAnswers) and it can still send the reader to the venue's own page. So
  // this, not hasBag, is what gates both the FAQ and the card: hasBag remains the
  // narrower test for whether a bag fact exists at all, which is what
  // venueHubIsIndexable and the capsule copy care about.
  const hasBagFaq = hasBag || (verified && !!hub.bagPolicyUrl);
  const dimStr = dimsString(hub.bagMaxDimensions);

  // ── FAQ (rule: overflow bag text + long-tail queries land here) ──
  const faqs: HubFaqItem[] = [];
  // Bag copy is GENERATED from the policy data by bagFaqAnswers, never templated
  // here. The string this replaced asserted "requires a clear bag no larger than
  // {dims}" for any building with bag data, which was false on 45 of them and sat
  // inside FAQPage schema. See lib/venue-hub bagFaqAnswers for the five cases.
  // The clutch exception comes from the VERIFIED tenant overlays' bagPolicyException,
  // which was declared and read but never rendered until now.
  if (hasBagFaq) {
    const tenantExceptions = hub.tenantOverlays
      .filter((t) => t.verified && t.bagPolicyException)
      .map((t) => t.bagPolicyException as string);
    const bag = bagFaqAnswers(hub, tenantExceptions);
    if (bag.size) faqs.push({ question: `What size bag can I bring into ${short}?`, answer: bag.size });
    // Emitted ONLY when clearBagRequired is a boolean. On null the question is
    // dropped rather than answered, because the source said neither.
    if (bag.clarity) faqs.push({ question: `Does ${short} require a clear bag?`, answer: bag.clarity });
  }
  if (verified && (hub.outsideFoodAllowed !== null || hub.outsideFoodRules)) {
    const foodAns =
      hub.outsideFoodRules ||
      (hub.outsideFoodAllowed === false
        ? `Outside food and drink are not permitted at ${short}.`
        : `Outside food is permitted at ${short}.`);
    faqs.push({ question: `Can you bring outside food into ${short}?`, answer: foodAns });
  }
  const gateTenants = verifiedGateTenants(hub);
  const lotOpenTenants = hub.tenantOverlays.filter((t) => t.verified && t.tailgateWindow);
  const lotOpenLines = lotOpenTenants.map((t) => ({
    key: t.teamId,
    label: lotOpenTenants.length > 1 ? tenantName(t) : null,
    text: t.tailgateWindow as string,
  }));
  if (gateTenants.length) {
    // stripTrailingPeriod before appending: the stored ruleText legitimately ends
    // in a period, and appending a second produced "games.." on 74 pages before
    // the CFB write and more after it.
    const gateAns =
      gateTenants.length === 1
        ? `${stripTrailingPeriod(gateTenants[0].gatesOpen!.ruleText!)}.`
        : gateTenants.map((t) => `${tenantName(t)}: ${stripTrailingPeriod(t.gatesOpen!.ruleText!)}.`).join(' ');
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

  // ── getting-in rows (built in venue-logistics.tsx, shared with any page that
  //    mounts the block; the rows and the gates FAQ read the same tenant set) ──
  const gettingRows = buildGettingInRows(hub, tenantName);

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
  // Capacity as a fact chip, never a sentence: a "seats {n} fans" skeleton
  // would be near-100% template-shared across buildings (plan 9e).
  if (verified && typeof hub.capacity === 'number' && hub.capacity > 0) {
    chips.push({ k: 'CAPACITY', v: hub.capacity.toLocaleString('en-US') });
  }
  const showFactBand = chips.length >= 2;

  const metaDescription = venueHubDescription(hub);

  // ── reusable cards (rail on desktop, inline on mobile — rendered once each,
  //    the DOM copy visible at each breakpoint is toggled with lg: utilities) ──
  // Gated on hasBagFaq, not hasBag: a building whose only bag fact is a policy
  // URL has nothing to put in the capsule but still has somewhere to send the
  // reader, and sending them to the venue's own page is the whole value of the
  // empty state. bagCapsule returns the neutral BAG POLICY label with no size and
  // no clarity claim when the three fact fields are null, so widening the gate
  // asserts nothing new.
  const bagCard = <BagCard hub={hub} hasBagFaq={hasBagFaq} />;

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

  const gettingInCard = <GettingInCard rows={gettingRows} />;

  const parkingLotsCard = <ParkingLotsCard hub={hub} />;

  const foodCard = <FoodCard hub={hub} />;

  const nearbyCard = <NearbyCard hub={hub} />;

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
        capacity={hub.capacity}
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
            {/* Promos this week: directly under the bag capsule and above
                parking. The capsule stays first because it is the SEO answer the
                page ranks for; a live promo is the highest-intent time-sensitive
                content on the page, so it sits as high as it can without
                displacing that. Self-conditional (null on an empty 7-day
                window), which is what lets parking move up on off-season
                buildings with no extra branching here. Building-agnostic, like
                the teams block below it: promos are PromoNight data, not a venue
                fact, so they do not sit behind hub.verified. */}
            <HubPromosThisWeek items={weekPromos} buildingSlug={hub.slug} buildingName={short} />
            {/* Return links: prominent (first for held buildings, which have no
                bag capsule), high in the DOM for link equity + AI crawlers. */}
            {teamsCard}
            {/* mobile: Plan-your-visit sits directly under the bag capsule */}
            {planCard ? <div className="lg:hidden">{planCard}</div> : null}
            {gettingInCard}
            {parkingLotsCard}
            {foodCard}
            {nearbyCard}
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
