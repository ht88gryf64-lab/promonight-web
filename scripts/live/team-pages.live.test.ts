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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
  const card = /<meta property="og:image" content="https?:\/\/[^/"]+(\/api\/promo-card\/[^"]+)"/.exec(await promoPage(promo))?.[1]?.replace(/&amp;/g, '&');
  const bad: string[] = [];
  for (const ua of [...ALLOW_LIST_AGENTS, 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)']) {
    const page = await probe(promo, ua);
    if (!/^200 text\/html/.test(page)) bad.push(`${promo} [${ua}] -> ${page}`);
    if (card) {
      const img = await probe(card, ua);
      if (!/^200 image\//.test(img)) bad.push(`${card} [${ua}] -> ${img}`);
    }
  }
  console.log(`agents ${ALLOW_LIST_AGENTS.length + 1}, promo ${promo}, card ${card ?? 'none (page uses another image)'}`);
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
