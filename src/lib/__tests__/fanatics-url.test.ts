import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { buildFanaticsUrl, stripFanaticsRuntimeParams, isPartnerActive } from '../affiliates';
import { FANATICS_AD_IDS } from '../fanatics-ad-ids';

const PREFIX = 'https://fanatics.93n6tx.net/c/7236189';
const TWINS_DEST = 'https://www.fanatics.com/mlb/minnesota-twins/o-2321+t-92119851+z-8173-1236932534';

const twins = {
  id: 'minnesota-twins',
  fanaticsUrl: TWINS_DEST,
  fanaticsPath: '/mlb/minnesota-twins/o-2321+t-92119851+z-8173-1236932534',
};

/** The `u` param, still percent-encoded exactly as it appears in the href. */
function rawUParam(href: string): string {
  const m = /[?&]u=([^&]*)$/.exec(href);
  assert.ok(m, `no trailing u= param in ${href}`);
  return m[1];
}

describe('buildFanaticsUrl', () => {
  test('routes through the Impact /c/ redirect with the per-team adId', () => {
    const href = buildFanaticsUrl({ team: twins, surface: 'web_team_page' });
    assert.ok(href.startsWith(`${PREFIX}/618882/9663?`), href);
  });

  test('falls back to the generic adId for an unmapped team', () => {
    const href = buildFanaticsUrl({
      team: { id: 'portland-fire', fanaticsUrl: 'https://www.fanatics.com/wnba/portland-fire' },
      surface: 'web_team_page',
    });
    assert.ok(href.startsWith(`${PREFIX}/586570/9663?`), href);
  });

  test('subId1 is `${surface}_${team.id}`, matching TicketNetwork', () => {
    const href = buildFanaticsUrl({ team: twins, surface: 'web_team_page' });
    assert.ok(href.includes('?subId1=web_team_page_minnesota-twins&'), href);
  });

  test("single-encodes the destination: '+' becomes %2B, never a raw '+'", () => {
    const u = rawUParam(buildFanaticsUrl({ team: twins, surface: 'web_team_page' }));
    assert.equal(u, encodeURIComponent(TWINS_DEST));
    assert.ok(u.includes('%2B'), 'catalog separators must survive as %2B');
    assert.ok(!u.includes('+'), 'no raw + may appear in the query');
    // No double-encoding: a second decode must not still look encoded.
    assert.equal(decodeURIComponent(u), TWINS_DEST);
    assert.ok(!u.includes('%25'), 'a %25 would mean the % of %2B was re-encoded');
  });

  test('accepts the legacy fanaticsPath when fanaticsUrl is absent', () => {
    const href = buildFanaticsUrl({
      team: { id: 'minnesota-twins', fanaticsPath: twins.fanaticsPath },
      surface: 'web_team_page',
    });
    assert.equal(decodeURIComponent(rawUParam(href)), TWINS_DEST);
  });

  test('strips runtime tracking params before wrapping', () => {
    const href = buildFanaticsUrl({
      team: {
        id: 'minnesota-twins',
        fanaticsUrl: `${TWINS_DEST}?_ref=abc&irclickid=xyz&utm_source=web&SSAID=1&irgwc=1&afsrc=1&_s=q`,
      },
      surface: 'web_team_page',
    });
    const dest = decodeURIComponent(rawUParam(href));
    assert.equal(dest, TWINS_DEST, 'destination must be the bare canonical URL');
    for (const p of ['irclickid', 'utm_', 'SSAID', 'ssaid', '_ref', 'irgwc', 'afsrc']) {
      assert.ok(!href.includes(p), `${p} leaked into the href`);
    }
  });

  test('preserves non-tracking query params on the destination', () => {
    assert.equal(
      stripFanaticsRuntimeParams('https://www.fanatics.com/mlb?size=XL&irclickid=z'),
      'https://www.fanatics.com/mlb?size=XL',
    );
  });

  test('leaves a query-less destination byte-identical', () => {
    assert.equal(stripFanaticsRuntimeParams(TWINS_DEST), TWINS_DEST);
  });

  test('passes an unparseable destination through rather than dropping it', () => {
    assert.equal(stripFanaticsRuntimeParams('not a url'), 'not a url');
  });

  test('an empty destination still routes through Impact', () => {
    const href = buildFanaticsUrl({ team: { id: 'nonexistent-team' }, surface: 'web_team_page' });
    assert.ok(href.startsWith(`${PREFIX}/586570/9663?`), href);
    assert.equal(decodeURIComponent(rawUParam(href)), 'https://www.fanatics.com');
  });

  test('tracking is always active (hardcoded constants, no env var)', () => {
    assert.equal(isPartnerActive('fanatics'), true);
  });
});

describe('FANATICS_AD_IDS', () => {
  test('every adId is a bare numeric string', () => {
    for (const [team, adId] of Object.entries(FANATICS_AD_IDS)) {
      assert.match(adId, /^\d+$/, `${team} has a non-numeric adId: ${adId}`);
    }
  });

  test('adIds are unique per team and never collide with the generic id', () => {
    const ids = Object.values(FANATICS_AD_IDS);
    assert.equal(new Set(ids).size, ids.length, 'duplicate adId across teams');
    assert.ok(!ids.includes('586570'), 'a per-team adId must not equal the generic fallback');
  });
});
