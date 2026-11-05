// RENDER-LEVEL BAG HOLDS (src/lib/venue-bag-holds.ts, fix/venue-bag-holds).
//
//   1. Each held field is absent from its building's rendered markup AND its
//      JSON-LD, and from the title and description where those print it.
//   2. Every other building renders byte-identically to main 76579e7
//      (venue-view-baseline-76579e7.json, rendered before any hold code).
//
// The published fixture predates the holds, so each test applies withBagHolds
// to it, exactly as toVenueHub does to the raw doc. That is faithful for these
// fields: publishedView only nulls unsourced values, and a hold nulls the value
// and drops its provenance, so the order of the two does not matter.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';
import { BAG_HOLDS, withBagHolds } from '../../../lib/venue-bag-holds';

const FIX = new URL('./fixtures/', import.meta.url);
const HUBS: VenueHub[] = JSON.parse(readFileSync(new URL('venue-hubs-published.json', FIX), 'utf8'));
const MAIN: Record<string, { htmlSha256: string; htmlBytes: number }> = JSON.parse(
  readFileSync(new URL('venue-view-baseline-76579e7.json', FIX), 'utf8'),
);
const raw = (s: string) => HUBS.find((h) => h.slug === s)!;
const held = (s: string) => withBagHolds(s, raw(s) as unknown as Record<string, unknown>) as unknown as VenueHub;
const HELD = new Set(BAG_HOLDS.map((h) => h.hub));

const render = async (h: VenueHub) => (await import('./fixtures/render-venue-view')).renderVenueView(h);
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
function jsonLd(html: string): string {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => m[1]).join('\n');
}
async function surfaces(s: string) {
  const { venueHubTitle, venueHubDescription } = await import('../../../lib/venue-hub');
  const { isBagAnswerEligible, venueBagTitle, venueBagDescription } = await import('../../../lib/venue-bag-answer');
  const h = held(s);
  const html = decode(await render(h));
  const eligible = isBagAnswerEligible(h);
  return {
    h, html, ld: decode(jsonLd(await render(h))), eligible,
    title: eligible ? venueBagTitle(h) : venueHubTitle(h, { hasVendors: false }),
    description: eligible ? venueBagDescription(h) : venueHubDescription(h),
  };
}

test('the hold list: every entry is a real building with a reason and an ops-ticket item', () => {
  assert.equal(BAG_HOLDS.length, 8);
  const seen = new Set<string>();
  for (const h of BAG_HOLDS) {
    assert.ok(HUBS.some((x) => x.slug === h.hub), `${h.hub} is a venueHubs doc`);
    assert.ok(h.reason.length > 40, `${h.hub}: a reason specific enough to re-check`);
    assert.match(h.ticket, /^docs\/ops-tickets\/venue-bag-data-2026-11\.md item 6\.\d$/, h.hub);
    assert.ok(!seen.has(`${h.hub}:${h.field}`), `${h.hub}:${h.field} listed once`);
    seen.add(`${h.hub}:${h.field}`);
  }
});

test('HOLD q2-stadium, nationwide-arena: no size limit, no MAX BAG chip, no answer block, previous title template', async () => {
  const { venueHubTitle } = await import('../../../lib/venue-hub');
  for (const s of ['q2-stadium', 'nationwide-arena']) {
    const r = await surfaces(s);
    assert.equal(r.h.bagMaxDimensions, null);
    assert.equal(r.eligible, false, `${s}: no sourced prohibition, so no bag template`);
    assert.ok(!r.html.includes('data-bag-answer'), `${s}: no answer block`);
    assert.ok(!r.html.includes('MAX BAG') && !r.html.includes('Max bag size') && !r.html.includes('MAX BAG SIZE'), `${s}: no size label`);
    for (const surface of [r.html, r.ld, r.title, r.description]) {
      assert.ok(!surface.includes('8" x 5" x 1"'), `${s}: the stored exception size is not printed as a size`);
    }
    assert.equal(r.title, venueHubTitle(r.h, { hasVendors: false }), `${s}: the previous title template`);
    assert.doesNotMatch(r.title, /Bag Size|What's Allowed|No Bags Allowed/);
  }
});

test('HOLD q2-stadium clearBagRequired: no "clear bag not required" anywhere, Austin FC lines included', async () => {
  const r = await surfaces('q2-stadium');
  assert.equal(r.h.clearBagRequired, null);
  const CLAIM = /clear bag (is )?not required|not require a clear bag|do not have to be clear|require a clear bag\?/i;
  for (const [name, surface] of [['markup', r.html], ['JSON-LD', r.ld], ['title', r.title], ['description', r.description]] as const) {
    assert.doesNotMatch(surface, CLAIM, `q2-stadium ${name}`);
  }
  const { teamVenueRows } = await import('../TeamVenueFacts');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildCondensedLogistics } = await import('../../../lib/venue-hub-condensed');
  for (const t of r.h.tenants) {
    const bag = teamVenueRows(r.h, t.teamId).find((x) => x.label === 'Bag policy');
    if (bag) assert.doesNotMatch(decode(renderToStaticMarkup(<>{bag.body}</>)), CLAIM, `team ${t.teamId}`);
    const line = buildCondensedLogistics(r.h, t.teamId).find((l) => l.key === 'bag');
    if (line) assert.doesNotMatch(line.text, CLAIM, `promo/condensed ${t.teamId}`);
  }
  assert.ok(r.h.tenants.some((t) => t.teamId === 'austin-fc'), 'Austin FC is the tenant checked');
});

test('HOLD audi-field, footprint-center: no clear-bag line, no clear-bag question', async () => {
  for (const s of ['audi-field', 'footprint-center']) {
    const r = await surfaces(s);
    assert.equal(r.h.clearBagRequired, null);
    assert.equal(r.eligible, true, `${s}: still eligible on its sourced size`);
    for (const surface of [r.html, r.ld]) {
      assert.ok(!surface.includes('A clear bag is not required'), `${s}: no clear-bag line`);
      assert.ok(!/require a clear bag\?/.test(surface), `${s}: no clear-bag question`);
      assert.ok(!/does not require a clear bag|do not have to be clear|Clear bag required/.test(surface), `${s}: no clarity claim in any answer`);
    }
    assert.ok(!/do not have to be clear|clear bag/i.test(r.description), `${s}: description silent on clarity`);
    assert.doesNotMatch(r.title, /Clear Bag/);
  }
});

test('HOLD truist-park, gainbridge-fieldhouse: the stored notes appear nowhere', async () => {
  const reasoning: Record<string, string> = {
    'truist-park': 'so clear bags are not strictly required',
    'gainbridge-fieldhouse': 'there is no clear-bag requirement stated',
  };
  for (const s of ['truist-park', 'gainbridge-fieldhouse']) {
    const notes = raw(s).bagPolicyNotes!;
    const r = await surfaces(s);
    assert.equal(r.h.bagPolicyNotes, null);
    for (const surface of [r.html, r.ld, r.description]) {
      assert.ok(!surface.includes(reasoning[s]), `${s}: the extractor reasoning is gone`);
      // Every sentence of the stored notes, not just the flagged one.
      const { sentenceSpans } = await import('../../../lib/venue-bag-answer');
      for (const sp of sentenceSpans(notes)) {
        const sentence = notes.slice(sp.start, sp.end);
        assert.ok(!surface.includes(sentence), `${s}: a notes sentence still renders: ${sentence}`);
      }
    }
  }
  // truist keeps its sourced prohibition and its tenant exception
  const t = await surfaces('truist-park');
  assert.ok(t.html.includes('>No bags allowed</p>'));
  assert.ok(t.html.includes('Bag-ban exceptions:'), 'the verified tenant exception still answers');
});

test('HOLD truist-park notes: the MLB bag-policies row reads the held doc too', async () => {
  const { bagRowFromDoc } = await import('../../../lib/venue-bag-policies');
  const doc = { ...raw('truist-park'), verified: true } as unknown as Record<string, unknown>;
  const row = bagRowFromDoc('truist-park', doc, { overlayException: null });
  assert.ok(!JSON.stringify(row).includes('strictly required'), 'no surface of the aggregator row carries the notes');
});

test('HOLD t-mobile-park: the storage answer has no link; the official bag-policy link stays', async () => {
  const r = await surfaces('t-mobile-park');
  const i = r.html.indexOf('Is there bag storage at T-Mobile Park?');
  assert.ok(i > 0, 'the storage question still renders');
  const block = r.html.slice(i, r.html.indexOf('</div>', i));
  assert.ok(!block.includes('<a '), 'no source link under the storage answer');
  // The other topic answers keep their links: the page they cite does carry
  // their sentences. Only the storage citation was wrong (ticket item 6.5).
  assert.ok(r.html.includes('Official bag policy'), 'the venue official policy link stays');
});

test('UNCHANGED: every building without a hold renders byte-identically to main 76579e7', async () => {
  let n = 0;
  for (const h of HUBS) {
    if (HELD.has(h.slug)) continue;
    assert.equal(withBagHolds(h.slug, h as unknown as Record<string, unknown>), h as unknown, `${h.slug}: no hold, same object`);
    const html = await render(h);
    const b = MAIN[h.slug];
    assert.equal(Buffer.byteLength(html), b.htmlBytes, `${h.slug}: markup length moved`);
    assert.equal(createHash('sha256').update(html).digest('hex'), b.htmlSha256, `${h.slug}: markup moved`);
    n++;
  }
  assert.equal(n, 216, '223 buildings less the 7 held buildings (8 holds)');
});

test('UNCHANGED: the check is live, every held building DOES differ from main', async () => {
  for (const s of HELD) {
    const html = await render(held(s));
    assert.notEqual(createHash('sha256').update(html).digest('hex'), MAIN[s].htmlSha256, s);
  }
});
