// Live guards on a deployed host's real sitemap and team pages
// (fix/promo-orphans-meta, 2026-10-31). Not part of `npm test`: they read the
// network. Run against production or a preview:
//
//   npm run test:live                                   # www.getpromonight.com
//   LIVE_HOST=https://promonight-xxxx.vercel.app npm run test:live
//
// A *.vercel.app preview sits behind Vercel SSO, so those pages are fetched
// with `vercel curl` (the CLI's own auth); any other host with plain fetch.
//
// 1. Every promo URL in the sitemap (every one is indexable: the sitemap lists
//    upcoming, non-duplicate pages only) is an href in its team page's server
//    HTML. The in-suite twin over fixture data is the "data guard" test in
//    src/app/[sport]/[team]/promos/[slug]/__tests__/promo-page.test.tsx.
// 2. No team page's server HTML passes 950,000 bytes (ruling 2026-10-31):
//    headroom under Bing's 1 MB ceiling, now that every upcoming row is
//    server-rendered. The completed rows stay lazy-mounted for this reason.
// 3. Every sitemap promo page's meta description is 100 to 155 characters,
//    and under 120 only when it carries the page's whole stored description
//    (the About paragraph) or there is none (ruling 2026-11-01). The 100 floor
//    is a property of the real data, so it lives here and not in the unit
//    battery in src/lib/__tests__/promo-page-copy.test.ts.
// 4. /ads.txt and /app-ads.txt answer 200 text/plain to every client
//    (chore/bot-firewall, 2026-11-02; unit twin src/app/__tests__/ads-files.test.ts).
// 5. Every always-allow agent's user agent gets 200 on a promo page and an
//    image from its /api/promo-card card (ops/firewall/PROPOSAL.md).
// 6. Every /download? anchor on a sitemap team or promo page is rel="nofollow".
// 7. Every og:image, twitter:image and JSON-LD image on our domain, across a
//    sample of promo, team, venue and aggregator pages, is allowed by
//    robots.txt for Googlebot, Twitterbot, facebookexternalhit and `*`
//    (longest match). Card fetchers obey robots.txt for the image, so a new
//    image route under /api/ needs its own Allow (fix/robots-share-card,
//    2026-11-04: /api/share-card/ shipped Disallowed). ROBOTS_SOURCE=local
//    checks the checkout's src/lib/robots-txt.ts instead of the served file,
//    so a branch can be checked against production pages before it deploys.
// 8. A live promo page whose themeKey has an explainer entry renders the
//    "General guide" block (per-promo pages v2 content floor, 2026-11-07).
//    The explainer files are read with fs at request time and reach the
//    serverless bundle only through next.config.ts outputFileTracingIncludes;
//    if they ever fall out, every page silently renders no guide, and this is
//    what catches it. The candidates are far-dated pages; when all of them
//    are gone the sitemap's promo pages are sampled instead, and at least one
//    must carry the guide.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import robotsParser from 'robots-parser';
import { robotsTxt } from '../../src/lib/robots-txt';

const HOST = (process.env.LIVE_HOST || 'https://www.getpromonight.com').replace(/\/$/, '');
const VIA_CLI = /\.vercel\.app$/.test(new URL(HOST).hostname);
const MAX_TEAM_PAGE_BYTES = 950_000;
const CONCURRENCY = VIA_CLI ? 6 : 10;
const run = promisify(execFile);
const STATUS_MARK = 'LIVE_GUARD_HTTP_STATUS:';

/** The href of every <a> in the HTML: a link a crawler follows, never a
 *  string that merely appears in a script or the flight payload. */
function anchorHrefs(html: string): Set<string> {
  return new Set([...html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')));
}

async function get(path: string): Promise<string> {
  const url = `${HOST}${path}`;
  for (let attempt = 1; ; attempt++) {
    try {
      if (VIA_CLI) {
        // The status rides on the last line: a 404, a 500 or an SSO page must
        // fail the guard, never pass it as a small page (review finding 4).
        const { stdout } = await run('npx', ['vercel', 'curl', url, '-s', '-w', `\n${STATUS_MARK}%{http_code}`], { maxBuffer: 16 * 1024 * 1024 });
        const at = stdout.lastIndexOf(`\n${STATUS_MARK}`);
        const status = at >= 0 ? stdout.slice(at + STATUS_MARK.length + 1).trim() : 'none';
        if (status !== '200') throw new Error(`${status} ${url}`);
        return stdout.slice(0, at);
      }
      const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// The sitemap names production URLs whatever host serves it; paths only.
let sitemapPaths: Promise<string[]> | undefined;
const sitemap = () =>
  (sitemapPaths ??= get('/sitemap.xml').then((xml) =>
    [...xml.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]),
  ));
const PROMO_RE = /^\/([a-z]+)\/([a-z0-9-]+)\/promos\/([a-z0-9-]+)$/;
const TEAM_RE = /^\/(mlb|nba|nhl|nfl|wnba|mls|cfb)\/([a-z0-9-]+)$/;

const teamPages = new Map<string, Promise<string>>();
const teamPage = (path: string) => {
  if (!teamPages.has(path)) teamPages.set(path, get(path));
  return teamPages.get(path)!;
};
const promoPages = new Map<string, Promise<string>>();
const promoPage = (path: string) => {
  if (!promoPages.has(path)) promoPages.set(path, get(path));
  return promoPages.get(path)!;
};

/** Status and content type of one request sent with exactly this user agent
 *  ('' sends none). curl, not fetch, so the header is what we say it is. */
async function probe(path: string, ua: string): Promise<string> {
  const url = `${HOST}${path}`;
  const args = ['-s', '-o', '/dev/null', '--user-agent', ua, '-w', '%{http_code} %{content_type}'];
  // vercel curl's own flags come before `--` (its global -A is --local-config),
  // curl's after it.
  const { stdout } = VIA_CLI
    ? await run('npx', ['vercel', 'curl', url, '--', ...args])
    : await run('curl', [...args, url]);
  return stdout.trim();
}

test(`every sitemap promo URL is an href in its team page server HTML (${HOST})`, async () => {
  const promos = (await sitemap()).filter((p) => PROMO_RE.test(p));
  assert.ok(promos.length > 0, 'the sitemap lists promo pages');
  const byTeam = new Map<string, string[]>();
  for (const p of promos) {
    const [, sport, team] = PROMO_RE.exec(p)!;
    byTeam.set(`/${sport}/${team}`, [...(byTeam.get(`/${sport}/${team}`) ?? []), p]);
  }
  const missing = (
    await pool([...byTeam], async ([team, paths]) => {
      const hrefs = anchorHrefs(await teamPage(team));
      return paths.filter((p) => !hrefs.has(p));
    })
  ).flat();
  console.log(`promo URLs ${promos.length}, team pages ${byTeam.size}, linked ${promos.length - missing.length}, missing ${missing.length}`);
  assert.deepEqual(missing, [], `${missing.length} of ${promos.length} sitemap promo URLs have no href on their team page:\n${missing.join('\n')}`);
});

test(`no team page's server HTML passes ${MAX_TEAM_PAGE_BYTES.toLocaleString('en-US')} bytes (${HOST})`, async () => {
  const teams = (await sitemap()).filter((p) => TEAM_RE.test(p));
  assert.ok(teams.length > 100, `${teams.length} team pages in the sitemap`);
  const sizes = await pool(teams, async (t) => ({ t, bytes: Buffer.byteLength(await teamPage(t), 'utf8') }));
  sizes.sort((a, b) => b.bytes - a.bytes);
  console.log('largest:', sizes.slice(0, 5).map((s) => `${s.t} ${s.bytes}`).join(', '));
  const over = sizes.filter((s) => s.bytes > MAX_TEAM_PAGE_BYTES);
  assert.deepEqual(over, [], `team pages over ${MAX_TEAM_PAGE_BYTES} bytes:\n${over.map((s) => `${s.t} ${s.bytes}`).join('\n')}`);
});

const unescape = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// The stored description as the About section renders it: the first paragraph
// after the "About this …" heading, unless that is the package note or line.
const ABOUT_RE = /About this [^<]*<\/h2><p class="m-0 text-\[15px\] leading-\[1\.55\] text-rd-ink-soft">([^<]*)<\/p>/;
const PACKAGE_LINES = /^(Comes with a special ticket package\.|Package: )/;

test(`every sitemap promo page's meta description is 100 to 155, under 120 only with its whole description (${HOST})`, async () => {
  const promos = (await sitemap()).filter((p) => PROMO_RE.test(p));
  const rows = await pool(promos, async (p) => {
    const html = await promoPage(p);
    const meta = unescape(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '');
    const about = unescape(ABOUT_RE.exec(html)?.[1] ?? '');
    return { p, meta, stored: PACKAGE_LINES.test(about) ? '' : about };
  });
  const bad = rows.flatMap(({ p, meta, stored }) => {
    const n = meta.length;
    if (n < 100 || n > 155) return [`${p} ${n}: ${meta}`];
    if (n < 120 && (meta.endsWith('…') || !meta.includes(stored.replace(/[.!?]$/, '')))) return [`${p} ${n}, stored text unused: ${meta}`];
    return [];
  });
  const short = rows.filter((r) => r.meta.length < 120).length;
  console.log(`promo pages ${rows.length}, under 120 ${short}, shortest ${Math.min(...rows.map((r) => r.meta.length))}, longest ${Math.max(...rows.map((r) => r.meta.length))}, failing ${bad.length}`);
  assert.deepEqual(bad, [], `${bad.length} promo meta descriptions break the rule:\n${bad.join('\n')}`);
});

// 4-6 (chore/bot-firewall, 2026-11-02). One real user agent per always-allow
// class: verified search, Google ads, Criteo, AI search and assistants, SEO,
// link previews, ad verification (ops/firewall/PROPOSAL.md, allow list).
// Sent from this machine they are not Vercel-verified, so a 200 here proves no
// rule of ours keys on these agents' user agents; it cannot prove what the
// firewall does for the vendors' own IPs.
const ORIGIN = 'https://www.getpromonight.com';
const OUR_HOSTS = new Set(['www.getpromonight.com', 'getpromonight.com', new URL(HOST).hostname]);

/** Every og:image, twitter:image and JSON-LD `image` URL in the HTML, as
 *  written (absolute or root-relative). */
function pageImages(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g)) out.push(m[1].replace(/&amp;/g, '&'));
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'image') walkImage(x);
        else walk(x);
      }
    }
  };
  const walkImage = (x: unknown): void => {
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach(walkImage);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.url === 'string') out.push(o.url);
      if (typeof o.contentUrl === 'string') out.push(o.contentUrl);
      walk(o);
    }
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) walk(JSON.parse(m[1]));
  return out;
}

/** `count` paths spread evenly through `paths`. */
const spread = (paths: string[], count: number) =>
  paths.length <= count ? paths : Array.from({ length: count }, (_, i) => paths[Math.floor((i * paths.length) / count)]);

const ALLOW_LIST_AGENTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  'Mediapartners-Google',
  'Mozilla/5.0 (compatible; AdsBot-Google/1.0; +http://www.google.com/adsbot.html)',
  'CriteoBot/0.1 (+https://www.criteo.com/criteo-crawler/)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +claude-searchbot@anthropic.com)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +claude-user@anthropic.com)',
  'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36 (compatible; DoubleVerifyBot/1.1; +http://www.doubleverify.com)',
  'IAS Crawler (ias_crawler; http://integralads.com/site-indexing-policy/)',
  'ias-sync/3.3 (former https://www.admantx.com + https://integralads.com/about-ias/)',
  'peer39_crawler/1.0',
  'Mozilla/5.0 (compatible; proximic; +https://www.comscore.com/Web-Crawler)',
  'Verity/1.1 (https://gumgum.com/verity; verity-support@gumgum.com)',
  'Mozilla/5.0 (compatible; TTD-Content; +https://www.thetradedesk.com/general/ttd-content)',
  'PubMatic Crawler Bot',
  'Mozilla/5.0 (Windows NT 6.3;compatible; Leikibot/1.0; +http://www.leiki.com)',
  'RaptiveMegacrawler/1.0 (+https://megacrawler-bot-auth.development.raptive.com)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; AudigentAdBot; +http://www.audigent.com/bot.html) Chrome/W.X.Y.Z Safari/537.36',
  'weborama-fetcher (+http://www.weborama.com)',
  'Mozilla/5.0 (compatible; DVBot/1.0; +http://www.doubleverify.com)',
  'IAS_wombles/1.0 (+https://integralads.com/site-indexing-policy/)',
  'Mozilla/5.0 (compatible; SlickBot/1.0)',
  'Mozilla/5.0 (compatible; SinceraSyntheticUser/1.0)',
  'Mozilla/5.0 (compatible; AmazonAdBot/1.0; +https://adbot.amazon.com)',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'WhatsApp/2.23.20.0',
  'TelegramBot (like TwitterBot)',
  'Pinterest/0.2 (+https://www.pinterest.com/bot.html)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36 Edg/91.0.864.54 MicrosoftPreview/2.0 +https://aka.ms/MicrosoftPreview',
  'Bluesky Cardyb/1.1',
];

test(`/ads.txt and /app-ads.txt answer 200 text/plain to every client (${HOST})`, async () => {
  const agents = [
    '',
    'curl/8.7.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Google-adstxt',
    'bidswitchbot/1.0',
    ...ALLOW_LIST_AGENTS.slice(0, 2),
  ];
  const bad: string[] = [];
  for (const path of ['/ads.txt', '/app-ads.txt']) {
    for (const ua of agents) {
      const got = await probe(path, ua);
      if (!/^200 text\/plain/.test(got)) bad.push(`${path} [${ua || 'no UA'}] -> ${got}`);
    }
  }
  assert.deepEqual(bad, []);
});

test(`every always-allow agent gets 200 on a promo page and an image from its card (${HOST})`, async () => {
  const promo = (await sitemap()).find((p) => PROMO_RE.test(p));
  assert.ok(promo, 'a promo page in the sitemap');
  const html = await promoPage(promo);
  // Every image route the page names (og:image is the share card since
  // 2026-11-03, the JSON-LD image is still the promo card).
  const cards = [...new Set(pageImages(html).map((u) => new URL(u, ORIGIN)).filter((u) => u.pathname.startsWith('/api/')).map((u) => u.pathname + u.search))];
  assert.ok(cards.length > 0, `an /api/ image on ${promo}`);
  const bad: string[] = [];
  for (const ua of [...ALLOW_LIST_AGENTS, 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)']) {
    const page = await probe(promo, ua);
    if (!/^200 text\/html/.test(page)) bad.push(`${promo} [${ua}] -> ${page}`);
    for (const card of cards) {
      const img = await probe(card, ua);
      if (!/^200 image\//.test(img)) bad.push(`${card} [${ua}] -> ${img}`);
    }
  }
  console.log(`agents ${ALLOW_LIST_AGENTS.length + 1}, promo ${promo}, cards ${cards.join(' ')}`);
  assert.deepEqual(bad, []);
});

test(`every /download? anchor on sitemap pages is rel="nofollow" (${HOST})`, async () => {
  const paths = (await sitemap()).filter((p) => PROMO_RE.test(p) || TEAM_RE.test(p));
  const rows = await pool(paths, async (p) => {
    const html = PROMO_RE.test(p) ? await promoPage(p) : await teamPage(p);
    const anchors = [...html.matchAll(/<a\b[^>]*?\shref="\/download\?[^"]*"[^>]*>/g)].map((m) => m[0]);
    return { p, anchors, missing: anchors.filter((a) => !/\srel="[^"]*\bnofollow\b[^"]*"/.test(a)) };
  });
  const total = rows.reduce((n, r) => n + r.anchors.length, 0);
  const bad = rows.flatMap((r) => r.missing.map((a) => `${r.p}: ${a}`));
  console.log(`pages ${rows.length}, /download? anchors ${total}, without nofollow ${bad.length}`);
  assert.ok(total > 0, 'found /download? anchors');
  assert.deepEqual(bad, [], `${bad.length} /download? anchors lack rel="nofollow":\n${bad.slice(0, 20).join('\n')}`);
});

test(`every page image on our domain is allowed by robots.txt for card fetchers and crawlers (${HOST})`, async () => {
  const local = process.env.ROBOTS_SOURCE === 'local';
  const robots = robotsParser(`${ORIGIN}/robots.txt`, local ? robotsTxt() : await get('/robots.txt'));
  const all = await sitemap();
  const promo = all.filter((p) => PROMO_RE.test(p));
  const team = all.filter((p) => TEAM_RE.test(p));
  const venue = all.filter((p) => p.startsWith('/venues/'));
  const aggregator = all.filter((p) => !PROMO_RE.test(p) && !TEAM_RE.test(p) && !p.startsWith('/venues/'));
  const sample = {
    promo: spread(promo, 20),
    team: spread(team, 10),
    venue: spread(venue, 8),
    // Hubs, /teams, /venues, /playoffs, the /promos and /best-promos boards,
    // the homepage, and a few rivalry pages.
    aggregator: [...new Set(['/', ...aggregator.filter((p) => !p.startsWith('/cfb/rivalries/')), ...spread(aggregator.filter((p) => p.startsWith('/cfb/rivalries/')), 3)])],
  };
  const pages = Object.entries(sample).flatMap(([kind, paths]) => paths.map((p) => ({ kind, p })));
  const rows = await pool(pages, async ({ kind, p }) => ({ kind, p, images: pageImages(PROMO_RE.test(p) ? await promoPage(p) : await get(p)) }));
  const agents = ['Googlebot', 'Twitterbot', 'facebookexternalhit', '*'];
  const bad: string[] = [];
  const routes = new Map<string, number>();
  let checked = 0;
  for (const { kind, p, images } of rows) {
    for (const raw of images) {
      const u = new URL(raw, ORIGIN);
      if (!OUR_HOSTS.has(u.hostname)) continue;
      checked++;
      const route = u.pathname.split('/').slice(0, 3).join('/');
      routes.set(route, (routes.get(route) ?? 0) + 1);
      for (const ua of agents) {
        if (robots.isAllowed(`${ORIGIN}${u.pathname}${u.search}`, ua) !== true) bad.push(`${kind} ${p}: ${u.pathname} disallowed for ${ua}`);
      }
    }
  }
  const counts = Object.entries(sample).map(([k, v]) => `${k} ${v.length}`).join(', ');
  console.log(`robots ${local ? 'local src/lib/robots-txt.ts' : 'served'}; pages ${counts}; images on our domain ${checked}; routes ${[...routes].map(([r, n]) => `${r} ${n}`).join(', ')}`);
  for (const [kind, paths] of Object.entries(sample)) assert.ok(paths.length > 0, `sampled ${kind} pages`);
  assert.ok(checked > 0, 'found images on our domain');
  assert.deepEqual(bad, [], `${bad.length} page images are disallowed:\n${[...new Set(bad)].slice(0, 20).join('\n')}`);
});

// ── 8. the explainer library reaches the deployed page ───────────────────────

/** Live pages whose themeKey has a library entry (pride, star-wars,
 *  fan-appreciation), chosen far out so the list stays valid; refresh it from
 *  the data when they pass (scripts/audit-team-colors.ts shows the query
 *  shape). A 404 here means the page is gone, not that the guide is. */
const GUIDE_PAGES = [
  '/mlb/san-francisco-giants/promos/pride-night',
  '/mlb/san-francisco-giants/promos/star-wars-day',
  '/nba/san-antonio-spurs/promos/fan-appreciation-night',
];
const GUIDE_LABEL = 'General guide';
const GUIDE_TITLE_RE = /<h2 class="rd-display[^"]*">(?:<span[^>]*><\/span>)?What to expect /;

test(`a promo page with an explainer match renders the General guide block (${HOST})`, async () => {
  for (const path of GUIDE_PAGES) {
    let html: string;
    try {
      html = await promoPage(path);
    } catch (err) {
      if (/^404 /.test(String((err as Error).message))) continue;
      throw err;
    }
    assert.ok(html.includes(GUIDE_LABEL), `${path}: no "${GUIDE_LABEL}" block. The explainer files are not reaching the serverless bundle (next.config.ts outputFileTracingIncludes for the promo route), or the page lost its themeKey.`);
    assert.match(html, GUIDE_TITLE_RE, `${path}: the guide's title`);
    return;
  }
  // Every candidate is gone: sample the sitemap's promo pages, newest first.
  const paths = (await sitemap()).filter((p) => PROMO_RE.test(p)).slice(-40).reverse();
  const hits = await pool(paths, async (p) => ((await promoPage(p)).includes(GUIDE_LABEL) ? p : null));
  assert.ok(hits.some(Boolean), `none of ${paths.length} sitemap promo pages carries a "${GUIDE_LABEL}" block; refresh GUIDE_PAGES, and check next.config.ts outputFileTracingIncludes`);
});

// ── guard 9: browser back returns the fan to the rail (ux-review 2026-11-08, D1) ──
// After a tap on a rail card and browser back, Chromium restored the scroll
// position and then, when the Raptive script tore its slots down and
// re-inserted them inside the article, scroll anchoring moved the window a
// full screen past where the fan left (+780 to +1,040px, every run, both
// environments). The fix is overflow-anchor: none on the promo page article.
// A served-HTML check cannot see this; it needs a browser with the ad script
// running, so this guard drives one (Playwright, a devDependency since
// 2026-11-08; `npx playwright install chromium` once per machine).
const BACK_TOLERANCE_PX = 50;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

test(`browser back from a rail card restores the scroll position within ${BACK_TOLERANCE_PX}px with the Raptive script running (${HOST})`, { timeout: 600_000 }, async (t) => {
  // A promo page with a rail AND ad slots above it: the jump is the height
  // of the slots Raptive re-inserts above the rail after back, so a short
  // page with one slot above its rail barely moves (the Ducks' kids socks
  // page: +310px) while a long one moves a full screen (the Flames' Hockey
  // Fights Cancer page: +1,190px, four slots). The guard takes the sitemap's
  // promo pages with a rail in order, opens up to six, and uses the first
  // with three or more filled slots above the rail, else the one with the
  // most, so it measures where the defect is largest.
  const promos = (await sitemap()).filter((p) => PROMO_RE.test(p));
  const withRail: string[] = [];
  for (const p of promos.slice(0, 40)) {
    if (((await promoPage(p)).match(/role="listitem"/g) ?? []).length >= 2) withRail.push(p);
    if (withRail.length >= 6) break;
  }
  assert.ok(withRail.length, 'no sitemap promo page with a rail among the first 40');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: BROWSER_UA, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const slotsAbove = () => page.evaluate(() => {
      const card = document.querySelector('a[role="listitem"]');
      const section = card?.closest('section');
      const heading = section?.querySelector('h2') ?? section;
      if (!heading) return -1;
      const railTop = heading.getBoundingClientRect().top + window.scrollY;
      return [...document.querySelectorAll('.adthrive-ad')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top + window.scrollY < railTop; }).length;
    });
    let path = withRail[0];
    let best = -1;
    for (const p of withRail) {
      await page.goto(`${HOST}${p}`, { waitUntil: 'load', timeout: 180_000 });
      await page.waitForTimeout(5_000);
      const n = await slotsAbove();
      if (n > best) { best = n; path = p; }
      if (n >= 3) break;
    }
    const start = `${HOST}${path}`;
    if (page.url() !== start) {
      await page.goto(start, { waitUntil: 'load', timeout: 180_000 });
      await page.waitForTimeout(5_000);
    }
    const raptive = await page.evaluate(() => [...document.body.classList].some((c) => c.startsWith('adthrive-')) || 'adthrive' in window);
    assert.ok(raptive, `${path}: the Raptive script is not running (no adthrive- body class, no window.adthrive), so the guard cannot measure the jump it exists to catch`);
    assert.ok(best >= 1, `${path}: no filled ad slot above the rail on any of ${withRail.length} candidate pages; the guard has nothing to measure against`);
    // The rail heading to the top of the viewport, then settle.
    await page.evaluate(() => {
      const card = document.querySelector('a[role="listitem"]');
      const section = card?.closest('section');
      (section?.querySelector('h2') ?? section)?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(2_000);
    const pre = await page.evaluate(() => window.scrollY);
    assert.ok(pre > 500, `${path}: the rail heading did not scroll into place (scrollY ${pre})`);
    await Promise.all([
      page.waitForURL((u) => u.toString() !== start, { waitUntil: 'load', timeout: 180_000 }),
      page.click('a[role="listitem"]'),
    ]);
    await page.waitForTimeout(1_500);
    await page.goBack({ waitUntil: 'load', timeout: 180_000 });
    await page.waitForTimeout(5_000);
    const post = await page.evaluate(() => window.scrollY);
    const delta = post - pre;
    t.diagnostic(`${path}: ${best} ad slots above the rail; scrollY ${pre} before the tap, ${post} five seconds after back (${delta > 0 ? '+' : ''}${delta}px)`);
    assert.ok(
      Math.abs(delta) <= BACK_TOLERANCE_PX,
      `${path} (${best} ad slots above the rail): scrollY ${pre} before the tap, ${post} five seconds after back (${delta > 0 ? '+' : ''}${delta}px). The fan lost their place. overflow-anchor: none on the promo page article is the fix (ux-review 2026-11-08, D1).`,
    );
  } finally {
    await browser.close();
  }
});
