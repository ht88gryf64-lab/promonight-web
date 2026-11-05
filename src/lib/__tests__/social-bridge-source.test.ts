import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

/**
 * The team map is generated from promo-video's config/team-short.json (the
 * social bridge, 2026-11-05). This fails when that file changed after the
 * export: run `npm run export-social-bridge -- --to <this repo>/src/config/social-bridge.json`
 * in promo-video and commit the result. The pipeline checkout is found at
 * PROMO_VIDEO_DIR, else beside this repo at ../code/promo-video; where there
 * is none (a CI runner) the check is skipped and says so.
 */
const MAP = 'src/config/social-bridge.json';
const PIPELINE = process.env.PROMO_VIDEO_DIR ?? resolve(process.cwd(), '..', 'code', 'promo-video');
const SOURCE = resolve(PIPELINE, 'config', 'team-short.json');

test('the team map is fresh against promo-video\'s config/team-short.json', (t) => {
  if (!existsSync(SOURCE)) {
    t.skip(`promo-video checkout not found at ${PIPELINE}; set PROMO_VIDEO_DIR to check the map's source`);
    return;
  }
  const map = JSON.parse(readFileSync(MAP, 'utf8')) as { sourceSha256: string; routes: Record<string, string> };
  const bytes = readFileSync(SOURCE);
  const sha = createHash('sha256').update(bytes).digest('hex');
  assert.equal(map.sourceSha256, sha, `${MAP} is stale: config/team-short.json changed since the export. Run \`npm run export-social-bridge -- --to ${resolve(MAP)}\` in ${PIPELINE} and commit it.`);
  const source = JSON.parse(bytes.toString('utf8')) as { teams: Record<string, string>; cfbSchools: Record<string, string> };
  const expected = new Set([...Object.values(source.teams), ...Object.values(source.cfbSchools)]);
  assert.deepEqual(new Set(Object.keys(map.routes)), expected, 'every slug in the source, and no other, is a short link');
  for (const [id, short] of Object.entries(source.teams)) assert.ok(map.routes[short]?.endsWith(`/${id}`), `${short} -> ${map.routes[short]} should end in /${id}`);
  for (const [id, short] of Object.entries(source.cfbSchools)) assert.equal(map.routes[short], `/cfb/${id}`);
});
