// Entity model, phase 1: the `kind` field is tolerated and changes nothing.
//
//  1. promoKind: the stored kind, or null for absent and for anything unknown.
//  2. promoGameKey: team + date, the bracket game for a postseason row, null
//     with no usable date.
//  3. TOLERANCE. A doc carrying kind (any value, known or not) maps to exactly
//     the Promo it mapped to without it, on mapPromoDoc and on every data-layer
//     reader exercised here; nothing gains a key, loses a row or reorders.
//  4. TRIPWIRE. No source file outside this module imports it, and no source
//     file reads `.kind` off a promo row. Phase 1 is schema only; the phase
//     that makes readers use kind removes this test on purpose.
//
// Run with: node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

type Data = Record<string, unknown>;
function fakeDoc(id: string, data: Data, teamId?: string) {
  return { id, exists: true, data: () => data, get: (f: string) => data[f], ref: { parent: { parent: teamId ? { id: teamId } : null } } };
}
type Doc = ReturnType<typeof fakeDoc>;
function query(docs: Doc[]): any {
  let rows = docs;
  const q: any = {
    where: (field: string, op: string, value: any) => {
      const v = (d: Doc) => d.data()[field] as any;
      if (op === '==') rows = rows.filter((d) => v(d) === value);
      if (op === '>=') rows = rows.filter((d) => v(d) >= value);
      if (op === '<=') rows = rows.filter((d) => v(d) <= value);
      if (op === '<') rows = rows.filter((d) => v(d) < value);
      return q;
    },
    orderBy: (field: string) => {
      rows = [...rows].sort((a, b) => String(a.data()[field]).localeCompare(String(b.data()[field])));
      return q;
    },
    limit: () => q,
    count: () => ({ get: async () => ({ data: () => ({ count: rows.length }) }) }),
    get: async () => ({ docs: rows, empty: rows.length === 0, size: rows.length, forEach: (fn: (d: Doc) => void) => rows.forEach(fn) }),
  };
  return q;
}

// One club's rows, one of every shape the corpus holds: an item, a theme
// night, a mixed row, a fixture, a kids row, a food deal, a scored row, a
// package, a tombstone and a postseason row.
const BASE: { id: string; data: Data }[] = [
  { id: 'a', data: { date: '2099-01-02', title: 'Star Player Bobblehead', type: 'giveaway', description: 'First 10,000 fans receive a bobblehead.', highlight: true, attendanceCap: 10000, score: 95, scoreBreakdown: { baseType: 40, itemType: 30 }, derivedSignals: { itemType: 'bobblehead' }, scoredAt: '2026-11-25T21:00:00.000Z' } },
  { id: 'b', data: { date: '2099-01-03', title: 'Star Wars Night', type: 'theme', description: 'Themed game night.', themeKey: 'star-wars' } },
  { id: 'c', data: { date: '2099-01-04', title: 'Centennial Celebration Night', type: 'theme', description: 'Bobblehead giveaway for the first 8,000 fans.' } },
  { id: 'd', data: { date: '2099-01-05', title: 'Regular Season Match', type: 'theme', description: 'Home match.' } },
  { id: 'e', data: { date: '2099-01-06', title: 'Kids Run the Bases', type: 'kids', description: 'After the game.' } },
  { id: 'f', data: { date: '2099-01-07', title: '$1 Hot Dogs', type: 'food', description: 'Dollar dogs.' } },
  { id: 'g', data: { date: '2099-01-08', title: 'Hoodie Pack', type: 'theme', description: 'Ticket package includes a hoodie.', ticketPackageRequired: true } },
  { id: 'h', data: { date: '2099-01-09', title: 'Gone Night', type: 'theme', description: '', tombstoned: true } },
  { id: 'i', data: { date: '2099-01-10', title: 'Playoff T-Shirt', type: 'giveaway', description: 'All fans.', isPostseason: true, bracketGameId: '401918305' } },
];
// The kind each row would carry, plus values no version of this code knows.
const KINDS: Record<string, unknown> = { a: 'item', b: 'event', c: 'item', d: 'fixture', e: 'event', f: 'event', g: 'item', h: 'event', i: 'item' };
const UNKNOWN: Record<string, unknown> = { a: 'package', b: '', c: null, d: 'FIXTURE', e: 7, f: { kind: 'item' }, g: ['item'], h: 'game', i: true };

const TEAM = 'test-club';
const TEAM_DOCS = [fakeDoc(TEAM, { league: 'NHL', city: 'Test', name: 'Club', abbreviation: 'TST', primaryColor: 0, secondaryColor: 0, division: 'Atlantic', sportSlug: 'nhl' })];
let variant: Record<string, unknown> | null = null; // null: no doc carries kind
// Control for the reader test: a field the readers DO act on, so "the three
// snapshots are equal" cannot pass merely because the fake is read once.
let controlTombstone = false;
const docs = () =>
  BASE.map((r) =>
    fakeDoc(r.id, { ...r.data, ...(variant ? { kind: variant[r.id] } : {}), ...(controlTombstone && r.id === 'b' ? { tombstoned: true } : {}) }, TEAM),
  );
const fakeDb = {
  collection(name: string): any {
    if (name === 'teams') {
      return {
        ...query(TEAM_DOCS),
        doc: () => ({ get: async () => ({ exists: true, id: TEAM, data: () => TEAM_DOCS[0].data() }), collection: () => query(docs()) }),
      };
    }
    return query([]);
  },
  collectionGroup(name: string): any {
    return query(name === 'promos' ? docs() : []);
  },
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../firebase.ts', import.meta.url).href, { namedExports: { db: fakeDb } });

test('promoKind: the stored kind, null for absent and for anything unknown', async () => {
  const { promoKind, PROMO_KINDS } = await import('../promo-kind');
  assert.deepEqual([...PROMO_KINDS], ['item', 'event', 'fixture']);
  for (const k of PROMO_KINDS) assert.equal(promoKind({ kind: k }), k);
  for (const bad of [undefined, null, '', 'package', 'FIXTURE', 'Item', ' item', 7, true, {}, ['item']]) assert.equal(promoKind({ kind: bad }), null);
  assert.equal(promoKind({}), null);
  assert.equal(promoKind(null), null);
  assert.equal(promoKind(undefined), null);
  // Never inferred from the type or the title.
  assert.equal(promoKind({ type: 'giveaway', title: 'Bobblehead' } as { kind?: unknown }), null);
});

test('promoGameKey: team and date, the bracket game for postseason, null with no date', async () => {
  const { promoGameKey } = await import('../promo-kind');
  assert.equal(promoGameKey('chicago-blackhawks', { date: '2025-11-15' }), 'chicago-blackhawks|2025-11-15');
  // An item and the event for the same night share the key.
  assert.equal(promoGameKey('philadelphia-76ers', { date: '2026-11-25' }), promoGameKey('philadelphia-76ers', { date: '2026-11-25' }));
  assert.notEqual(promoGameKey('seattle-mariners', { date: '2026-05-18' }), promoGameKey('seattle-mariners', { date: '2026-05-19' }));
  for (const date of [undefined, null, '', 'nodate', '2026-5-18', '05/18/2026', 20260518]) assert.equal(promoGameKey('miami-heat', { date }), null);
  assert.equal(promoGameKey('', { date: '2026-05-18' }), null);
  assert.equal(promoGameKey(null, { date: '2026-05-18' }), null);
  assert.equal(promoGameKey('miami-heat', null), null);
  // Postseason: the bracket game, never team and date.
  assert.equal(promoGameKey('golden-state-valkyries', { date: '2026-10-17', isPostseason: true, bracketGameId: '401918305' }), 'bracket:401918305');
  assert.equal(promoGameKey('golden-state-valkyries', { date: '2026-10-17', isPostseason: true, bracketGameId: 401918305 }), 'bracket:401918305');
  assert.equal(promoGameKey('golden-state-valkyries', { date: '2026-10-17', isPostseason: true }), null);
  assert.equal(promoGameKey('golden-state-valkyries', { date: '2026-10-17', isPostseason: true, bracketGameId: ' ' }), null);
});

test('mapPromoDoc: a doc with kind maps to exactly the Promo it mapped to without it', async () => {
  const { mapPromoDoc } = await import('../data');
  for (const r of BASE) {
    const plain = mapPromoDoc(fakeDoc(r.id, { ...r.data }) as never);
    for (const kind of ['item', 'event', 'fixture', UNKNOWN[r.id]]) {
      const withKind = mapPromoDoc(fakeDoc(r.id, { ...r.data, kind }) as never);
      assert.deepEqual(withKind, plain, `${r.id} with kind ${JSON.stringify(kind)}`);
      assert.equal('kind' in (withKind as object), false, 'kind never rides on a Promo');
    }
  }
});

// Every reader below runs three times: no doc carries kind, every doc carries
// its real kind, every doc carries a value nothing knows. The three results
// must be the same rows, in the same order, with the same keys.
async function snapshotReaders() {
  const data = await import('../data');
  const out: Record<string, unknown> = {};
  out.teamPromos = await data.getTeamPromos(TEAM);
  out.fromDate = await data.getPromosFromDate('2099-01-01');
  out.inRange = await data.getPromosInDateRange('2099-01-01', '2099-12-31');
  out.forDate = await data.getPromosForDate('2099-01-05');
  out.count = await data.getPromoCount();
  out.scored = await data.getScoredPromosInDateRange('2099-01-01', '2099-12-31', 300, undefined, new Set(['NHL']));
  out.byItem = await data.getScoredPromosByItemType('2099-01-01', '2099-12-31', 'bobblehead', 500, undefined, new Set(['NHL']));
  out.packages = (out.teamPromos as object[]).map((p) => data.isTicketPackagePromo(p as never));
  return JSON.parse(JSON.stringify(out));
}

test('readers: an absent, a known and an unknown kind give the same rows', async () => {
  variant = null;
  const absent = await snapshotReaders();
  // The fixture row is listed and counted today, and still is.
  assert.ok((absent.teamPromos as { title: string }[]).some((p) => p.title === 'Regular Season Match'));
  assert.ok((absent.fromDate as { title: string }[]).some((p) => p.title === 'Regular Season Match'));
  assert.equal(absent.count, BASE.length - 1, 'every doc less the one NHL package doc');
  assert.equal((absent.scored as unknown[]).length, 1);

  variant = KINDS;
  const known = await snapshotReaders();
  variant = UNKNOWN;
  const unknown = await snapshotReaders();
  variant = null;
  // Control: the fake is re-read on every call, so a field the readers act on
  // does change the snapshot.
  controlTombstone = true;
  const control = await snapshotReaders();
  controlTombstone = false;
  assert.notDeepEqual(control, absent, 'a tombstone reaches the readers, so the equality below is a real comparison');
  assert.equal((control.teamPromos as unknown[]).length, (absent.teamPromos as unknown[]).length - 1);
  assert.equal((control.fromDate as unknown[]).length, (absent.fromDate as unknown[]).length - 1);

  assert.deepEqual(known, absent, 'known kinds change no reader');
  assert.deepEqual(unknown, absent, 'unknown kinds change no reader');
  assert.equal(JSON.stringify(known).includes('"kind"'), false, 'no reader output carries a kind key');
});

test('isVisiblePromo ignores kind', async () => {
  const { isVisiblePromo } = await import('../promo-helpers');
  for (const kind of ['item', 'event', 'fixture', 'package', undefined]) {
    assert.equal(isVisiblePromo({ kind } as never), true);
    assert.equal(isVisiblePromo({ kind, tombstoned: true } as never), false);
    assert.equal(isVisiblePromo({ kind, isPostseason: true } as never), false);
  }
});

// ── tripwire ────────────────────────────────────────────────────────────────
const SRC = fileURLToPath(new URL('../../', import.meta.url));
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('tripwire: nothing in src reads the kind yet (phase 1 is schema only)', () => {
  const files = walk(SRC).filter((f) => !/[\\/]__tests__[\\/]|\.test\.tsx?$/.test(f));
  assert.ok(files.length > 200, `walked ${files.length} source files`);
  const importers: string[] = [];
  const readers: string[] = [];
  for (const f of files) {
    const rel = relative(SRC, f);
    if (rel === join('lib', 'promo-kind.ts')) continue;
    const text = readFileSync(f, 'utf8');
    if (/from\s+['"][^'"]*\/promo-kind['"]|import\(\s*['"][^'"]*\/promo-kind['"]/.test(text)) importers.push(rel);
    if (/\bpromoKind\s*\(|\bpromoGameKey\s*\(|\bPromoKind\b/.test(text)) readers.push(rel);
  }
  assert.deepEqual(importers, [], 'no source file imports promo-kind before the phase that changes behavior');
  assert.deepEqual(readers, [], 'no source file calls promoKind or promoGameKey, or names the type');
  // And the mapper does not copy the field (the RSC payload rule).
  const dataSrc = readFileSync(join(SRC, 'lib', 'data.ts'), 'utf8');
  assert.equal(/\bdata\.kind\b|\bkind:\s*data\b/.test(dataSrc), false, 'mapPromoDoc and the loaders do not read data.kind');
  const typesSrc = readFileSync(join(SRC, 'lib', 'types.ts'), 'utf8');
  const promoBlock = typesSrc.slice(typesSrc.indexOf('export interface Promo {'), typesSrc.indexOf('export interface PromoWithTeam'));
  assert.equal(/^\s*kind\??:/m.test(promoBlock), false, 'the Promo interface has no kind field yet');
});
