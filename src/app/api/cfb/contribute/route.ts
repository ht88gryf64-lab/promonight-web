/**
 * POST /api/cfb/contribute
 *
 * Contributor-CTA capture for CFB auto pages (decision record §3). Writes the
 * submission to the `cfbContributions` REVIEW QUEUE as a DRAFT and stops there —
 * it NEVER auto-publishes, NEVER flips editorialStatus, NEVER writes cfbSchools.
 * Graduating a school (review -> publish -> auto->destination) is an operational
 * human step, not an automated path. Per-IP flood limited + honeypot.
 *
 * After the write commits, the full submission is emailed to the owner as a
 * best-effort notification. The write is the only thing that can fail the
 * request; a mail failure is logged and the user still sees success.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { clientIp, checkSubscribeRateLimit } from '@/lib/rate-limit';
import { isValidEmail } from '@/lib/subscribers';
import { sendContributionNotification } from '@/lib/cfb/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Human review queue. Only clean submissions land here. */
const QUEUE = 'cfbContributions';
/** Honeypot-tripped submissions. Stored, never reviewed, never emailed. */
const QUARANTINE = 'cfbContributionsFlagged';

const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
// contact = an email OR a LinkedIn/URL/handle (for credit + follow-up)
function validContact(c: string): boolean {
  if (!c) return false;
  if (isValidEmail(c)) return true;
  return /linkedin\.com\/|^https?:\/\/|^@?[\w.-]{2,}$/i.test(c) && c.length <= 200;
}

interface Body {
  schoolId?: unknown; name?: unknown; contact?: unknown; website?: unknown; // website = honeypot
  whyYouGo?: unknown; traditions?: unknown; gameday?: unknown; venueInWords?: unknown; signatureGame?: unknown;
}

export async function POST(request: Request) {
  const rate = await checkSubscribeRateLimit(clientIp(request));
  if (!rate.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } });

  let body: Body;
  try { body = (await request.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  // Honeypot: real users leave the hidden `website` field empty; bots fill it.
  // We never tell a bot it was filtered, so a tripped submission still gets the
  // exact same 200 body as a real one. What we no longer do is DISCARD it: a
  // browser or password manager can autofill a hidden field for a genuine
  // contributor, and silently throwing their writing away is far worse than
  // storing some spam. Tripped rows go to a quarantine collection so the review
  // queue stays clean, and they never trigger an owner email.
  const honeypot = Boolean(cap(body.website, 1));

  const schoolId = cap(body.schoolId, 64).toLowerCase();
  const name = cap(body.name, 120);
  const contact = cap(body.contact, 200);
  const content = {
    whyYouGo: cap(body.whyYouGo, 4000),
    traditions: cap(body.traditions, 4000),
    gameday: cap(body.gameday, 4000),
    venueInWords: cap(body.venueInWords, 4000),
    signatureGame: cap(body.signatureGame, 200),
  };
  if (!/^[a-z0-9-]{2,64}$/.test(schoolId)) return NextResponse.json({ ok: false, error: 'invalid_school' }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 });
  if (!validContact(contact)) return NextResponse.json({ ok: false, error: 'contact_required' }, { status: 400 });
  const hasContent = Object.values(content).some((v) => v.length > 0);
  if (!hasContent) return NextResponse.json({ ok: false, error: 'content_required' }, { status: 400 });

  const submittedAt = new Date().toISOString();
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);

  let docId: string;
  try {
    // DRAFT in the review queue. status stays 'pending-review'; a human reviews,
    // fact-checks (rivalry/transit claims, originality), then publishes + graduates.
    // Honeypot-tripped rows are quarantined instead, never queued for review.
    const ref = await db.collection(honeypot ? QUARANTINE : QUEUE).add({
      schoolId, name, contact, content,
      status: honeypot ? 'spam-suspected' : 'pending-review', autoPublished: false,
      ...(honeypot ? { honeypot: true } : {}),
      submittedAt, userAgent,
    });
    docId = ref.id;
  } catch (e) {
    console.error('[api:cfb-contribute] write failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }

  // Quarantined rows are stored but never announced: a bot flood must not become
  // an inbox flood. A genuine contributor caught by autofill is recoverable from
  // cfbContributionsFlagged rather than lost.
  if (honeypot) return NextResponse.json({ ok: true, queued: true });

  // The submission is durably committed above. Everything past this point is
  // best-effort: an owner notification must never fail the request or imply the
  // write was lost. Isolated from the write's try/catch on purpose, so a mail
  // error cannot be mistaken for a storage error and turn a 200 into a 500.
  try {
    const res = await sendContributionNotification({
      docId, schoolId, name, contact, content, submittedAt, userAgent,
    });
    if (!res.ok && !res.skipped) {
      console.error(`[api:cfb-contribute] notify failed for ${docId}: ${res.error}`);
    }
  } catch (e) {
    console.error(`[api:cfb-contribute] notify threw for ${docId}`, e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, queued: true });
}
