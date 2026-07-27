/**
 * POST /api/log-request
 *
 * Server-truth request counter sink. Called fire-and-forget from
 * src/middleware.ts for EVERY matched request, human and crawler alike, at full
 * rate with no sampling. Sibling to /api/log-crawler-hit, which it deliberately
 * does not touch: that route keeps its 10 percent forensic sample of named
 * crawlers with full UA strings, this one keeps the full-rate tally. A crawler
 * request is therefore counted in both places by design.
 *
 * Auth:   header `x-request-log-secret: <REQUEST_LOG_SECRET>`
 *         Its OWN env var, never the crawler logger's secret.
 * Body:   { traffic_class, request_type, userAgent?, path? }
 *
 * WHAT THE CALLER IS NOT TRUSTED WITH. The hour bucket and the increment amount
 * are both derived server-side here. There is no caller-supplied timestamp and
 * no caller-supplied count: the bucket comes from this process's clock and the
 * increment is always exactly 1. A compromised or buggy caller can therefore
 * mis-attribute a request between classes but cannot forge volume or backdate
 * it into a closed hour.
 *
 * WRITES, at most two per request:
 *   1. requestCounters/{YYYY-MM-DD-HH}   always. Merge-set with
 *      FieldValue.increment on exactly two paths, counts.{class}_{type} and
 *      total. Merge-set rather than update so the first write of an hour creates
 *      the document without a prior read.
 *   2. unknownUserAgents/{auto}          only for a sampled unknown-class
 *      request that carried a UA. This is the only mechanism by which
 *      classifier gaps get FOUND rather than guessed at, which matters because
 *      the legacy detectBot() list silently missed Googlebot entirely.
 *
 * READERS BEWARE: requestCounters also holds a `_meta` document alongside the
 * hourly buckets. Anything that ranges over the collection must exclude it. See
 * scripts/seed-request-counters-meta.ts.
 */
import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase';
import {
  CLASSIFIER_VERSION,
  isRequestType,
  isTrafficClass,
} from '@/lib/analytics/traffic-classifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Counters are the long series the traffic record is built on, so they outlive
// the raw samples by a wide margin. 400 days keeps a full year plus a month of
// year-over-year overlap.
const COUNTER_RETENTION_DAYS = 400;
// The unknown-UA sample is diagnostic scratch, not a record. It only needs to
// live long enough for someone to read it and widen a pattern.
const UNKNOWN_UA_RETENTION_DAYS = 90;

// Defensive caps on the two free-text fields. A user agent is attacker-supplied
// and Firestore charges by document size, so neither is stored unbounded.
const MAX_UA_LENGTH = 512;
const MAX_PATH_LENGTH = 512;

const COUNTERS = 'requestCounters';
const UNKNOWN_UAS = 'unknownUserAgents';

/**
 * Hour bucket id, `YYYY-MM-DD-HH`, always UTC. Built off toISOString rather
 * than getUTCHours and friends so the id and the `date` field cannot disagree
 * about which day an hour belongs to, and so no zero-padding is hand-rolled.
 */
function hourBucket(now: Date): { id: string; date: string; hour: number } {
  const iso = now.toISOString(); // 2026-07-27T14:23:45.678Z
  const date = iso.slice(0, 10); // 2026-07-27
  const hh = iso.slice(11, 13); // 14
  return { id: `${date}-${hh}`, date, hour: Number(hh) };
}

function daysFromNow(now: Date, days: number): Timestamp {
  return Timestamp.fromDate(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
}

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export async function POST(request: Request) {
  const secret = process.env.REQUEST_LOG_SECRET;
  if (!secret) {
    // Not configured yet. Body must be null: a 204 carrying a body throws in
    // the Response constructor ("Invalid response status code 204"), and this
    // branch is hit on EVERY request until the env var is set in Vercel, so it
    // is the one branch that absolutely cannot throw.
    return new NextResponse(null, { status: 204 });
  }
  if (request.headers.get('x-request-log-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: {
    traffic_class?: unknown;
    request_type?: unknown;
    userAgent?: unknown;
    path?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  // Strict validation against the runtime unions exported by the classifier, so
  // a typo or a stale caller cannot invent a counts key and quietly fragment
  // the series across misspelled buckets.
  if (!isTrafficClass(payload.traffic_class)) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_traffic_class' },
      { status: 400 },
    );
  }
  if (!isRequestType(payload.request_type)) {
    return NextResponse.json({ ok: false, reason: 'invalid_request_type' }, { status: 400 });
  }

  const trafficClass = payload.traffic_class;
  const requestType = payload.request_type;

  const now = new Date();
  const { id, date, hour } = hourBucket(now);
  const countsKey = `${trafficClass}_${requestType}`;

  try {
    await db
      .collection(COUNTERS)
      .doc(id)
      .set(
        {
          date,
          hour,
          classifierVersion: CLASSIFIER_VERSION,
          updatedAt: Timestamp.fromDate(now),
          expiresAt: daysFromNow(now, COUNTER_RETENTION_DAYS),
          total: FieldValue.increment(1),
          // Nested map under merge:true is a deep merge: per the SetOptions
          // contract, "fields omitted from the set() call remain untouched", so
          // only this one key of `counts` is written and every sibling class is
          // preserved. The one documented way merge DESTROYS nested data is
          // setting a field to an EMPTY map, which cannot happen here because
          // countsKey is built from two validated non-empty unions and this
          // object therefore always has exactly one key.
          counts: { [countsKey]: FieldValue.increment(1) },
        },
        { merge: true },
      );
  } catch (err) {
    console.error('log-request counter write failed:', err);
    return NextResponse.json({ ok: false, reason: 'write_failed' }, { status: 500 });
  }

  // Unknown-class UA sample. The middleware decides WHETHER to sample (1 in
  // 100); this route only decides whether the sample is well formed. The class
  // is re-checked here rather than trusted, so a caller that starts sending UAs
  // for other classes cannot turn this into a log of human user agents.
  if (trafficClass === 'unknown' && typeof payload.userAgent === 'string') {
    try {
      await db.collection(UNKNOWN_UAS).add({
        userAgent: clamp(payload.userAgent, MAX_UA_LENGTH),
        path: typeof payload.path === 'string' ? clamp(payload.path, MAX_PATH_LENGTH) : null,
        classifierVersion: CLASSIFIER_VERSION,
        createdAt: Timestamp.fromDate(now),
        expiresAt: daysFromNow(now, UNKNOWN_UA_RETENTION_DAYS),
      });
    } catch (err) {
      // The counter above already succeeded. Losing a diagnostic sample must
      // not turn a counted request into a reported failure.
      console.error('log-request unknown-UA sample write failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
