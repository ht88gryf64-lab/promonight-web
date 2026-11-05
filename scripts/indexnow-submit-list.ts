/* eslint-disable no-console */
/**
 * Submits every URL in a file (one per line) to IndexNow.
 *
 * Usage: npx tsx --env-file=.env.local scripts/indexnow-submit-list.ts <urls.txt>
 *
 * Written for the serp-targeting deploy (2026-11-05: 164 venue + 169 team
 * pages); reusable for any changed-URL list. Requires INDEXNOW_KEY.
 */
import { readFileSync } from 'node:fs';
import { submitToIndexNow } from '../src/lib/indexnow';

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: indexnow-submit-list.ts <urls.txt>');
  const urls = [...new Set(readFileSync(file, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))];
  console.log(`[indexnow-submit-list] submitting ${urls.length} urls from ${file}`);
  await submitToIndexNow(urls);
  console.log(`[indexnow-submit-list] done ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
