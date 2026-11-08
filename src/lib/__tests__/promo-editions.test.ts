// Editions (archive pass, step 6, 2026-11-08): the pure selection the
// loader, the view and the archive page share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveSeasons, editionKey, indexWindow, nextEditionFor, normalizedPromoName, playedDateIndexable, previousEditionsFor } from '../promo-editions';
import type { PromoPageRow } from '../promo-page-copy';

const href = (slug: string) => `/nhl/club/promos/${slug}`;
const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'p', date: '2026-10-28', title: 'Pride Night', description: '', type: 'theme', displayTime: '7:00 PM', displayOpponent: 'Wild', highlight: false,
  attendanceCap: null, presentedBy: null, whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null, ticketPackageName: null,
  sourceUrl: null, pageSlug: 'pride-night', pageSeason: '2026-27', themeKey: 'pride', imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: null,
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
const TODAY = '2026-11-08';

test('the normalized name drops seasons, years, punctuation and case; the key is the theme, else the name', () => {
  assert.equal(normalizedPromoName('Star Wars Night 2025-26'), 'star wars night');
  assert.equal(normalizedPromoName("Dr. J's Bobblehead (2026)"), 'dr j s bobblehead');
  assert.equal(editionKey({ themeKey: 'pride', title: 'Pride Night' }), 'theme:pride');
  assert.equal(editionKey({ themeKey: 'none', title: 'Rally Towel' }), 'name:rally towel');
  assert.equal(editionKey({ themeKey: null, title: 'Rally Towel Night 2025' }), 'name:rally towel night');
});

test('previous editions: same theme in earlier seasons, played only, never the page itself or a future date, newest first, five at most, with the tier 1 thumbnail', () => {
  const rows = [
    row({ promoId: 'now', date: '2026-11-20' }), // this page, upcoming
    row({ promoId: 'ls', date: '2026-03-10', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26', displayOpponent: 'Stars', imageTier: 1, imageRef: 'promo-images/ls.png' }),
    row({ promoId: 'ls2', date: '2026-03-12', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26', displayOpponent: 'Kings' }), // a second date of the same edition
    row({ promoId: 'ot', date: '2026-01-05', pageSlug: 'rainbow-night', pageSeason: '2025-26', title: 'Rainbow Night' }), // same theme, other slug
    row({ promoId: 'old', date: '2025-02-01', pageSlug: 'pride-night-2024-25', pageSeason: '2024-25' }),
    row({ promoId: 'older', date: '2024-02-01', pageSlug: 'pride-night-2023-24', pageSeason: '2023-24' }),
    row({ promoId: 'oldest', date: '2023-02-01', pageSlug: 'pride-night-2022-23', pageSeason: '2022-23' }),
    row({ promoId: 'ancient', date: '2022-02-01', pageSlug: 'pride-night-2021-22', pageSeason: '2021-22' }),
    row({ promoId: 'other-theme', date: '2026-02-01', pageSlug: 'hockey-fights-cancer', pageSeason: '2025-26', themeKey: 'hfc', title: 'Hockey Fights Cancer' }),
    row({ promoId: 'future-prior', date: '2026-12-01', pageSlug: 'pride-night-x', pageSeason: '2025-26' }), // an earlier season label with a date still to come: out
    row({ promoId: 'tomb', date: '2025-03-01', pageSlug: 'pride-night-tomb', pageSeason: '2024-25', tombstoned: true }),
  ];
  const page = { slug: 'pride-night', season: '2026-27', themeKey: 'pride', title: 'Pride Night' };
  const got = previousEditionsFor(rows, page, TODAY, href);
  assert.deepEqual(got.map((e) => [e.href, e.season, e.date, e.displayOpponent, e.thumbnailUrl ? 'thumb' : null]), [
    ['/nhl/club/promos/pride-night-2025-26', '2025-26', '2026-03-12', 'Kings', 'thumb'],
    ['/nhl/club/promos/rainbow-night', '2025-26', '2026-01-05', 'Wild', null],
    ['/nhl/club/promos/pride-night-2024-25', '2024-25', '2025-02-01', 'Wild', null],
    ['/nhl/club/promos/pride-night-2023-24', '2023-24', '2024-02-01', 'Wild', null],
    ['/nhl/club/promos/pride-night-2022-23', '2022-23', '2023-02-01', 'Wild', null],
  ]);
  assert.ok(got[0].thumbnailUrl?.includes(encodeURIComponent('promo-images/ls.png')));
  // The page itself, from its own season, is never a previous edition.
  assert.deepEqual(previousEditionsFor([row({ promoId: 'self', date: '2026-10-01' })], page, TODAY, href), []);
  // No theme: the normalized name matches across a season-suffixed slug.
  const towel = { slug: 'rally-towel', season: '2026-27', themeKey: 'none', title: 'Rally Towel' };
  assert.equal(previousEditionsFor([row({ promoId: 't', date: '2026-02-02', title: 'Rally Towel', themeKey: 'none', pageSlug: 'rally-towel-2025-26', pageSeason: '2025-26' })], towel, TODAY, href).length, 1);
  assert.equal(previousEditionsFor([row({ promoId: 't', date: '2026-02-02', title: 'Rally Scarf', themeKey: 'none', pageSlug: 'rally-scarf', pageSeason: '2025-26' })], towel, TODAY, href).length, 0);
});

test('the forward link prefers the current season, else the earliest later season, named by its first date; null when this is the latest', () => {
  const page = { slug: 'pride-night-2024-25', season: '2024-25', themeKey: 'pride', title: 'Pride Night' };
  const rows = [
    row({ promoId: 'a', date: '2025-02-01', pageSlug: 'pride-night-2024-25', pageSeason: '2024-25' }),
    row({ promoId: 'b', date: '2026-03-10', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26' }),
    row({ promoId: 'c1', date: '2026-11-20', pageSlug: 'pride-night', pageSeason: '2026-27' }),
    row({ promoId: 'c2', date: '2027-01-15', pageSlug: 'pride-night', pageSeason: '2026-27' }),
  ];
  const next = nextEditionFor(rows, page, 'NHL', TODAY, href);
  assert.deepEqual([next?.href, next?.season, next?.date], ['/nhl/club/promos/pride-night', '2026-27', '2026-11-20'], 'the current season, its first date');
  const noCurrent = nextEditionFor(rows.filter((r) => r.pageSeason !== '2026-27'), page, 'NHL', TODAY, href);
  assert.deepEqual([noCurrent?.href, noCurrent?.season], ['/nhl/club/promos/pride-night-2025-26', '2025-26'], 'else the earliest later season');
  assert.equal(nextEditionFor(rows, { slug: 'pride-night', season: '2026-27', themeKey: 'pride', title: 'Pride Night' }, 'NHL', TODAY, href), null);
});

test('the archive: played editions by season, newest season and newest date first; nothing upcoming', () => {
  const rows = [
    row({ promoId: 'u', date: '2026-11-20', pageSlug: 'pride-night' }),
    row({ promoId: 'p1', date: '2026-10-10', pageSlug: 'opening-night', pageSeason: '2026-27', title: 'Opening Night', themeKey: 'none' }),
    row({ promoId: 'p2', date: '2026-10-25', pageSlug: 'hat-night', pageSeason: '2026-27', title: 'Hat Night', themeKey: 'none', type: 'giveaway' }),
    row({ promoId: 'ls', date: '2026-03-10', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26' }),
    row({ promoId: 'ls-b', date: '2026-03-12', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26' }),
    row({ promoId: 'nodate', date: '', pageSlug: 'x', pageSeason: '2025-26' }),
    row({ promoId: 'noslug', date: '2026-01-01', pageSlug: '', pageSeason: '2025-26' }),
  ];
  const got = archiveSeasons(rows, TODAY, href);
  assert.deepEqual(got.map((s) => [s.season, s.editions.map((e) => `${e.href}@${e.date}`)]), [
    ['2026-27', ['/nhl/club/promos/hat-night@2026-10-25', '/nhl/club/promos/opening-night@2026-10-10']],
    ['2025-26', ['/nhl/club/promos/pride-night-2025-26@2026-03-12']],
  ]);
  assert.deepEqual(archiveSeasons([row({ date: '2026-11-20' })], TODAY, href), [], 'nothing played, nothing archived');
});

test('the index window by league, and the played-date rule', () => {
  assert.deepEqual(indexWindow('NHL', '2026-11-08'), { current: '2026-27', previous: '2025-26' });
  assert.deepEqual(indexWindow('MLB', '2026-11-08'), { current: '2026', previous: '2025' });
  assert.equal(playedDateIndexable('NHL', '2025-07-01', '2026-11-08'), true);
  assert.equal(playedDateIndexable('NHL', '2025-06-30', '2026-11-08'), false);
  assert.equal(playedDateIndexable('MLB', '2025-04-01', '2026-11-08'), true);
  assert.equal(playedDateIndexable('MLB', '2024-09-30', '2026-11-08'), false);
  assert.equal(playedDateIndexable('MLB', 'nope', '2026-11-08'), false);
});
