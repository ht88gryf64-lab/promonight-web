// Phase 2 rule (2026-10-29): every surface reads displayTime / displayOpponent,
// never promo.time / promo.opponent. The stored fields are the scanner's text;
// the display slots carry that text or, when it is empty, the home game's
// value from the games spine (src/lib/promo-game-join.ts). A component that
// reads the stored field shows nothing where every other surface shows the
// game time, which is the inconsistency Phase 1 left behind on 11 components.
//
// This scans the source. Any `.time` or `.opponent` member read under
// src/components, src/app and src/lib fails unless the file is one of the
// listed mappers or the receiver is one of the listed non-promo shapes. Add
// to the lists only with a reason; a new promo surface reads the slots through
// promoDisplayTime / promoDisplayOpponent (src/lib/promo-helpers.ts).
import { test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN = ['src/components', 'src/app', 'src/lib'];

// Files that READ the stored field on purpose: the mappers that seed the
// display slots, the helper that implements the fallback, and the join itself.
const MAPPER_FILES = new Set([
  'src/lib/data.ts',
  'src/lib/promo-helpers.ts',
  'src/lib/promo-game-join.ts',
  // Builds the /api/my-teams payload from raw docs and fills the display
  // slots once per request (the `data.time` seed and the join write-back).
  'src/app/api/my-teams/promos/route.ts',
]);

// Receivers that are not promos: a CFB kickoff, a playoff series club, a
// digest row or feed item whose `time` / `opponent` were already taken from
// the display slots upstream (src/lib/digest.ts, src/lib/social-feed/feed.ts).
const NON_PROMO_RECEIVERS = /\b(kickoff\??|k|club|item|p: DigestPromo)\.(time|opponent)\b/;
const NON_PROMO_FILES = new Set([
  'src/lib/email.ts', // DigestPromo rows, display values set in digest.ts
  'src/lib/social-feed/rss.ts', // FeedItem rows, display values set in feed.ts
]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      yield full;
    }
  }
}

/** The offending lines of one file: a stored-field read that no rule excuses. */
function offendingLines(rel: string, text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (!/\.(time|opponent)\b/.test(code)) return;
    if (NON_PROMO_RECEIVERS.test(code)) return;
    out.push(`${rel}:${i + 1}: ${code.trim()}`);
  });
  return out;
}

test('the scanner flags a stored read and excuses the display helper and the non-promo shapes', () => {
  assert.deepEqual(offendingLines('x.tsx', '{promo.time && <span>{promo.time}</span>}'), ['x.tsx:1: {promo.time && <span>{promo.time}</span>}']);
  assert.deepEqual(offendingLines('x.tsx', 'const t = p.opponent;'), ['x.tsx:1: const t = p.opponent;']);
  assert.deepEqual(offendingLines('x.tsx', '{promoDisplayTime(promo)}\nif (game.timeTbd) {}\nconst k = game.kickoff?.time;\n// promo.time in a comment'), []);
});

test('no surface reads promo.time or promo.opponent directly', () => {
  const offenders: string[] = [];
  for (const dir of SCAN) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file);
      if (MAPPER_FILES.has(rel) || NON_PROMO_FILES.has(rel)) continue;
      offenders.push(...offendingLines(rel, readFileSync(file, 'utf8')));
    }
  }
  assert.deepEqual(offenders, [], `stored time/opponent reads outside the mappers:\n${offenders.join('\n')}`);
});

test('the allowlists name files that still exist', () => {
  for (const rel of [...MAPPER_FILES, ...NON_PROMO_FILES]) {
    assert.doesNotThrow(() => statSync(join(ROOT, rel)), `${rel} is gone; remove it from the allowlist`);
  }
});
