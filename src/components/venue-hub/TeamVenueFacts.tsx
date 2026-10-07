import type { ReactNode } from 'react';
import { IconClock } from '@tabler/icons-react';
import { displayVenueName, type VenueHub } from '@/lib/venue-hub';
import {
  bagGates,
  bagCardModel,
  buildGettingInRows,
  parkingLotsModel,
  publishedNearby,
  ClaimLine,
} from './venue-logistics';

// The team page's game-day facts, read from the building's venueHubs published
// view: the same object /venues/[slug] renders, through the same decisions
// (bagGates, bagCardModel, buildGettingInRows, parkingLotsModel,
// publishedNearby). It replaces VenueInfoBlock, which read the provenance-free
// `venues` prose, so a team page and its venue page said different things about
// one building (Matt, 2026-10-07).
//
// Every row is self-gating: a field the view withholds is a row that does not
// exist, never a placeholder. A building with nothing published renders null.
//
// The layout is the rail's, not the venue page's: one column, because on
// desktop this sits in the 336px team-page sidebar, where the venue cards'
// two-column grids would not fit. The words are the venue page's.
//
// GATES ARE THIS TEAM'S ONLY. A shared building lists a gate rule per tenant;
// the Timberwolves page has no use for the Lynx's doors. Filtering the overlays
// to this team leaves buildGettingInRows labelling the row plain "Gates", the
// label the venue page uses when a building has one tenant.

type Row = { label: string; body: ReactNode };

export function teamVenueRows(hub: VenueHub, teamId: string): Row[] {
  if (!hub.verified) return [];
  const forTeam: VenueHub = { ...hub, tenantOverlays: hub.tenantOverlays.filter((t) => t.teamId === teamId) };
  const rows: Row[] = [];

  const bag = bagCardModel(forTeam, bagGates(forTeam).hasBagFaq);
  if (bag) {
    // The capsule's own words in sentence case ("CLEAR BAG REQUIRED" over a
    // size on the venue page). With no size and no rule, the capsule's figure is
    // the bare words "Bag policy", which states nothing, so it is left out.
    const capLabel = bag.cap.label.charAt(0) + bag.cap.label.slice(1).toLowerCase();
    const capText = bag.cap.dims ? `${capLabel}: ${bag.cap.dims}` : bag.cap.bigText === 'Bag policy' ? null : bag.cap.bigText;
    rows.push({
      label: 'Bag policy',
      body: (
        <>
          {capText ? <><span className="font-semibold text-rd-ink">{capText}.</span>{' '}</> : null}
          {bag.lead ? <span>{bag.lead}</span> : <span>Review the official bag policy before you arrive.</span>}
          {bag.noOutsideFood ? <> <strong>No outside food or drink.</strong></> : null}
          <ClaimLine sourceUrl={bag.sourceUrl} verifiedOn={bag.verifiedOn} />
          {bag.clearBagReason ? (
            <div className="mt-1 font-rd text-[11px] text-rd-ink-faint">
              <strong className="text-rd-ink">Clear bag.</strong> {bag.clearBagReason}
            </div>
          ) : null}
          {bag.policyLink ? (
            <div className="mt-1 text-[11px]">
              <a href={bag.policyLink} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                Official bag policy &rsaquo;
              </a>
            </div>
          ) : null}
        </>
      ),
    });
  }

  // The resolver only matters for a multi-tenant gate label, which the filter
  // above rules out; the overlay's own name is enough.
  for (const r of buildGettingInRows(forTeam, (t) => t.displayName)) {
    rows.push({
      label: r.label,
      body: (
        <>
          {r.body}
          <ClaimLine sourceUrl={r.sourceUrl} verifiedOn={r.verifiedOn} reason={r.reason} />
        </>
      ),
    });
  }

  const parking = parkingLotsModel(forTeam);
  if (parking) {
    rows.push({
      label: 'Parking',
      body: (
        <>
          {parking.lots.length > 0 ? (
            <ul className="space-y-1.5">
              {parking.lots.map((l) => (
                <li key={l.name}>
                  <strong className="text-rd-ink">{l.name}.</strong>
                  {l.notes ? <> {l.notes}</> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <ClaimLine sourceUrl={parking.sourceUrl} verifiedOn={parking.verifiedOn} />
          {parking.officialUrls.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-rd text-[11px]">
              <span className="text-rd-ink-soft">Official parking:</span>
              {parking.officialUrls.map((u) => (
                <a key={u} href={u} className="font-semibold text-rd-red" target="_blank" rel="noopener noreferrer">
                  {new URL(u).hostname.replace(/^www\./, '')} &rsaquo;
                </a>
              ))}
            </div>
          ) : null}
        </>
      ),
    });
  }

  const nearby = publishedNearby(forTeam);
  if (nearby) rows.push({ label: 'Nearby', body: nearby });

  return rows;
}

export function TeamVenueFacts({ hub, teamId }: { hub: VenueHub; teamId: string }) {
  const rows = teamVenueRows(hub, teamId);
  // A labelled box with nothing in it reads as a failure, not as restraint.
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <IconClock size={13} stroke={2.25} className="text-rd-ink-faint" />
        <h3 className="font-rd text-[11px] font-normal uppercase tracking-[0.14em] text-rd-ink-faint">
          Game day at {displayVenueName(hub.name)}
        </h3>
      </div>
      <div className="bg-rd-card border border-rd-line rounded-2xl divide-y divide-rd-line">
        {rows.map((row) => (
          <div key={row.label} className="px-5 py-4">
            <div className="font-rd text-[10px] uppercase tracking-wide text-rd-ink-faint">{row.label}</div>
            <div className="mt-1 text-rd-ink-soft text-sm leading-relaxed">{row.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
