// Promo page sharing (2026-11-03): the pure half. Share ids, the shared URL,
// the copy, the landing parse, the address-bar strip, the subId2 rule, and
// the card's words and fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_ID_RE,
  buildShareUrl,
  facebookShareHref,
  formatDayMonD,
  mailtoHref,
  newShareId,
  parseShareLanding,
  shareEmailSubject,
  shareText,
  smsHref,
  stripShareParams,
  withShareSubId2,
  xIntentHref,
} from '../promo-share';
import { accentFor, gameLayout, photoBox, titleFit, wrapLines } from '../share-card-render';
import { textWidth } from '../share-card-metrics';
import { buildFanaticsUrl, buildSpotHeroUrl, buildTicketNetworkLink, buildExpediaHotelLink } from '../affiliates';

const STARS = { promoName: 'Esa Lindell Bobblehead', teamName: 'Dallas Stars', displayOpponent: 'Panthers', date: '2026-11-15' };
const CANON = 'https://www.getpromonight.com/nhl/dallas-stars/promos/esa-lindell-bobblehead';

test('share ids: 8 characters of [a-z0-9], from the CSPRNG, and distinct', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => newShareId()));
  assert.equal(ids.size, 2000);
  for (const id of ids) assert.match(id, SHARE_ID_RE);
  // Rejection sampling: bytes at or above 252 are skipped, never folded.
  const bytes = [255, 254, 253, 252, 0, 1, 2, 3, 4, 5, 6, 7];
  assert.equal(newShareId(() => Uint8Array.from(bytes)), 'abcdefgh');
});

test('the shared URL is the canonical plus the fixed campaign, the channel and the id, nothing else', () => {
  const u = buildShareUrl(CANON, 'sms', 'ab12cd34');
  assert.equal(u, `${CANON}?utm_source=share&utm_medium=sms&utm_campaign=promo_page&s=ab12cd34`);
  // No PII: exactly these five keys.
  assert.deepEqual([...new URL(u).searchParams.keys()], ['utm_source', 'utm_medium', 'utm_campaign', 's']);
  // A canonical carrying a query or a hash never stacks parameters.
  assert.equal(buildShareUrl(`${CANON}?utm_source=x&s=zzzzzzzz#faq`, 'copy', 'ab12cd34'), `${CANON}?utm_source=share&utm_medium=copy&utm_campaign=promo_page&s=ab12cd34`);
});

test('the share copy: the brief\'s two shapes, built from stored fields, missing parts dropped', () => {
  assert.equal(formatDayMonD('2026-11-15'), 'Sun Nov 15');
  assert.equal(formatDayMonD('2027-02-29'), '');
  assert.equal(shareText(STARS), 'Esa Lindell Bobblehead: Dallas Stars vs Panthers, Sun Nov 15. All the details:');
  assert.equal(shareEmailSubject(STARS), 'Esa Lindell Bobblehead at the Dallas Stars game, Nov 15');
  assert.equal(shareText({ ...STARS, displayOpponent: '' }), 'Esa Lindell Bobblehead: Dallas Stars, Sun Nov 15. All the details:');
  assert.equal(shareText({ ...STARS, date: '' }), 'Esa Lindell Bobblehead: Dallas Stars vs Panthers. All the details:');
  assert.equal(shareEmailSubject({ ...STARS, date: '' }), 'Esa Lindell Bobblehead at the Dallas Stars game');
  const url = buildShareUrl(CANON, 'sms', 'ab12cd34');
  assert.equal(smsHref(STARS, url), `sms:?&body=${encodeURIComponent(`${shareText(STARS)} ${url}`)}`);
  const mail = new URL(mailtoHref(STARS, url).replace('mailto:', 'http://x/'));
  assert.equal(mail.searchParams.get('subject'), shareEmailSubject(STARS));
  assert.equal(mail.searchParams.get('body'), `${shareText(STARS)} ${url}`);
  assert.equal(new URL(xIntentHref(STARS, url)).searchParams.get('url'), url);
  assert.equal(new URL(facebookShareHref(url)).searchParams.get('u'), url);
  // No em dash in any copy (house rule).
  for (const t of [shareText(STARS), shareEmailSubject(STARS)]) assert.ok(!t.includes('—'), t);
});

test('landing: a well-formed id with utm_source=share and a known channel; anything else is not a share', () => {
  assert.deepEqual(parseShareLanding('?utm_source=share&utm_medium=native&utm_campaign=promo_page&s=ab12cd34'), { shareId: 'ab12cd34', channel: 'native' });
  assert.equal(parseShareLanding('?utm_source=share&utm_medium=native&s=AB12CD34'), null, 'uppercase is not an id');
  assert.equal(parseShareLanding('?utm_source=share&utm_medium=native&s=ab12cd3'), null, 'seven characters');
  assert.equal(parseShareLanding('?utm_source=newsletter&utm_medium=email&s=ab12cd34'), null, 'foreign source');
  assert.equal(parseShareLanding('?utm_source=share&utm_medium=carrier-pigeon&s=ab12cd34'), null, 'unknown channel');
  assert.equal(parseShareLanding(''), null);
});

test('the address-bar strip removes s and every utm_*, keeps the rest and the hash', () => {
  assert.equal(stripShareParams('/nhl/dallas-stars/promos/x?utm_source=share&utm_medium=sms&utm_campaign=promo_page&s=ab12cd34'), '/nhl/dallas-stars/promos/x');
  assert.equal(stripShareParams('/p?a=1&utm_source=share&s=ab12cd34&b=2#faq'), '/p?a=1&b=2#faq');
  assert.equal(stripShareParams('/p?UTM_Term=x&gclid=9'), '/p?gclid=9');
  assert.equal(stripShareParams('/p'), '/p');
  assert.equal(stripShareParams('/p#x'), '/p#x');
});

test('subId2=share on Impact links only; subId1 and sharedid untouched; SpotHero and Expedia never', () => {
  const team = { id: 'dallas-stars', ticketNetworkSlug: undefined, fanaticsUrl: 'https://www.fanatics.com/nhl/dallas-stars/o-1234+t-5678', fanaticsPath: undefined } as never;
  const tn = buildTicketNetworkLink({ team, surface: 'web_promo_page' })!;
  const tnShared = withShareSubId2(tn, 'ticketnetwork');
  assert.equal(tnShared, `${tn}&subId2=share`);
  assert.equal(new URL(tnShared).searchParams.get('subId1'), 'web_promo_page_dallas-stars');
  assert.equal(withShareSubId2(tnShared, 'ticketnetwork'), tnShared, 'idempotent');

  const tm = 'https://ticketmaster.evyy.net/c/7236189/264167/4272?u=https%3A%2F%2Fwww.ticketmaster.com%2Fdallas-stars-tickets%2Fartist%2F805933&sharedid=web_promo_page_dallas-stars';
  const tmShared = withShareSubId2(tm, 'ticketmaster');
  assert.equal(tmShared, `${tm}&subId2=share`);
  assert.equal(new URL(tmShared).searchParams.get('sharedid'), 'web_promo_page_dallas-stars');
  // Ticketmaster without its Impact wrap is a bare link: not Impact, untouched.
  assert.equal(withShareSubId2('https://www.ticketmaster.com/dallas-stars-tickets/artist/805933', 'ticketmaster'), 'https://www.ticketmaster.com/dallas-stars-tickets/artist/805933');

  const fan = buildFanaticsUrl({ team, surface: 'web_team_page' });
  const fanShared = withShareSubId2(fan, 'fanatics');
  assert.equal(new URL(fanShared).searchParams.get('subId1'), 'web_team_page_dallas-stars');
  assert.equal(new URL(fanShared).searchParams.get('subId2'), 'share');
  assert.equal(new URL(fanShared).searchParams.get('u'), new URL(fan).searchParams.get('u'), 'the deep link is byte-identical');

  const sh = buildSpotHeroUrl({ latitude: 32.79, longitude: -96.81, subKey: 'web_promo_page_dallas-stars' });
  assert.equal(withShareSubId2(sh, 'spothero'), sh);
  const ex = buildExpediaHotelLink({ venueName: 'American Airlines Center', city: 'Dallas', pubref: 'web_promo_page_dallas-stars' });
  assert.equal(withShareSubId2(ex, 'expedia'), ex);
  // A partner name alone is not enough: the link must be an Impact /c/ link.
  assert.equal(withShareSubId2('https://example.com/c/1/2/3', 'spothero'), 'https://example.com/c/1/2/3');
});

test('the card: measured widths, the name fits width and height, the game line splits rather than wraps mid-phrase', () => {
  // "BOBBLEHEAD" is 7.3em of Archivo 800: wider than a 622px column at 96px.
  assert.ok(textWidth('BOBBLEHEAD', 96, 'extrabold', -1) > 622);
  assert.equal(wrapLines('AUSTIN REAVES BOBBLEHEAD', 96, 622, 'extrabold', -1), 4);
  const reaves = titleFit('Austin Reaves Bobblehead', 622, 1);
  assert.ok(reaves.lines <= 3 && textWidth('BOBBLEHEAD', reaves.size, 'extrabold', -1) <= 622, JSON.stringify(reaves));
  const long = titleFit('10th Anniversary Celebration & 2016 Championship Mini Banner Giveaway', 582, 2);
  assert.ok(long.size >= 50 && long.lines <= 4, JSON.stringify(long));
  assert.deepEqual(titleFit('Anime Night', 582, 1).size, 96);
  assert.deepEqual(gameLayout({ lead: 'Dallas Stars vs Panthers', tail: 'Sun Nov 15' }, 622), ['Dallas Stars vs Panthers \u00b7 Sun Nov 15']);
  assert.deepEqual(gameLayout({ lead: 'Los Angeles Lakers vs Clippers', tail: 'Fri Dec 4' }, 622), ['Los Angeles Lakers vs Clippers', 'Fri Dec 4']);
  assert.deepEqual(gameLayout({ lead: 'Dallas Stars', tail: '' }, 622), ['Dallas Stars']);
  assert.deepEqual(photoBox(624, 351, 518), { w: 400, h: 225 });
  assert.deepEqual(photoBox(800, 1200, 518), { w: 345, h: 518 });
  assert.equal(accentFor('#006847', '#8f8f8c'), '#006847');
  assert.equal(accentFor('#000000', '#fcb514'), '#fcb514');
  assert.equal(accentFor('#000000', '#111111'), '#f7f3ea');
});
