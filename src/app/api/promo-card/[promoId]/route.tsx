import { ImageResponse } from 'next/og';
import { loadCardFonts } from '@/lib/social-feed/fonts';
import { cleanText } from '@/lib/social-feed/text';
import { getPromoCardRow, isPromoPagesLive } from '@/lib/promo-pages';
import { badgeLabel, CARD_HEIGHT, CARD_WIDTH, formatLongDate } from '@/lib/promo-page-copy';
import { teamDisplayName } from '@/lib/promo-helpers';

// The tier 3 image for a promo page (Phase 3b, brief A.4): a 1200x630 PNG at
// /api/promo-card/{promoId}?team={teamId}&v={updatedAt ms}, drawn by the same
// renderer and fonts as the 1080x1080 social card. Text only: the team's
// colour as a ground stripe, the promo name in the display weight, the date
// and opponent line, the type badge and the PromoNight mark. Deterministic
// from the document, so a page's og:image never depends on a fetch.
//
// KEYED ON promoId + updatedAt. The URL carries the row's updatedAt as `v`, so
// the edge cache turns over when the document changes and a stale copy is
// never served under a fresh key. A request whose `v` matches the document is
// cached for a year; a mismatch (a page rendered before the write) is served
// but cached for an hour only. The team rides as a query parameter because
// promo ids are unique within a team, not across the site.
//
// Gated with the pages: with PROMO_PAGES_LIVE unset nothing here renders.

const TEAM_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PROMO_RE = /^[A-Za-z0-9_-]{1,64}$/;

const CREAM = '#f7f3ea';
const INK = '#211d18';
const INK_SOFT = '#50483f';
const ACCENT = '#dc2626';

function titleSize(title: string): number {
  if (title.length <= 24) return 84;
  if (title.length <= 40) return 72;
  if (title.length <= 64) return 58;
  return 48;
}

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
  const { team, row } = found;
  const title = cleanText(row.title);
  if (!title) return notFound();

  const stamp = row.updatedAt ? String(Date.parse(row.updatedAt)) : '0';
  const fresh = v === stamp;
  const headers = {
    'x-robots-tag': 'noindex',
    // Lowercase on purpose: ImageResponse merges these over its own lowercase
    // cache-control default, and a differently cased key would append instead.
    'cache-control': fresh
      ? 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400'
      : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  };

  const [regular, bold] = await loadCardFonts();
  const teamName = cleanText(teamDisplayName(team));
  const when = row.date ? formatLongDate(row.date) : '';
  const opponent = cleanText(row.displayOpponent);
  const time = cleanText(row.displayTime);
  const line2 = [opponent ? `vs ${opponent}` : null, time || null].filter(Boolean).join(' · ');
  const badge = row.tombstoned ? 'Removed' : badgeLabel(row);
  const tint = /^#[0-9a-f]{6}$/i.test(team.primaryColor) ? team.primaryColor : INK;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: CREAM, color: INK, fontFamily: 'DM Sans' }}>
        <div style={{ width: 36, height: '100%', background: tint, display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 64px 48px 56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: ACCENT, display: 'flex' }} />
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>PromoNight</div>
            </div>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#ffffff', background: row.tombstoned ? INK_SOFT : ACCENT, padding: '10px 18px', borderRadius: 10 }}>
              {badge}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 34, fontWeight: 400, color: INK_SOFT }}>{teamName}</div>
            <div style={{ fontSize: titleSize(title), fontWeight: 700, lineHeight: 1.02, letterSpacing: -2, lineClamp: 3, display: 'block' }}>{title}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `4px solid ${INK}`, paddingTop: 24 }}>
            {when ? <div style={{ fontSize: 40, fontWeight: 700 }}>{when}</div> : null}
            {line2 ? <div style={{ fontSize: 30, fontWeight: 400, color: INK_SOFT }}>{line2}</div> : null}
          </div>
        </div>
      </div>
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        { name: 'DM Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'DM Sans', data: bold, weight: 700, style: 'normal' },
      ],
      headers,
    },
  );
}
