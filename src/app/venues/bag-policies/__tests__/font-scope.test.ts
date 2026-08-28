// Finding 22 (Phase 0 sweep): the page mounts `rd-root` without the Archivo
// variable. --font-archivo is then undefined inside that scope, so --font-rd
// resolves past Archivo to the next family and the whole body renders in the
// fallback, on a page whose siblings render the house font.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');

test('a page that mounts rd-root also binds the Archivo variable rd-root reads', () => {
  assert.ok(/\brd-root\b/.test(page), 'this page mounts rd-root');
  assert.ok(
    /archivoHouse\.variable/.test(page),
    'rd-root is mounted without archivoHouse.variable, so --font-archivo is undefined in the scope and the body falls off the house font',
  );
  assert.ok(
    /fonts-house/.test(page),
    'the variable must come from the preload:false instance in fonts-house, not the preload:true one',
  );
});
