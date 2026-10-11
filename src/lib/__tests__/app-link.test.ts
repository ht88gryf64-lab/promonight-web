// src/lib/app-link.ts: the store links every app CTA uses (app funnel G1).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANDROID_APP_URL,
  APP_STORE_CAMPAIGN_MAX,
  IOS_APP_URL,
  appStoreCampaign,
  appStoreUrl,
  detectClientPlatform,
  downloadHref,
  playReferrer,
  playStoreUrl,
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
  assert.equal(u.searchParams.get('ct'), 'web_team_cta_minnesota-twins');
  assert.equal(u.searchParams.get('mt'), '8');
  assert.deepEqual([...u.searchParams.keys()], ['pt', 'ct', 'mt']);
});

test('campaign token: web_{surface}_{teamId}, else the placement, cut to 30 characters', () => {
  assert.equal(APP_STORE_CAMPAIGN_MAX, 30);
  assert.equal(appStoreCampaign({ surface: 'team_cta', teamId: 'minnesota-twins' }), 'web_team_cta_minnesota-twins');
  const long = appStoreCampaign({ surface: 'team_cta', teamId: 'minnesota-timberwolves' });
  assert.equal(long, 'web_team_cta_minnesota-timberw');
  assert.equal(long.length, 30);
  assert.equal(appStoreCampaign({ surface: 'download' }), 'web_download');
  assert.equal(appStoreCampaign({ surface: 'download_qr', placement: 'qr_ios' }), 'web_download_qr_qr_ios');
  // The team wins over the placement when both are given.
  assert.equal(appStoreCampaign({ surface: 'team_cta', teamId: 'chicago-cubs', placement: 'x' }), 'web_team_cta_chicago-cubs');
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

test('/download with a team: App Store ct and Play utm_content carry it, QR placement kept on Play', () => {
  process.env[KEY] = 'tok';
  const team = teamFromDownloadSrc('team_cta_minnesota-twins');
  assert.equal(new URL(appStoreUrl({ surface: 'download', teamId: team })).searchParams.get('ct'), 'web_download_minnesota-twins');
  assert.equal(new URL(appStoreUrl({ surface: 'download_qr', placement: 'qr_ios', teamId: team })).searchParams.get('ct'), 'web_download_qr_minnesota-twin');
  const qr = new URL(playStoreUrl({ surface: 'download_qr', placement: 'qr_android', teamId: team }));
  assert.equal(qr.searchParams.get('referrer'), 'utm_source=web&utm_medium=download_qr&utm_content=minnesota-twins&utm_campaign=qr_android');
  const btn = new URL(playStoreUrl({ surface: 'download', teamId: team }));
  assert.equal(btn.searchParams.get('referrer'), 'utm_source=web&utm_medium=download&utm_content=minnesota-twins');
});
