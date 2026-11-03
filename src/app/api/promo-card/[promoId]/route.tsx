import { ImageResponse } from 'next/og';
import { loadCardFonts } from '@/lib/social-feed/fonts';
import { cleanText } from '@/lib/social-feed/text';
import { getPromoCardRow, isPromoPagesLive } from '@/lib/promo-pages';
import { badgeLabel, CARD_HEIGHT, CARD_WIDTH, formatLongDate, formatMonDayYear, seriesLine } from '@/lib/promo-page-copy';
import { teamDisplayName } from '@/lib/promo-helpers';

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

const TEAM_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PROMO_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

const INK = '#211d18';
const CREAM = '#f7f3ea';

function titleSize(title: string): number {
  if (title.length <= 24) return 88;
  if (title.length <= 40) return 74;
  if (title.length <= 64) return 60;
  return 50;
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio between two colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
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
  const { team, row, seriesDates } = found;
  const title = cleanText(row.title);
  if (!title) return notFound();

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

  const [regular, bold] = await loadCardFonts();
  const teamName = cleanText(teamDisplayName(team)).toUpperCase();
  const series = seriesDates.length > 1;
  const opponent = cleanText(row.displayOpponent);
  const time = cleanText(row.displayTime);
  // One line at 36px holds about 60 characters; a stored full-club-name
  // opponent can pass that, so the weekday goes first.
  const singleLine = (date: string) => [date || null, time || null, opponent ? `vs ${opponent}` : null].filter(Boolean).join(' · ');
  const dateLine = series
    ? seriesLine(seriesDates)
    : row.date
      ? (singleLine(formatLongDate(row.date)).length > 56 ? singleLine(formatMonDayYear(row.date)) : singleLine(formatLongDate(row.date)))
      : singleLine('');
  const badge = row.tombstoned ? 'Removed' : badgeLabel(row);

  // The team's colours as stored (mapTeamDoc gives #rrggbb, black for a
  // missing one; the HEX_RE guard is for a malformed string). Text is
  // whichever of white and the house ink contrasts more with the ground
  // (orange and gold grounds take ink), and the badge follows the same flag.
  const ground = HEX_RE.test(team.primaryColor) ? team.primaryColor : INK;
  const rule = HEX_RE.test(team.secondaryColor) && team.secondaryColor.toLowerCase() !== ground.toLowerCase() ? team.secondaryColor : CREAM;
  const dark = contrast(ground, '#ffffff') >= contrast(ground, INK);
  const text = dark ? '#ffffff' : INK;
  const soft = dark ? 'rgba(255,255,255,0.78)' : '#50483f';
  const badgeBg = dark ? '#ffffff' : INK;
  const badgeText = dark ? INK : '#ffffff';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: ground, color: text, fontFamily: 'DM Sans', padding: '52px 64px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'block', flex: 1, minWidth: 0, fontSize: 32, fontWeight: 700, letterSpacing: 3, lineClamp: 1 }}>{teamName}</div>
          <div style={{ display: 'flex', flexShrink: 0, fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: badgeText, background: badgeBg, padding: '10px 18px', borderRadius: 10 }}>
            {badge}
          </div>
        </div>

        <div style={{ display: 'block', fontSize: titleSize(title), fontWeight: 700, lineHeight: 1.02, letterSpacing: -2, lineClamp: 3 }}>{title}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, borderTop: `5px solid ${rule}`, paddingTop: 22 }}>
          {dateLine ? <div style={{ display: 'block', fontSize: 36, fontWeight: 700, lineClamp: 1 }}>{dateLine}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: soft }}>
            {/* The mark in the text colour: the brand red disappears on a red ground. */}
            <div style={{ width: 14, height: 14, borderRadius: 7, background: text, display: 'flex' }} />
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>PromoNight</div>
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
