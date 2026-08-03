import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import {
  classifyRequestType,
  classifyTraffic,
} from '@/lib/analytics/traffic-classifier';
import {
  MANAGE_COOKIE,
  MANAGE_TOKEN_RE,
  manageCookieOptions,
} from '@/lib/manage-session';

/**
 * Pages whose ?token= is exchanged for a cookie before any HTML is produced.
 *
 * /confirm is deliberately NOT here. It is only ever reached by a redirect from
 * GET /api/confirm, which sets its own cookie on the way past: api/ is excluded
 * from this middleware's matcher, so the route handler has to do it there
 * anyway, and doing it twice would mean two places to keep in step.
 */
const TOKEN_EXCHANGE_PATHS = new Set(['/preferences']);

/**
 * Swap `?token=` for an httpOnly cookie and redirect to the bare path.
 *
 * Returns null when there is nothing to do, which is every request except the
 * one hop straight out of an email.
 *
 * A malformed token is redirected WITHOUT a cookie rather than passed through.
 * The destination page renders its own "link not valid" state, so a junk token
 * gets the same answer it always did, and we never write a cookie we know
 * Firestore would reject.
 */
function maybeExchangeManageToken(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (!TOKEN_EXCHANGE_PATHS.has(pathname)) return null;

  const token = searchParams.get('token');
  if (!token) return null;

  const url = request.nextUrl.clone();
  url.searchParams.delete('token');

  const response = NextResponse.redirect(url);
  if (MANAGE_TOKEN_RE.test(token)) {
    response.cookies.set(
      MANAGE_COOKIE,
      token,
      manageCookieOptions(request.nextUrl.protocol === 'https:'),
    );
  }
  return response;
}

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

// Fraction of unknown-class requests whose raw user agent is sampled into
// unknownUserAgents. The counter itself is full rate; only this diagnostic
// side-channel is sampled. It is the only way a classifier gap gets FOUND
// rather than guessed at, which is not academic: the legacy detectBot() list
// above misses Googlebot entirely and nothing surfaced that for months.
const UNKNOWN_UA_SAMPLE_RATE = 0.01;

/**
 * Server-truth request counter. Fires for EVERY matched request, human and
 * crawler alike, at FULL RATE with no sampling, into requestCounters.
 *
 * Independent of the crawler logger below it in every way: separate secret,
 * separate route, separate collection, no sampling, and a different classifier.
 * A crawler request is counted in BOTH, by design.
 *
 * Never throws and never awaits. The fetch is handed to event.waitUntil so the
 * response is not held on our own bookkeeping, and every failure path logs and
 * swallows. A logging outage must not become a site outage.
 */
function countRequest(
  request: NextRequest,
  event: NextFetchEvent,
  userAgent: string | null,
): void {
  try {
    const secret = process.env.REQUEST_LOG_SECRET;
    // Not configured. Skip rather than fire an unauthenticated request that the
    // route would only reject anyway.
    if (!secret) return;

    const trafficClass = classifyTraffic(userAgent);
    const requestType = classifyRequestType(request.headers);

    const payload: Record<string, string> = {
      traffic_class: trafficClass,
      request_type: requestType,
    };

    // Unknown-class only. Deliberately never sampled for `human`: this is a
    // classifier-gap diagnostic, not a log of visitors' user agents.
    if (trafficClass === 'unknown' && Math.random() < UNKNOWN_UA_SAMPLE_RATE) {
      payload.userAgent = userAgent ?? '';
      payload.path = request.nextUrl.pathname;
    }

    const write = fetch(`${request.nextUrl.origin}/api/log-request`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-log-secret': secret,
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('REQUEST_COUNTER_FETCH_ERR', {
        message: err?.message,
        name: err?.name,
        trafficClass,
        requestType,
        path: request.nextUrl.pathname,
      });
    });

    event.waitUntil(write);
  } catch (err) {
    console.error('REQUEST_COUNTER_ERR', {
      message: (err as Error)?.message,
      name: (err as Error)?.name,
      path: request.nextUrl.pathname,
    });
  }
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // TOKEN EXCHANGE, FIRST AND BEFORE THE COUNTER.
  //
  // /preferences?token=... is the link in every email we have ever sent, so the
  // URL shape cannot change. What changes is that it never reaches the browser:
  // the token moves into an httpOnly cookie here and the visitor is redirected
  // to a bare /preferences, so the document that loads (and that rrweb
  // snapshots, and that page_path reports to PostHog and GA4) carries no
  // credential. See src/lib/manage-session.ts for why this cannot live in the
  // page or on the client.
  //
  // Ahead of countRequest deliberately: this request is immediately redirected
  // and the visitor's real page request arrives a moment later, so counting both
  // would double-count one visit.
  //
  // The non-secret params are preserved. `confirmed` and `unsub` are UI intent,
  // not credentials, and dropping `unsub` would break the one-click unsubscribe
  // journey the footer link depends on.
  const exchange = maybeExchangeManageToken(request);
  if (exchange) return exchange;

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

  // Server-truth request counter, FIRST and unconditional. This must run before
  // the non-crawler early return below, which is where every human request used
  // to leave the function untouched. Placement here is the whole point of the
  // counter: it is the only code path that sees human traffic.
  //
  // Placed after the 410 trap above on purpose: a leaked Fanatics catalog path
  // is not a page request, so counting it would put non-pages in the tally.
  // The cost is that `total` runs a hair below Vercel's middleware invocation
  // count by exactly the 410 volume (1 in the last 24h). Recorded for the
  // Phase 3 reconciliation in docs/request-counter-notes.md.
  countRequest(request, event, userAgent);

  const bot = detectBot(userAgent);
  if (!bot) return NextResponse.next();

  // Error trap: keep bots at 200 even if logging ever regresses.
  try {
    const secret = process.env.CRAWLER_LOG_SECRET;
    if (!secret) {
      // Env var not set — skip logging rather than fail open. Request still proceeds.
      return NextResponse.next();
    }

    // Sample 1-in-10 bot hits. The crawler-hit signal is statistical (which bots
    // crawl which paths, and roughly how often) rather than a per-request audit,
    // so a 10% sample preserves the insight while spawning the /api/log-crawler-hit
    // Node function — and its Firestore write — on only ~10% of bot GETs. Gating
    // here (not inside the route) means the skipped 90% never invoke the function
    // at all. Treat stored counts as a 10% sample (×10 for true volume).
    if (Math.random() < 0.1) {
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
    }
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
    '/((?!api/|_next/|_static/|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|txt|xml|json|webmanifest)$).*)',
  ],
};
