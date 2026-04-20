import { NextRequest, NextResponse } from 'next/server';

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

export async function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent');
  const bot = detectBot(userAgent);
  if (!bot) return NextResponse.next();

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
  }).catch(() => {
    // swallow — logging errors must never affect the response
  });

  // @ts-expect-error: waitUntil exists on Edge runtime's event object but Next types lag
  request.waitUntil?.(logPromise);

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on pages; skip API, Next internals, and common static assets.
    '/((?!api/|_next/|_static/|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml)$).*)',
  ],
};
