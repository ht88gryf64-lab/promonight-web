// Vendor direction (owner ruling 2026-11-08): when an operator's parking page names
// no lots and directs fans to a vendor (SpotHero, SacPark, Parking OKC), the pipeline
// stores it as `parkingNotes` { vendor, quote } and leaves parkingLots empty. The
// Before you go row, the venue page's parking card and the quick-facts card all print
// this one sentence, built here, so the three surfaces cannot disagree.
// Dependency-free: imported by server and client renders alike.

export interface ParkingNotes {
  /** The vendor's name as the operator's page prints it (visible text, link labels included). */
  vendor: string;
  /** The operator page's verbatim sentence that carries the direction (provenance; not printed). */
  quote: string;
}

/** A stored value of the right shape, else null. */
export function parseParkingNotes(v: unknown): ParkingNotes | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const vendor = typeof o.vendor === 'string' ? o.vendor.trim() : '';
  const quote = typeof o.quote === 'string' ? o.quote.trim() : '';
  return vendor && quote ? { vendor, quote } : null;
}

/** "No venue lots; {Arena} directs fans to {vendor}." */
export function vendorParkingSentence(arena: string, vendor: string): string {
  return `No venue lots; ${arena} directs fans to ${vendor}.`;
}
