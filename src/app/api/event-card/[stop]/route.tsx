import { ImageResponse } from 'next/og';
import { loadCardFonts } from '@/lib/social-feed/fonts';
import { displayVenueName } from '@/lib/venue-hub';
import { resolveEventStop } from '@/lib/events/event-stops';
import { EVENT_CARD_HEIGHT, EVENT_CARD_WIDTH, eventShowOf, formatRangeWithYear, isEventsPagesLive, stopTimeline, stopYear, upcomingPerformances } from '@/lib/events/event-pages';

// The stop page's image and its og:image (Phase 2, 2026-11-18):
// /api/event-card/{show}~{venue}?v={stamp}. TEXT ONLY, drawn with the promo
// card's fonts and frame: the PromoNight wordmark, "{Show} {Year}", the venue,
// the search city and the date range. No photo, no truck art, no logo, and
// nothing fetched (ruling 2026-11-17: generated card only). 404 while
// EVENTS_PAGES_LIVE is off, for an unknown stop, and for a removed one.
const STOP_RE = /^([a-z0-9][a-z0-9-]{0,79})~([a-z0-9][a-z0-9-]{0,79})$/;
const INK = '#211d18';
const SOFT = '#e9e3d8';
const ACCENT = '#f0857c';

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
}

export async function GET(req: Request, { params }: { params: Promise<{ stop: string }> }) {
  if (!isEventsPagesLive()) return notFound();
  const { stop: id } = await params;
  const m = STOP_RE.exec(id);
  if (!m || !eventShowOf(m[1])) return notFound();
  const r = await resolveEventStop(m[1], m[2]);
  if (!r || r.kind !== 'page' || r.page.stop.tombstoned) return notFound();
  const { stop, hub } = r.page;
  const show = eventShowOf(stop.show)!;
  const tl = stopTimeline(stop, new Date());
  const up = upcomingPerformances(tl);
  const year = stopYear(stop, tl);
  // Several visits: a count between two dates, never one continuous range.
  const dates = up.length ? (tl.upcoming.length > 1 ? `${up.length} shows · ${formatRangeWithYear(up[0].date, up[0].date)} to ${formatRangeWithYear(up[up.length - 1].date, up[up.length - 1].date)}` : formatRangeWithYear(up[0].date, up[up.length - 1].date)) : tl.returnsYear ? `Returns in ${tl.returnsYear}` : '';
  const venueName = displayVenueName(hub.name);

  const stamp = stop.updatedAt ? String(Date.parse(stop.updatedAt)) : '0';
  const fresh = new URL(req.url).searchParams.get('v') === stamp;
  const headers = {
    'x-robots-tag': 'noindex',
    // A day at most even on the stamped URL: the date range on the card moves with the clock.
    'cache-control': fresh ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  };
  const [regular, bold] = await loadCardFonts();
  const headline = `${show.name}${year ? ` ${year}` : ''}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: INK, color: '#ffffff', fontFamily: 'DM Sans', padding: '56px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 42, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: '#ffffff' }}>PROMO</span>
            <span style={{ color: ACCENT }}>NIGHT</span>
          </div>
          <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: SOFT }}>Live event</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'block', fontSize: headline.length > 20 ? 92 : 112, fontWeight: 700, lineHeight: 0.95, letterSpacing: -3, textTransform: 'uppercase', lineClamp: 2 }}>{headline}</div>
          <div style={{ display: 'block', fontSize: 46, fontWeight: 400, color: SOFT, lineClamp: 1 }}>{`${venueName} · ${stop.searchCity}`}</div>
          {dates ? <div style={{ display: 'block', fontSize: 38, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: ACCENT }}>{dates}</div> : null}
        </div>
      </div>
    ),
    {
      width: EVENT_CARD_WIDTH,
      height: EVENT_CARD_HEIGHT,
      fonts: [
        { name: 'DM Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'DM Sans', data: bold, weight: 700, style: 'normal' },
      ],
      headers,
    },
  );
}
