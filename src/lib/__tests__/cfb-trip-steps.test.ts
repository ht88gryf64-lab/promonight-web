import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTripSteps } from '../cfb/trip-steps';

// The timeline gates its own steps because the shared CTA components do not fail
// closed. No page in the 32-slug registry currently lacks coordinates, so this
// is the only place the no-coords branch is exercised.

const FULL = { lat: 32.7796, lng: -96.7596, city: 'Dallas', hubSlug: 'cotton-bowl-stadium', hubIndexable: true };

test('a fully resolved venue renders all four steps', () => {
  assert.deepEqual(planTripSteps({ hasTicketSchool: true, venue: FULL }), ['tickets', 'hotels', 'parking', 'gates']);
});

test('NO COORDS drops Park, because SpotHeroCTA never returns null', () => {
  // Without this gate the step would render a tracked link to spothero.com's
  // homepage labelled "Reserve parking".
  const steps = planTripSteps({ hasTicketSchool: true, venue: { ...FULL, lat: null, lng: null } });
  assert.equal(steps.includes('parking'), false);
  assert.deepEqual(steps, ['tickets', 'hotels', 'gates']);
});

test('no coords but a city still renders Book a room, which is a real city-level search', () => {
  const steps = planTripSteps({ hasTicketSchool: true, venue: { ...FULL, lat: null, lng: null, hubSlug: null, hubIndexable: false } });
  assert.deepEqual(steps, ['tickets', 'hotels']);
});

test('neither coords nor city drops Book a room too', () => {
  const steps = planTripSteps({ hasTicketSchool: true, venue: { lat: null, lng: null, city: null, hubSlug: null, hubIndexable: false } });
  assert.deepEqual(steps, ['tickets']);
});

test('a non-indexable hub drops Gates and bags, so it never links into an empty hub', () => {
  const steps = planTripSteps({ hasTicketSchool: true, venue: { ...FULL, hubIndexable: false } });
  assert.equal(steps.includes('gates'), false);
});

test('no hub slug at all drops Gates and bags', () => {
  const steps = planTripSteps({ hasTicketSchool: true, venue: { ...FULL, hubSlug: null } });
  assert.equal(steps.includes('gates'), false);
});

test('tickets-only is acceptable and still returns a step, so the heading renders', () => {
  const steps = planTripSteps({ hasTicketSchool: true, venue: null });
  assert.deepEqual(steps, ['tickets']);
});

test('no tracked school at all yields no steps', () => {
  assert.deepEqual(planTripSteps({ hasTicketSchool: false, venue: FULL }), []);
});

test('tickets is always first, so the solid button is the primary action', () => {
  for (const venue of [FULL, { ...FULL, lat: null, lng: null }, null]) {
    const steps = planTripSteps({ hasTicketSchool: true, venue });
    assert.equal(steps[0], 'tickets');
  }
});
