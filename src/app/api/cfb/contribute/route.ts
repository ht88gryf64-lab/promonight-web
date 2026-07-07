/**
 * POST /api/cfb/contribute
 *
 * Contributor-CTA capture for CFB auto pages (decision record §3). Writes the
 * submission to the `cfbContributions` REVIEW QUEUE as a DRAFT and stops there —
 * it NEVER auto-publishes, NEVER flips editorialStatus, NEVER writes cfbSchools.
 * Graduating a school (review -> publish -> auto->destination) is an operational
 * human step, not an automated path. Per-IP flood limited + honeypot.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { clientIp, checkSubscribeRateLimit } from '@/lib/rate-limit';
import { isValidEmail } from '@/lib/subscribers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // Honeypot: real users leave the hidden `website` field empty. Silently accept
  // (200) so bots do not learn they were filtered, but write nothing.
  if (cap(body.website, 1)) return NextResponse.json({ ok: true, queued: true });

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

  try {
    // DRAFT in the review queue. status stays 'pending-review'; a human reviews,
    // fact-checks (rivalry/transit claims, originality), then publishes + graduates.
    await db.collection('cfbContributions').add({
      schoolId, name, contact, content,
      status: 'pending-review', autoPublished: false,
      submittedAt: new Date().toISOString(),
      userAgent: (request.headers.get('user-agent') || '').slice(0, 300),
    });
    return NextResponse.json({ ok: true, queued: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
