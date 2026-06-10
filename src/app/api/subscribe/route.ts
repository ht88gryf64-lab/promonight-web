/**
 * POST /api/subscribe
 *
 * Combined capture-form submit. Creates or upserts a single `subscribers`
 * record (one per email, keyed by email hash). An empty `teams` array is a
 * valid generic signup; a non-empty array is a personalized digest. On a
 * duplicate email we update teams and re-arm confirmation rather than erroring.
 *
 * On a new or re-armed (pending) record it sends the single-opt-in confirmation
 * email; an already-confirmed re-submit merges teams silently. Per-IP rate
 * limited (Firestore-backed) on top of the per-email confirmation cooldown.
 */

import { NextResponse } from 'next/server';
import { isValidEmail, sanitizeTeams, upsertSubscriber } from '@/lib/subscribers';
import { coerceCaptureSurface } from '@/lib/follow-surface';
import { sendConfirmationEmail } from '@/lib/email';
import { checkSubscribeRateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubscribeBody {
  email?: unknown;
  teams?: unknown;
  source?: unknown;
}

export async function POST(request: Request) {
  // Per-IP flood protection (5 POSTs / 10 min). Checked before any work so it
  // also caps Firestore writes and confirmation-email sends to arbitrary
  // addresses. The per-email cooldown in upsertSubscriber is the complementary
  // single-address layer.
  const rate = await checkSubscribeRateLimit(clientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const teams = sanitizeTeams(body.teams);
  const source = coerceCaptureSurface(body.source);

  try {
    const result = await upsertSubscriber({ email: body.email, teams, source });

    // Single opt-in: send the confirmation email ONLY when a (re)confirmation is
    // due, i.e. the resulting status is pending (new signup, or a pending /
    // unsubscribed record re-armed). An already-confirmed subscriber re-submitting
    // via /follow has needsConfirmation=false, so their teams merge silently with
    // no email. Failures are logged but never fail the signup, the record exists
    // and a re-submit re-triggers.
    if (result.needsConfirmation) {
      try {
        await sendConfirmationEmail({
          email: result.email,
          confirmToken: result.confirmToken,
          manageToken: result.manageToken,
        });
      } catch (e) {
        console.error('[api:subscribe] confirmation send threw', e);
      }
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      created: result.created,
      team_count: result.teams.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[api:subscribe] ${message}`);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
