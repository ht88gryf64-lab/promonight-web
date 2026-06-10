/**
 * GET /api/confirm?token=<confirmToken>
 *
 * Single-opt-in confirmation link target. Flips the matching subscriber to
 * `confirmed` and stamps `confirmedAt`, then redirects to their preferences
 * page so they land somewhere useful. Idempotent: a second click is a no-op
 * success. A missing or unknown token redirects to /follow to re-subscribe.
 */

import { NextResponse } from 'next/server';
import { confirmSubscriberByToken } from '@/lib/subscribers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const result = await confirmSubscriberByToken(token);

  if (!result.found || !result.manageToken) {
    return NextResponse.redirect(new URL('/follow?confirm=invalid', request.url));
  }

  return NextResponse.redirect(
    new URL(
      `/preferences?token=${encodeURIComponent(result.manageToken)}&confirmed=1`,
      request.url,
    ),
  );
}
