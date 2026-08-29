/* The `venues` corpus stops asserting transit and gate times.
 *
 * Measured 2026-08-29 on a 20-doc stratified sample verified against operators
 * (audit/venues-batch-provenance-audit.md): publicTransit 16/20 defective
 * (78.9% excluding the blind control), gatesOpen 17 claims of which 5 false and
 * 3 unverifiable. The defects are GENERATED, not stale: at least 11 of 16
 * assert something never true on any date, so no refresh cadence can repair
 * them. The corpus is the defect, so the corpus is silenced, not the doc.
 *
 * Firestore is untouched. The strings stay for a provenance rebuild. */
import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import {
  NEARBY_SILENCED, nearbySilenced, BAG_URL_REPOINTS, bagPolicyUrlFor,
} from '../venue-corpus-silence';

const read = (p: string) => fs.readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('neither mapping site carries gatesOpen or publicTransit onto a Venue', () => {
  // Both sites, because the Firestore-to-Venue mapping is duplicated and a gate
  // that lands in one of them leaves the other serving the silenced field.
  for (const p of ['src/lib/data.ts', 'src/app/api/my-teams/promos/route.ts']) {
    const src = read(p);
    assert.ok(
      !/^\s*gatesOpen:/m.test(src),
      `${p}: still maps gatesOpen onto the Venue object`,
    );
    assert.ok(
      !/^\s*publicTransit:/m.test(src),
      `${p}: still maps publicTransit onto the Venue object`,
    );
  }
});

test('the Venue type cannot carry either field, so no consumer can read one', () => {
  const src = read('src/lib/types.ts');
  const iface = src.slice(src.indexOf('export interface Venue'), src.indexOf('export interface Venue') + 2600);
  assert.ok(!/^\s*gatesOpen\?:/m.test(iface), 'Venue still declares gatesOpen');
  assert.ok(!/^\s*publicTransit\?:/m.test(iface), 'Venue still declares publicTransit');
});

test('the FAQ builder no longer asks or answers the gate-time question', () => {
  const src = read('src/lib/promo-helpers.ts');
  assert.ok(
    !/What time do gates open/.test(src),
    'the gate-time FAQ is still emitted; verbatim publication of a 47%-unconfirmed field is not a fix',
  );
});

test('the three nearby sentences that count stops from an invented station are silenced', () => {
  // A fabricated primitive propagates. These three do not merely mention a
  // transit entity, they measure FROM one: Charlotte counts "two to three stops
  // south" from a station that appears on no CATS roster.
  assert.deepEqual(
    NEARBY_SILENCED.map((n) => n.slug),
    ['bank-of-america-stadium', 'entertainment-sports-arena', 'citi-field'],
  );
  for (const n of NEARBY_SILENCED) {
    assert.equal(nearbySilenced(n.slug), true, n.slug);
    assert.ok(n.reason.length > 60, `${n.slug}: the reason must carry its evidence`);
    assert.ok(!/—/.test(n.reason), `${n.slug}: no em dashes`);
  }
  assert.equal(nearbySilenced('target-field'), false, 'a doc with no derived nearby keeps it');
  assert.equal(nearbySilenced(''), false, 'an unslugged Venue must not match a gate');
});

test('bag pointers are repointed, not silenced, and every target was verified reachable', () => {
  // A pointer gates on reachability, not provenance. Every live stored URL
  // returns 200, so none is unreachable; these seven dead-ended on a hub page
  // carrying no bag policy, and each replacement was fetched at write time.
  assert.deepEqual(
    Object.keys(BAG_URL_REPOINTS).sort(),
    ['allianz-field', 'american-family-field', 'bank-of-america-stadium', 'bc-place',
      'busch-stadium', 'geodis-park', 'bmo-field'].sort(),
  );
  for (const [slug, e] of Object.entries(BAG_URL_REPOINTS)) {
    assert.ok(/^https:\/\//.test(e.url), `${slug}: must be https`);
    assert.ok(URL.canParse(e.url), `${slug}: must be a well-formed URL`);
    assert.ok(e.verifiedOn === '2026-08-29', `${slug}: must record when it was fetched`);
    assert.ok(e.replaces !== e.url, `${slug}: a repoint that changes nothing is not a repoint`);
  }
  // The override must WIN over Firestore; the existing venue-overrides merge is
  // `stored ?? override`, which can never replace a populated bad value.
  assert.equal(
    bagPolicyUrlFor('bc-place', 'https://www.whitecapsfc.com/matchday'),
    BAG_URL_REPOINTS['bc-place'].url,
  );
  // A slug with no repoint keeps whatever it stored.
  assert.equal(bagPolicyUrlFor('target-field', 'https://example.com/bag'), 'https://example.com/bag');
  assert.equal(bagPolicyUrlFor('target-field', undefined), undefined);
});
