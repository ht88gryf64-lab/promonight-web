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
