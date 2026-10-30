// The one inbound-link helper (Phase 3c) and the loader-side stamp: the
// linking rule, the canonical winner, the season guard, and the flag gate on
// the mapper's page fields. Pure, no Firestore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Promo, PromoWithTeam, Team } from '../types';
import { promoPageHref } from '../promo-page-href';
import { attachPromoPageFields, stampPromoPageCanonical } from '../promo-page-stamp';
import { inferSurfaceFromPath } from '../analytics';

const STARS = { id: 'dallas-stars', sportSlug: 'nhl', league: 'NHL' } as Team;
const TWINS = { id: 'minnesota-twins', sportSlug: 'mlb', league: 'MLB' } as Team;
const P = (over: Partial<Promo>): Promo => ({ date: '2026-11-18', time: '', opponent: '', type: 'giveaway', title: 'Esa Lindell Bobblehead', description: '', highlight: false, icon: '', recurring: false, pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026-27', ...over });
const ON: NodeJS.ProcessEnv = { ...process.env, PROMO_PAGES_LIVE: 'true' };
const OFF: NodeJS.ProcessEnv = { ...process.env, PROMO_PAGES_LIVE: '' };

test('promoPageHref: team + slug, the canonical winner first, never a row that may not link', () => {
  assert.equal(promoPageHref(P({}), STARS), '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
  assert.equal(promoPageHref({ ...P({}), team: STARS } as PromoWithTeam), '/nhl/dallas-stars/promos/esa-lindell-bobblehead', 'a PromoWithTeam needs no team argument');
  assert.equal(promoPageHref(P({ pageCanonicalSlug: 'esa-lindell-bobblehead-night' }), STARS), '/nhl/dallas-stars/promos/esa-lindell-bobblehead-night', 'a loser links to its winner');
  assert.equal(promoPageHref(P({ pageSlug: undefined }), STARS), null, 'no slug (the flag off, or an unslugged row)');
  assert.equal(promoPageHref(P({ tombstoned: true }), STARS), null, 'tombstoned');
  assert.equal(promoPageHref(P({ date: '' }), STARS), null, 'dateless');
  assert.equal(promoPageHref(P({ date: 'TBD' }), STARS), null, 'not a date');
  assert.equal(promoPageHref(P({ title: '  ' }), STARS), null, 'nameless (noindex)');
  assert.equal(promoPageHref(P({ isPostseason: true }), STARS), null, 'postseason row');
  assert.equal(promoPageHref(P({})), null, 'no team at all');
});

test('attachPromoPageFields: the page fields ride only while the flag is on', () => {
  const data = { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026-27', imageTier: 1 };
  const off = attachPromoPageFields(P({ pageSlug: undefined, pageSeason: undefined }), data, OFF);
  assert.equal(off.pageSlug, undefined);
  assert.equal(off.pageSeason, undefined);
  const on = attachPromoPageFields(P({ pageSlug: undefined, pageSeason: undefined }), data, ON);
  assert.equal(on.pageSlug, 'esa-lindell-bobblehead');
  assert.equal(on.pageSeason, '2026-27');
  const blank = attachPromoPageFields(P({ pageSlug: undefined }), { pageSlug: '  ' }, ON);
  assert.equal(blank.pageSlug, undefined, 'a blank slug is no slug');
  assert.equal(Object.keys(on).includes('imageTier'), false, 'the tier is never published on the promo');
});

test('stampPromoPageCanonical: the tier 1 giveaway wins its date, every loser points at it, singletons are untouched', () => {
  const night = attachPromoPageFields(P({ title: 'Esa Lindell Bobblehead Night', type: 'theme', pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead-night', pageSeason: '2026-27' }, ON);
  const bobble = attachPromoPageFields(P({ pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026-27', imageTier: 1 }, ON);
  const other = attachPromoPageFields(P({ title: 'Hockey Fights Cancer', type: 'theme', pageSlug: undefined }), { pageSlug: 'hockey-fights-cancer', pageSeason: '2026-27' }, ON);
  const rows = stampPromoPageCanonical([night, bobble, other], () => STARS);
  assert.equal(rows.length, 3);
  assert.equal(night.pageCanonicalSlug, 'esa-lindell-bobblehead');
  assert.equal(bobble.pageCanonicalSlug, undefined);
  assert.equal(other.pageCanonicalSlug, undefined);
  assert.equal(promoPageHref(night, STARS), '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
});

test('stampPromoPageCanonical: without a tier 1 giveaway the most specific title wins; a different date is a different group', () => {
  const short = attachPromoPageFields(P({ title: 'Star Wars Night', type: 'theme', pageSlug: undefined }), { pageSlug: 'star-wars-night', pageSeason: '2026' }, ON);
  const long = attachPromoPageFields(P({ title: 'Star Wars Night Lightsaber Giveaway', pageSlug: undefined }), { pageSlug: 'star-wars-night-lightsaber-giveaway', pageSeason: '2026', imageTier: 3 }, ON);
  const nextDay = attachPromoPageFields(P({ title: 'Star Wars Night', type: 'theme', date: '2026-11-19', pageSlug: undefined }), { pageSlug: 'star-wars-night', pageSeason: '2026' }, ON);
  stampPromoPageCanonical([short, long, nextDay], () => TWINS);
  assert.equal(short.pageCanonicalSlug, 'star-wars-night-lightsaber-giveaway');
  assert.equal(long.pageCanonicalSlug, undefined);
  assert.equal(nextDay.pageCanonicalSlug, undefined, 'alone on its date');
});

test('stampPromoPageCanonical: an NHL special-ticket row is never a candidate; the same flag on an MLB row is', () => {
  const pack = attachPromoPageFields(P({ title: 'Esa Lindell Bobblehead Package', pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead-package', pageSeason: '2026-27', imageTier: 1, ticketPackageRequired: true }, ON);
  const bobble = attachPromoPageFields(P({ pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026-27', imageTier: 3 }, ON);
  stampPromoPageCanonical([pack, bobble], () => STARS);
  assert.equal(bobble.pageCanonicalSlug, undefined, 'the package is not a sibling on NHL');
  const mlbPack = attachPromoPageFields(P({ title: 'Esa Lindell Bobblehead Package', pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead-package', pageSeason: '2026', imageTier: 1, ticketPackageRequired: true }, ON);
  const mlbBobble = attachPromoPageFields(P({ pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026', imageTier: 3 }, ON);
  stampPromoPageCanonical([mlbPack, mlbBobble], () => TWINS);
  assert.equal(mlbBobble.pageCanonicalSlug, 'esa-lindell-bobblehead-package', 'outside NHL and NBA the flag is ignored, as the page ignores it');
});

test('stampPromoPageCanonical: a slug a later season also carries is cleared on the older rows', () => {
  const old = attachPromoPageFields(P({ date: '2025-11-01', pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2025-26' }, ON);
  const cur = attachPromoPageFields(P({ pageSlug: undefined }), { pageSlug: 'esa-lindell-bobblehead', pageSeason: '2026-27' }, ON);
  stampPromoPageCanonical([old, cur], () => STARS);
  assert.equal(promoPageHref(old, STARS), null, 'the resolver would serve the later season');
  assert.equal(promoPageHref(cur, STARS), '/nhl/dallas-stars/promos/esa-lindell-bobblehead');
});

test('stampPromoPageCanonical: a no-op over rows without slugs (the flag off)', () => {
  const rows = [P({ pageSlug: undefined, pageSeason: undefined }), P({ pageSlug: undefined, pageSeason: undefined, title: 'Esa Lindell Bobblehead Night' })];
  stampPromoPageCanonical(rows, () => STARS);
  assert.deepEqual(rows.map((r) => [r.pageSlug, r.pageCanonicalSlug]), [[undefined, undefined], [undefined, undefined]]);
});

test('page_view: a promo page is its own page type, web_promo_page, and the team page stays web_team_page', () => {
  assert.equal(inferSurfaceFromPath('/nhl/dallas-stars/promos/esa-lindell-bobblehead'), 'web_promo_page');
  assert.equal(inferSurfaceFromPath('/mlb/minnesota-twins/promos/star-wars-night-2026/'), 'web_promo_page');
  assert.equal(inferSurfaceFromPath('/nhl/dallas-stars'), 'web_team_page');
  assert.equal(inferSurfaceFromPath('/nhl/dallas-stars/promos'), 'web_team_page', 'no slug: not a promo page');
  assert.equal(inferSurfaceFromPath('/promos/today'), 'web_today');
});
