// RSS 2.0 output for the social feed (/feeds/social.xml).
//
// Run with:
//   node --import tsx --test src/lib/social-feed/__tests__/rss.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialRss,
  centralNoon,
  escapeXml,
  formatShortDate,
  itemDescription,
  itemTitle,
  pubDateFor,
  type RssItemInput,
} from '../rss';
import { cleanText } from '../text';

const NOW = new Date('2026-09-25T17:00:00Z');

function item(over: Partial<RssItemInput> = {}): RssItemInput {
  return {
    promoId: 'abc123',
    teamId: 'minnesota-twins',
    sportSlug: 'mlb',
    teamName: 'Minnesota Twins',
    title: 'Bobblehead Night',
    date: '2026-09-27',
    opponent: 'Detroit Tigers',
    venue: 'Target Field',
    ...over,
  };
}

// Text between tags must carry no raw '<', and every '&' must open an entity.
function assertWellEscaped(xml: string) {
  const text = xml.replace(/<[^<>]*>/g, '');
  assert.ok(!text.includes('<'), 'raw < in text');
  assert.ok(!text.includes('>'), 'raw > in text');
  assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(xml), 'bare & in output');
}

// Every opened element is closed in order.
function assertBalanced(xml: string) {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w:]*)[^<>]*?(\/?)>/g)) {
    const [, close, name, selfClose] = m;
    if (selfClose) continue;
    if (close) assert.equal(stack.pop(), name);
    else stack.push(name);
  }
  assert.deepEqual(stack, []);
}

test('title and description follow the stored-field templates', () => {
  assert.equal(itemTitle(item()), 'Minnesota Twins Bobblehead Night, Sun Sep 27');
  assert.equal(
    itemDescription(item()),
    'Bobblehead Night at Target Field vs Detroit Tigers on Sun Sep 27.',
  );
  assert.equal(formatShortDate('2026-09-26'), 'Sat Sep 26');
});

test('description omits clauses whose field is missing', () => {
  assert.equal(itemDescription(item({ venue: null })), 'Bobblehead Night vs Detroit Tigers on Sun Sep 27.');
  assert.equal(itemDescription(item({ opponent: '' })), 'Bobblehead Night at Target Field on Sun Sep 27.');
  assert.equal(itemDescription(item({ venue: undefined, opponent: undefined })), 'Bobblehead Night on Sun Sep 27.');
});

test('escapes & < > " \' in titles, descriptions and attributes', () => {
  const xml = buildSocialRss(
    [item({ title: 'Fish & Chips <Night> "Big" \'Deal\'', venue: 'A&B Park', opponent: 'X < Y' })],
    NOW,
  );
  assert.ok(xml.includes('<title>Minnesota Twins Fish &amp; Chips &lt;Night&gt; &quot;Big&quot; &apos;Deal&apos;, Sun Sep 27</title>'));
  assert.ok(xml.includes('at A&amp;B Park vs X &lt; Y'));
  // URL query separators are escaped inside the element.
  assert.ok(xml.includes('?utm_source=promonight_feed&amp;utm_medium=social&amp;utm_campaign=social_rss&amp;utm_content=abc123'));
  assertWellEscaped(xml);
  assertBalanced(xml);
  assert.ok(!xml.includes('CDATA'));
  assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
});

test('control characters are stripped', () => {
  const xml = buildSocialRss([item({ title: 'Bobble\u0000head\u0007 Night\u000B', opponent: 'Tigers￾' })], NOW);
  // eslint-disable-next-line no-control-regex
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml));
  assert.ok(xml.includes('Bobblehead Night'));
});

test('cite tags in a model-written title come out stripped (known-bad input)', () => {
  const bad = item({ title: '<cite index="3-1">Bobblehead Night</cite>', opponent: 'Detroit <cite index="9">Tigers</cite>' });
  const xml = buildSocialRss([bad], NOW);
  assert.ok(!/cite/i.test(xml), 'cite survived');
  assert.ok(xml.includes('<title>Minnesota Twins Bobblehead Night, Sun Sep 27</title>'));
  assert.ok(xml.includes('<description>Bobblehead Night at Target Field vs Detroit Tigers on Sun Sep 27.</description>'));
  assert.equal(cleanText('<CITE  index="1" >x</Cite >'), 'x');
});

test('zero items still produce a valid channel', () => {
  const xml = buildSocialRss([], NOW);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"'));
  for (const needle of [
    'xmlns:atom="http://www.w3.org/2005/Atom"',
    'xmlns:media="http://search.yahoo.com/mrss/"',
    '<title>PromoNight: Promos This Week</title>',
    '<link>https://www.getpromonight.com</link>',
    '<description>',
    '<language>en-us</language>',
    `<lastBuildDate>${NOW.toUTCString()}</lastBuildDate>`,
    '<atom:link href="https://www.getpromonight.com/feeds/social.xml" rel="self" type="application/rss+xml"/>',
    '<ttl>60</ttl>',
  ]) {
    assert.ok(xml.includes(needle), `missing ${needle}`);
  }
  assert.ok(!xml.includes('<item>'));
  assertBalanced(xml);
  assertWellEscaped(xml);
});

test('item carries link, guid, enclosure and media:content', () => {
  const xml = buildSocialRss([item()], NOW);
  const img = 'https://www.getpromonight.com/feeds/social/image/abc123';
  assert.ok(xml.includes('<link>https://www.getpromonight.com/mlb/minnesota-twins?utm_source=promonight_feed&amp;utm_medium=social&amp;utm_campaign=social_rss&amp;utm_content=abc123</link>'));
  assert.ok(xml.includes('<guid isPermaLink="false">abc123</guid>'));
  assert.ok(xml.includes(`<enclosure url="${img}" type="image/png" length="0"/>`));
  assert.ok(xml.includes(`<media:content url="${img}" medium="image" type="image/png" width="1080" height="1080"/>`));
});

test('pubDate is promo date minus 7 days at 12:00 Central, and output is stable', () => {
  // CDT: noon is 17:00 UTC.
  assert.equal(pubDateFor('2026-09-27', NOW).toUTCString(), 'Sun, 20 Sep 2026 17:00:00 GMT');
  // CST: noon is 18:00 UTC.
  assert.equal(centralNoon('2026-12-01').toISOString(), '2026-12-01T18:00:00.000Z');
  // DST boundary days.
  assert.equal(centralNoon('2026-03-08').toISOString(), '2026-03-08T17:00:00.000Z');
  assert.equal(centralNoon('2026-11-01').toISOString(), '2026-11-01T18:00:00.000Z');

  const items = [item(), item({ promoId: 'def456', date: '2026-10-01' })];
  assert.equal(buildSocialRss(items, NOW), buildSocialRss(items, NOW));
  // The item block does not depend on build time once its stable pubDate has passed.
  const later = new Date('2026-09-25T21:37:00Z');
  const itemsOf = (xml: string) => xml.slice(xml.indexOf('<item>'));
  assert.equal(itemsOf(buildSocialRss(items, NOW)), itemsOf(buildSocialRss(items, later)));
});

test('a pubDate still in the future clamps to now rounded down to the hour', () => {
  // Day-7 item at 09:37 CDT: date-7 noon is later today.
  const morning = new Date('2026-09-25T14:37:12Z');
  assert.equal(pubDateFor('2026-10-02', morning).toISOString(), '2026-09-25T14:00:00.000Z');
});
