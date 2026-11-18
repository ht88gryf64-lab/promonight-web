// One fixed render of VenueHubView for a published hub: no ticket team, no
// tenant links, no promos, no vendors, no postseason. Those inputs come from
// other collections and are held constant so a markup difference can only come
// from the hub itself. Used by the baseline builder and the byte-identity test.
import { renderToStaticMarkup } from 'react-dom/server';
import { VenueHubView } from '../../VenueHubView';
import type { VenueHub } from '../../../../lib/venue-hub';

/** The zero-size anchor an event stop page links to (/venues/{slug}#parking),
 *  added to the parking card on 2026-11-18 (events Phase 2C). It is the ONE
 *  named addition since the baselines were cut: renderVenueView removes
 *  exactly this string, so "identical to main" keeps its literal meaning for
 *  everything else, and venue-parking-anchor.test.tsx pins the anchor itself
 *  (present once wherever the parking card renders, absent otherwise). */
export const PARKING_ANCHOR = '<span id="parking" class="block scroll-mt-24"></span>';

/** The markup exactly as rendered, anchor included. */
export function renderVenueViewRaw(hub: VenueHub): string {
  return renderToStaticMarkup(
    <VenueHubView
      hub={hub}
      canonicalUrl={`https://www.getpromonight.com/venues/${hub.slug}`}
      ticketTeam={null}
      tenantLinks={[]}
      weekPromos={[]}
      nextGiveaways={[]}
      vendors={[]}
    />,
  );
}

export function renderVenueView(hub: VenueHub): string {
  return renderVenueViewRaw(hub).split(PARKING_ANCHOR).join('');
}
