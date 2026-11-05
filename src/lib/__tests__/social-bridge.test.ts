import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BIO_LINKS,
  bioLinkSearch,
  NOINDEX_HEADER,
  PROMO_FALLBACK_PATH,
  RESERVED_SHORT_SLUGS,
  resolvePromoCode,
  shortLinkRedirect,
  shortLinkRoutes,
  TEAM_SHORT_RE,
  teamShortRedirects,
  withSearch,
} from '../social-bridge';

/**
 * The social bridge: the short links the video pipeline prints and the
 * profile bio links, resolved here. The team map is generated (promo-video
 * `npm run export-social-bridge`), so the contract on its shape is what keeps
 * a bad export out of the middleware: every slug typeable and unique, every
 * destination one of the site's own page routes, and no slug shadowing a
 * real top-level route, a bio link or the promo link's prefix.
 */

const TEAM_PATH = /^\/(mlb|nba|nhl|nfl|mls|wnba)\/[a-z0-9][a-z0-9-]*$/;
const SCHOOL_PATH = /^\/cfb\/[a-z0-9][a-z0-9-]*$/;

/** Every static top-level route under src/app (a folder that is not dynamic, private or a group), plus the files Next serves at the root. */
const topLevelRoutes = (): string[] =>
  readdirSync('src/app', { withFileTypes: true })
    .filter((d) => !/^[[(_]/.test(d.name) && !d.name.startsWith('.') && d.name !== '__tests__')
    .map((d) => d.name.replace(/\.(tsx?|ico|png|json|txt|xml)$/, ''));

describe('the team short links', () => {
  const routes = shortLinkRoutes();
  const entries = Object.entries(routes);

  it('is the generated map, every team and school present, with its source hash', () => {
    const file = JSON.parse(readFileSync('src/config/social-bridge.json', 'utf8')) as { routes: Record<string, string>; generatedAt: string; sourceSha256: string };
    assert.deepEqual(routes, file.routes);
    assert.match(file.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(file.sourceSha256, /^[a-f0-9]{64}$/);
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

  it('never shadows a real top-level route, a bio link or the promo prefix', () => {
    const reserved = new Set([...topLevelRoutes(), ...RESERVED_SHORT_SLUGS]);
    assert.ok(reserved.has('nhl') && reserved.has('promos') && reserved.has('yt') && reserved.has('p'), [...reserved].join(','));
    for (const short of Object.keys(routes)) assert.ok(!reserved.has(short), `/${short} is a real route`);
  });

  it('describes one temporary redirect per slug', () => {
    assert.deepEqual(teamShortRedirects({ islanders: '/nhl/new-york-islanders', notredame: '/cfb/notre-dame' }), [
      { source: '/islanders', destination: '/nhl/new-york-islanders', permanent: false },
      { source: '/notredame', destination: '/cfb/notre-dame', permanent: false },
    ]);
    assert.equal(teamShortRedirects().length, entries.length);
  });
});

describe('the middleware hop', () => {
  const routes = { islanders: '/nhl/new-york-islanders', notredame: '/cfb/notre-dame' };
  const q = (s: string) => new URLSearchParams(s);

  it('sends a team or school slug to its page with the query string', () => {
    assert.deepEqual(shortLinkRedirect('/islanders', q('utm_source=youtube&utm_campaign=gameday'), routes), { location: '/nhl/new-york-islanders?utm_source=youtube&utm_campaign=gameday', kind: 'team' });
    assert.deepEqual(shortLinkRedirect('/notredame/', q(''), routes), { location: '/cfb/notre-dame', kind: 'team' });
  });

  it('sends the bio links to the homepage tagged by platform, over whatever the request carried', () => {
    assert.deepEqual(BIO_LINKS, { yt: 'youtube', tt: 'tiktok', ig: 'instagram', fb: 'facebook' });
    assert.deepEqual(shortLinkRedirect('/tt', q(''), routes), { location: '/?utm_source=tiktok&utm_medium=social&utm_campaign=bio', kind: 'bio' });
    assert.equal(shortLinkRedirect('/yt', q('utm_source=x&ref=abc'), routes)?.location, '/?utm_source=youtube&ref=abc&utm_medium=social&utm_campaign=bio');
    assert.equal(bioLinkSearch('facebook').toString(), 'utm_source=facebook&utm_medium=social&utm_campaign=bio');
  });

  it('leaves everything else alone', () => {
    for (const path of ['/', '/nhl', '/islanders/promos', '/Islanders', '/p/219f40', '/download', '/islanders.png', '/a', '/this-slug-is-far-too-long-to-be-one']) {
      assert.equal(shortLinkRedirect(path, q(''), routes), null, path);
    }
  });

  it('is wired in before the request counter, and answers noindex', () => {
    const mw = readFileSync('src/middleware.ts', 'utf8');
    const hop = mw.indexOf('shortLinkRedirect(request.nextUrl.pathname');
    const counter = mw.indexOf('countRequest(request, event, userAgent)');
    assert.ok(hop > 0 && counter > hop, 'the hop is answered before the counter runs');
    assert.match(mw, /status: 307, headers: NOINDEX_HEADER/);
    assert.deepEqual(NOINDEX_HEADER, { 'x-robots-tag': 'noindex' });
    assert.match(readFileSync('src/app/p/[code]/route.ts', 'utf8'), /\.\.\.NOINDEX_HEADER/);
    assert.doesNotMatch(readFileSync('next.config.ts', 'utf8'), /social-bridge/);
  });

  it('never reaches the sitemap', () => {
    const sitemap = readFileSync('src/app/sitemap.ts', 'utf8');
    assert.doesNotMatch(sitemap, /social-bridge|\/p\/|\/yt|\/tt|\/ig|\/fb/);
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
