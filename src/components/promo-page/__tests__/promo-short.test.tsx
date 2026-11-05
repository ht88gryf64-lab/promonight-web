import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoShort } from '../PromoShort';

test('the Short is a click-to-load box at a fixed size: the thumbnail and a play button, no iframe until the click', () => {
  const html = renderToStaticMarkup(<PromoShort videoId="KBrnKx2troc" title="Camo Hat night" />);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(html, /data-promo-short="KBrnKx2troc"/);
  assert.match(html, /width:236px;height:420px/);
  assert.match(html, /src="https:\/\/i\.ytimg\.com\/vi\/KBrnKx2troc\/hqdefault\.jpg"/);
  assert.match(html, /aria-label="Play: Camo Hat night"/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/shorts\/KBrnKx2troc"/);
});
