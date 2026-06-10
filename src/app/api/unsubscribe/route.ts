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
import { unsubscribeByManageToken } from '@/lib/subscribers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readToken(request: Request): Promise<string> {
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
