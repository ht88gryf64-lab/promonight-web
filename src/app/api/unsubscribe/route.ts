/**
 * /api/unsubscribe?token=<manageToken>
 *
 * Sets the matching subscriber to `unsubscribed`. The weekly send (Phase C)
 * iterates confirmed subscribers only, so this removes them from all future
 * sends. Idempotent.
 *
 * - GET  NEVER mutates. Mail-security gateways and link scanners (Proofpoint,
 *   Mimecast, Defender Safe Links, etc.) prefetch every in-body URL on
 *   delivery, so a write-on-GET would silently unsubscribe users. GET only
 *   redirects to the preferences page, which surfaces a one-click confirm.
 * - POST flips status to unsubscribed and returns JSON. Used by the preferences
 *   confirm button and the RFC 8058 List-Unsubscribe one-click handler (token
 *   in the query string).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { unsubscribeByManageToken } from '@/lib/subscribers';
import { MANAGE_COOKIE } from '@/lib/manage-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * THE QUERY-STRING TOKEN ON THIS ROUTE IS AN RFC 8058 REQUIREMENT. DO NOT
 * "CLEAN IT UP" TO MATCH /api/preferences.
 *
 * Everything else on this branch moved the manage token out of URLs and into an
 * httpOnly cookie. This one endpoint cannot follow, because its caller is not a
 * browser. `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (src/lib/email.ts)
 * makes Gmail, Yahoo and Apple Mail POST to the `List-Unsubscribe` URL directly,
 * server to server, with no cookie jar and no session. Requiring a cookie here
 * would silently break one-click unsubscribe, which is a CAN-SPAM problem and a
 * bulk-sender-requirements problem that shows up as a deliverability collapse
 * long before anyone notices the button stopped working.
 *
 * It is an acceptable exception on the merits, not just by necessity: this
 * endpoint is single-purpose, idempotent, and discloses nothing. It returns
 * {ok:true} and no subscriber data, so a token replayed against it can only do
 * the thing the token holder was already offered a one-click button for.
 *
 * Order matters. The cookie is checked FIRST so the in-page confirm button uses
 * it, and the query string is the fallback that mail providers land on.
 */
async function readToken(request: Request): Promise<string> {
  const fromCookie = (await cookies()).get(MANAGE_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const fromQuery = new URL(request.url).searchParams.get('token');
  if (fromQuery) return fromQuery;

  try {
    const body = (await request.json()) as { token?: unknown };
    return typeof body?.token === 'string' ? body.token : '';
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  // Read-only on purpose (see header). Hand off to the preferences page, which
  // opens the unsubscribe confirm when it sees ?unsub=1.
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return NextResponse.redirect(
    new URL(`/preferences?token=${encodeURIComponent(token)}&unsub=1`, request.url),
  );
}

export async function POST(request: Request) {
  const token = await readToken(request);
  const result = await unsubscribeByManageToken(token);
  if (!result.found) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status: 'unsubscribed' });
}
