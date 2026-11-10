// The empty query string (fix/gsc-cleanup-2026-11): "/nba/minnesota-timberwolves?"
// was indexed as its own URL. No builder may leave a bare "?". (The served-HTML
// twin is the test:live guard; there is no middleware redirect, see url-query.ts.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withQuery } from '../url-query';
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
