// src/lib/app-link.ts: the store links every app CTA uses (app funnel G1).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANDROID_APP_URL,
  APP_STORE_CAMPAIGN_MAX,
  APP_STORE_CT,
  IOS_APP_URL,
  appStoreCampaign,
  appStoreUrl,
  detectClientPlatform,
  downloadHref,
  downloadOrigin,
  playReferrer,
  playStoreUrl,
  promoDownloadHref,
  promoFromDownloadParams,
  teamFromDownloadSrc,
} from '@/lib/app-link';
import { IOS_APP_URL as OLD_IOS, ANDROID_APP_URL as OLD_ANDROID } from '@/components/app-download-buttons';

const KEY = 'NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN';
let saved: string | undefined;
beforeEach(() => { saved = process.env[KEY]; delete process.env[KEY]; });
afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; });

test('the bare listings, and the old constants are the same values', () => {
  assert.equal(IOS_APP_URL, 'https://apps.apple.com/app/apple-store/id6761309246');
  assert.equal(ANDROID_APP_URL, 'https://play.google.com/store/apps/details?id=com.promonight.app');
  assert.equal(OLD_IOS, IOS_APP_URL);
  assert.equal(OLD_ANDROID, ANDROID_APP_URL);
});

test('App Store, token unset: no parameters at all', () => {
  assert.equal(appStoreUrl({ surface: 'team_cta', teamId: 'minnesota-twins' }), IOS_APP_URL);
  process.env[KEY] = '';
  assert.equal(appStoreUrl({ surface: 'download' }), IOS_APP_URL, 'an empty value counts as unset');
});

test('App Store, token set: pt, ct and mt=8', () => {
  process.env[KEY] = '123456';
  const u = new URL(appStoreUrl({ surface: 'team_cta', teamId: 'minnesota-twins' }));
  assert.equal(u.origin + u.pathname, IOS_APP_URL);
  assert.equal(u.searchParams.get('pt'), '123456');
  assert.equal(u.searchParams.get('ct'), 'tc');
  assert.equal(u.searchParams.get('mt'), '8');
  assert.deepEqual([...u.searchParams.keys()], ['pt', 'ct', 'mt']);
});

test('campaign token: a short fixed token per surface, never the team, placement or promo', () => {
  assert.deepEqual(APP_STORE_CT, { promo_cta: 'pc', team_cta: 'tc', download: 'dl', download_qr: 'dl' });
  for (const t of Object.values(APP_STORE_CT)) assert.ok(/^[a-z]{2}$/.test(t) && t.length <= APP_STORE_CAMPAIGN_MAX, t);
  assert.equal(appStoreCampaign({ surface: 'team_cta', teamId: 'minnesota-timberwolves' }), 'tc');
  assert.equal(appStoreCampaign({ surface: 'promo_cta', teamId: 'dallas-stars', promoId: '681fc85299a82ba4', pageSlug: 'x' }), 'pc');
  assert.equal(appStoreCampaign({ surface: 'download' }), 'dl');
  assert.equal(appStoreCampaign({ surface: 'download_qr', placement: 'qr_ios', teamId: 'chicago-cubs' }), 'dl');
  // On /download, the CTA that sent the visitor wins over the page's own token.
  assert.equal(appStoreCampaign({ surface: 'download', teamId: 'chicago-cubs', from: 'team_cta' }), 'tc');
  assert.equal(appStoreCampaign({ surface: 'download_qr', placement: 'qr_ios', teamId: 'chicago-cubs', from: 'promo_cta' }), 'pc');
});

test('Play: the referrer is one encoded parameter that decodes to the utm pairs', () => {
  const url = playStoreUrl({ surface: 'team_cta', teamId: 'minnesota-twins' });
  assert.equal(
    url,
    'https://play.google.com/store/apps/details?id=com.promonight.app&referrer=utm_source%3Dweb%26utm_medium%3Dteam_cta%26utm_content%3Dminnesota-twins',
  );
  const u = new URL(url);
  assert.deepEqual([...u.searchParams.keys()], ['id', 'referrer'], 'no utm pair leaks into the store URL itself');
  assert.equal(u.searchParams.get('referrer'), 'utm_source=web&utm_medium=team_cta&utm_content=minnesota-twins');
  assert.equal(playReferrer({ surface: 'download' }), 'utm_source=web&utm_medium=download');
  assert.equal(playReferrer({ surface: 'download_qr', placement: 'qr_android' }), 'utm_source=web&utm_medium=download_qr&utm_campaign=qr_android');
  // A value that needs escaping inside the referrer stays one parameter.
  const odd = new URL(playStoreUrl({ surface: 'download_qr', placement: 'a&b=c' }));
  assert.equal(odd.searchParams.get('referrer'), 'utm_source=web&utm_medium=download_qr&utm_campaign=a%26b%3Dc');
});

test('Play does not depend on the App Store token', () => {
  const before = playStoreUrl({ surface: 'team_cta', teamId: 'x' });
  process.env[KEY] = 'tok';
  assert.equal(playStoreUrl({ surface: 'team_cta', teamId: 'x' }), before);
});

test('device detection', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9a) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
  assert.equal(detectClientPlatform(iphone), 'ios');
  assert.equal(detectClientPlatform(android), 'android');
  assert.equal(detectClientPlatform(mac), 'desktop');
  assert.equal(detectClientPlatform(mac, 5), 'ios', 'iPadOS reports a Mac user agent with touch');
  assert.equal(detectClientPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129'), 'desktop');
});

test('/download src: the team card link round-trips, anything else is ignored', () => {
  assert.equal(downloadHref('minnesota-twins'), '/download?src=team_cta_minnesota-twins');
  assert.equal(teamFromDownloadSrc('team_cta_minnesota-twins'), 'minnesota-twins');
  assert.equal(teamFromDownloadSrc(new URL('https://x' + downloadHref('st-louis-cardinals')).searchParams.get('src')), 'st-louis-cardinals');
  for (const bad of [undefined, '', 'team_cta_', 'nav', 'team_cta_Twins', 'team_cta_a b', 'team_cta_x&y=z', 'team_cta_../x', ['team_cta_x'], 'team_cta_' + 'a'.repeat(61), 'team_cta_-x', 'xteam_cta_y']) {
    assert.equal(teamFromDownloadSrc(bad), undefined, String(bad));
  }
});

test('/download from a team card: App Store ct is tc on button and QR, Play utm_content carries the team, QR placement kept on Play', () => {
  process.env[KEY] = 'tok';
  const team = teamFromDownloadSrc('team_cta_minnesota-twins');
  const from = downloadOrigin('team_cta_minnesota-twins');
  assert.equal(from, 'team_cta');
  assert.equal(new URL(appStoreUrl({ surface: 'download', teamId: team, from })).searchParams.get('ct'), 'tc');
  assert.equal(new URL(appStoreUrl({ surface: 'download_qr', placement: 'qr_ios', teamId: team, from })).searchParams.get('ct'), 'tc');
  // A direct visit (no src) is the page's own token.
  assert.equal(downloadOrigin(undefined), undefined);
  assert.equal(new URL(appStoreUrl({ surface: 'download' })).searchParams.get('ct'), 'dl');
  const qr = new URL(playStoreUrl({ surface: 'download_qr', placement: 'qr_android', teamId: team }));
  assert.equal(qr.searchParams.get('referrer'), 'utm_source=web&utm_medium=download_qr&utm_content=minnesota-twins&utm_campaign=qr_android');
  const btn = new URL(playStoreUrl({ surface: 'download', teamId: team }));
  assert.equal(btn.searchParams.get('referrer'), 'utm_source=web&utm_medium=download&utm_content=minnesota-twins');
});

test('/download from a promo page: promo_cta src keeps the team, promoId and pageSlug ride as separate params', () => {
  const href = promoDownloadHref('dallas-stars', '681fc85299a82ba4', 'esa-lindell-bobblehead');
  assert.equal(href, '/download?src=promo_cta_dallas-stars&promoId=681fc85299a82ba4&pageSlug=esa-lindell-bobblehead');
  const q = Object.fromEntries(new URL('https://x' + href).searchParams);
  assert.equal(teamFromDownloadSrc(q.src), 'dallas-stars');
  assert.deepEqual(promoFromDownloadParams(q), { promoId: '681fc85299a82ba4', pageSlug: 'esa-lindell-bobblehead' });
  // Only on a promo_cta src, and only as a well-formed pair.
  const ok = { src: 'promo_cta_dallas-stars', promoId: '681fc85299a82ba4', pageSlug: 'esa-lindell-bobblehead' };
  for (const bad of [
    { ...ok, src: 'team_cta_dallas-stars' },
    { ...ok, src: 'promo_cta_' },
    { ...ok, src: 'promo_cta_Dallas' },
    { ...ok, promoId: undefined },
    { ...ok, promoId: '' },
    { ...ok, promoId: 'a_b' },
    { ...ok, promoId: 'x&y=z' },
    { ...ok, promoId: ['681fc85299a82ba4'] },
    { ...ok, promoId: 'a'.repeat(65) },
    { ...ok, pageSlug: undefined },
    { ...ok, pageSlug: 'Esa' },
    { ...ok, pageSlug: 'a_b' },
    { ...ok, pageSlug: '../x' },
    { ...ok, pageSlug: 'a'.repeat(121) },
  ]) {
    assert.equal(promoFromDownloadParams(bad), undefined, JSON.stringify(bad));
  }
});

test('/download from a promo page: every App Store ct is pc, utm_content carries team, promo id and slug', () => {
  process.env[KEY] = 'tok';
  const promo = { promoId: '681fc85299a82ba4', pageSlug: 'esa-lindell-bobblehead' };
  const from = downloadOrigin('promo_cta_dallas-stars');
  assert.equal(from, 'promo_cta');
  assert.equal(downloadOrigin('promo_cta_Dallas'), undefined);
  assert.equal(new URL(appStoreUrl({ surface: 'download', teamId: 'dallas-stars', ...promo, from })).searchParams.get('ct'), 'pc');
  assert.equal(new URL(appStoreUrl({ surface: 'download_qr', placement: 'qr_ios', teamId: 'dallas-stars', ...promo, from })).searchParams.get('ct'), 'pc');
  const btn = new URL(playStoreUrl({ surface: 'download', teamId: 'dallas-stars', ...promo }));
  assert.equal(btn.searchParams.get('referrer'), 'utm_source=web&utm_medium=download&utm_content=dallas-stars_681fc85299a82ba4_esa-lindell-bobblehead');
  const qr = new URL(playStoreUrl({ surface: 'download_qr', placement: 'qr_android', teamId: 'dallas-stars', ...promo }));
  assert.equal(qr.searchParams.get('referrer'), 'utm_source=web&utm_medium=download_qr&utm_content=dallas-stars_681fc85299a82ba4_esa-lindell-bobblehead&utm_campaign=qr_android');
});
