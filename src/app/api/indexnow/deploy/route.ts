import { NextResponse } from 'next/server';
import { submitToIndexNow } from '@/lib/indexnow';
import { getAllSitemapUrls } from '@/lib/sitemap-urls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.INDEXNOW_DEPLOY_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('x-indexnow-secret') !== secret) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const urls = await getAllSitemapUrls();
  await submitToIndexNow(urls);
  return NextResponse.json({ ok: true, submitted: urls.length });
}
