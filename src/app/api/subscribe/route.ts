/**
 * POST /api/subscribe
 *
 * Combined capture-form submit. Creates or upserts a single `subscribers`
 * record (one per email, keyed by email hash). An empty `teams` array is a
 * valid generic signup; a non-empty array is a personalized digest. On a
 * duplicate email we update teams rather than erroring.
 *
 * A new record always gets the confirmation email. A pending re-submit gets one
 * only when it is a genuine resend request: a submit that merely ADDS teams
 * keeps the token already in the user's inbox and sends nothing, as does one
 * inside the per-email cooldown. An unsubscribed re-submit always re-confirms,
 * and an already-confirmed re-submit merges teams silently. Per-IP rate limited
 * (Firestore-backed) on top of the per-email confirmation cooldown.
 *
 * Suppressing a resend requires that a link was actually DELIVERED, tracked by
 * confirmationSentAt, which this route stamps in a second write once the sender
 * reports success. A failed or skipped send leaves it unset so the next submit
 * re-sends rather than stranding the subscriber.
 */

import { NextResponse } from 'next/server';
import {
  isValidEmail,
  markConfirmationSent,
  sanitizeTeams,
  upsertSubscriber,
  type SubscriberGeo,
} from '@/lib/subscribers';
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

// Read the approximate location Vercel attaches at the edge, the same headers
// /follow uses for geo ordering. Additive: any header may be absent (local dev,
// non-Vercel) and the sanitizer downstream drops anything invalid. The city
// header is URL-encoded by Vercel, so it is decoded defensively.
function readVercelGeo(request: Request): SubscriberGeo {
  const h = request.headers;
  const rawCity = h.get('x-vercel-ip-city');
  let geoCity: string | null = null;
  if (rawCity) {
    try {
      geoCity = decodeURIComponent(rawCity);
    } catch {
      geoCity = rawCity;
    }
  }
  const lat = h.get('x-vercel-ip-latitude');
  const lng = h.get('x-vercel-ip-longitude');
  return {
    geoCity,
    geoRegion: h.get('x-vercel-ip-country-region'),
    geoLat: lat !== null && lat !== '' ? Number(lat) : null,
    geoLng: lng !== null && lng !== '' ? Number(lng) : null,
  };
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
  const geo = readVercelGeo(request);

  try {
    const result = await upsertSubscriber({ email: body.email, teams, source, geo });

    // Send the confirmation email ONLY when upsertSubscriber says one is due.
    // needsConfirmation is false for an already-confirmed re-submit, and for the
    // two pending suppressors (see suppressionReason), so neither un-confirms a
    // subscriber nor rotates a token out from under a link already emailed.
    // Failures are logged but never fail the signup, the record exists and a
    // re-submit re-triggers.
    if (result.needsConfirmation) {
      try {
        const sent = await sendConfirmationEmail({
          email: result.email,
          confirmToken: result.confirmToken,
          manageToken: result.manageToken,
        });
        if (sent.ok) {
          // Only a DELIVERED link may suppress a later teams-adding submit, so
          // the stamp is the gate on that suppressor. Never throws.
          await markConfirmationSent(result.id);
        } else {
          // sendEmail returns {ok:false} rather than throwing on a missing API
          // key, a Resend non-2xx or a timeout, so without this the failure is
          // invisible: the subscriber sits pending holding a link that was never
          // delivered. confirmationSentAt stays unset, so their next submit
          // rotates and re-sends.
          console.error(
            `[api:subscribe] confirmation send failed reason=${
              sent.skipped ? 'skipped_no_api_key' : (sent.error ?? 'unknown')
            }`,
          );
        }
      } catch (e) {
        console.error('[api:subscribe] confirmation send threw', e);
      }
    } else if (result.suppressionReason) {
      // Info level so "no duplicate confirmations are firing" stays verifiable
      // in the Vercel logs without an analytics dependency. teams_only is the
      // expected steady state for a surface that adds teams after signup;
      // cooldown is a rapid repeat submit of the same address. No email is
      // logged: the reason and status are the whole signal.
      console.info(
        `[api:subscribe] confirmation suppressed reason=${result.suppressionReason} status=${result.status}`,
      );
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
