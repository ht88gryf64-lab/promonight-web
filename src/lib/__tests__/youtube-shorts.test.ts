import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildShortsMap,
  diffShortsMap,
  parsePlaylistPage,
  playlistItemsUrl,
  PROMONIGHT_CHANNEL_ID,
  promoIdFromDescription,
  SHORT_BOX,
  shortEmbedUrl,
  shortJsonLd,
  shortThumbnailUrl,
  shortWatchUrl,
  uploadsPlaylistId,
} from '../youtube-shorts';

describe('the pipeline\'s description marker', () => {
  it('reads pn:{promoId} at the end of a description, in any case, and nothing else', () => {
    assert.equal(promoIdFromDescription('Devils at Islanders tonight.\n\nFull details in the app.\n\npn:219f40551981491f'), '219f40551981491f');
    assert.equal(promoIdFromDescription('...\npn:219F40551981491F\n'), '219f40551981491f');
    assert.equal(promoIdFromDescription('no promo tonight\n\npn:game:nhl-2026-11-07-san-jose-sharks-at-dallas-stars'), null);
    assert.equal(promoIdFromDescription('pn:219f4055198149 short'), null);
    assert.equal(promoIdFromDescription('http://x/pn:219f40551981491f'), null);
    assert.equal(promoIdFromDescription(''), null);
  });
});

describe('the uploads playlist', () => {
  it('is the channel id with UC swapped for UU, read fifty at a time', () => {
    assert.equal(uploadsPlaylistId(PROMONIGHT_CHANNEL_ID), 'UURU8aBU0662tBrGAHg-OE7Q');
    const url = new URL(playlistItemsUrl('UUx', 'KEY', 'tok'));
    assert.equal(url.origin + url.pathname, 'https://www.googleapis.com/youtube/v3/playlistItems');
    assert.deepEqual(Object.fromEntries(url.searchParams), { part: 'snippet', playlistId: 'UUx', maxResults: '50', key: 'KEY', pageToken: 'tok' });
    assert.ok(!playlistItemsUrl('UUx', 'KEY').includes('pageToken'));
  });

  it('parses a page into uploads with their promo ids and skips what has no video', () => {
    const page = parsePlaylistPage({
      nextPageToken: 'NEXT',
      items: [
        { snippet: { title: 'Devils at Islanders', publishedAt: '2026-11-06T10:00:00Z', description: 'x\n\npn:219f40551981491f', resourceId: { videoId: 'KBrnKx2troc' } } },
        { snippet: { title: 'Sharks at Stars', publishedAt: '2026-11-06T11:00:00Z', description: 'pn:game:nhl-x', resourceId: { videoId: 'SZVYd9awEow' } } },
        { snippet: { title: 'gone', description: 'pn:219f40551981491f', resourceId: {} } },
      ],
    });
    assert.equal(page.nextPageToken, 'NEXT');
    assert.deepEqual(page.items, [
      { videoId: 'KBrnKx2troc', title: 'Devils at Islanders', publishedAt: '2026-11-06T10:00:00Z', promoId: '219f40551981491f' },
      { videoId: 'SZVYd9awEow', title: 'Sharks at Stars', publishedAt: '2026-11-06T11:00:00Z', promoId: null },
    ]);
    assert.deepEqual(parsePlaylistPage(null), { items: [], nextPageToken: null });
  });
});

describe('the map', () => {
  it('keeps the newest upload per promo and ignores uploads without a marker', () => {
    const map = buildShortsMap([
      { videoId: 'aaaaaaaaaaa', title: 'old', publishedAt: '2026-11-01T00:00:00Z', promoId: '219f40551981491f' },
      { videoId: 'bbbbbbbbbbb', title: 'new', publishedAt: '2026-11-05T00:00:00Z', promoId: '219f40551981491f' },
      { videoId: 'ccccccccccc', title: 'none', publishedAt: '2026-11-06T00:00:00Z', promoId: null },
    ]);
    assert.deepEqual(map, { '219f40551981491f': { videoId: 'bbbbbbbbbbb', title: 'new', publishedAt: '2026-11-05T00:00:00Z' } });
  });

  it('diffs to the promo ids whose video was added, replaced or removed', () => {
    const a = { p1: { videoId: 'aaaaaaaaaaa', title: '', publishedAt: '' }, p2: { videoId: 'bbbbbbbbbbb', title: '', publishedAt: '' }, p3: { videoId: 'ccccccccccc', title: '', publishedAt: '' } };
    const b = { p1: { videoId: 'aaaaaaaaaaa', title: 'retitled', publishedAt: '' }, p2: { videoId: 'ddddddddddd', title: '', publishedAt: '' }, p4: { videoId: 'eeeeeeeeeee', title: '', publishedAt: '' } };
    assert.deepEqual(diffShortsMap(a, b), ['p2', 'p3', 'p4']);
    assert.deepEqual(diffShortsMap(a, a), []);
  });
});

describe('the embed', () => {
  it('has fixed Short-shaped box and YouTube\'s own URLs', () => {
    assert.deepEqual(SHORT_BOX, { width: 236, height: 420 });
    assert.equal(shortWatchUrl('KBrnKx2troc'), 'https://www.youtube.com/shorts/KBrnKx2troc');
    assert.equal(shortEmbedUrl('KBrnKx2troc'), 'https://www.youtube-nocookie.com/embed/KBrnKx2troc?autoplay=1&playsinline=1&rel=0');
    assert.equal(shortThumbnailUrl('KBrnKx2troc'), 'https://i.ytimg.com/vi/KBrnKx2troc/hqdefault.jpg');
  });

  it('describes the video as a VideoObject on the page', () => {
    const schema = shortJsonLd({ videoId: 'KBrnKx2troc', title: 'Camo Hat night', publishedAt: '2026-11-06T10:00:00Z' }, { name: 'Camo Hat', description: 'Free Camo Hat at the Islanders game.', url: 'https://www.getpromonight.com/nhl/new-york-islanders/promos/camo-hat' });
    assert.equal(schema['@type'], 'VideoObject');
    assert.equal(schema.name, 'Camo Hat night');
    assert.equal(schema.uploadDate, '2026-11-06T10:00:00Z');
    assert.equal(schema.contentUrl, 'https://www.youtube.com/shorts/KBrnKx2troc');
    assert.equal(schema.embedUrl, 'https://www.youtube-nocookie.com/embed/KBrnKx2troc?playsinline=1&rel=0');
    assert.deepEqual(schema.thumbnailUrl, ['https://i.ytimg.com/vi/KBrnKx2troc/hqdefault.jpg']);
  });
});
