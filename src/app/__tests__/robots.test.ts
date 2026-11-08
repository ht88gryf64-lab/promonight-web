// robots.txt guards (chore/bot-firewall, 2026-11-02).
//
// The text under test is what the route serves (src/app/robots.txt/route.ts).
// Verdicts are checked two ways: robots-parser applies RFC 9309 group selection
// (a crawler obeys its most specific group, else `*`) and longest-match
// precedence; firstMatch() below stops at the first matching line, the way
// older parsers (Python's urllib.robotparser among them) read a group. The file
// is written so both reach the same answers, and the line order is pinned.

import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import robotsParser from 'robots-parser';

import { GET } from '../robots.txt/route';
import { ROBOTS_AGENTS } from '@/lib/robots-txt';

const ORIGIN = 'https://www.getpromonight.com';
const NAMED_GROUPS = ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended'];
// Agents with no group of their own, so `*` decides for them.
const STAR_AGENTS = ['Googlebot', 'OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'Bingbot', 'SomeUnlistedBot'];
const PROMO_CARD = '/api/promo-card/c42db7fce52ee28c?team=boston-bruins&v=1793373766552';
const SHARE_CARD = '/api/share-card/c42db7fce52ee28c?team=boston-bruins&v=1793373766552';
const PROMO_PAGE = '/nhl/boston-bruins/promos/military-appreciation-night';
const PAGES = ['/', PROMO_PAGE, '/download', '/ads.txt', '/app-ads.txt', '/sitemap.xml'];

async function served() {
  const res = GET();
  return { res, text: await res.text() };
}

/** Groups as [agent, lines[]] in file order. */
function groups(text: string): Array<[string, string[]]> {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => block.startsWith('User-Agent:'))
    .map((block) => {
      const [head, ...lines] = block.split('\n');
      return [head.replace(/^User-Agent:\s*/, ''), lines];
    });
}

/** First-match reading: the agent's own group, else `*`; the first Allow or
 *  Disallow whose path is a prefix of the URL path decides. */
function firstMatch(text: string, path: string, ua: string): boolean {
  const all = groups(text);
  const group = all.find(([a]) => a.toLowerCase() === ua.toLowerCase()) ?? all.find(([a]) => a === '*');
  for (const line of group?.[1] ?? []) {
    const m = /^(Allow|Disallow):\s*(.*)$/.exec(line);
    if (m && m[2] && path.startsWith(m[2])) return m[1] === 'Allow';
  }
  return true;
}

describe('robots.txt', async () => {
  const { res, text } = await served();
  const parsed = robotsParser(`${ORIGIN}/robots.txt`, text);
  const longest = (path: string, ua: string) => parsed.isAllowed(`${ORIGIN}${path}`, ua) === true;

  it('is served 200 text/plain by the route, and app/robots.ts is gone (it would collide)', () => {
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
    assert.equal(existsSync(join(__dirname, '..', 'robots.ts')), false);
  });

  it('every group, in order, reads Allow: /api/promo-card/, Allow: /api/share-card/, Disallow: /api/, Allow: /', () => {
    const g = groups(text);
    assert.deepEqual(g.map(([a]) => a), [...NAMED_GROUPS, '*']);
    assert.deepEqual(g.map(([a]) => a), [...ROBOTS_AGENTS]);
    for (const [agent, lines] of g) {
      assert.deepEqual(lines, ['Allow: /api/promo-card/', 'Allow: /api/share-card/', 'Disallow: /api/', 'Allow: /'], agent);
    }
  });

  it('ends with the sitemap lines: the live sitemap, then the index that also names the played pages (step 6, 2026-11-08)', () => {
    assert.match(text, /\n\nSitemap: https:\/\/www\.getpromonight\.com\/sitemap\.xml\nSitemap: https:\/\/www\.getpromonight\.com\/sitemap-index\.xml\n$/);
    assert.deepEqual(parsed.getSitemaps(), [`${ORIGIN}/sitemap.xml`, `${ORIGIN}/sitemap-index.xml`]);
  });

  for (const ua of ['Googlebot', 'Twitterbot', 'facebookexternalhit', 'ClaudeBot', 'OAI-SearchBot', 'PerplexityBot', 'SomeUnlistedBot']) {
    it(`${ua}: /api/promo-card/<id> and /api/share-card/<id> allowed, /api/subscribe and /api/ disallowed, under longest match and first match`, () => {
      for (const read of [longest, (p: string, a: string) => firstMatch(text, p, a)]) {
        assert.equal(read(PROMO_CARD, ua), true);
        assert.equal(read('/api/promo-card/c42db7fce52ee28c', ua), true);
        assert.equal(read(SHARE_CARD, ua), true);
        assert.equal(read('/api/share-card/c42db7fce52ee28c', ua), true);
        assert.equal(read('/api/subscribe', ua), false);
        assert.equal(read('/api/revalidate', ua), false);
        assert.equal(read('/api/', ua), false);
      }
    });
  }

  it('the two readings agree for every agent on every path', () => {
    for (const ua of [...NAMED_GROUPS, ...STAR_AGENTS]) {
      for (const path of [...PAGES, PROMO_CARD, SHARE_CARD, '/api/subscribe', '/api/geo-region', '/api/']) {
        assert.equal(firstMatch(text, path, ua), longest(path, ua), `${ua} ${path}`);
      }
    }
  });

  it('no group blocks pages, /ads.txt or /app-ads.txt', () => {
    for (const ua of [...NAMED_GROUPS, ...STAR_AGENTS]) {
      for (const path of PAGES) {
        assert.equal(longest(path, ua), true, `${ua} ${path}`);
        assert.equal(firstMatch(text, path, ua), true, `${ua} ${path} (first match)`);
      }
    }
  });
});
