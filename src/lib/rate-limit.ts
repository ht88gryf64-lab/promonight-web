import 'server-only';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase';

// Persistent, Firestore-backed per-IP rate limit for POST /api/subscribe.
// Serverless instances do not share memory, so an in-memory limiter would not
// hold across invocations; this keeps one fixed-window counter per IP in
// Firestore. It is the multi-address-flood layer ON TOP OF the Phase B
// per-email confirmation cooldown (which caps repeats of a single address).

const COLLECTION = 'rateLimits';
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LIMIT = 5; // POSTs per window per IP

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// Client IP: first hop of x-forwarded-for (the original client), with a Vercel
// header fallback. Vercel populates x-forwarded-for on every request; the
// fallbacks cover edge cases. Never throws.
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const vercel = request.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Fixed-window counter, claimed inside a transaction so concurrent requests from
// one IP cannot race past the limit. The doc id is a hash of the IP, so the raw
// address is never stored. Fails OPEN on a Firestore error: a storage blip must
// not block legitimate signups, and the subscribe write itself would fail in
// that case too, so no email would go out anyway.
export async function checkSubscribeRateLimit(ip: string): Promise<RateLimitResult> {
  const id = createHash('sha256').update(`subscribe:${ip}`).digest('hex');
  const ref = db.collection(COLLECTION).doc(id);
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : 0;
      const count = typeof data?.count === 'number' ? data.count : 0;

      // New IP, or the previous window has elapsed -> start a fresh window.
      if (!data || now - windowStart >= WINDOW_MS) {
        tx.set(ref, {
          windowStart: now,
          count: 1,
          // For an optional Firestore TTL policy on `rateLimits.expiresAt`.
          expiresAt: Timestamp.fromMillis(now + WINDOW_MS),
        });
        return { allowed: true, remaining: LIMIT - 1, retryAfterSec: 0 };
      }

      if (count < LIMIT) {
        tx.update(ref, { count: count + 1 });
        return { allowed: true, remaining: LIMIT - (count + 1), retryAfterSec: 0 };
      }

      const retryAfterSec = Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    });
  } catch (e) {
    console.error('[rate-limit] check failed, failing open', e instanceof Error ? e.message : e);
    return { allowed: true, remaining: LIMIT, retryAfterSec: 0 };
  }
}
