// THE RENDERER MUST NOT BE ABLE TO READ THE PROVENANCE DATABASE.
//
// Venue provenance (per-field confirmation type, pages read with the per-page
// finding, held text and its reason, rule 1.5 readings, harvest gaps) is written by
// the pipeline into a SEPARATE Firestore database, not into (default). The reason it
// lives there rather than beside the venueHubs documents is that a Firestore client
// is bound to one database for its lifetime: this repo builds exactly one client,
// unparameterised, so there is no collection path on it that reaches the other
// database. Adding one would take a second client with an explicit database id.
//
// These tests keep that true. They are the "by construction" claim, checked.
// Shapes (a) and (b) were rejected for reasons this repo has already lived through:
// putting adjudication prose next to fan-facing copy crossed the proseViolation
// boundary twice, and folding it into the one prose blob that ships was corrupted by
// a blind string edit within a day of being relied on.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SELF = fileURLToPath(import.meta.url);

// Assembled at runtime so this file does not contain the tokens it forbids.
// NOTE ON SCOPE: the English word by itself is NOT forbidden and must not be. This
// repo already uses it correctly for per-CLAIM provenance, the source link and date
// on a rendered claim, which is a different thing living in (default). What is
// forbidden is naming the separate STORE: its collection, or its database id passed
// to a client.
const COLLECTION = ['venueHub', 'Prov', 'enance'].join('');
const DATABASE_ID = ['prov', 'enance'].join('');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) out.push(f);
  }
  return out;
}

const files = walk(SRC).filter((f) => f !== SELF);

test('the provenance collection is named nowhere under src/', () => {
  const offenders = files
    .filter((f) => fs.readFileSync(f, 'utf8').includes(COLLECTION))
    .map((f) => path.relative(SRC, f));
  assert.deepEqual(
    offenders,
    [],
    `The renderer must not name the provenance collection. Found in:\n  ${offenders.join('\n  ')}`,
  );
});

test('the provenance database id is never handed to a client or a collection call', () => {
  const quoted = new RegExp(`(getFirestore|collection|database)\\s*\\([^)]*['"\`]${DATABASE_ID}['"\`]`, 'i');
  const offenders = files
    .filter((f) => quoted.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f));
  assert.deepEqual(offenders, [], `A second database must not be addressable from the render path. Found in:\n  ${offenders.join('\n  ')}`);
});

test('src/ builds exactly one Firestore client, and it takes no database id', () => {
  const calls: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/getFirestore\s*\(([^)]*)\)/g)) {
      calls.push(`${path.relative(SRC, f)}: getFirestore(${m[1].trim()})`);
    }
  }
  assert.equal(calls.length, 1, `expected exactly one Firestore client, found:\n  ${calls.join('\n  ')}`);
  // An argument here would mean a second database is addressable from the render path.
  assert.match(calls[0], /getFirestore\(\)$/, `the client must take no database id, got: ${calls[0]}`);
});

// A zero-file scan would pass both tests above while checking nothing. Framework 6b.8:
// prove the check could run before believing its result.
test('the scan actually reached the source tree', () => {
  assert.ok(files.length > 100, `expected to scan the source tree, scanned ${files.length} files`);
});
