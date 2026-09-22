import 'server-only';

// ── Process-local TTL cache for the STATIC Firestore collections ─────────────
//
// Lifted verbatim out of src/lib/cfb/data.ts, where it was written for the /cfb
// build and proved out on 87 pages. It is generic and the pro side needs the
// same thing for the same reason, so it lives here now and CFB imports it.
//
// THE PROBLEM IT SOLVES. React cache() dedupes a read inside ONE page render
// (generateMetadata + the page body). It resets between pages, so during SSG a
// 520-page build pays a full-collection read per page for anything the layout
// touches. getAllTeams() was that read: 169 docs on every render of every
// route, because the root layout's coverage counts call it. A build paid it
// ~520 times. This layer reuses one read ACROSS pages within a build.
//
// THE TTL IS SHORT ON PURPOSE. Five minutes, the same value and the same
// reasoning as the CFB layer it came from: a longer TTL breaks on-demand
// revalidation. The scanner writes, POSTs /api/revalidate, Next re-renders the
// path, and a long-lived cache hands the render the same stale collection, so
// the regenerated page comes out byte-identical to the one it replaced. Five
// minutes bounds that lag. The cost is one collection read per server instance
// per five minutes under traffic, which is nothing.
//
// WHAT MAY USE IT. Only collections that change on a human/deploy cadence:
// teams, venues, teamScores, venueHubs, tenants. NOT promos, games or
// playoffPromos — those are what the scanners write and what the revalidate
// hook exists to surface, so they stay uncached and are read fresh every time.
export const STATIC_TTL_MS = 5 * 60 * 1000;

/**
 * Wraps a collection read in a process-local TTL cache with in-flight
 * coalescing, so a build's page fan-out issues ONE read rather than N.
 *
 * A build is a short-lived process that starts with an empty cache, so this
 * never serves data stale across builds. Under a long-lived server instance
 * the TTL is the only staleness bound; see the note above for why it is short.
 */
export function makeCollectionLoader<T>(read: () => Promise<T>): () => Promise<T> {
  let cached: { at: number; data: T } | null = null;
  let inflight: Promise<T> | null = null;
  return async () => {
    // Firestore emulator/prod clock only; Date.now() is fine at runtime (this
    // module never executes inside a Workflow script sandbox).
    if (cached && Date.now() - cached.at < STATIC_TTL_MS) return cached.data;
    if (inflight) return inflight; // coalesce concurrent first-callers (build fan-out)
    inflight = (async () => {
      try {
        const data = await read();
        cached = { at: Date.now(), data };
        return data;
      } finally {
        // THE `finally` IS LOAD-BEARING, and it is the one change from the CFB
        // original. Clearing `inflight` only on success means a single rejected
        // read is latched forever: `cached` stays null, so every later call
        // falls through to `return inflight` and re-throws the SAME rejected
        // promise, and `read()` is never retried. On the CFB module that could
        // brick 87 pages. Here `teams` is loaded by the root layout on every
        // route, so one transient UNAVAILABLE on a cold instance would 500
        // every page that instance served until it was recycled, and one flaky
        // read mid-build would fail every remaining page instead of one.
        inflight = null;
      }
    })();
    return inflight;
  };
}

/** A cached collection document: what `doc.id` / `doc.data()` gave the callers
 *  that used to hold a live QuerySnapshot. Loaders preserve Firestore's default
 *  `__name__` ascending document order, which several callers depend on for
 *  first-wins / last-wins joins. */
export interface CachedDoc {
  id: string;
  data: FirebaseFirestore.DocumentData;
}

/** A cached collection-GROUP document, carrying the parent doc id so callers do
 *  not need a live DocumentReference to reach `.ref.parent.parent!.id`. */
export interface CachedGroupDoc extends CachedDoc {
  /** Id of the grandparent document (e.g. the venueHubs slug for a tenant). */
  parentId: string;
}
