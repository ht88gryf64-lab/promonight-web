// The venue bag template at RENDER level (serp-targeting, rulings 2026-11-05).
//
//   1. BYTE IDENTITY. Every building the template does not touch (states 2 and
//      3 that are not eligible, and every unverified building) renders the same
//      title, description and VenueHubView markup as main did. The baseline was
//      rendered from main 0373191 before any change on this branch
//      (scripts/serp/venue-view-baseline.tsx), so this compares against main's
//      own bytes, not a re-derivation of them.
//   2. FAQPage JSON-LD is built from exactly the Common questions the page
//      shows: same questions, same answers, same order, nothing more.
//   3. Placement: the answer block is the first child of page-content and sits
//      above the fact band and Next giveaways.
//   4. A no-bag building publishes no "MAX BAG" chip and no size headline.
import { test, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

import type { VenueHub } from '../../../lib/venue-hub';

const FIX = new URL('./fixtures/', import.meta.url);
const HUBS: VenueHub[] = JSON.parse(readFileSync(new URL('venue-hubs-published.json', FIX), 'utf8'));
const BASELINE: Record<string, { title: string; description: string; htmlSha256: string; htmlBytes: number }> = JSON.parse(
  readFileSync(new URL('venue-view-baseline.json', FIX), 'utf8'),
);
const byslug = (s: string) => HUBS.find((h) => h.slug === s)!;

const render = async (h: VenueHub) => (await import('./fixtures/render-venue-view')).renderVenueView(h);
const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

test('BYTE IDENTITY: every ineligible building renders exactly what main rendered', async () => {
  const { isBagAnswerEligible } = await import('../../../lib/venue-bag-answer');
  const { venueHubTitle, venueHubDescription } = await import('../../../lib/venue-hub');
  const ineligible = HUBS.filter((h) => !isBagAnswerEligible(h));
  assert.equal(ineligible.length, 59, '223 buildings less the 164 eligible');
  for (const h of ineligible) {
    const b = BASELINE[h.slug];
    assert.ok(b, `${h.slug} has a baseline`);
    const html = await render(h);
    assert.equal(Buffer.byteLength(html), b.htmlBytes, `${h.slug}: markup length moved`);
    assert.equal(createHash('sha256').update(html).digest('hex'), b.htmlSha256, `${h.slug}: markup moved`);
    assert.equal(venueHubTitle(h, { hasVendors: false }), b.title, `${h.slug}: title moved`);
    assert.equal(venueHubDescription(h), b.description, `${h.slug}: description moved`);
  }
});

test('BYTE IDENTITY: the check is live, an eligible building DOES differ from main', async () => {
  const h = byslug('united-center');
  const html = await render(h);
  assert.notEqual(createHash('sha256').update(html).digest('hex'), BASELINE[h.slug].htmlSha256);
});

/** On-page Common questions: the H2s and answer paragraphs inside the FAQ section. */
function onPageFaq(html: string): Array<{ q: string; a: string }> {
  const sec = html.slice(html.indexOf('>Common questions</p>'));
  const out: Array<{ q: string; a: string }> = [];
  for (const m of sec.matchAll(/<h2 class="rd-display[^"]*">(.*?)<\/h2><p class="mt-2 max-w-2xl[^"]*">(.*?)<\/p>/g)) {
    out.push({ q: decode(m[1]), a: decode(m[2]) });
  }
  return out;
}
function jsonLdFaq(html: string): Array<{ q: string; a: string }> {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = scripts.find((s) => s['@type'] === 'FAQPage');
  return (faq?.mainEntity ?? []).map((e: { name: string; acceptedAnswer: { text: string } }) => ({ q: e.name, a: e.acceptedAnswer.text }));
}

test('FAQPage JSON-LD equals the on-page Common questions exactly, on every eligible building', async () => {
  const { isBagAnswerEligible, bagTopicQuestions } = await import('../../../lib/venue-bag-answer');
  let topicQs = 0;
  for (const h of HUBS.filter(isBagAnswerEligible)) {
    const html = await render(h);
    assert.ok(html.includes('>Common questions</p>'), `${h.slug}: one "Common questions" section`);
    assert.ok(!html.includes('>Frequently asked</p>'), `${h.slug}: no second FAQ section`);
    const page = onPageFaq(html);
    assert.deepEqual(jsonLdFaq(html), page, `${h.slug}: JSON-LD and page differ`);
    // every quoted bag question is on the page
    for (const q of bagTopicQuestions(h)) {
      topicQs++;
      assert.ok(page.some((p) => p.q === q.question && p.a === q.answer), `${h.slug}: ${q.question}`);
    }
  }
  // Measured 2026-11-05 on the published fixture; the Gate 2 report quotes it.
  assert.equal(topicQs, 306);
});

test('the answer block is the first thing in page-content, above the fact band and Next giveaways', async () => {
  for (const s of ['united-center', 'wrigley-field', 'chase-center', 'target-center', 'truist-park']) {
    const html = await render(byslug(s));
    const pc = html.indexOf('page-content');
    const answer = html.indexOf('data-bag-answer');
    const band = html.indexOf('bg-[#2b2620]');
    assert.ok(pc > 0 && answer > pc, `${s}: the answer block is inside page-content`);
    // nothing between the page-content open tag and the answer slot
    assert.match(html.slice(pc), /^page-content"><div data-bag-answer-top="true">/, `${s}: the answer slot is the first child`);
    if (band >= 0) assert.ok(band > answer, `${s}: the fact band follows the answer block`);
    const h1 = html.indexOf('<h1');
    assert.ok(h1 >= 0 && h1 < answer, `${s}: the H1 precedes it`);
  }
});

test('H1 is "{Venue} Bag Policy"; a renamed building keeps its former name', async () => {
  assert.match(await render(byslug('united-center')), /<h1[^>]*>United Center Bag Policy<\/h1>/);
  assert.match(await render(byslug('xcel-energy-center')), /<h1[^>]*>Grand Casino Arena Bag Policy \(formerly Xcel Energy Center\)<\/h1>/);
});

test('a no-bag building: "No bags allowed", no MAX BAG chip, the size only inside the quote', async () => {
  const html = await render(byslug('truist-park'));
  assert.ok(html.includes('>No bags allowed</p>'));
  assert.ok(!html.includes('MAX BAG'), 'no MAX BAG chip beside a prohibition');
  assert.ok(!html.includes('Max bag size'), 'no size headline');
  assert.ok(html.includes('>BAGS</div>'), 'the chip says BAGS: Not allowed');
  // the only place 5 x 9 appears is the stored sentence
  for (const m of html.matchAll(/5 x 9|5&quot; x 9/g)) {
    const around = html.slice(Math.max(0, m.index! - 200), m.index! + 50);
    assert.match(around, /clutches or clear bags no larger than/, 'the size appears only inside the quoted exception');
  }
});

test('CLAIMS VS DATA: every answer-block paragraph is a fixed restatement or a quote', async () => {
  const { isBagAnswerEligible, sourcedBagFacts } = await import('../../../lib/venue-bag-answer');
  for (const h of HUBS.filter(isBagAnswerEligible)) {
    const html = await render(h);
    const block = html.slice(html.indexOf('<div data-bag-answer=""'), html.indexOf('</section>', html.indexOf('<div data-bag-answer=""')));
    const f = sourcedBagFacts(h);
    const prose = [h.bagPolicyNotes ?? '', ...h.tenantOverlays.map((t) => t.bagPolicyException ?? '')];
    for (const m of block.matchAll(/<p class="[^"]*">(.*?)<\/p>/g)) {
      const p = decode(m[1].replace(/<[^>]+>/g, ''));
      const fixed = [
        'No bags allowed',
        `Max bag size: ${f.sizeLimit}`,
        'Clear bag required.',
        'A clear bag is not required.',
        'No outside food or drink.',
      ];
      const ok =
        fixed.includes(p) ||
        prose.some((t) => t && t.includes(p)) ||
        /^(Last verified [A-Z][a-z]{2} \d{1,2}, \d{4}( · )?)?([a-z0-9.-]+\.[a-z]{2,} ›)?$/.test(p) ||
        /^Clear bag\. /.test(p);
      assert.ok(ok, `${h.slug}: unsourced text in the answer block: ${p}`);
      if (p === 'Clear bag required.') assert.equal(f.clear, true, h.slug);
      if (p === 'A clear bag is not required.') assert.equal(f.clear, false, h.slug);
      if (p === 'No bags allowed') assert.equal(f.prohibited, true, h.slug);
    }
  }
});
