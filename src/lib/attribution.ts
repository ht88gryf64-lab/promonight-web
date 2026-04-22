// First-party attribution cookie. Captures source / medium / campaign on the
// first visit and persists for 90 days. Read by lib/analytics track() so every
// event carries a consistent acquisition channel.

const COOKIE_NAME = 'pn_attribution';
const COOKIE_MAX_AGE_DAYS = 90;

const SELF_HOSTS = new Set(['getpromonight.com', 'www.getpromonight.com']);

const AI_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'www.perplexity.ai',
  'claude.ai',
  'gemini.google.com',
]);

const SOCIAL_HOSTS = new Set([
  't.co',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'l.facebook.com',
  'lm.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'l.instagram.com',
  'linkedin.com',
  'www.linkedin.com',
  'lnkd.in',
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'out.reddit.com',
  'tiktok.com',
  'www.tiktok.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'threads.net',
  'www.threads.net',
  'bsky.app',
]);

const SEARCH_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
  'yahoo.com',
  'www.yahoo.com',
  'search.brave.com',
  'brave.com',
  'search.yahoo.com',
  'www.ecosia.org',
  'ecosia.org',
  'startpage.com',
]);

export type AttributionCookie = {
  source: string;
  source_medium: string;
  source_campaign: string | null;
  landed_at: string;
  landing_page: string;
};

export type AttributionReadResult = {
  source: string | null;
  source_medium: string | null;
  source_campaign: string | null;
};

const NULL_RESULT: AttributionReadResult = {
  source: null,
  source_medium: null,
  source_campaign: null,
};

function getReferrerHost(): string | null {
  if (typeof document === 'undefined') return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    return new URL(ref).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function inferMedium(host: string | null): string {
  if (!host) return 'direct';
  if (AI_HOSTS.has(host)) return 'ai';
  if (SOCIAL_HOSTS.has(host)) return 'social';
  if (SEARCH_HOSTS.has(host)) return 'organic';
  return 'referral';
}

function readCookie(): AttributionCookie | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Minimal validation — if shape is wrong treat as missing
    if (typeof parsed.source !== 'string' || typeof parsed.source_medium !== 'string') {
      return null;
    }
    return parsed as AttributionCookie;
  } catch {
    return null;
  }
}

function writeCookie(value: AttributionCookie): void {
  if (typeof document === 'undefined') return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  const serialized = encodeURIComponent(JSON.stringify(value));
  document.cookie = `${COOKIE_NAME}=${serialized}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function captureAttribution(): AttributionCookie | null {
  if (typeof window === 'undefined') return null;

  const refHost = getReferrerHost();

  // Self-referral filter: same-origin navigation should never overwrite the
  // original acquisition source. If the referrer is us, bail without touching
  // the cookie (existing entry, if any, is left alone).
  if (refHost && SELF_HOSTS.has(refHost)) {
    return readCookie();
  }

  const existing = readCookie();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');

  const source = utmSource || refHost || 'direct';
  const source_medium = utmMedium || inferMedium(refHost);
  const source_campaign = utmCampaign || null;

  const value: AttributionCookie = {
    source,
    source_medium,
    source_campaign,
    landed_at: new Date().toISOString(),
    landing_page: window.location.pathname,
  };
  writeCookie(value);
  return value;
}

export function readAttribution(): AttributionReadResult {
  const c = readCookie();
  if (!c) return NULL_RESULT;
  return {
    source: c.source,
    source_medium: c.source_medium,
    source_campaign: c.source_campaign,
  };
}
