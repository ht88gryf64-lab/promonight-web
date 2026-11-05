import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { captureUTMs, getStoredUTMs, utmTriplet } from '../utm-capture';

/** A window with a location and a session store, enough for the capture. */
function fakeWindow(search: string) {
  const store = new Map<string, string>();
  const w = {
    location: { search },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    },
  };
  (globalThis as unknown as { window: unknown }).window = w;
  return w;
}

describe('the session\'s first-touch UTMs', () => {
  beforeEach(() => { fakeWindow(''); });
  afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; });

  it('keeps the first tagged URL of the session and never overwrites it', () => {
    const w = fakeWindow('?utm_source=youtube&utm_medium=social&utm_campaign=bio');
    assert.deepEqual(captureUTMs(), { utm_source: 'youtube', utm_medium: 'social', utm_campaign: 'bio' });
    w.location.search = '?utm_source=meta&utm_medium=social&utm_campaign=gameday&utm_content=219f40551981491f';
    assert.deepEqual(captureUTMs(), { utm_source: 'youtube', utm_medium: 'social', utm_campaign: 'bio' });
    w.location.search = '';
    assert.deepEqual(getStoredUTMs(), { utm_source: 'youtube', utm_medium: 'social', utm_campaign: 'bio' });
  });

  it('stores nothing on an untagged visit', () => {
    assert.equal(captureUTMs(), null);
    assert.equal(getStoredUTMs(), null);
  });

  it('gives the three the click events carry, and nothing when the session has none', () => {
    assert.deepEqual(utmTriplet(null), {});
    assert.deepEqual(utmTriplet({ utm_source: 'meta', utm_medium: 'social', utm_campaign: 'gameday', utm_content: '219f40551981491f', utm_term: 'x' }), { utm_source: 'meta', utm_campaign: 'gameday', utm_content: '219f40551981491f' });
    fakeWindow('?utm_source=tiktok&utm_campaign=bio');
    captureUTMs();
    assert.deepEqual(utmTriplet(), { utm_source: 'tiktok', utm_campaign: 'bio' });
  });
});
