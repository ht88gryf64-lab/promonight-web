import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';

// Dead-URL trap. Team.fanaticsPath used to ride into the RSC payload as a
// root-relative string `/{league}/{slug}/o-N+t-N+z-N-N`; crawlers/preloaders
// resolved it against getpromonight.com → 404. Those paths are unmistakable
// (a third segment beginning `o-` under a league prefix is never a real
// route), so return 410 Gone — a hard deindex signal that clears the
// discovered URLs faster than a soft 404. See scripts/migrate-fanatics-path-to-url.ts.
const FANATICS_LEAK_PATH = /^\/(?:mlb|nba|nhl|nfl|mls|wnba)\/[a-z0-9-]+\/o-/i;

const GONE_HTML =
  '<!doctype html><meta charset="utf-8"><title>410 Gone</title>' +
  '<p>This page does not exist. <a href="https://www.getpromonight.com/">Go to PromoNight</a>.</p>';

const AI_BOT_PATTERNS: Array<{ bot: string; match: RegExp }> = [
  { bot: 'GPTBot', match: /GPTBot/i },
  { bot: 'ChatGPT-User', match: /ChatGPT-User/i },
  { bot: 'PerplexityBot', match: /PerplexityBot/i },
  { bot: 'Google-Extended', match: /Google-Extended/i },
  { bot: 'ClaudeBot', match: /ClaudeBot/i },
  { bot: 'Applebot-Extended', match: /Applebot-Extended/i },
  { bot: 'Gemini', match: /Googlebot-(?:News|Image|Video)?.*Gemini|GoogleOther|Gemini/i },
  { bot: 'Bingbot', match: /bingbot/i },
];

function detectBot(userAgent: string | null): string | null {
  if (!userAgent) return null;
  for (const entry of AI_BOT_PATTERNS) {
    if (entry.match.test(userAgent)) return entry.bot;
  }
  return null;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (FANATICS_LEAK_PATH.test(request.nextUrl.pathname)) {
    return new NextResponse(GONE_HTML, {
      status: 410,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex',
      },
    });
  }

  const userAgent = request.headers.get('user-agent');
  const bot = detectBot(userAgent);
  if (!bot) return NextResponse.next();

  // Error trap: keep bots at 200 even if logging ever regresses.
  try {
    const secret = process.env.CRAWLER_LOG_SECRET;
    if (!secret) {
      // Env var not set — skip logging rather than fail open. Request still proceeds.
      return NextResponse.next();
    }

    const origin = request.nextUrl.origin;
    const payload = {
      bot,
      path: request.nextUrl.pathname,
      userAgent: userAgent ?? '',
      country: request.headers.get('x-vercel-ip-country') ?? null,
      referer: request.headers.get('referer') ?? null,
    };

    // Fire-and-forget: never block the crawler's response on our own logging.
    const logPromise = fetch(`${origin}/api/log-crawler-hit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-crawler-log-secret': secret,
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('MIDDLEWARE_FETCH_ERR', {
        message: err?.message,
        name: err?.name,
        bot,
        path: request.nextUrl.pathname,
      });
    });

    event.waitUntil(logPromise);
  } catch (err) {
    console.error('MIDDLEWARE_ERROR', {
      message: (err as Error)?.message,
      name: (err as Error)?.name,
      stack: (err as Error)?.stack,
      bot,
      ua: userAgent,
      path: request.nextUrl.pathname,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on pages; skip API, Next internals, and common static assets.
    '/((?!api/|_next/|_static/|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml)$).*)',
  ],
};
