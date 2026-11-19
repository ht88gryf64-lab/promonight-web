import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueFormerLine, withFormerName } from '../venue-hub';

test('a renamed building: "Formerly {X}" on its own line, and the former name kept once in the description', () => {
  assert.equal(venueFormerLine({ formerNames: ['NRG Stadium'] }), 'Formerly NRG Stadium');
  assert.equal(venueFormerLine({ formerNames: [] }), null);
  // The most recent former name is the one printed.
  assert.equal(venueFormerLine({ formerNames: ['B Arena', 'A Arena'] }), 'Formerly B Arena');
  assert.equal(withFormerName('Reliant Stadium bag policy: clear bags only.', { formerNames: ['NRG Stadium'] }), 'Reliant Stadium bag policy: clear bags only. Formerly NRG Stadium.');
  assert.equal(withFormerName('Already says NRG Stadium.', { formerNames: ['NRG Stadium'] }), 'Already says NRG Stadium.');
  assert.equal(withFormerName('No rename here.', { formerNames: [] }), 'No rename here.');
});
