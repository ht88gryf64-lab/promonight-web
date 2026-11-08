// The roof flag on the hub (step 5b, pipeline 9b8855c9): parsed as its value
// (a draft default counts), and its provenance never leaves the mapper.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

test('toVenueHub: roof open, fixed (draft too), retractable; anything else null; sources.roof dropped, other sources kept', async () => {
  const { toVenueHub } = await import('../venue-hub');
  const base = { name: 'Arena', verified: true, tenants: [], sources: { parkingLots: 'https://x/parking', roof: 'https://x/roof' } };
  assert.equal(toVenueHub('a', { ...base, roof: 'fixed', roofDraft: true }, []).roof, 'fixed');
  assert.equal(toVenueHub('a', { ...base, roof: 'retractable' }, []).roof, 'retractable');
  assert.equal(toVenueHub('a', { ...base, roof: 'open' }, []).roof, 'open');
  assert.equal(toVenueHub('a', { ...base, roof: 'dome' }, []).roof, null);
  assert.equal(toVenueHub('a', base, []).roof, null);
  const hub = toVenueHub('a', { ...base, roof: 'fixed' }, []);
  assert.deepEqual(hub.sources, { parkingLots: 'https://x/parking' }, 'sources.roof never reaches a client component');
  assert.ok(!JSON.stringify(hub).includes('https://x/roof'));
});
