// The empty query string (fix/gsc-cleanup-2026-11): "/nba/minnesota-timberwolves?"
// was indexed as its own URL. No builder may leave a bare "?", and the
// middleware sends one to the path in one 308 hop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { withQuery, bareQueryTarget, rawRequestUrl } from '../url-query';
import { withSearch } from '../social-bridge';
import { stripShareParams } from '../promo-share';
import { buildUtmUrl } from '../utm';

const ROOT = join(__dirname, '..', '..', '..');

test('withQuery: no "?" for an empty query, whatever its form', () => {
  assert.equal(withQuery('/teams', ''), '/teams');
  assert.equal(withQuery('/teams', '?'), '/teams');
  assert.equal(withQuery('/teams', new URLSearchParams()), '/teams');
  assert.equal(withQuery('/teams', new URLSearchParams({ league: 'nba' })), '/teams?league=nba');
  assert.equal(withQuery('/teams', '?league=nba'), '/teams?league=nba');
});

test('every query builder leaves no bare "?" when it has nothing to carry', () => {
  assert.equal(withSearch('/nba/minnesota-timberwolves', new URLSearchParams()), '/nba/minnesota-timberwolves');
  assert.equal(stripShareParams('/nba/minnesota-timberwolves/promos/noche-latina?s=abcd1234'), '/nba/minnesota-timberwolves/promos/noche-latina');
  assert.equal(stripShareParams('/nba/minnesota-timberwolves?'), '/nba/minnesota-timberwolves');
  assert.ok(!buildUtmUrl('https://www.getpromonight.com/nba/minnesota-timberwolves', { source: 'x', medium: 'y', campaign: 'z' }).endsWith('?'));
});

test('the URL-synced filters join their query through withQuery', () => {
  for (const f of ['src/components/scoring/filter-chips.tsx', 'src/components/scoring/team-rankings-list.tsx', 'src/components/scoring/best-promos-browser.tsx']) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.match(src, /withQuery\(pathname, qs\)/, f);
    assert.doesNotMatch(src, /`\$\{pathname\}\?\$\{qs\}`/, f);
  }
});

test('bareQueryTarget: only an empty query, read from the raw URL', () => {
  assert.equal(bareQueryTarget('https://www.getpromonight.com/nba/minnesota-timberwolves?'), 'https://www.getpromonight.com/nba/minnesota-timberwolves');
  assert.equal(bareQueryTarget('https://www.getpromonight.com/?'), 'https://www.getpromonight.com/');
  assert.equal(bareQueryTarget('https://www.getpromonight.com/nba/minnesota-timberwolves'), null);
  assert.equal(bareQueryTarget('https://www.getpromonight.com/nba/minnesota-timberwolves?utm_source=x'), null);
  assert.equal(bareQueryTarget('https://www.getpromonight.com/teams?league='), null, 'a named parameter, even empty, is a real query');
});

test('rawRequestUrl keeps the bare "?" that NextRequest.url drops', () => {
  const r = new NextRequest('https://www.getpromonight.com/nba/minnesota-timberwolves?');
  assert.equal(r.url, 'https://www.getpromonight.com/nba/minnesota-timberwolves', 'the normalized url');
  assert.equal(rawRequestUrl(r), 'https://www.getpromonight.com/nba/minnesota-timberwolves?');
  assert.equal(rawRequestUrl(new NextRequest('https://www.getpromonight.com/teams')), 'https://www.getpromonight.com/teams');
});

test('middleware: "path?" is one 308 to "path"; "path" and "path?x=1" pass', async () => {
  const { middleware } = await import('../../middleware');
  const ev = { waitUntil() {} } as never;
  const bare = await middleware(new NextRequest('https://www.getpromonight.com/nba/minnesota-timberwolves?'), ev);
  assert.equal(bare!.status, 308);
  assert.equal(bare!.headers.get('location'), 'https://www.getpromonight.com/nba/minnesota-timberwolves');
  // The target is not itself redirected: one hop.
  const target = await middleware(new NextRequest(bare!.headers.get('location')!), ev);
  assert.equal(target!.headers.get('location'), null);
  const real = await middleware(new NextRequest('https://www.getpromonight.com/nba/minnesota-timberwolves?utm_source=x'), ev);
  assert.equal(real!.headers.get('location'), null);
});
