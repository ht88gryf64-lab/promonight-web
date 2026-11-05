import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  PROMO_FALLBACK_PATH,
  resolvePromoCode,
  shortLinkRoutes,
  TEAM_SHORT_RE,
  teamShortRedirects,
  withSearch,
} from '../social-bridge';

/**
 * The social bridge: the short links the video pipeline prints, resolved
 * here. The team map is generated (promo-video `npm run export-social-bridge`),
 * so the contract on its shape is what keeps a bad export out of
 * next.config: every slug typeable and unique, every destination one of the
 * site's own page routes, and no slug shadowing a real top-level route.
 */

const TEAM_PATH = /^\/(mlb|nba|nhl|nfl|mls|wnba)\/[a-z0-9][a-z0-9-]*$/;
const SCHOOL_PATH = /^\/cfb\/[a-z0-9][a-z0-9-]*$/;

/** Every static top-level route under src/app (a folder that is not dynamic, private or a group). */
const topLevelRoutes = (): string[] =>
  readdirSync('src/app', { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[[(_]/.test(d.name) && !d.name.startsWith('.'))
    .map((d) => d.name);

describe('the team short links', () => {
  const routes = shortLinkRoutes();
  const entries = Object.entries(routes);

  it('is the generated map, every team and school present', () => {
    const file = JSON.parse(readFileSync('src/config/social-bridge.json', 'utf8')) as { routes: Record<string, string>; generatedAt: string };
    assert.deepEqual(routes, file.routes);
    assert.match(file.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(entries.filter(([, p]) => TEAM_PATH.test(p)).length, 169, 'one link per team');
    assert.equal(entries.filter(([, p]) => SCHOOL_PATH.test(p)).length, 87, 'one link per school');
  });

  it('has typeable, unique slugs and only the site\'s own pages as destinations', () => {
    for (const [short, path] of entries) {
      assert.match(short, TEAM_SHORT_RE, short);
      assert.ok(TEAM_PATH.test(path) || SCHOOL_PATH.test(path), `${short} -> ${path}`);
    }
    assert.equal(new Set(entries.map(([, p]) => p)).size, entries.length, 'two slugs never share a page');
  });

  it('never shadows a real top-level route or a league hub', () => {
    const reserved = new Set([...topLevelRoutes(), 'p', 'api', 'sitemap.xml', 'robots.txt']);
    for (const short of Object.keys(routes)) assert.ok(!reserved.has(short), `/${short} is a real route`);
  });

  it('becomes one temporary redirect per slug, the query string left to Next', () => {
    const redirects = teamShortRedirects({ islanders: '/nhl/new-york-islanders', notredame: '/cfb/notre-dame' });
    assert.deepEqual(redirects, [
      { source: '/islanders', destination: '/nhl/new-york-islanders', permanent: false },
      { source: '/notredame', destination: '/cfb/notre-dame', permanent: false },
    ]);
    assert.equal(teamShortRedirects().length, entries.length);
    for (const r of teamShortRedirects()) assert.equal(r.permanent, false, `${r.source} must stay temporary`);
  });

  it('is wired into next.config from the same file, temporary, as the first redirects', () => {
    const config = readFileSync('next.config.ts', 'utf8');
    assert.match(config, /import socialBridge from '\.\/src\/config\/social-bridge\.json';/);
    assert.match(config, /Object\.entries\(socialBridge\.routes\)\.map\(\(\[short, destination\]\) => \(\{\s*source: `\/\$\{short\}`,\s*destination,\s*permanent: false,/);
  });
});

describe('the promo short link', () => {
  const upcoming = [
    { teamId: 'new-york-islanders', promoId: '219f40551981491f', date: '2026-11-07', pageSlug: 'camo-hat-2026-11-07' },
    { teamId: 'new-jersey-devils', promoId: '219f40aa00000001', date: '2026-11-09', pageSlug: 'bobblehead-2026-11-09' },
    { teamId: 'dallas-stars', promoId: 'abcdef0123456789', date: '2026-11-07', pageSlug: 'puck-night-2026-11-07' },
  ];

  it('resolves the six-character code when one upcoming promo carries it', () => {
    assert.equal(resolvePromoCode('abcdef', null, upcoming)?.teamId, 'dallas-stars');
    assert.equal(resolvePromoCode('ABCDEF', undefined, upcoming)?.teamId, 'dallas-stars');
  });

  it('settles a shared prefix with the whole id from utm_content, and refuses to guess without it', () => {
    assert.equal(resolvePromoCode('219f40', '219f40551981491f', upcoming)?.teamId, 'new-york-islanders');
    assert.equal(resolvePromoCode('219f40', '219f40aa00000001', upcoming)?.teamId, 'new-jersey-devils');
    assert.equal(resolvePromoCode('219f40', null, upcoming), null);
    assert.equal(resolvePromoCode('219f40', 'not-an-id', upcoming), null);
    // A whole id that matches nothing upcoming does not override a lone prefix match.
    assert.equal(resolvePromoCode('abcdef', '0000000000000000', upcoming)?.teamId, 'dallas-stars');
  });

  it('resolves nothing for a malformed code or a code with no upcoming promo', () => {
    for (const code of ['', 'abc', 'abcdefg', 'zzzzzz', '../../', '219f40551981491f']) assert.equal(resolvePromoCode(code, null, upcoming), null, code);
    assert.equal(resolvePromoCode('abcdef', null, []), null);
  });

  it('carries the query string onto the destination and falls back to today\'s board', () => {
    assert.equal(withSearch('/nhl/dallas-stars/promos/puck-night-2026-11-07', new URLSearchParams('utm_source=meta&utm_medium=social&utm_campaign=gameday&utm_content=abcdef0123456789')), '/nhl/dallas-stars/promos/puck-night-2026-11-07?utm_source=meta&utm_medium=social&utm_campaign=gameday&utm_content=abcdef0123456789');
    assert.equal(withSearch('/promos/today', new URLSearchParams('')), '/promos/today');
    assert.equal(PROMO_FALLBACK_PATH, '/promos/today');
  });
});
