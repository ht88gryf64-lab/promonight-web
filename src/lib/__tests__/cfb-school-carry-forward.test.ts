import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  carryHumanOwned, pickHumanOwned, HUMAN_OWNED_BY_COLLECTION,
} from '../cfb/human-owned';
import { assertWipeSafe, findHumanOwnedDocs } from '../../../scripts/cfb/lib/human-owned';

// THE PIECE WITH REAL RISK.
//
// cfbSchools is rebuilt by BOTH Phase 2 writers with a bare set() and is wiped
// outright by an unscoped run-phase2 --execute. `editorial` is reader-
// contributed prose a human approved section by section: no parser emits it and
// no re-run can rebuild it. If a rebuild drops it, 87 pages lose their only
// human writing and nothing errors.
//
// These tests exercise the WRITE PLAN, not the dry run. A dry run writes
// nothing, so "a dry run left the doc unchanged" is true of a no-op and proves
// nothing. What has to hold is that the document the writer WOULD set() carries
// the editorial block through byte-identically.

/** The exact document shape run-phase2.ts builds for a school. */
const machineDoc = (over: Record<string, unknown> = {}) => ({
  id: 'penn-state', name: 'Penn State', shortName: 'Penn State', mascot: 'Nittany Lions',
  primaryColor: '#001E44', secondaryColor: '#FFFFFF',
  colorsSource: 'https://en.wikipedia.org/wiki/Penn_State_Nittany_Lions_football',
  colorsHumanConfirmed: false,
  conferenceBySeason: { '2026': 'Big Ten' }, venueId: 'beaver-stadium', traditionIds: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const storedWithEditorial = {
  ...machineDoc({ updatedAt: '2026-07-07T16:40:18.490Z' }),
  scheduleUrl: 'https://gopsusports.com/sports/football/schedule',
  editorial: {
    whyYouGo: {
      text: 'A football Saturday at Beaver Stadium is a truly unique experience.',
      contributor: 'Andrew',
      approvedAt: '2026-09-20T18:00:00.000Z',
      contributionId: 'xjbIK9nfmh4zP7AotIJz',
    },
    venueInTheirWords: {
      text: 'The sound booms in the stadium, it’s an unrivaled level of noise on third down.',
      contributor: 'Andrew',
      approvedAt: '2026-09-20T18:00:00.000Z',
      contributionId: 'xjbIK9nfmh4zP7AotIJz',
    },
  },
};

test('a full Phase 2 rebuild leaves the editorial block BYTE-IDENTICAL', () => {
  const before = JSON.stringify(storedWithEditorial.editorial);
  const written = carryHumanOwned(machineDoc(), storedWithEditorial, 'cfbSchools');
  assert.equal(
    JSON.stringify((written as Record<string, unknown>).editorial), before,
    'the rebuilt doc must serialize the editorial block exactly as stored',
  );
  assert.deepEqual((written as Record<string, unknown>).editorial, storedWithEditorial.editorial);
});

test('the rebuild still OVERWRITES every machine-owned field', () => {
  const written = carryHumanOwned(
    machineDoc({ name: 'Penn State Nittany Lions', primaryColor: '#000000' }),
    storedWithEditorial, 'cfbSchools',
  ) as Record<string, unknown>;
  assert.equal(written.name, 'Penn State Nittany Lions', 'a fresh parse must win on machine fields');
  assert.equal(written.primaryColor, '#000000');
  assert.equal(written.updatedAt, '2026-10-01T00:00:00.000Z');
  // and a stale machine field the writer no longer emits must NOT survive:
  // this is an allowlist, not { merge: true }.
  assert.equal('scheduleUrl' in written, false);
});

test('the carry is an ALLOWLIST: no other stored field rides along', () => {
  const carried = pickHumanOwned(storedWithEditorial, 'cfbSchools');
  assert.deepEqual(Object.keys(carried), ['editorial']);
});

test('editorialStatus is never written by the rebuild', () => {
  const written = carryHumanOwned(machineDoc(), storedWithEditorial, 'cfbSchools');
  assert.equal('editorialStatus' in (written as Record<string, unknown>), false);
  // even when a legacy doc still carries the stored field, it is NOT carried
  // forward: it is derived at read time and a stored copy could only disagree.
  const legacy = { ...storedWithEditorial, editorialStatus: 'destination' };
  const w2 = carryHumanOwned(machineDoc(), legacy, 'cfbSchools') as Record<string, unknown>;
  assert.equal('editorialStatus' in w2, false);
});

test('a school with no editorial is written clean, with no undefined key', () => {
  const written = carryHumanOwned(machineDoc(), { ...machineDoc() }, 'cfbSchools') as Record<string, unknown>;
  assert.equal('editorial' in written, false, 'an absent field must not become an undefined key');
});

test('a missing stored doc (first write) carries nothing and does not throw', () => {
  const written = carryHumanOwned(machineDoc(), undefined, 'cfbSchools') as Record<string, unknown>;
  assert.equal('editorial' in written, false);
  assert.equal(written.id, 'penn-state');
});

// ── the allowlist is per-collection, and the wipe guard uses it ──────────────

test('the human-owned allowlist is scoped per collection', () => {
  assert.deepEqual([...HUMAN_OWNED_BY_COLLECTION.cfbSchools], ['editorial']);
  assert.equal(HUMAN_OWNED_BY_COLLECTION.cfbSchools.includes('tombstoned'), false);
  assert.equal(HUMAN_OWNED_BY_COLLECTION.cfbGames.includes('editorial'), false);
  // an unregistered wipe-listed collection has no protection, and says so
  assert.deepEqual(pickHumanOwned({ anything: 1 }, 'cfbVenues'), {});
});

test('a games field on a school doc is NOT treated as human-owned there', () => {
  // scoping matters in both directions: `tombstoned` on a school doc is not a
  // human decision, and carrying it would resurrect a meaningless field.
  assert.deepEqual(pickHumanOwned({ tombstoned: true }, 'cfbSchools'), {});
});

function fakeDb(collections: Record<string, Record<string, Record<string, unknown>>>) {
  return {
    collection(name: string) {
      const docs = collections[name] ?? {};
      return {
        async get() {
          return { docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })) };
        },
      };
    },
  } as unknown as FirebaseFirestore.Firestore;
}

test('assertWipeSafe REFUSES to wipe cfbSchools while an editorial block exists', async () => {
  const db = fakeDb({
    cfbSchools: { 'penn-state': storedWithEditorial, tennessee: machineDoc({ id: 'tennessee' }) },
  });
  await assert.rejects(
    () => assertWipeSafe(db, ['cfbSchools'], false),
    (e: Error) => {
      assert.match(e.message, /REFUSING TO WIPE: 1 doc\(s\)/);
      assert.match(e.message, /cfbSchools\/penn-state/);
      assert.match(e.message, /Andrew/);
      assert.equal(/tennessee/.test(e.message), false, 'a clean school must not be named');
      return true;
    },
  );
});

test('the wipe guard finds editorial on cfbSchools in a mixed-collection scan', async () => {
  const db = fakeDb({
    cfbGames: { g1: { tombstoned: true }, g2: { homeSchoolId: 'penn-state' } },
    cfbSchools: { 'penn-state': storedWithEditorial },
    cfbVenues: { 'beaver-stadium': { capacity: 106572 } },
  });
  const hits = await findHumanOwnedDocs(db, ['cfbGames', 'cfbSchools', 'cfbVenues']);
  assert.deepEqual(
    hits.map((h) => `${h.collection}/${h.docId}`).sort(),
    ['cfbGames/g1', 'cfbSchools/penn-state'],
  );
});
