import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { findCardPromo } from '@/lib/social-feed/feed';
import { formatShortDate, IMAGE_SIZE } from '@/lib/social-feed/rss';
import { cleanText } from '@/lib/social-feed/text';

// 1080x1080 PNG card for one social-feed item, at /feeds/social/image/{teamId}~{promoId}. Text only: no team logos or
// league marks. Fonts are the static DM Sans TTFs committed beside this route
// (Satori reads neither variable fonts nor WOFF2); OFL.txt sits with them.

const HEADERS = {
  'x-robots-tag': 'noindex',
  // Lowercase on purpose: ImageResponse merges these over its own lowercase
  // cache-control default, and a differently cased key would append instead.
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

const FONT_DIR = join(process.cwd(), 'src/app/feeds/social/image/_fonts');
let fontsPromise: Promise<[Buffer, Buffer]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, 'DMSans-Regular.ttf')),
    readFile(join(FONT_DIR, 'DMSans-Bold.ttf')),
  ]);
  return fontsPromise;
}

const CREAM = '#f7f3ea';
const INK = '#211d18';
const INK_SOFT = '#50483f';
const ACCENT = '#dc2626';

function titleSize(title: string): number {
  if (title.length <= 28) return 96;
  if (title.length <= 48) return 80;
  if (title.length <= 72) return 66;
  return 54;
}

// The path segment is the feed key "{teamId}~{promoId}" (see select.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const promo = await findCardPromo(key);
  if (!promo) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...HEADERS },
    });
  }

  const [regular, bold] = await loadFonts();
  const title = cleanText(promo.title);
  const teamName = cleanText(promo.teamName);
  const venue = cleanText(promo.venue);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CREAM,
          color: INK,
          padding: 88,
          fontFamily: 'DM Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: ACCENT }} />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>PromoNight</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 44, fontWeight: 400, color: INK_SOFT }}>{teamName}</div>
          <div
            style={{
              fontSize: titleSize(title),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              lineClamp: 4,
              display: 'block',
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `4px solid ${INK}`, paddingTop: 36 }}>
          <div style={{ fontSize: 52, fontWeight: 700 }}>{formatShortDate(promo.date)}</div>
          {venue ? <div style={{ fontSize: 40, fontWeight: 400, color: INK_SOFT }}>{venue}</div> : null}
        </div>
      </div>
    ),
    {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      fonts: [
        { name: 'DM Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'DM Sans', data: bold, weight: 700, style: 'normal' },
      ],
      headers: HEADERS,
    },
  );
}
