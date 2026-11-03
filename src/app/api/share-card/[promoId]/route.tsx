import { cleanText } from '@/lib/social-feed/text';
import { getPromoCardRow, isPromoPagesLive, type PromoCardRow } from '@/lib/promo-pages';
import { storageImageUrl } from '@/lib/promo-page-copy';
import { teamDisplayName } from '@/lib/promo-helpers';
import { imageSizeFromBytes } from '@/lib/image-dimensions';
import { renderPromoCard } from '@/lib/promo-card-render';
import { shareBadge, shareCardGame } from '@/lib/share-card-model';
import { accentFor, renderShareCard, type ShareCardModel, type ShareCardPanel } from '@/lib/share-card-render';

// The promo share card (2026-11-03): every promo page's og:image, at
// /api/share-card/{promoId}?team={teamId}&v={updatedAt ms}. The drawing is
// src/lib/share-card-render.tsx; this route resolves the row, builds the
// model and fetches the panel.
//
// THE TEAM PARAMETER. The brief's URL is /api/share-card/{promoId}?v=...;
// `team` rides beside `v` for the reason the promo card's does: promo ids
// are unique within a team, not across the site.
//
// KEYED ON promoId + updatedAt, exactly as the promo card: `v` is the page's
// stamp (the latest updatedAt under the slug), so an edit changes the URL on
// the page, which is what makes messaging apps fetch the card again. A
// matching `v` is edge-cached for a year; a mismatch is served and cached for
// an hour. A card drawn without its photo (the Storage fetch failed) is
// cached for ten minutes, so the next request draws it properly.
//
// PANEL. Tier 1 (a stored photo, row not tombstoned): our Firebase Storage
// copy, never a team CDN, with the page's credit line. Otherwise the promo
// card artwork, rendered in process (no self-fetch, so a protected preview
// draws it too).
//
// Gated with the pages: with PROMO_PAGES_LIVE unset nothing here renders.

const TEAM_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PROMO_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const PHOTO_TIMEOUT_MS = 8000;
const PHOTO_MAX_BYTES = 4_000_000;

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
}

async function photoPanel(found: PromoCardRow): Promise<ShareCardPanel> {
  const { row, team } = found;
  if (row.imageTier !== 1 || !row.imageRef || row.tombstoned) return null;
  try {
    const res = await fetch(storageImageUrl(row.imageRef), { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !PHOTO_TYPES.has(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > PHOTO_MAX_BYTES) return null;
    const size = imageSizeFromBytes(bytes);
    if (!size) return null;
    const credit = row.imageCredit ? cleanText(row.imageCredit) : `Image: ${cleanText(teamDisplayName(team))}`;
    return { kind: 'photo', src: `data:${type};base64,${Buffer.from(bytes).toString('base64')}`, credit, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

async function cardPanel(found: PromoCardRow): Promise<ShareCardPanel> {
  const png = Buffer.from(await (await renderPromoCard(found)).arrayBuffer());
  const ground = HEX_RE.test(found.team.primaryColor) ? found.team.primaryColor : '#211d18';
  return { kind: 'card', src: `data:image/png;base64,${png.toString('base64')}`, ground };
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
  const title = cleanText(found.row.title);
  if (!title) return notFound();

  const wantsPhoto = found.row.imageTier === 1 && !!found.row.imageRef && !found.row.tombstoned;
  const photo = wantsPhoto ? await photoPanel(found) : null;
  const degraded = wantsPhoto && !photo;
  const panel = photo ?? (await cardPanel(found));

  const model: ShareCardModel = {
    badge: shareBadge(found.row),
    title,
    game: shareCardGame(found),
    accent: accentFor(found.team.primaryColor, found.team.secondaryColor),
    panel,
  };

  const stamp = found.updatedAt ? String(Date.parse(found.updatedAt)) : '0';
  const fresh = v === stamp;
  const headers = {
    'x-robots-tag': 'noindex',
    // Lowercase on purpose, as in the promo card route: ImageResponse merges
    // these over its own lowercase cache-control default.
    'cache-control': degraded
      ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=60'
      : fresh
        ? 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400'
        : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  };
  return renderShareCard(model, headers);
}
