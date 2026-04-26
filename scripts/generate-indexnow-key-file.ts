/* eslint-disable no-console */
/**
 * Writes the IndexNow key verification file to public/{INDEXNOW_KEY}.txt.
 *
 * Runs automatically via the `prebuild` script. The file's name IS the key,
 * and its body is the same key as raw text (no trailing newline). Bing/Yandex
 * fetch it to verify ownership of the IndexNow key.
 *
 * Key lives ONLY in env vars (Vercel + .env.local). Never committed to git.
 * public/*.txt is gitignored so this generated file never lands in a commit.
 *
 * Rotating the key:
 *   1. Generate a new hex string: `openssl rand -hex 16`
 *   2. Update INDEXNOW_KEY in Vercel and .env.local
 *   3. Next build writes the new <KEY>.txt automatically. The old one will
 *      be orphaned in Bing's side; that's fine — it just stops verifying.
 *
 * Run manually: npx tsx scripts/generate-indexnow-key-file.ts
 */
import { writeFile, readdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

async function main() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.warn('[generate-indexnow-key-file] INDEXNOW_KEY not set, skipping');
    return;
  }

  if (!/^[a-f0-9]{8,128}$/i.test(key)) {
    throw new Error(
      `[generate-indexnow-key-file] INDEXNOW_KEY must be 8-128 hex chars, got: ${key.length} chars`,
    );
  }

  // Remove any stale *.txt verification files from previous key values,
  // so the public/ directory only ever holds the current key.
  // Keep checked-in *.txt files (ads.txt for AdSense verification, etc.) —
  // those are not generated and must survive every build.
  const KEEP_TXT = new Set(['ads.txt']);
  const entries = await readdir(PUBLIC_DIR);
  for (const name of entries) {
    if (name.endsWith('.txt') && name !== `${key}.txt` && !KEEP_TXT.has(name)) {
      await unlink(join(PUBLIC_DIR, name));
      console.log(`[generate-indexnow-key-file] removed stale ${name}`);
    }
  }

  const outPath = join(PUBLIC_DIR, `${key}.txt`);
  await writeFile(outPath, key, 'utf8');
  console.log(`[generate-indexnow-key-file] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
