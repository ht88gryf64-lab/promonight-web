/**
 * POST /api/indexnow/submit
 *
 * Called by the promo-pipeline repo after it regenerates Firestore data so
 * Bing/Yandex/ChatGPT Search see changed URLs quickly.
 *
 * Auth:   header `x-indexnow-secret: <INDEXNOW_SUBMIT_SECRET>`
 * Body:   { "urls": ["https://www.getpromonight.com/mlb/minnesota-twins", ...] }
 * Rules:
 *   - All URLs must be on host www.getpromonight.com (400 otherwise)
 *   - Up to 10,000 URLs per request (larger batches are chunked server-side)
 *   - Returns { ok: true, submitted: <count> }; IndexNow delivery is
 *     best-effort — network/IndexNow errors are logged but do not fail the
 *     request (see submitToIndexNow).
 */
import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.INDEXNOW_SUBMIT_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('x-indexnow-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: { urls?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  if (!Array.isArray(payload.urls) || !payload.urls.every((u) => typeof u === 'string')) {
    return NextResponse.json(
      { ok: false, reason: 'urls_must_be_string_array' },
      { status: 400 },
    );
  }
  const urls = payload.urls as string[];

  try {
    await submitToIndexNow(urls);
  } catch (err) {
    // submitToIndexNow only throws on client-side validation (bad host/URL).
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: 'invalid_url', message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, submitted: urls.length });
}
