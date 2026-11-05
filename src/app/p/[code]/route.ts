import { NextResponse, type NextRequest } from 'next/server';
import { getTeamBySlug } from '@/lib/data';
import { todayYmd } from '@/lib/promo-helpers';
import { promoPagePath } from '@/lib/promo-page-copy';
import { getUpcomingPromoIndex, isPromoPagesLive } from '@/lib/promo-pages';
import { NOINDEX_HEADER, PROMO_FALLBACK_PATH, resolvePromoCode, withSearch } from '@/lib/social-bridge';

// The social bridge's promo link (2026-11-05): /p/{code}?utm_... from a Reel
// or TikTok caption, redirected to the promo's page. The rule is in
// src/lib/social-bridge.ts; this route only reads the upcoming index and
// answers with a 307 that keeps the query string, so the promo page's
// attribution sees the UTMs the caption carried.
//
// Never a 404: a caption outlives its game, so a code that resolves to
// nothing upcoming lands on today's board. With PROMO_PAGES_LIVE off no promo
// carries a page slug, so every code lands there too. The redirect is marked
// noindex and uncached: it is a hop, not a page.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params;
  const search = request.nextUrl.searchParams;
  let target = PROMO_FALLBACK_PATH;
  if (isPromoPagesLive()) {
    const hit = resolvePromoCode(code, search.get('utm_content'), await getUpcomingPromoIndex(todayYmd()));
    const team = hit ? await getTeamBySlug(hit.teamId) : null;
    if (hit && team) target = promoPagePath(team.sportSlug, team.id, hit.pageSlug);
  }
  return NextResponse.redirect(new URL(withSearch(target, search), request.nextUrl.origin), {
    status: 307,
    headers: { ...NOINDEX_HEADER, 'cache-control': 'private, no-store' },
  });
}
