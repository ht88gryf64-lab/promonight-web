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
  CLAUSE_REDACTIONS, redactClause,
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


test('a redaction removes its clause and leaves the rest of the field standing', () => {
  const msg = CLAUSE_REDACTIONS.find((r) => r.slug === 'madison-square-garden')!;
  const stored = 'There is no official MSG parking, and nearby private garages are limited and expensive, so reserving ahead through a service like SpotHero is wise.' + msg.clause;
  const out = redactClause('madison-square-garden', 'parkingInfo', stored);
  assert.ok(!/Penn Station/.test(out!), 'the transit assertion survived the redaction');
  assert.ok(/SpotHero is wise\.$/.test(out!), 'the parking advice must survive intact');
});

test('a redaction is FAIL-SAFE: drift silences the field rather than republishing it', () => {
  // If the stored text no longer contains the exact clause, the value has moved
  // out from under an edit we can no longer verify. Silence on drift, never
  // publish on drift, because the failure we are guarding against is exactly a
  // stale clause going back out.
  assert.equal(redactClause('madison-square-garden', 'parkingInfo', 'Some rewritten parking text.'), null);
  assert.equal(redactClause('madison-square-garden', 'parkingInfo', null), null);
  // A slug with no redaction is passed through untouched.
  assert.equal(redactClause('target-field', 'parkingInfo', 'Lots open early.'), 'Lots open early.');
  assert.equal(redactClause('target-field', 'parkingInfo', undefined), null);
});

test('every redaction records a clause, a field and its evidence', () => {
  assert.deepEqual(
    CLAUSE_REDACTIONS.map((r) => `${r.slug}.${r.field}`),
    ['madison-square-garden.parkingInfo', 'dignity-health-sports-park.parkingLots',
      'milan-puskar-stadium.parkingLots', 'kidd-brewer-stadium.tailgating.timeWindow'],
  );
  for (const r of CLAUSE_REDACTIONS) {
    assert.ok(r.clause.length > 10, `${r.slug}: a clause short enough to match by accident is not safe`);
    assert.ok(r.reason.length > 60, `${r.slug}: carries its evidence`);
    assert.ok(!/—/.test(r.reason), `${r.slug}: no em dashes`);
  }
});

test('both mapping sites and the hub mapper apply the redaction', () => {
  // The same duplication problem as everything else in this corpus: a redaction
  // that lands in one mapper leaves the other serving the clause.
  for (const p of ['src/lib/data.ts', 'src/app/api/my-teams/promos/route.ts']) {
    assert.ok(/redactClause\(/.test(read(p)), `${p}: does not apply redactClause to parkingInfo`);
  }
  const hub = read('src/lib/venue-hub.ts');
  assert.ok(/redactClause\(slug, 'parkingLots'/.test(hub), 'venue-hub.ts does not redact lot notes');
  assert.ok(/redactClause\(slug, 'tailgating\.timeWindow'/.test(hub), 'venue-hub.ts does not redact the tailgate window');
});


test('a sub-field exclusion is honoured by EVERY site that reads the field', () => {
  // Adding the first `bag`/`notes` and `parking`/`parkingLots` entries revealed
  // that four render sites consulted provenance and the WHOLE-field exclusion
  // but never the sub-key, so an excluded note simply moved to another surface:
  // the venue page bag block, the bag FAQ answer, the parking FAQ sentence and
  // the CFB condensed block. providence-park's 2016 bag rules kept rendering in
  // the FAQ after being withheld from the card, and chase-center's lot names
  // kept rendering in a parking FAQ sentence after being withheld from the card.
  const sites: Array<[string, RegExp]> = [
    ['src/components/venue-hub/venue-logistics.tsx', /subFieldExcluded\(hub\.slug, 'bag', 'notes'\)/],
    ['src/components/venue-hub/VenueHubView.tsx', /subFieldExcluded\(hub\.slug, 'bag', 'notes'\)/],
    ['src/components/venue-hub/VenueHubView.tsx', /subFieldExcluded\(hub\.slug, 'parking', 'parkingLots'\)/],
    ['src/lib/venue-hub-condensed.ts', /excludedSub\(hub\.slug, 'bag', 'notes'\)/],
    ['src/lib/venue-hub-condensed.ts', /excludedSub\(hub\.slug, 'parking', 'parkingLots'\)/],
  ];
  for (const [file, re] of sites) {
    assert.ok(re.test(read(file)), `${file}: missing sub-field gate ${re}`);
  }
});
