import type { ReactNode } from 'react';
import type { Team } from '@/lib/types';
import type { HubFaqItem } from '@/components/hub/HubFaq';
import { HubFaq } from '@/components/hub/HubFaq';
import { TicketmasterCTA } from '@/components/affiliates/TicketmasterCTA';
import { VenueHubJsonLd } from './VenueHubJsonLd';
import {
  type VenueHub,
  displayVenueName,
  leadSentences,
  cityState,
} from '@/lib/venue-hub';

// House Light venue logistics hub. Server component. Reads only the VenueHub it is
// given. Four rules are enforced HERE, in code, not in the data:
//   1. Conditional render: a card returns null when it has no data. No "coming soon".
//   2. Verified gate: fact cards render only when hub.verified; a held building
//      (verified:false) shows the hero and nothing else. Per-tenant gate times gate
//      on the tenant overlay's own verified flag.
//   3. Bag-capsule length budget: dimensions block + at most two sentences; the
//      remainder of a long bagPolicyNotes overflows into the FAQ, never the capsule.
//   4. Empty-venue parking: no parking data AND no widget inventory renders a
//      "no data yet" card linking to contact, never an empty booking box.

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

function inches(n: number): string {
  return Number.isInteger(n) ? `${n}"` : `${n}"`;
}

// ── stubbed embeds (labeled placeholders, per Phase 1 spec) ──────────────────
function SpotHeroSlot() {
  return (
    <div className="overflow-hidden rounded-[10px] border border-dashed border-rd-line-strong bg-[#f3efe6]">
      <div className="flex h-[104px] items-center justify-center bg-[linear-gradient(135deg,#e7ede2,#dbe6df)]">
        <span className="rounded-md bg-white/80 px-2 py-1 font-rd text-[11px] font-semibold text-rd-ink-soft">
          SpotHero widget placeholder
        </span>
      </div>
      <div className="border-t border-rd-line px-3 py-2 font-rd text-[12px] text-rd-ink-soft">
        Live parking prices and reservations land here.
      </div>
    </div>
  );
}
function ExpediaSlot() {
  return (
    <div className="rounded-[10px] border border-dashed border-rd-line-strong bg-[#f3efe6] px-3 py-3 font-rd text-[12px] text-rd-ink-soft">
      Expedia hotel rates placeholder. Nearby stays and nightly prices land here.
    </div>
  );
}

export function VenueHubView({
  hub,
  canonicalUrl,
  ticketTeam,
}: {
  hub: VenueHub;
  canonicalUrl: string;
  ticketTeam: Team | null;
}) {
  const short = displayVenueName(hub.name);
  const loc = cityState(hub);
  const tenantNames = hub.tenantOverlays.map((t) => t.displayName);
  const primaryTenant = tenantNames[0] ?? null;
  const verified = hub.verified;

  // ── bag capsule (rule 3: length budget) ──
  const hasBag = verified && (hub.bagMaxDimensions !== null || hub.clearBagRequired !== null || !!hub.bagPolicyNotes);
  const dims = hub.bagMaxDimensions;
  const bagSplit = hub.bagPolicyNotes ? leadSentences(hub.bagPolicyNotes, 2) : { lead: '', overflow: '' };
  const noOutsideFood = verified && hub.outsideFoodAllowed === false;

  // ── FAQ (rule: overflow bag text + long-tail queries land here) ──
  const faqs: HubFaqItem[] = [];
  if (hasBag) {
    const dimStr = dims ? `${inches(dims.w)} x ${inches(dims.h)} x ${inches(dims.d)}` : null;
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
  // Lot-open time (from the tenant overlay's tailgateWindow) rendered in PARKING
  // context, never as a gate. Labeled per tenant only when more than one has one.
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
      answer: `${short} has on-site lots${lotNames ? ` including ${lotNames}` : ''}. Reserve a nearby spot in advance through the parking widget on this page.`,
    });
  }

  // ── parking card (rule 4: empty-venue) ──
  const hasParkingData = verified && (hub.parkingLots.length > 0 || hub.parkingLotMapUrl);
  const widgetHasInventory = true; // stub always has mock inventory; real widget will report this

  // ── getting-in rows ──
  const gettingRows: { label: string; body: ReactNode }[] = [];
  for (const t of gateTenants) {
    // multi-tenant gate times as LABELED ROWS in the DOM (never tabs)
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

  const bagPolicyLink = hub.bagPolicyUrl;

  return (
    <>
      <VenueHubJsonLd name={hub.name} url={canonicalUrl} city={hub.city} state={hub.state} lat={hub.lat} lng={hub.lng} faqs={faqs} />

      {/* Hero: charcoal + brand-red glow, matching the live team pages and the MLB hub */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#211d18' }}>
        <div
          aria-hidden
          className="absolute right-[-40px] top-[-40px] h-44 w-44 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(218,45,32,0.42), transparent 70%)' }}
        />
        <div className="relative z-10 mx-auto max-w-[980px] px-4 pb-5 pt-5 md:px-8 md:pb-6 md:pt-7">
          <p className="font-rd text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Gameday Guide</p>
          <h1 className="rd-display mt-1 text-2xl text-white md:text-4xl">{short}</h1>
          <p className="mt-0.5 font-rd text-[12px] text-white/65">
            {[loc, ...tenantNames].filter(Boolean).join(' · ')}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[980px] px-3 py-4 md:px-8 md:py-6">
        <div className="md:grid md:grid-cols-[1.15fr_.85fr] md:gap-4">
          {/* main column */}
          <div>
            {/* 2. Bag policy capsule */}
            {hasBag ? (
              <Card accent>
                <CardLabel>What size bag can I bring?</CardLabel>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="rounded-lg bg-rd-ink px-3.5 py-2.5 text-center text-white">
                    {dims ? (
                      <div className="text-xl font-extrabold leading-none">
                        {inches(dims.w)} x {inches(dims.h)} x {inches(dims.d)}
                      </div>
                    ) : (
                      <div className="text-base font-extrabold leading-none">Clear bag</div>
                    )}
                    <div className="mt-1 font-rd text-[10px] tracking-[0.1em] text-white/75">
                      {hub.clearBagRequired ? 'CLEAR BAG REQUIRED' : hub.clearBagRequired === false ? 'NO BAGS ALLOWED' : 'BAG POLICY'}
                    </div>
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
            ) : null}

            {/* 3. Parking */}
            {verified ? (
              hasParkingData || widgetHasInventory ? (
                <Card>
                  <CardLabel>Reserve parking near {short}</CardLabel>
                  <SpotHeroSlot />
                  {/* Lot-open time near the widget, in PARKING context. Never mapped
                      into a gate row: a lot-opening time is not a gate-opening time. */}
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
              ) : (
                <Card>
                  <CardLabel>Parking</CardLabel>
                  <p className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
                    We do not have verified parking details for {short} yet.{' '}
                    <a href={CONTACT_URL} className="font-semibold text-rd-red">
                      Know the lots? Tell us &rsaquo;
                    </a>
                  </p>
                </Card>
              )
            ) : null}

            {/* 6. Getting in (desktop keeps it in the main column) */}
            {gettingRows.length ? (
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
            ) : null}
          </div>

          {/* side column */}
          <div>
            {/* 4. Hotels (Expedia stub, always offered) */}
            {verified ? (
              <Card>
                <CardLabel>Hotels near the stadium</CardLabel>
                <ExpediaSlot />
              </Card>
            ) : null}

            {/* 5. Food (renders only if present) */}
            {verified && hub.food ? (
              <Card>
                <CardLabel>Food worth the line</CardLabel>
                <p className="font-rd text-[13px] leading-relaxed text-rd-ink">{hub.food}</p>
              </Card>
            ) : null}
          </div>
        </div>

        {/* Tickets CTA, directly ABOVE the FAQ. Building-agnostic: renders on every
            hub, held or not. Ticketmaster primary + TicketNetwork below, both routed
            through Impact with subId web_venue_{slug}(_teamId) and dual-emitting
            affiliate_click to PostHog + GA4 via TrackedAffiliateLink. */}
        {ticketTeam ? (
          <Card>
            <CardLabel>Get tickets</CardLabel>
            <TicketmasterCTA team={ticketTeam} surface="web_venue" placement="venue_hub" venueSlug={hub.slug} promoId={hub.slug} />
          </Card>
        ) : null}

        {/* FAQ (overflow bag text lands here) */}
        {faqs.length ? (
          <Card tint>
            <HubFaq faqs={faqs} />
          </Card>
        ) : null}

        {/* held building: hero shows, facts do not (rule 2) */}
        {!verified ? (
          <Card>
            <p className="font-rd text-[13px] leading-relaxed text-rd-ink-soft">
              We are still confirming gameday details for {short}. Check back closer to the season.
            </p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
