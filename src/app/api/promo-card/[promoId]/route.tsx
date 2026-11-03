import { cleanText } from '@/lib/social-feed/text';
import { getPromoCardRow, isPromoPagesLive } from '@/lib/promo-pages';
import { renderPromoCard } from '@/lib/promo-card-render';

// The tier 3 image for a promo page (Phase 3b, brief A.4; redrawn to the
// 2026-10-29 ruling): a 1200x630 PNG at
// /api/promo-card/{promoId}?team={teamId}&v={updatedAt ms}, drawn by the
// same renderer and fonts as the 1080x1080 social card. The team's primary
// colour is the ground and its secondary colour the rule; the team's name is
// the wordmark (the site holds no club logos or league marks, and draws
// none); the PromoNight mark is small; the type badge sits inside the frame;
// the promo name is the headline; the date line is the game for a single-date
// promo and "{N} home games · {first} to {last}" for a series. Deterministic
// from the documents, so a page's og:image never depends on a fetch.
//
// KEYED ON promoId + updatedAt. `v` is the series' latest updatedAt (the
// page's own stamp), so the edge cache turns over when the document or a
// sibling date changes. A matching `v` is cached for a year; a mismatch is
// served but cached for an hour. The team rides as a query parameter because
// promo ids are unique within a team, not across the site.
//
// Gated with the pages: with PROMO_PAGES_LIVE unset nothing here renders.
// The drawing itself is src/lib/promo-card-render.tsx (shared with the share
// card since 2026-11-03).

const TEAM_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PROMO_RE = /^[A-Za-z0-9_-]{1,64}$/;
function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
}

export async function GET(req: Request, { params }: { params: Promise<{ promoId: string }> }) {
  if (!isPromoPagesLive()) return notFound();
  const { promoId } = await params;
  const url = new URL(req.url);
  const teamId = url.searchParams.get('team') ?? '';
  const v = url.searchParams.get('v') ?? '';
  if (!TEAM_RE.test(teamId) || !PROMO_RE.test(promoId)) return notFound();

  const found = await getPromoCardRow(teamId, promoId);
  if (!found) return notFound();
  if (!cleanText(found.row.title)) return notFound();

  const stamp = found.updatedAt ? String(Date.parse(found.updatedAt)) : '0';
  const fresh = v === stamp;
  const headers = {
    'x-robots-tag': 'noindex',
    // Lowercase on purpose: ImageResponse merges these over its own lowercase
    // cache-control default, and a differently cased key would append instead.
    'cache-control': fresh
      ? 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400'
      : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  };

  return renderPromoCard(found, headers);
}
