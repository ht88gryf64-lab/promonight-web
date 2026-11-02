// robots.txt guards (chore/bot-firewall, 2026-11-02).
//
// The served bytes come from Next's own serializer (resolveRobots), and the
// verdicts come from robots-parser, which applies RFC 9309 group selection
// (a crawler obeys its most specific group, else `*`) and longest-match
// precedence between Allow and Disallow. So these assertions are about what a
// crawler reading the real file would do, not about the shape of robots().

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import robotsParser from 'robots-parser';
const { resolveRobots } = require('next/dist/build/webpack/loaders/metadata/resolve-route-data') as {
  resolveRobots: (data: ReturnType<typeof robots>) => string;
};

import robots from '../robots';

const ORIGIN = 'https://www.getpromonight.com';
const TEXT = resolveRobots(robots());
const parsed = robotsParser(`${ORIGIN}/robots.txt`, TEXT);
const allowed = (path: string, ua: string) => parsed.isAllowed(`${ORIGIN}${path}`, ua) === true;

const NAMED_GROUPS = ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended'];
// Agents with no group of their own, so `*` decides for them.
const STAR_AGENTS = ['Googlebot', 'OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'Bingbot', 'SomeUnlistedBot'];
const PROMO_CARD = '/api/promo-card/c42db7fce52ee28c?team=boston-bruins&v=1793373766552';
const PROMO_PAGE = '/nhl/boston-bruins/promos/military-appreciation-night';

describe('robots.txt', () => {
  it('every group, including *, disallows /api/ and allows / and /api/promo-card/', () => {
    const { rules } = robots();
    const list = Array.isArray(rules) ? rules : [rules];
    assert.deepEqual(
      list.map((r) => r.userAgent),
      [...NAMED_GROUPS, '*'],
    );
    for (const r of list) {
      const allow = ([] as string[]).concat(r.allow ?? []);
      const disallow = ([] as string[]).concat(r.disallow ?? []);
      assert.ok(disallow.includes('/api/'), `${r.userAgent} disallows /api/`);
      assert.ok(allow.includes('/'), `${r.userAgent} allows /`);
      assert.ok(allow.includes('/api/promo-card/'), `${r.userAgent} allows /api/promo-card/`);
    }
  });

  it('the served text carries the rules in all seven groups', () => {
    const count = (s: string) => TEXT.split('\n').filter((l) => l.trim() === s).length;
    assert.equal(count('Disallow: /api/'), 7);
    assert.equal(count('Allow: /api/promo-card/'), 7);
    assert.equal(count('Allow: /'), 7);
  });

  for (const ua of ['Googlebot', 'ClaudeBot', 'OAI-SearchBot', 'PerplexityBot', 'SomeUnlistedBot']) {
    it(`${ua}: /api/promo-card/<id> allowed, /api/subscribe and /api/ disallowed (longest match)`, () => {
      assert.equal(allowed(PROMO_CARD, ua), true);
      assert.equal(allowed('/api/promo-card/c42db7fce52ee28c', ua), true);
      assert.equal(allowed('/api/subscribe', ua), false);
      assert.equal(allowed('/api/revalidate', ua), false);
      assert.equal(allowed('/api/', ua), false);
    });
  }

  it('every named group and every agent that falls to * disallows /api/ outside promo-card', () => {
    for (const ua of [...NAMED_GROUPS, ...STAR_AGENTS]) {
      assert.equal(allowed('/api/subscribe', ua), false, ua);
      assert.equal(allowed('/api/promo-card/x', ua), true, ua);
    }
  });

  it('no group blocks pages, /ads.txt or /app-ads.txt', () => {
    for (const ua of [...NAMED_GROUPS, ...STAR_AGENTS]) {
      for (const path of ['/', PROMO_PAGE, '/download', '/ads.txt', '/app-ads.txt', '/sitemap.xml']) {
        assert.equal(allowed(path, ua), true, `${ua} ${path}`);
      }
    }
  });

  it('keeps the sitemap line', () => {
    assert.deepEqual(parsed.getSitemaps(), [`${ORIGIN}/sitemap.xml`]);
  });
});
