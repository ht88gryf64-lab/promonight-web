// Takes the byte-identity golden: every club's team-page module, and the hub
// hero, rendered with no PromoNight Predicts line and no notice, by the code
// in the tree this script runs from. Run it from an export of main, with this
// script, the shared cases and the element walker copied in:
//
//   OUT=<file> TSX_TSCONFIG_PATH=tsconfig.test.json \
//     node --import tsx --experimental-test-module-mocks scripts/playoffs/byte-identity-golden.tsx
import { mock } from 'node:test';
import { writeFileSync } from 'node:fs';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../src/lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

void import('../../src/components/playoffs/inbound/__tests__/byte-identity-cases').then(({ teamModules, heroes }) => {
  const out = { teamModules: teamModules(), heroes: heroes() };
  writeFileSync(process.env.OUT as string, JSON.stringify(out, null, 1) + '\n');
  console.log(`${Object.keys(out.teamModules).length} modules, ${Object.keys(out.heroes).length} heroes`);
});
