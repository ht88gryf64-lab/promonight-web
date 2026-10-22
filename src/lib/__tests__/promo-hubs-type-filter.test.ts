import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The two keyword hubs are giveaway pages, so they list giveaway rows only
 * (2026-10-21). Before, a keyword match alone qualified a row: on 2026-10-21
 * /promos/jersey-giveaways served 51 theme rows of 141 ("Caps Holiday Party",
 * "Kopitar Jersey Retirement", a "Fourth Wing Ticket Pack"), and
 * /promos/bobbleheads listed theme nights whose description named a
 * bobblehead. The copy that described the old population changed with it.
 */
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
const source = (page: string) => strip(readFileSync(`src/app/promos/${page}/page.tsx`, 'utf8'));

describe('keyword hubs list giveaway rows only', () => {
  it('/promos/jersey-giveaways requires type giveaway beside the apparel keyword', () => {
    const code = source('jersey-giveaways');
    assert.match(code, /all\.filter\(\(p\) => p\.type === 'giveaway' && \(re\.test\(p\.title\) \|\| re\.test\(p\.description\)\)\)/);
    assert.doesNotMatch(code, /pulls any promo/, 'the FAQ no longer says any promo qualifies');
    assert.match(code, /Theme nights and ceremonies without a giveaway are not listed\./);
  });

  it('/promos/bobbleheads requires type giveaway beside the bobblehead keyword', () => {
    const code = source('bobbleheads');
    assert.match(code, /all\.filter\(\(p\) => p\.type === 'giveaway' && \(re\.test\(p\.title\) \|\| re\.test\(p\.description\)\)\)/);
    assert.doesNotMatch(code, /it also shows theme nights/, 'the FAQ no longer promises theme nights');
    // The published count still comes from the strict population.
    assert.match(code, /const strict = strictBobbleheadGiveaways\(all\);/);
  });
});
