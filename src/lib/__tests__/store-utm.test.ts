import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { APP_STORE_CAMPAIGN_MAX, IOS_APP_URL, appStoreUrl, playReferrer, playStoreUrl, utmCampaignToken, utmFromParams } from '../app-link';

/**
 * The social bridge's store links (2026-11-05): a visitor who came in through
 * a Short's link or a bio link reaches /download with the session's UTMs, and
 * the App Store ct and the Play referrer name that visit instead of the
 * surface tokens.
 */

const SAVED = { apple: process.env.APPLE_PROVIDER_TOKEN, pub: process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN };
beforeEach(() => {
  delete process.env.APPLE_PROVIDER_TOKEN;
  delete process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN;
});
afterEach(() => {
  if (SAVED.apple === undefined) delete process.env.APPLE_PROVIDER_TOKEN; else process.env.APPLE_PROVIDER_TOKEN = SAVED.apple;
  if (SAVED.pub === undefined) delete process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN; else process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN = SAVED.pub;
});

describe('utmFromParams', () => {
  it('needs utm_source and keeps only token-shaped values', () => {
    assert.deepEqual(utmFromParams({ utm_source: 'youtube', utm_campaign: 'bio' }), { source: 'youtube', campaign: 'bio', content: null });
    assert.deepEqual(utmFromParams({ utm_source: 'meta', utm_medium: 'social', utm_campaign: 'gameday', utm_content: '219f40551981491f' }), { source: 'meta', campaign: 'gameday', content: '219f40551981491f' });
    assert.equal(utmFromParams({ utm_campaign: 'bio' }), undefined);
    assert.equal(utmFromParams({ utm_source: 'a b' }), undefined);
    assert.deepEqual(utmFromParams({ utm_source: ['tiktok', 'x'], utm_campaign: '<script>' }), { source: 'tiktok', campaign: null, content: null });
  });
});

describe('the App Store link for a social visit', () => {
  const bio = { source: 'youtube', campaign: 'bio', content: null };

  it('carries ct={utm_source}_{utm_campaign} even without a provider token', () => {
    assert.equal(appStoreUrl({ surface: 'download', utm: bio }), `${IOS_APP_URL}?ct=youtube_bio&mt=8`);
    assert.equal(appStoreUrl({ surface: 'download_qr', placement: 'qr_ios', utm: { source: 'tiktok', campaign: null, content: null } }), `${IOS_APP_URL}?ct=tiktok&mt=8`);
  });

  it('adds pt when APPLE_PROVIDER_TOKEN is set, else the public token', () => {
    process.env.APPLE_PROVIDER_TOKEN = '123456';
    assert.equal(appStoreUrl({ surface: 'download', utm: bio }), `${IOS_APP_URL}?pt=123456&ct=youtube_bio&mt=8`);
    delete process.env.APPLE_PROVIDER_TOKEN;
    process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN = '654321';
    assert.equal(appStoreUrl({ surface: 'download', utm: bio }), `${IOS_APP_URL}?pt=654321&ct=youtube_bio&mt=8`);
  });

  it('keeps the surface token when the visit has no UTMs', () => {
    assert.equal(appStoreUrl({ surface: 'download' }), IOS_APP_URL);
    process.env.NEXT_PUBLIC_APPSTORE_PROVIDER_TOKEN = '654321';
    assert.equal(appStoreUrl({ surface: 'download', utm: null }), `${IOS_APP_URL}?pt=654321&ct=dl&mt=8`);
  });

  it('cuts the token to Apple\'s 30 characters and its alphabet', () => {
    const token = utmCampaignToken({ source: 'Instagram Reels', campaign: 'game.day/november-2026', content: null });
    assert.ok(token.length <= APP_STORE_CAMPAIGN_MAX);
    assert.match(token, /^[a-z0-9_-]+$/);
    assert.equal(utmCampaignToken({ source: 'meta', campaign: 'gameday', content: '219f40551981491f' }), 'meta_gameday');
  });
});

describe('the Play link for a social visit', () => {
  it('carries referrer=utm_source%3D{src}%26utm_campaign%3D{camp}', () => {
    assert.equal(playReferrer({ surface: 'download', utm: { source: 'tiktok', campaign: 'bio', content: null } }), 'utm_source=tiktok&utm_campaign=bio');
    assert.ok(playStoreUrl({ surface: 'download', utm: { source: 'tiktok', campaign: 'bio', content: null } }).endsWith('&referrer=utm_source%3Dtiktok%26utm_campaign%3Dbio'));
    assert.equal(playReferrer({ surface: 'download', utm: { source: 'meta', campaign: null, content: 'x' } }), 'utm_source=meta');
  });

  it('keeps the surface referrer when the visit has no UTMs', () => {
    assert.equal(playReferrer({ surface: 'download', teamId: 'dallas-stars' }), 'utm_source=web&utm_medium=download&utm_content=dallas-stars');
  });
});
