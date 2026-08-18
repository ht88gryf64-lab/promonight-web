// /venues/bag-policies Firestore loader: the 30 MLB ballpark rows. Server
// module (imports the admin SDK); every pure derivation lives in
// venue-bag-policies.ts so tests can import it without the server-only guard.

import { cache } from 'react';
import { db } from '@/lib/firebase';
import { getAllTeams } from '@/lib/data';
import { teamDisplayName } from '@/lib/promo-helpers';
import { dimsString, type BagMaxDimensions } from '@/lib/venue-hub';
import { parseClutch, SOURCES_CONFLICT_SLUGS, type BagPolicyRow } from '@/lib/venue-bag-policies';

// ── the Firestore read (30 MLB buildings + tenant overlays + team join) ─────
export const getMlbBagPolicyRows = cache(async (): Promise<BagPolicyRow[]> => {
  const [snap, teams] = await Promise.all([db.collection('venueHubs').get(), getAllTeams()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const rows: BagPolicyRow[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const mlbTenant = (Array.isArray(d.tenants) ? d.tenants : []).find(
      (t: { league?: string }) => t.league === 'MLB',
    );
    if (!mlbTenant) continue;
    // Corpus rule (venue-hub.ts): facts publish only from verified buildings.
    // All 30 MLB buildings are verified today; this is the future-data gate.
    if (d.verified !== true) continue;

    // MLB tenant overlay: the bagPolicyException prose feeds the clutch chip.
    const overlaySnap = await db.collection('venueHubs').doc(doc.id).collection('tenants').get();
    const overlay = overlaySnap.docs
      .map((t) => t.data())
      .find((t) => t.league === 'MLB' && t.verified === true); // verified overlays only, like VenueHubView

    const team = teamById.get(mlbTenant.teamId);
    const sourcesConflict = SOURCES_CONFLICT_SLUGS.includes(doc.id);
    const dims: BagMaxDimensions | null = sourcesConflict ? null : (d.bagMaxDimensions ?? null);
    const dimsText = dims ? prettyDims(dims) : null;

    rows.push({
      slug: doc.id,
      venueName: String(d.name ?? doc.id),
      teamName: team ? teamDisplayName(team) : mlbTenant.teamId,
      teamColor: team?.primaryColor ?? null,
      clearBagRequired: sourcesConflict ? null : typeof d.clearBagRequired === 'boolean' ? d.clearBagRequired : null,
      dims,
      dimsText,
      bagsProhibited: sourcesConflict ? null : typeof d.bagsProhibited === 'boolean' ? d.bagsProhibited : null,
      bagPolicyUrl: typeof d.bagPolicyUrl === 'string' && URL.canParse(d.bagPolicyUrl) ? d.bagPolicyUrl : null,
      clutch: sourcesConflict ? null : parseClutch([overlay?.bagPolicyException, d.bagPolicyNotes], dimsText),
      sourcesConflict,
    });
  }
  return rows;
});

/** Mockup dimension formatting (12″ × 12″ × 6″), from the same structured field
 *  dimsString reads; prime marks and multiplication signs are presentation. */
export function prettyDims(dims: BagMaxDimensions): string | null {
  const plain = dimsString(dims);
  if (!plain) return null;
  return plain
    .split(' x ')
    .map((p) => p.replace('"', '″').replace('cm', ' cm'))
    .join(' × ');
}
