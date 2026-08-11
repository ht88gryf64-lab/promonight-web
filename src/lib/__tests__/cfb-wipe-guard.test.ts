import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertWipeSafe, findHumanOwnedDocs } from '../../../scripts/cfb/lib/human-owned';

// A Firestore stand-in with just the surface assertWipeSafe touches.
function fakeDb(collections: Record<string, Record<string, Record<string, unknown>>>) {
  return {
    collection(name: string) {
      const docs = collections[name] ?? {};
      return {
        async get() {
          return {
            docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })),
          };
        },
      };
    },
  } as unknown as FirebaseFirestore.Firestore;
}

const clean = {
  cfbGames: {
    '2026-2026-10-31-florida-georgia': { homeSchoolId: 'florida', awaySchoolId: 'georgia', venueId: '' },
    '2026-2026-11-28-alabama-auburn': { homeSchoolId: 'alabama', awaySchoolId: 'auburn', venueId: '' },
  },
};

const withHumanData = {
  cfbGames: {
    '2026-2026-10-31-florida-georgia': {
      homeSchoolId: 'florida',
      awaySchoolId: 'georgia',
      venueId: '',
      neutralVenueHubSlug: 'mercedes-benz-stadium',
    },
    '2026-2026-10-31-georgia-florida': {
      homeSchoolId: 'georgia',
      awaySchoolId: 'florida',
      venueId: '',
      tombstoned: true,
    },
    '2026-2026-11-28-alabama-auburn': { homeSchoolId: 'alabama', awaySchoolId: 'auburn', venueId: '' },
  },
};

test('a wipe is allowed when no doc carries human-owned data', async () => {
  await assertWipeSafe(fakeDb(clean), ['cfbGames'], false);
});

test('a wipe REFUSES when a doc carries human-owned data', async () => {
  await assert.rejects(
    () => assertWipeSafe(fakeDb(withHumanData), ['cfbGames'], false),
    (e: Error) => {
      assert.match(e.message, /REFUSING TO WIPE: 2 doc\(s\)/);
      return true;
    },
  );
});

test('the refusal names every affected doc and the exact fields at risk', async () => {
  await assert.rejects(
    () => assertWipeSafe(fakeDb(withHumanData), ['cfbGames'], false),
    (e: Error) => {
      assert.match(e.message, /cfbGames\/2026-2026-10-31-florida-georgia/);
      assert.match(e.message, /"neutralVenueHubSlug":"mercedes-benz-stadium"/);
      assert.match(e.message, /cfbGames\/2026-2026-10-31-georgia-florida/);
      assert.match(e.message, /"tombstoned":true/);
      // and it must not name the clean doc
      assert.equal(/alabama-auburn/.test(e.message), false);
      return true;
    },
  );
});

test('the refusal offers the scoped-run escape hatch, which skips the wipe', async () => {
  await assert.rejects(
    () => assertWipeSafe(fakeDb(withHumanData), ['cfbGames'], false),
    (e: Error) => {
      assert.match(e.message, /--only=<school> or --resume/);
      assert.match(e.message, /--force-wipe/);
      return true;
    },
  );
});

test('--force-wipe proceeds instead of throwing', async () => {
  await assertWipeSafe(fakeDb(withHumanData), ['cfbGames'], true);
});

test('findHumanOwnedDocs reports only the docs that actually carry the fields', async () => {
  const hits = await findHumanOwnedDocs(fakeDb(withHumanData), ['cfbGames']);
  assert.equal(hits.length, 2);
  assert.deepEqual(
    hits.map((h) => h.docId).sort(),
    ['2026-2026-10-31-florida-georgia', '2026-2026-10-31-georgia-florida'],
  );
});
