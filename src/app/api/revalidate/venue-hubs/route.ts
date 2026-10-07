/**
 * POST /api/revalidate/venue-hubs
 *
 * Called by the venue pipeline after each venueHubs write (building fields,
 * tenants or vendors), once per batch, naming the buildings it wrote. The
 * contract the pipeline follows is in ~/promonight/handoffs/HANDOFF-venue-data.md
 * ("Website refresh after a write").
 *
 * The caller names BUILDINGS, not paths: which pages show a building is the
 * website's knowledge (src/lib/venue-hub-revalidate.ts), and a pipeline that
 * derived team paths itself would drift the first time a page started showing
 * hub facts. For each slug this revalidates the venue page, /venues, the MLB
 * bag comparison for an MLB building, and every tenant team or school page,
 * then pings IndexNow for the venue page (when indexable) and those team pages.
 *
 * Auth:   header `x-revalidate-secret: <REVALIDATE_SECRET>` (the same secret
 *         as /api/revalidate)
 * Body:   { "slugs": ["target-field", "xcel-energy-center"] }
 * Rules:
 *   - 1 to 25 slugs, each lowercase letters, digits and single hyphens. One bad
 *     slug fails the whole batch (400), like /api/revalidate.
 *   - A slug with no venueHubs doc is not an error: its page and /venues are
 *     still refreshed (so a removed building stops rendering), and it is listed
 *     under `unknown`.
 * Returns { ok: true, slugs, unknown, revalidated, failed, paths, indexNow }.
 *
 * TIMING. Next applies revalidatePath after this request completes, and the
 * IndexNow ping is sent from after(), once the response is out, so a crawler
 * that follows the ping promptly asks for a page whose cache entry is already
 * stale. The /venues index and the team-page hub link read a process cache with
 * a five-minute TTL (src/lib/collection-cache.ts); the facts themselves (venue
 * page, team page, vendors) are read uncached and are fresh on the first
 * request after this one.
 */
import { NextResponse, after } from 'next/server';
import { revalidatePaths } from '@/lib/revalidate-paths';
import { getVenueHub, resolveTenantTeamLinks, venueHubIsIndexable } from '@/lib/venue-hub';
import { HUB_SLUG_RE, hubRevalidationPlan } from '@/lib/venue-hub-revalidate';
import { submitToIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SLUGS = 25;

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: { slugs?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  if (!Array.isArray(payload.slugs) || !payload.slugs.every((s) => typeof s === 'string')) {
    return NextResponse.json({ ok: false, reason: 'slugs_must_be_string_array' }, { status: 400 });
  }
  const slugs = [...new Set(payload.slugs as string[])];
  if (slugs.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no_slugs' }, { status: 400 });
  }
  if (slugs.length > MAX_SLUGS) {
    return NextResponse.json({ ok: false, reason: 'too_many_slugs', max: MAX_SLUGS }, { status: 400 });
  }
  const bad = slugs.find((s) => !HUB_SLUG_RE.test(s));
  if (bad !== undefined) {
    return NextResponse.json({ ok: false, reason: 'invalid_slug', slug: bad }, { status: 400 });
  }

  const paths = new Set<string>();
  const indexNow = new Set<string>();
  const unknown: string[] = [];
  for (const slug of slugs) {
    const hub = await getVenueHub(slug);
    if (!hub) unknown.push(slug);
    const tenantHrefs = hub ? (await resolveTenantTeamLinks(hub)).map((l) => l.href) : [];
    const plan = hubRevalidationPlan({ slug, hub, indexable: hub ? venueHubIsIndexable(hub) : false, tenantHrefs });
    plan.paths.forEach((p) => paths.add(p));
    plan.indexNowUrls.forEach((u) => indexNow.add(u));
  }

  const list = [...paths];
  console.log(`[revalidate/venue-hubs] slugs=${slugs.length} paths=${list.length} unknown=${unknown.length}`);
  const { succeeded, failed } = revalidatePaths(list, undefined, 'revalidate/venue-hubs');

  const urls = [...indexNow];
  after(async () => {
    try {
      await submitToIndexNow(urls);
    } catch (err) {
      console.warn(`[revalidate/venue-hubs] indexnow: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return NextResponse.json({
    ok: true,
    slugs,
    unknown,
    revalidated: succeeded,
    failed,
    paths: list,
    indexNow: urls.length,
  });
}
