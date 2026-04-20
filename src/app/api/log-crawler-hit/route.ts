import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = 90;

export async function POST(request: Request) {
  const secret = process.env.CRAWLER_LOG_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 204 });
  }
  if (request.headers.get('x-crawler-log-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let payload: {
    bot?: string;
    path?: string;
    userAgent?: string;
    country?: string | null;
    referer?: string | null;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const bot = typeof payload.bot === 'string' ? payload.bot : null;
  const path = typeof payload.path === 'string' ? payload.path : null;
  if (!bot || !path) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await db.collection('ai_crawler_hits').add({
      bot,
      path,
      userAgent: payload.userAgent ?? '',
      country: payload.country ?? null,
      referer: payload.referer ?? null,
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
    });
  } catch (err) {
    console.error('log-crawler-hit write failed:', err);
    return NextResponse.json({ ok: false, reason: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
