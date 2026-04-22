/**
 * POST /api/revalidate
 *
 * Called by the promo-pipeline repo immediately after it writes new content
 * to Firestore. Flushes the Next.js ISR cache for affected paths so fans see
 * fresh data without waiting for the natural revalidate window (1h hub /
 * 6h team page).
 *
 * Auth:   header `x-revalidate-secret: <REVALIDATE_SECRET>`
 * Body:   { "paths": ["/playoffs", "/nba/minnesota-timberwolves", ...] }
 * Rules:
 *   - Each path must match `/[a-z0-9-]+(?:/[a-z0-9-]+)?` exactly. No query
 *     strings, no parent traversal, no uppercase.
 *   - Up to 100 paths per request (rejects with 400 above the cap).
 *   - Returns { ok: true, revalidated: <count> }.
 *   - revalidatePath is best-effort; failures for individual paths are logged
 *     and counted but never fail the whole request.
 *
 * Example:
 *   curl -X POST https://www.getpromonight.com/api/revalidate \
 *     -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"paths":["/playoffs","/nba/minnesota-timberwolves"]}'
 *
 * The secret value is never logged.
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH_RE = /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/;
const MAX_PATHS = 100;

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: { paths?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  if (!Array.isArray(payload.paths) || !payload.paths.every((p) => typeof p === 'string')) {
    return NextResponse.json(
      { ok: false, reason: 'paths_must_be_string_array' },
      { status: 400 },
    );
  }

  const rawPaths = payload.paths as string[];
  if (rawPaths.length === 0) {
    return NextResponse.json({ ok: true, revalidated: 0 });
  }
  if (rawPaths.length > MAX_PATHS) {
    return NextResponse.json(
      { ok: false, reason: 'too_many_paths', max: MAX_PATHS },
      { status: 400 },
    );
  }

  // Dedupe + strict validation. One bad path fails the whole batch so
  // problems surface immediately instead of being silently dropped.
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const p of rawPaths) {
    if (seen.has(p)) continue;
    if (!PATH_RE.test(p)) {
      return NextResponse.json(
        { ok: false, reason: 'invalid_path', path: p },
        { status: 400 },
      );
    }
    seen.add(p);
    paths.push(p);
  }

  console.log(`[revalidate] request received, paths=${paths.length}`);

  let succeeded = 0;
  for (const p of paths) {
    try {
      revalidatePath(p);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[revalidate] failed for ${p}: ${message}`);
    }
  }

  console.log(`[revalidate] revalidated ${succeeded}/${paths.length}`);
  return NextResponse.json({ ok: true, revalidated: succeeded });
}
