// The tenant-overlay mapping getVenueHub applies (src/lib/venue-hub.ts), for
// the fixture builder, which maps a Firestore dump without a db handle.
// Keep in step with getVenueHub's tSnap.docs.map.
import { fieldStateMap, type VenueHubTenantOverlay } from '../../../../lib/venue-hub';

function stringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 0) { out[k] = val; continue; }
    if (Array.isArray(val)) {
      const first = val.find((u): u is string => typeof u === 'string' && u.length > 0);
      if (first) out[k] = first;
    }
  }
  return out;
}

export function overlayFromDoc(t: Record<string, any>): VenueHubTenantOverlay {
  return {
    teamId: t.teamId,
    league: t.league,
    displayName: t.displayName ?? t.teamId,
    gatesOpen: t.gatesOpen ?? null,
    gateVariance: t.gateVariance ?? null,
    tailgateWindow: t.tailgateWindow ?? null,
    bagPolicyException: t.bagPolicyException ?? null,
    verified: t.verified === true,
    sources: stringMap(t.sources),
    observedAtByField: stringMap(t.observedAtByField),
    fieldStates: fieldStateMap(t.fieldStates),
  };
}
