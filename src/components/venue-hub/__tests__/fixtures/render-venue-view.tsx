// One fixed render of VenueHubView for a published hub: no ticket team, no
// tenant links, no promos, no vendors, no postseason. Those inputs come from
// other collections and are held constant so a markup difference can only come
// from the hub itself. Used by the baseline builder and the byte-identity test.
import { renderToStaticMarkup } from 'react-dom/server';
import { VenueHubView } from '../../VenueHubView';
import type { VenueHub } from '../../../../lib/venue-hub';

export function renderVenueView(hub: VenueHub): string {
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
