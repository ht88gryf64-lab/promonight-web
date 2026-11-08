// RULING 6, SITE-WIDE (2026-11-05). Wherever a building has a sourced
// bagsProhibited true, no surface renders a size as a limit or as "Max bag".
// A size may appear only inside the exception text (the stored notes or a
// verified tenant's bagPolicyException), never as a figure, a chip or a label.
//
// Every bag-rendering surface, for every such building:
//   venue page markup and its JSON-LD, the venue title and meta description,
//   the venue fact-band chip, the team-page bag line (one per tenant), the
//   condensed bag line (promo pages and the CFB school block), and the MLB
//   aggregator row.
//
// "Every such building" is every published hub with a sourced prohibition in
// the 2026-11-05 fixture (truist-park, after its holds), plus a synthetic one
// that carries every field at once, so the test keeps biting when the real
// set is one building.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';
import { withBagHolds } from '../../../lib/venue-bag-holds';

const SRC = 'https://www.example-park.com/bag-policy';
const HUBS: VenueHub[] = JSON.parse(
  readFileSync(new URL('./fixtures/venue-hubs-published.json', import.meta.url), 'utf8'),
);

const SYNTHETIC: VenueHub = {
  slug: 'example-no-bag-park', name: 'Example No Bag Park', formerNames: [], city: 'Town', state: 'ST', lat: 1, lng: 2, capacity: 40000,
  tenants: [{ teamId: 'example-club', league: 'MLB', tenantKey: 'example-club' }],
  parkingLots: [], parkingLotMapUrl: null, officialParkingUrls: [], publicTransit: null, rideshareDropoff: null, accessibility: null,
  bagMaxDimensions: { w: 4.5, h: 6.5, d: 1, unit: 'in' }, clearBagRequired: false, bagsProhibited: true,
  bagPolicyUrl: SRC,
  bagPolicyNotes: 'Bags are not permitted inside the park. Small clutches no larger than 4.5 x 6.5 x 1 inches are the only exception.',
  tailgating: null, venueAccessRestrictions: null, nearby: null, outsideFoodAllowed: null, outsideFoodRules: null, food: null,
  photoUrl: null, photoAttribution: null, verified: true, observedAtByField: {}, fieldStates: {},
  tenantOverlays: [{
    teamId: 'example-club', league: 'MLB', displayName: 'Example Club',
    gatesOpen: { ruleText: 'Gates open 90 minutes before first pitch.', minutesBefore: 90 }, gateVariance: null, tailgateWindow: null,
    bagPolicyException: 'Clutches up to 4.5 x 6.5 x 1 inches and medical bags are exempt.', verified: true,
    sources: { gatesOpen: SRC, bagPolicyException: SRC }, observedAtByField: {},
  }],
  sources: { bagMaxDimensions: SRC, clearBagRequired: SRC, bagsProhibited: SRC, bagPolicyNotes: SRC, bagPolicyUrl: SRC },
};

/** Published hubs as the page now receives them (holds applied, as toVenueHub does). */
const prohibited = (): VenueHub[] => [
  ...HUBS.map((h) => withBagHolds(h.slug, h as unknown as Record<string, unknown>) as unknown as VenueHub)
    .filter((h) => h.verified && h.bagsProhibited === true && !!h.sources.bagsProhibited),
  SYNTHETIC,
];

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\\"/g, '"').replace(/<!-- -->/g, '');

/** Every way a size can be printed: our formatter, the aggregator's, and the
 *  raw "W x H" a template might build. */
function sizeForms(h: VenueHub): string[] {
  const d = h.bagMaxDimensions!;
  const n = [d.w, d.h, ...(d.d ? [d.d] : [])];
  return [
    n.map((x) => `${x}"`).join(' x '),
    n.map((x) => `${x}″`).join(' × '),
    `${d.w}" x ${d.h}"`,
    `${d.w} x ${d.h}`,
    `${d.w}x${d.h}`,
  ];
}

/** The text a size may legitimately appear in: the stored policy prose, as
 *  the source words it. The bag notes and tenant exceptions, and the entry
 *  restrictions, which on truist-park list "bags/backpacks/clutches exceeding
 *  5x9 inches" among prohibited items (the Getting-in "Entry" row). None of
 *  these is a size the template presents as a limit; that is what is banned. */
function exceptionTexts(h: VenueHub): string[] {
  return [h.bagPolicyNotes ?? '', h.venueAccessRestrictions ?? '', ...h.tenantOverlays.map((t) => t.bagPolicyException ?? '')].filter(Boolean);
}

function assertNoSizeOutsideExceptions(h: VenueHub, surface: string, raw: string) {
  let text = decode(raw);
  // Remove every exception text, whole and sentence by sentence (an answer may
  // quote one sentence of it), longest first.
  const pieces = exceptionTexts(h).flatMap((t) => [t, ...t.split(/(?<=[.!?])\s+/)]).sort((a, b) => b.length - a.length);
  for (const p of pieces) if (p.trim()) text = text.split(p).join(' ');
  assert.doesNotMatch(text, /max bag/i, `${h.slug} ${surface}: "Max bag" on a no-bag building`);
  for (const f of sizeForms(h)) {
    assert.ok(!text.includes(f), `${h.slug} ${surface}: size "${f}" printed outside the exception text`);
  }
}

test('the set: every sourced-prohibition building is covered, real and synthetic', () => {
  const slugs = prohibited().map((h) => h.slug);
  assert.deepEqual(slugs, ['truist-park', 'example-no-bag-park']);
});

test('VENUE PAGE: markup, JSON-LD, title, description and chip', async () => {
  const { renderVenueView } = await import('./fixtures/render-venue-view');
  const { venueBagTitle, venueBagDescription, isBagAnswerEligible } = await import('../../../lib/venue-bag-answer');
  const { bagChipFor } = await import('../venue-logistics');
  for (const h of prohibited()) {
    assert.ok(isBagAnswerEligible(h), `${h.slug}: a sourced prohibition is eligible`);
    const html = renderVenueView(h);
    assertNoSizeOutsideExceptions(h, 'venue markup', html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, ''));
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) assertNoSizeOutsideExceptions(h, 'venue JSON-LD', m[1]);
    assertNoSizeOutsideExceptions(h, 'title', venueBagTitle(h));
    assertNoSizeOutsideExceptions(h, 'description', venueBagDescription(h));
    assert.deepEqual(bagChipFor(h), { k: 'BAGS', v: 'Not allowed' }, `${h.slug}: chip`);
    assert.ok(html.includes('>No bags allowed</p>'), `${h.slug}: the answer leads with the prohibition`);
  }
});

test('TEAM PAGE: the bag line for every tenant', async () => {
  const { teamVenueRows } = await import('../TeamVenueFacts');
  for (const h of prohibited()) {
    for (const t of h.tenants) {
      const rows = teamVenueRows(h, t.teamId);
      const bag = rows.find((r) => r.label === 'Bag policy');
      assert.ok(bag, `${h.slug}/${t.teamId}: the team page has a bag line`);
      const html = renderToStaticMarkup(<>{bag!.body}</>);
      assertNoSizeOutsideExceptions(h, `team ${t.teamId}`, html);
      assert.match(decode(html), /No bags/, `${h.slug}/${t.teamId}: the line states the prohibition`);
    }
  }
});

test('PROMO PAGES and CFB block: the condensed bag line', async () => {
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  for (const h of prohibited()) {
    for (const t of h.tenants) {
      const line = buildCondensedLogistics(h, t.teamId).find((l) => l.key === 'bag');
      assert.ok(line, `${h.slug}/${t.teamId}: a bag line`);
      // Ruling 2026-11-08 (pipeline EXTRACTION-RULES 1.8): a sourced size on a
      // no-bag building prints as the clutch EXCEPTION, in one sentence, never as
      // a limit. That sentence is exception text; anything else in the line is
      // held to the rule above. (Before the ruling this line was exactly
      // "Bags are not allowed.")
      const PREFIX = 'No bags, except clutches up to ';
      assert.ok(line!.text.startsWith(PREFIX) && line!.text.endsWith('.'), `${h.slug}/${t.teamId}: the clutch sentence, got ${line!.text}`);
      assert.doesNotMatch(line!.text, /max bag/i, `${h.slug}/${t.teamId}: never "Max bag"`);
      assertNoSizeOutsideExceptions(h, `condensed ${t.teamId}`, line!.text.slice(PREFIX.length, -1).replace(/^[\d.]+(?:"|cm)(?: x [\d.]+(?:"|cm)){1,2}$/, ''));
      // Without a sourced size, the plain prohibition.
      const noSize = buildCondensedLogistics({ ...h, bagMaxDimensions: null }, t.teamId).find((l) => l.key === 'bag');
      assert.equal(noSize!.text, 'Bags are not allowed.', `${h.slug}/${t.teamId}: no size`);
    }
  }
});

test('MLB AGGREGATOR: the row carries no size, so no chip can print one', async () => {
  const { bagRowFromDoc, classifyRow } = await import('../../../lib/venue-bag-policies');
  for (const h of prohibited()) {
    const row = bagRowFromDoc(h.slug, h as unknown as Record<string, unknown>, { overlayException: h.tenantOverlays[0]?.bagPolicyException ?? null });
    assert.equal(row.dims, null, `${h.slug}: no size on the row`);
    assert.equal(row.dimsText, null, `${h.slug}: no size text on the row`);
    assert.equal(classifyRow(row), 'no-bags', `${h.slug}: filed under no bags`);
  }
  // and the page's own no-bags branch prints no size chip
  const page = readFileSync(new URL('../../../app/venues/bag-policies/page.tsx', import.meta.url), 'utf8');
  const branch = page.slice(page.indexOf("if (group === 'no-bags') {"), page.indexOf('return chips;', page.indexOf("if (group === 'no-bags') {")));
  assert.doesNotMatch(branch.replace(/\/\/.*$/gm, ''), /dimsText|<Chip/, 'no chip is pushed for a no-bag park');
});

test('the rule is about PROHIBITION: a sourced size on an ordinary building still prints', async () => {
  const { bagChipFor } = await import('../venue-logistics');
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  const ordinary: VenueHub = { ...SYNTHETIC, slug: 'example-bag-park', bagsProhibited: null, sources: { ...SYNTHETIC.sources, bagsProhibited: '' } };
  delete (ordinary.sources as Record<string, string>).bagsProhibited;
  assert.deepEqual(bagChipFor(ordinary), { k: 'MAX BAG', v: '4.5" x 6.5" x 1"' });
  assert.equal(buildCondensedLogistics(ordinary, 'example-club').find((l) => l.key === 'bag')!.text, 'Max bag 4.5" x 6.5" x 1".');
});
