// Food & drink on venue pages: the mapper, the app's visibility and grouping
// rules ported from promonight-app lib/services/vendor_rules.dart, and the card.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  toVenueVendor, visibleVendors, groupVendors, vendorWhere, vendorSources, allDietaryTags,
} from '../venue-vendors';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const loc = (raw: string, sections: string[] = [], over: Record<string, unknown> = {}) =>
  ({ raw, sections, level: null, concourse: null, standCode: null, ...over });
const doc = (name: string, over: Record<string, unknown> = {}) => ({
  name, items: [], locations: [], dietaryTags: [], isSignature: false, premiumOnly: false,
  sourceUrl: 'https://www.nhl.com/wild/arena/food-and-beverage', sourceUrls: ['https://www.nhl.com/wild/arena/food-and-beverage'],
  observedAt: '2026-10-07T17:40:00.000Z', verifiedAt: '2026-10-07T17:45:40Z', season: null, tombstoned: false,
  absentStreak: 0, manualCuration: false, signatureEvidence: null, curationNote: 'pipeline note', curatedAt: '2026-10-07',
  updatedAt: { _seconds: 1 }, ...over,
});

test('the mapper keeps what renders and drops pipeline bookkeeping', () => {
  const v = toVenueVendor('carvery', doc('Carvery', { locations: [loc('Sections C8 & 218', ['C8', '218'])] }));
  const keys = Object.keys(v).sort();
  assert.deepEqual(keys, ['dietaryTags', 'id', 'isSignature', 'items', 'locations', 'name', 'observedAt', 'premiumOnly', 'sourceUrls', 'tombstoned']);
  const json = JSON.stringify(v);
  for (const k of ['absentStreak', 'manualCuration', 'curationNote', 'curatedAt', 'verifiedAt', 'updatedAt', 'signatureEvidence', 'season']) {
    assert.ok(!json.includes(k), `${k} leaked`);
  }
  assert.deepEqual(v.sourceUrls, ['https://www.nhl.com/wild/arena/food-and-beverage'], 'sourceUrl and sourceUrls deduplicated');
});

test('tombstoned, suite-only and nameless stands are not listed (app rule)', () => {
  const vs = [
    toVenueVendor('a', doc('A')),
    toVenueVendor('b', doc('B', { tombstoned: true })),
    toVenueVendor('c', doc('C', { premiumOnly: true })),
    toVenueVendor('d', doc('  ')),
    toVenueVendor('e', doc('E', { premiumOnly: null })),
  ];
  assert.deepEqual(visibleVendors(vs).map((v) => v.name), ['A', 'E']);
});

test('grouping: levels first, then By section, then Other locations; a stand appears at each location', () => {
  const vs = [
    toVenueVendor('x', doc('Zeta Grill', { locations: [loc('112', ['112']), loc('Main level 9S', ['9S'], { level: 'Main Level' })] })),
    toVenueVendor('y', doc('alpha bar', { locations: [loc('S108', ['S108']), loc('108', ['108'])] })),
    toVenueVendor('z', doc('Cart', { locations: [loc('Bleacher Platform 14')] })),
    toVenueVendor('w', doc('Nowhere Nachos')),
  ];
  const groups = groupVendors(vs);
  assert.deepEqual(groups.map((g) => g.title), ['Main Level', 'By section', 'Other locations']);
  // Sections by number: 108 before S108 (equal numbers, numeric-first), 112 last.
  assert.deepEqual(groups[1].entries.map((e) => `${e.vendor.name}@${e.location!.sections[0]}`), ['alpha bar@108', 'alpha bar@S108', 'Zeta Grill@112']);
  assert.deepEqual(groups[2].entries.map((e) => e.vendor.name), ['Cart', 'Nowhere Nachos']);
});

test('where: sections, then stand code, then concourse, else the printed text', () => {
  const v = toVenueVendor('v', doc('V'));
  assert.equal(vendorWhere({ vendor: v, location: loc('x', ['112', '114'], { concourse: 'Main Concourse' }) }), 'Sections 112, 114 · Main Concourse');
  assert.equal(vendorWhere({ vendor: v, location: loc('x', ['C22']) }), 'Section C22');
  assert.equal(vendorWhere({ vendor: v, location: loc('Stand 5', [], { standCode: '5' }) }), 'Stand 5');
  assert.equal(vendorWhere({ vendor: v, location: loc('Carbliss Clubhouse Gate 6') }), 'Carbliss Clubhouse Gate 6');
  assert.equal(vendorWhere({ vendor: v, location: null }), '');
});

test('dietary tags: the stand and its items, each once', () => {
  const v = toVenueVendor('v', doc('V', { dietaryTags: ['vegan'], items: [{ name: 'Dog', dietaryTags: ['gluten-free', 'vegan'], isNew: null }] }));
  assert.deepEqual(allDietaryTags(v), ['vegan', 'gluten-free']);
});

test('sources: one line per page, dated by the earliest stand it vouches for', () => {
  const pdf = 'https://www.grandcasinoarena.com/assets/doc/menu.pdf';
  const vs = [
    toVenueVendor('a', doc('A', { observedAt: '2026-10-07T18:00:00Z' })),
    toVenueVendor('b', doc('B', { observedAt: '2026-10-06T09:00:00Z', sourceUrls: ['https://www.nhl.com/wild/arena/food-and-beverage', pdf] })),
  ];
  assert.deepEqual(vendorSources(vs), [
    { url: 'https://www.nhl.com/wild/arena/food-and-beverage', observedAt: '2026-10-06T09:00:00Z' },
    { url: pdf, observedAt: '2026-10-06T09:00:00Z' },
  ]);
});

test('the card: heading, groups, chips, source line; nothing when there are no stands', async () => {
  const { VendorsCard } = await import('../../components/venue-hub/VendorsCard');
  assert.equal(renderToStaticMarkup(<VendorsCard vendors={[]} />), '');
  const vs = visibleVendors([
    toVenueVendor('hot-indian', doc('Hot Indian', {
      locations: [loc('Section 120', ['120'])],
      items: [{ name: 'Vegan Channa', dietaryTags: ['vegan'], isNew: null }, { name: 'Chicken Tikka', dietaryTags: [], isNew: true }],
    })),
  ]);
  const html = renderToStaticMarkup(<VendorsCard vendors={vs} />);
  assert.match(html, /Food &amp; drink/);
  assert.match(html, /By section/);
  assert.match(html, /Hot Indian/);
  assert.match(html, /Section 120/);
  assert.match(html, /Vegan Channa, Chicken Tikka \(new\)/);
  assert.match(html, />Vegan</);
  assert.match(html, /nhl\.com/);
  assert.match(html, /Source read Oct 7, 2026/);
  assert.ok(!/—/.test(html), 'no em dashes');
});

test('the card folds after 12 rows: every stand stays in the HTML, inside one <details>', async () => {
  const { VendorsCard, splitGroups, VENDORS_VISIBLE } = await import('../../components/venue-hub/VendorsCard');
  assert.equal(VENDORS_VISIBLE, 12);
  // 20 stands, each at two sections: 40 rows, 20 stands.
  const vs = visibleVendors(Array.from({ length: 20 }, (_, i) =>
    toVenueVendor(`s${i}`, doc(`Stand ${String(i).padStart(2, '0')}`, { locations: [loc(String(100 + i), [String(100 + i)]), loc(String(300 + i), [String(300 + i)])] })),
  ));
  const html = renderToStaticMarkup(<VendorsCard vendors={vs} />);
  for (const v of vs) assert.ok(html.includes(v.name), `${v.name} missing from the HTML`);
  assert.equal(html.match(/<details/g)?.length, 1);
  assert.match(html, /Show all 20 stands/);
  const [before, after] = html.split('<details');
  assert.equal(before.match(/<li/g)?.length, 12, 'twelve rows above the fold');
  assert.equal(after.match(/<li/g)?.length, 28, 'the rest folded');
  assert.equal(html.match(/By section/g)?.length, 1, 'a group split by the fold is not headed twice');
  // Order is unchanged by the split.
  const { shown, rest } = splitGroups(groupVendors(vs), 12);
  const flat = [...shown, ...rest].flatMap((g) => g.entries);
  assert.deepEqual(flat, groupVendors(vs).flatMap((g) => g.entries));
});

test('twelve rows or fewer: no fold control', async () => {
  const { VendorsCard } = await import('../../components/venue-hub/VendorsCard');
  const vs = visibleVendors(Array.from({ length: 12 }, (_, i) => toVenueVendor(`s${i}`, doc(`S${i}`, { locations: [loc('1', ['1'])] }))));
  assert.doesNotMatch(renderToStaticMarkup(<VendorsCard vendors={vs} />), /<details|Show all/);
});
