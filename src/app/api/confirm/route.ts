/**
 * /api/confirm?token=<confirmToken>
 *
 * GET NEVER MUTATES, AND THAT IS THE WHOLE POINT OF THIS FILE.
 *
 * This route used to flip the subscriber to `confirmed` on GET. Mail-security
 * gateways and link scanners (Proofpoint, Mimecast, Defender Safe Links and the
 * rest) prefetch every in-body URL on delivery, so a write-on-GET here meant a
 * scanner could opt a human in before that human had clicked anything. That is
 * not a leak, it is manufactured consent: the record says the subscriber
 * affirmatively confirmed, and they did not. It also biases the confirm-rate
 * metric by domain, since corporate mail is scanned and consumer mail largely
 * is not, so the number would drift with the customer mix rather than with
 * anything about the product.
 *
 * The sibling route /api/unsubscribe already reasoned this through and refuses
 * to write on GET for exactly the same reason. This one now matches it.
 *
 * The flow:
 *   GET  validates the token READ-ONLY, puts it in an httpOnly cookie, and
 *        redirects to a bare /confirm. No write. No token in the URL bar.
 *   POST is what a human's button press calls. It performs the write, swaps in
 *        the manage session, and hands back the destination.
 *
 * A missing or unknown token redirects to /follow to re-subscribe, as before.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { confirmSubscriberByToken, getConfirmCandidateByToken } from '@/lib/subscribers';
import {
  CONFIRM_COOKIE,
  MANAGE_COOKIE,
  MANAGE_TOKEN_RE,
  manageCookieOptions,
} from '@/lib/manage-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';

  // READ-ONLY. Resolves the record to decide whether the link is real, and
  // writes nothing whatever the answer is.
  const candidate = MANAGE_TOKEN_RE.test(token)
    ? await getConfirmCandidateByToken(token)
    : null;

  if (!candidate?.found) {
    return NextResponse.redirect(new URL('/follow?confirm=invalid', request.url));
  }

  const response = NextResponse.redirect(new URL('/confirm', request.url));
  response.cookies.set(
    CONFIRM_COOKIE,
    token,
    manageCookieOptions(url.protocol === 'https:'),
  );
  return response;
}

export async function POST(request: Request) {
  // The credential comes from the cookie the GET above set, so the confirm
  // token never appears in a URL a browser, an analytics sink or a replay
  // recording can see. There is no query-string fallback: unlike
  // /api/unsubscribe, no mail provider ever POSTs here.
  const token = (await cookies()).get(CONFIRM_COOKIE)?.value ?? '';
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 });
  }

  const result = await confirmSubscriberByToken(token);
  if (!result.found || !result.manageToken) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // Straight into a manage session so the visitor lands on a working
  // preferences page without another emailed link, and without the manage token
  // ever passing through the URL.
  const response = NextResponse.json({ ok: true, next: '/preferences?confirmed=1' });
  const secure = new URL(request.url).protocol === 'https:';
  response.cookies.set(MANAGE_COOKIE, result.manageToken, manageCookieOptions(secure));
  response.cookies.set(CONFIRM_COOKIE, '', { ...manageCookieOptions(secure), maxAge: 0 });
  return response;
}
