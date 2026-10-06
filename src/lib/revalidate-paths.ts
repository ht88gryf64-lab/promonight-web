// The site's one revalidation fan-out: the path check and the revalidatePath
// loop behind POST /api/revalidate, which the pipeline's after-write calls and
// the nightly refresh cron (WEB6 G4) both go through. Call it only from a
// request whose job is to revalidate: Next applies revalidatePath when that
// request finishes, so the same request cannot also warm the new copies.
import { revalidatePath } from 'next/cache';

// One to THREE segments, lowercase alphanumeric and hyphen only, no trailing
// slash. Widened from two to three for /cfb/rivalries/<slug>. The charset is
// unchanged, so uppercase, underscores, dots and query strings still fail, and
// the bare root "/" is rejected by design. The pipeline keeps its own copy of
// this pattern in promo-pipeline/lib/revalidate-notify.js; both must be widened
// together or the client silently drops paths this endpoint would accept.
export const PATH_RE = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}$/;

export interface RevalidateResult {
  /** Paths revalidatePath accepted. */
  succeeded: number;
  /** Paths whose revalidatePath call threw (logged, never fatal). */
  failed: string[];
}

/** Revalidates each path, best-effort: a failure is logged and counted, never
 *  thrown. Callers validate against PATH_RE first. `revalidate` is injectable
 *  for tests. */
export function revalidatePaths(
  paths: readonly string[],
  revalidate: (path: string) => void = revalidatePath,
  tag = 'revalidate',
): RevalidateResult {
  const failed: string[] = [];
  let succeeded = 0;
  for (const p of paths) {
    try {
      revalidate(p);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[${tag}] failed for ${p}: ${message}`);
      failed.push(p);
    }
  }
  return { succeeded, failed };
}
