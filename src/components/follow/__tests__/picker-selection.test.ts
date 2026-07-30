// What the preferences picker shows, from the record, the local stars and any
// edit already made.
//
// The stakes are asymmetric and worth stating. POST /api/preferences REPLACES
// the teams array (src/lib/subscribers.ts, setSubscriberTeamsByManageToken), so
// a picker that renders a SHRUNKEN set is a set the user can commit, and the
// difference is deleted from their record. A picker that renders a set that is
// too large is merely a checkbox they can uncheck. Every case below is written
// against that asymmetry: the invariant under test is that the picker NEVER
// shows fewer teams than the record holds.
//
// Pure, so it is testable without a render harness (docs/known-issues.md entry
// 6). Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test } from 'node:test';
import assert from 'node:assert';
import { resolvePickerSelection } from '../PreferencesForm';

const KNOWN = new Set([
  'minnesota-twins',
  'new-york-yankees',
  'boston-red-sox',
  'chicago-cubs',
]);

const resolve = (over: Partial<Parameters<typeof resolvePickerSelection>[0]> = {}) =>
  resolvePickerSelection({
    initialTeams: ['minnesota-twins'],
    starred: [],
    knownTeamIds: KNOWN,
    isHydrated: true,
    edited: null,
    ...over,
  });

// ── hazard A: the pre-hydration window ──────────────────────────────────────

test('isHydrated false yields initialTeams, never a shrunken set', () => {
  // useStarredTeams reports [] before its mount effect runs. Unioning during
  // that window would read [] on EVERY device, including the one holding the
  // stars. Falling back to the record is what makes the shrunken-set frame
  // unreachable.
  const r = resolve({ isHydrated: false, starred: ['new-york-yankees'] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins']);
  assert.strictEqual(r.showDeviceNote, false, 'nothing to explain yet');
});

test('isHydrated false with an empty record still yields the record, not a guess', () => {
  const r = resolve({ isHydrated: false, initialTeams: [], starred: ['chicago-cubs'] });
  assert.deepStrictEqual(r.selected, []);
});

test('a MISSING provider degrades to the unseeded form, not a throw', () => {
  // PreferencesForm reads the stars through useStarredTeamsOptional, so a null
  // context maps to ([], false) rather than throwing. Those are the arguments
  // asserted here. The page must still render, because it is the only route a
  // subscriber has to unsubscribe and error.tsx offers no way through: its "Try
  // again" calls reset(), which re-renders the same tree and would throw again.
  const r = resolve({ starred: [], isHydrated: false, initialTeams: ['minnesota-twins'] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins'], 'exactly today behavior');
  assert.strictEqual(r.showDeviceNote, false);
});

// ── the union ───────────────────────────────────────────────────────────────

test('isHydrated true with no local stars yields initialTeams unchanged', () => {
  const r = resolve({ starred: [] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins']);
  assert.strictEqual(r.showDeviceNote, false);
});

test('isHydrated true with local stars yields the union, record first, order stable', () => {
  const r = resolve({
    initialTeams: ['minnesota-twins', 'boston-red-sox'],
    starred: ['chicago-cubs', 'new-york-yankees'],
  });
  assert.deepStrictEqual(r.selected, [
    'minnesota-twins',
    'boston-red-sox',
    'chicago-cubs',
    'new-york-yankees',
  ]);
  assert.strictEqual(r.showDeviceNote, true);
});

test('a local star the record already holds is not duplicated and adds no note', () => {
  const r = resolve({ starred: ['minnesota-twins'] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins']);
  assert.strictEqual(r.showDeviceNote, false, 'nothing was actually added');
});

// ── the asymmetric filter ───────────────────────────────────────────────────

test('an unrenderable local star is dropped, so what is checked equals what Save sends', () => {
  const r = resolve({ starred: ['some-defunct-team', 'chicago-cubs'] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins', 'chicago-cubs']);
  assert.ok(!r.selected.includes('some-defunct-team'));
});

test('an unrenderable slug ON THE RECORD is preserved, never filtered out', () => {
  // The opposite direction, and it matters more. Dropping a slug the record
  // holds would let Save delete it. Additions are filtered; the record is not.
  const r = resolve({ initialTeams: ['minnesota-twins', 'retired-franchise'], starred: [] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins', 'retired-franchise']);
});

test('a local star that is only unrenderable adds nothing and shows no note', () => {
  const r = resolve({ starred: ['not-a-real-team'] });
  assert.deepStrictEqual(r.selected, ['minnesota-twins']);
  assert.strictEqual(r.showDeviceNote, false);
});

// ── edited wins, always ─────────────────────────────────────────────────────

test('edited wins over the union', () => {
  const r = resolve({ starred: ['new-york-yankees'], edited: ['boston-red-sox'] });
  assert.deepStrictEqual(r.selected, ['boston-red-sox']);
  assert.strictEqual(r.showDeviceNote, false, 'the selection belongs to the user now');
});

test('edited wins even before hydration', () => {
  const r = resolve({ isHydrated: false, edited: ['chicago-cubs'] });
  assert.deepStrictEqual(r.selected, ['chicago-cubs']);
});

test('edited wins over a LATER cross-tab change to starred', () => {
  // starred is not write-once: the provider re-reads it on any storage event.
  // An effect-based seed could wipe an in-progress edit mid-session; deriving
  // cannot, and this is the case that proves it.
  const before = resolve({ starred: [], edited: ['boston-red-sox'] });
  const after = resolve({ starred: ['new-york-yankees', 'chicago-cubs'], edited: ['boston-red-sox'] });
  assert.deepStrictEqual(after.selected, before.selected);
  assert.deepStrictEqual(after.selected, ['boston-red-sox']);
});

test('an empty edit is respected, not treated as absent', () => {
  // Deliberately clearing every team is a legitimate action: it reverts the
  // subscriber to the generic list. [] must not fall back to the seed.
  const r = resolve({ starred: ['new-york-yankees'], edited: [] });
  assert.deepStrictEqual(r.selected, []);
});

// ── the invariant, stated directly ──────────────────────────────────────────

test('across every hydration and starred combination, the record is never shrunk', () => {
  const record = ['minnesota-twins', 'boston-red-sox'];
  for (const isHydrated of [false, true]) {
    for (const starred of [[], ['chicago-cubs'], ['minnesota-twins'], ['nope'], ['chicago-cubs', 'nope']]) {
      const r = resolve({ initialTeams: record, starred, isHydrated });
      for (const slug of record) {
        assert.ok(
          r.selected.includes(slug),
          `record team ${slug} missing with isHydrated=${isHydrated} starred=${JSON.stringify(starred)}`,
        );
      }
    }
  }
});
