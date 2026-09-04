import type { ReactNode } from 'react';
import Link from 'next/link';
import type { CondensedLine } from '@/lib/venue-hub-condensed';
import { transitSuppressed } from '@/lib/venue-transit-suppression';
// The venue page now honours the SAME per-field provenance and exclusion rules
// as the CFB condensed block. It keeps its doc-level `verified` gate on top:
// that asymmetry is deliberate (a building nobody signed off shows nothing
// here, while its individually sourced facts still reach its school page).
// What was NOT deliberate was publishing a field here that the school page
// withholds for cause. See audit/cfb-venue-sourcing-report.md section 16.
import { fieldExcluded, subFieldExcluded, hasProvenance, hasSubProvenance, isReachableUrl } from '@/lib/venue-field-exclusions';
import { dimsString } from '@/lib/venue-hub';
import { CLAIM_STATE_REASON, claimRow, claimSourceHost, claimState, claimSourceUrl, claimSourceReadOn } from '@/lib/venue-claim';
import {
  type VenueHub,
  type VenueHubTenantOverlay,
  leadSentences,
  bagCapsule,
  stripTrailingPeriod,
  isRestatement,
} from '@/lib/venue-hub';

// The venue logistics cards, extracted VERBATIM from VenueHubView so the pro
// venue pages render byte-identically, and exported so a team or school page
// can mount the same block (or any one card) without touching the view.
// Every card is self-gating: it returns null when it has nothing to show, and
// every fact card sits behind hub.verified exactly as it did inside the view.
// Nothing here reads Firestore; a caller passes the VenueHub it already has.

export function Card({ children, accent, tint }: { children: ReactNode; accent?: boolean; tint?: boolean }) {
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

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 mb-2.5 font-rd text-[13px] font-extrabold uppercase tracking-[0.08em] text-rd-ink-faint">
      {children}
    </h2>
  );
}

// Gate-open minutes -> a short scan-chip label: "90 min before", "2h before",
// "2h30 before".
export function formatMinutesBefore(m: number): string {
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
export function transitMode(pt: { lines: string[]; notes: string | null }): string {
  const text = [...pt.lines, pt.notes ?? ''].join(' ').toLowerCase();
  const rail =
    /\brail\b|\bmetro\b|subway|light[\s-]?rail|\btrain\b|streetcar|monorail|\btram\b|\btrolley\b|commuter rail|\bbart\b|\bmarta\b|\bmbta\b|\bsepta\b|\bcta\b|\bpath\b|\blirr\b|\bmetrolink\b|\bel\b|the l\b/.test(
      text,
    );
  const bus = /\bbus(es)?\b|shuttle|coach|\bbrt\b/.test(text);
  return rail && bus ? 'Rail + bus' : rail ? 'Rail' : bus ? 'Bus' : 'Nearby transit';
}

/** Resolves the label a tenant overlay renders under. The view passes its
 *  slug-aware resolver; a page with no tenant links can pass the identity. */
export type TenantNameResolver = (t: { teamId: string; displayName: string }) => string;

/** Verified tenant overlays that carry a gates-open rule. Shared by the
 *  getting-in rows and the view's gates FAQ so the two can never disagree. */
export function verifiedGateTenants(hub: VenueHub): VenueHubTenantOverlay[] {
  // Provenance is applied HERE, not at each call site, because this one set
  // feeds the Getting-in row, the gates FAQ (visible AND inside FAQPage JSON-LD)
  // and the GATES fact-band chip. Gating only the row left an unprovenanced gate
  // rule inside structured data, which is the worst place for it.
  return hub.tenantOverlays.filter(
    (t) =>
      t.verified &&
      t.gatesOpen?.ruleText &&
      hasSubProvenance(t.sources, 'gatesOpen', 'ruleText') &&
      !fieldExcluded(hub.slug, 'gates'),
  );
}

export interface GettingInRow {
  label: string;
  body: ReactNode;
  /** The page that carries this row's claim. Rendered as a visible link, so a
   *  reader can check the claim rather than take the site's word for it. */
  sourceUrl?: string | null;
  /** THIS field's verification date, never the doc-level one. */
  verifiedOn?: string | null;
  /** Set instead of a claim when the pipeline nulled the value: the operator
   *  contradicts itself, or no operator page carries the policy. */
  reason?: string | null;
}

/**
 * The provenance line under a claim: where it came from and when that field was
 * checked. A claim with no link is a claim a reader cannot check, so this is
 * rendered on every row that states a fact.
 */
export function ClaimLine({ sourceUrl, verifiedOn, reason }: { sourceUrl?: string | null; verifiedOn?: string | null; reason?: string | null }) {
  if (!sourceUrl && !verifiedOn && !reason) return null;
  return (
    <div className="mt-0.5 font-rd text-[11px] text-rd-ink-faint">
      {reason ? <span>{reason} </span> : null}
      {sourceUrl ? (
        <a href={sourceUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
          {claimSourceHost(sourceUrl)} &rsaquo;
        </a>
      ) : null}
      {verifiedOn ? <span>{sourceUrl ? ' · ' : ''}Source read {verifiedOn}</span> : null}
    </div>
  );
}

/** The "Getting in" rows: gates per verified tenant, transit, rideshare,
 *  tailgating, accessibility, entry restrictions. Moved unchanged from the view. */
/** An overlay's own per-field date, formatted like a building claim's. */
function formatOverlayDate(iso: string | undefined): string | null {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(t));
}

export function buildGettingInRows(hub: VenueHub, tenantName: TenantNameResolver): GettingInRow[] {
  const verified = hub.verified;
  const gateTenants = verifiedGateTenants(hub);
  const gettingRows: GettingInRow[] = [];
  // The gates row read the OVERLAY's verified flag and never the doc's, so an
  // unsigned-off building could still publish a gate time while every sibling
  // row stayed dark. Zero instances in today's corpus; latent, not live.
  for (const t of verified ? gateTenants : []) {
    const rule = stripTrailingPeriod(t.gatesOpen!.ruleText!);
    // The variance is rendered ONLY when it adds something the ruleText does not
    // already say. Both used to render unconditionally on 46 pages, which read as
    // the same sentence twice at target-field and barclays-center, while at
    // memorial-stadium-lincoln and chase-field the variance carries premium,
    // student and early-entry detail the ruleText omits. Containment decides.
    const variance =
      t.gateVariance && !isRestatement(rule, t.gateVariance) ? stripTrailingPeriod(t.gateVariance) : null;
    const gateSrc = t.sources?.gatesOpen ?? t.sources?.['gatesOpen.ruleText'] ?? null;
    gettingRows.push({
      label: gateTenants.length > 1 ? `Gates (${tenantName(t)})` : 'Gates',
      body: `${rule}.${variance ? ` ${variance}.` : ''}`,
      sourceUrl: typeof gateSrc === 'string' && gateSrc.startsWith('http') ? gateSrc : null,
      verifiedOn: formatOverlayDate(t.observedAtByField?.gatesOpen),
    });
  }
  // Suppressed buildings name a service a fan cannot use; the row is withheld
  // and the stored text is left untouched (venue-transit-suppression.ts).
  // Provenance and the exclusion list, matching every sibling row and the CFB
  // block. This row was the only one left on the suppression check alone.
  const transitOk =
    verified && !transitSuppressed(hub.slug) && !fieldExcluded(hub.slug, 'transit') && !!hub.publicTransit;
  const transitNotesOk = transitOk && !!hub.publicTransit?.notes && hasSubProvenance(hub.sources, 'publicTransit', 'notes');
  const transitLinesOk = transitOk && (hub.publicTransit?.lines.length ?? 0) > 0 && hasSubProvenance(hub.sources, 'publicTransit', 'lines');
  if (transitNotesOk || transitLinesOk) {
    // Notes AND lines: the lines array used to be swallowed whenever notes
    // existed, leaving named routes ("Metro C Line", "Route 47") dark. The
    // "Lines:" lead-in stays a single fixed word so no template-only 5-gram
    // forms (see audit/venue-thickening-plan.md, 9e discipline).
    const transitParts = [
      transitNotesOk ? hub.publicTransit!.notes : null,
      transitLinesOk ? `Lines: ${hub.publicTransit!.lines.join(', ')}.` : null,
    ].filter(Boolean) as string[];
    gettingRows.push({
      label: 'Transit',
      body: transitParts.join(' '),
      sourceUrl: claimSourceUrl(hub, 'publicTransit'),
      verifiedOn: claimSourceReadOn(hub, 'publicTransit'),
    });
  }
  // Rideshare is the first field to render from the pipeline's per-field state:
  // american-airlines-center's two operator pages name different streets, so the
  // value is nulled and the row explains the absence instead of vanishing.
  const rideshare = claimRow(
    hub,
    'rideshareDropoff',
    verified && !!hub.rideshareDropoff && hasProvenance(hub.sources, 'rideshareDropoff') && !fieldExcluded(hub.slug, 'rideshare'),
  );
  if (rideshare.show) {
    gettingRows.push({ label: 'Rideshare', body: hub.rideshareDropoff!, sourceUrl: rideshare.sourceUrl, verifiedOn: rideshare.verifiedOn });
  } else if (verified && rideshare.reason && !fieldExcluded(hub.slug, 'rideshare')) {
    gettingRows.push({ label: 'Rideshare', body: null, reason: rideshare.reason, sourceUrl: rideshare.sourceUrl });
  }
  const tailgateOk =
    verified && !fieldExcluded(hub.slug, 'tailgating') &&
    (hasSubProvenance(hub.sources, 'tailgating', 'rules') || hasSubProvenance(hub.sources, 'tailgating', 'allowed'));
  if (tailgateOk && hub.tailgating?.allowed === true) {
    // The harvested sub-fields (timeWindow, grillRules, rvPolicy) were typed
    // and populated but never rendered. Each is verbatim per-building prose;
    // periods normalized once here.
    const tg = hub.tailgating;
    const tailBody = [tg.rules || 'Tailgating is permitted in the parking lots.', tg.timeWindow, tg.grillRules, tg.rvPolicy]
      .filter((s): s is string => !!s)
      .map((s) => `${stripTrailingPeriod(s)}.`)
      .join(' ');
    gettingRows.push({ label: 'Tailgating', body: tailBody });
  } else if (tailgateOk && hub.tailgating?.allowed === false) {
    gettingRows.push({ label: 'Tailgating', body: 'Tailgating is not permitted at this venue.' });
  }
  if (verified && hub.accessibility && hasProvenance(hub.sources, 'accessibility') && !fieldExcluded(hub.slug, 'accessibility')) gettingRows.push({ label: 'Accessibility', body: hub.accessibility });
  if (verified && hub.venueAccessRestrictions && hasProvenance(hub.sources, 'venueAccessRestrictions')) gettingRows.push({ label: 'Entry', body: hub.venueAccessRestrictions });

  return gettingRows;
}

/** The overlays whose tailgate window the Plan-your-visit card prints. Lifted
 *  out of VenueHubView so it is reachable by a test: it sits two cards above
 *  the Getting-in card and was publishing what that card withholds. */
export function planYourVisitTailgateTenants(hub: VenueHub): VenueHubTenantOverlay[] {
  // Same gates as the Getting-in Tailgating row: the field's exclusion list and
  // the overlay's own provenance. Without them, yulman-stadium and
  // hard-rock-stadium withheld tailgating on one card for conflict and
  // republished a lot-open time two cards above it, on the same page.
  if (!hub.verified || fieldExcluded(hub.slug, 'tailgating')) return [];
  return hub.tenantOverlays.filter(
    (t) => t.verified && t.tailgateWindow && hasProvenance(t.sources, 'tailgateWindow'),
  );
}

export function GettingInCard({ rows }: { rows: GettingInRow[] }) {
  if (!rows.length) return null;
  return (
    <Card>
      <CardLabel>Getting in</CardLabel>
      <div className="grid grid-cols-1 gap-2.5 font-rd text-[13px] leading-[1.5] text-rd-ink md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <strong>{r.label}.</strong> {r.body}
            <ClaimLine sourceUrl={r.sourceUrl} verifiedOn={r.verifiedOn} reason={r.reason} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ParkingLotsCard({ hub }: { hub: VenueHub }) {
  const verified = hub.verified;
  // Parking lots: the per-lot harvested notes (895 verified values corpus-wide)
  // were dark; only the first 8 lot NAMES surfaced, inside one FAQ sentence.
  // Verbatim per-building prose in the MAIN column (not the twice-rendered
  // rail), each row `{name}. {notes}`. officialParkingUrls links close the card.
  const parkingOff = fieldExcluded(hub.slug, 'parking');
  const lotsOk = verified && !parkingOff && hasProvenance(hub.sources, 'parkingLots') && !subFieldExcluded(hub.slug, 'parking', 'parkingLots');
  // POINTER: a link gates on reachability and the exclusion list, not provenance.
  const linksOk = verified && !parkingOff && !subFieldExcluded(hub.slug, 'parking', 'officialParkingUrls');
  const lotsWithNotes = lotsOk ? hub.parkingLots.filter((l) => l.name) : [];
  const officialUrls = linksOk ? hub.officialParkingUrls.filter(isReachableUrl) : [];
  // Card renders when there is lot prose OR an official link: a doc whose only
  // parking fact is the official page (no per-lot breakdown) still surfaces
  // the link instead of silently dropping the field it exists to render.
  const hasLotContent = lotsWithNotes.some((l) => l.notes) || officialUrls.length > 0;
  if (!(verified && hasLotContent)) return null;
  return (
      <Card>
        <CardLabel>Parking lots</CardLabel>
        {lotsWithNotes.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 font-rd text-[13px] leading-[1.5] text-rd-ink md:grid-cols-2">
            {lotsWithNotes.slice(0, 12).map((l) => (
              <div key={l.name}>
                <strong>{l.name}.</strong>
                {l.notes ? <> {l.notes}</> : null}
              </div>
            ))}
          </div>
        ) : null}
        <ClaimLine
          sourceUrl={lotsWithNotes.length > 0 ? claimSourceUrl(hub, 'parkingLots') : null}
          verifiedOn={lotsWithNotes.length > 0 ? claimSourceReadOn(hub, 'parkingLots') : null}
        />
        {officialUrls.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-rd text-[11px]">
            <span className="text-rd-ink-soft">Official parking:</span>
            {officialUrls.slice(0, 3).map((u) => (
              <a
                key={u}
                href={u}
                className="font-semibold text-rd-red"
                target="_blank"
                rel="noopener noreferrer"
              >
                {new URL(u).hostname.replace(/^www\./, '')} &rsaquo;
              </a>
            ))}
          </div>
        ) : null}
      </Card>
  );

}

export function FoodCard({ hub }: { hub: VenueHub }) {
  if (!(hub.verified && hub.food && hasProvenance(hub.sources, 'food') && !fieldExcluded(hub.slug, 'food'))) return null;
  return (
      <Card>
        <CardLabel>Food worth the line</CardLabel>
        <p className="font-rd text-[13px] leading-relaxed text-rd-ink">{hub.food}</p>
      </Card>
  );
}

export function NearbyCard({ hub }: { hub: VenueHub }) {
  if (!(hub.verified && hub.nearby && hasProvenance(hub.sources, 'nearby') && !fieldExcluded(hub.slug, 'nearby'))) return null;
  return (
      <Card>
        <CardLabel>In the neighborhood</CardLabel>
        <p className="font-rd text-[13px] leading-relaxed text-rd-ink">{hub.nearby}</p>
      </Card>
  );
}

/** The bag capsule card. `hasBagFaq` is the view's wider gate (a policy URL
 *  alone is enough to send the reader somewhere); the view computes it and
 *  passes it in so the card and the FAQ stay on one gate. */
export function BagCard({ hub, hasBagFaq }: { hub: VenueHub; hasBagFaq: boolean }) {
  if (!hasBagFaq) return null;
  // Same rule as the FAQ: the capsule states a bag fact, so each fact it can
  // state needs its own provenance.
  const cap = bagCapsule({
    bagMaxDimensions: hasProvenance(hub.sources, 'bagMaxDimensions') ? hub.bagMaxDimensions : null,
    clearBagRequired: hasProvenance(hub.sources, 'clearBagRequired') ? hub.clearBagRequired : null,
    bagsProhibited: hasProvenance(hub.sources, 'bagsProhibited') ? hub.bagsProhibited : null,
  });
  // Sub-field gate, same omission the parking FAQ had: notes were withheld
  // nowhere despite an entry naming them.
  const bagNotesOk = !!hub.bagPolicyNotes && hasProvenance(hub.sources, 'bagPolicyNotes')
    && !subFieldExcluded(hub.slug, 'bag', 'notes');
  const bagSplit = bagNotesOk ? leadSentences(hub.bagPolicyNotes!, 2) : { lead: '', overflow: '' };
  const noOutsideFood =
    hub.verified && hub.outsideFoodAllowed === false && !fieldExcluded(hub.slug, 'outsideFood') &&
    (hasProvenance(hub.sources, 'outsideFoodAllowed') || hasProvenance(hub.sources, 'outsideFoodRules'));
  // POINTER: the venue's own policy page. Reachability, not provenance.
  const bagPolicyLink = isReachableUrl(hub.bagPolicyUrl) && !fieldExcluded(hub.slug, 'bag') ? hub.bagPolicyUrl : null;
  const clearBagState = claimState(hub, 'clearBagRequired');
  const clearBagReason =
    clearBagState === 'operator-conflict' || clearBagState === 'no-operator-page'
      ? CLAIM_STATE_REASON[clearBagState]
      : null;
  const clearBagReasonUrl = clearBagState === 'operator-conflict' ? bagPolicyLink : null;
  return (
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
          <ClaimLine
            sourceUrl={bagSplit.lead ? claimSourceUrl(hub, 'bagPolicyNotes') ?? claimSourceUrl(hub, 'bagMaxDimensions') : null}
            verifiedOn={bagSplit.lead ? claimSourceReadOn(hub, 'bagPolicyNotes') ?? claimSourceReadOn(hub, 'bagMaxDimensions') : null}
          />
          {/* The clear-bag question renders its own row when the pipeline nulled
              the answer: bridgestone-arena's operator says one thing in its bag
              policy and another in its screening section, so the page says so
              and points at the operator rather than staying silent. */}
          {clearBagReason ? (
            <div className="mt-1 font-rd text-[11px] text-rd-ink-faint">
              <strong className="text-rd-ink">Clear bag.</strong> {clearBagReason}{' '}
              {clearBagReasonUrl ? (
                <a href={clearBagReasonUrl} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                  {claimSourceHost(clearBagReasonUrl)} &rsaquo;
                </a>
              ) : null}
            </div>
          ) : null}
          {bagPolicyLink ? (
            <div className="mt-1 text-[11px]">
              <a href={bagPolicyLink} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                Official bag policy &rsaquo;
              </a>
            </div>
          ) : null}
          {/* The MLB comparison layer: the venue corpus's fourth inbound link
              (aggregator plan Build 2). MLB buildings only; other leagues have
              no bag aggregator yet. */}
          {hub.tenants.some((t) => t.league === 'MLB') ? (
            <div className="mt-1 text-[11px]">
              <Link href="/venues/bag-policies" className="font-semibold text-rd-ink-soft transition-colors hover:text-rd-red">
                Compare every MLB ballpark&apos;s bag policy &rsaquo;
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** Every logistics card in the venue-page order, for pages other than the
 *  venue page. Light tone only for now; the cards are the same components the
 *  venue page mounts one by one. */
/**
 * The fact-band bag chip, as ONE gated decision.
 *
 * This existed as three separate reads inside VenueHubView: the dimensions were
 * provenance-scrubbed, and the CHIP LABEL and the prohibition were not, so a
 * building with sourced dimensions and an unsourced clear-bag flag published a
 * "CLEAR BAG" claim that the same component withheld from its own FAQ. Live on
 * hard-rock-stadium until 2026-08-29. The label is a claim about the building
 * exactly as much as the number is, and it gets the same gate.
 */
export function bagChipFor(hub: VenueHub): { k: string; v: string } | null {
  if (!hub.verified || fieldExcluded(hub.slug, 'bag')) return null;
  const s = hub.sources;
  const dims = hasProvenance(s, 'bagMaxDimensions') ? dimsString(hub.bagMaxDimensions) : null;
  if (dims) {
    const clear = hasProvenance(s, 'clearBagRequired') && hub.clearBagRequired === true;
    return { k: clear ? 'CLEAR BAG' : 'MAX BAG', v: dims };
  }
  if (hasProvenance(s, 'bagsProhibited') && hub.bagsProhibited === true) {
    return { k: 'BAGS', v: 'Not allowed' };
  }
  return null;
}

export function VenueLogisticsBlock({ hub, tenantName = (t) => t.displayName }: { hub: VenueHub; tenantName?: TenantNameResolver }) {
  const verified = hub.verified;
  const hasBag =
    verified &&
    (hub.bagMaxDimensions !== null || hub.clearBagRequired !== null || hub.bagsProhibited === true
      // Notes count toward "has a bag policy" only if they would actually
      // render; an excluded sub-field must not open a card it cannot fill.
      || (!!hub.bagPolicyNotes && !subFieldExcluded(hub.slug, 'bag', 'notes')));
  const hasBagFaq = hasBag || (verified && !!hub.bagPolicyUrl);
  const rows = buildGettingInRows(hub, tenantName);
  return (
    <>
      <BagCard hub={hub} hasBagFaq={hasBagFaq} />
      <GettingInCard rows={rows} />
      <ParkingLotsCard hub={hub} />
      <FoodCard hub={hub} />
      <NearbyCard hub={hub} />
    </>
  );
}

/** The condensed logistics block: one line per provenanced field, verbatim
 *  from the hub, with a link to the full guide for depth. Dark tone for the
 *  CFB pages; the label colour reads --cfb-accent when the page sets it and
 *  falls back to the hub gold elsewhere, so a pro page can mount it as is.
 *  The caller decides the minimum (CONDENSED_MIN_FIELDS) and passes the lines. */
export function CondensedLogisticsBlock({
  lines,
  guideHref,
  venueName,
}: {
  lines: CondensedLine[];
  guideHref: string;
  venueName: string;
}) {
  if (!lines.length) return null;
  const MONO = 'var(--font-mono), ui-monospace, monospace';
  const SANS = 'var(--font-outfit-sans), system-ui, sans-serif';
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0c0b12', border: '1px solid rgba(255,255,255,0.06)' }}>
      <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
        {lines.map((l) => (
          <div key={l.key}>
            <dt className="text-[10px] uppercase" style={{ fontFamily: MONO, letterSpacing: '0.12em', color: 'var(--cfb-accent, #FFB71E)' }}>{l.label}</dt>
            <dd className="mt-0.5 text-[13.5px] leading-relaxed text-white/70" style={{ fontFamily: SANS }}>
              {l.text}
              {l.href && l.hrefLabel ? (
                <>
                  {' '}
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-white/85 underline-offset-2 hover:underline">
                    {l.hrefLabel} &rsaquo;
                  </a>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px]" style={{ fontFamily: SANS }}>
        <Link href={guideHref} className="font-bold" style={{ color: 'var(--cfb-accent, #FFB71E)' }}>
          Full gameday guide for {venueName} &rarr;
        </Link>
      </p>
    </div>
  );
}
