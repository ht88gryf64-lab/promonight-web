import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { isBobbleheadHubRow, isJerseyHubRow } from '../promo-helpers';

/**
 * The two keyword hubs are giveaway pages, so they list giveaway rows only
 * (2026-10-21). Before, a keyword match alone qualified a row: on 2026-10-21
 * /promos/jersey-giveaways served 51 theme rows of 141 ("Caps Holiday Party",
 * "Kopitar Jersey Retirement", a "Fourth Wing Ticket Pack"), and
 * /promos/bobbleheads listed theme nights whose description named a
 * bobblehead. Every count that links to a hub (homepage tiles on both homepage
 * paths, team-page "N on this team" hints) filters with the hub's own
 * predicate, so the number matches the list the link lands on.
 */
const row = (type: string, title: string, description = '') =>
  ({ type, title, description }) as Parameters<typeof isJerseyHubRow>[0];

describe('hub row predicates', () => {
  it('a theme night never qualifies, whatever its copy says', () => {
    assert.equal(isJerseyHubRow(row('theme', 'Kopitar Jersey Retirement')), false);
    assert.equal(isJerseyHubRow(row('theme', 'Caps Holiday Party')), false);
    assert.equal(isBobbleheadHubRow(row('theme', 'Star Wars Night', 'Includes a bobblehead ticket package')), false);
  });

  it('a giveaway qualifies on its title or its description', () => {
    assert.equal(isJerseyHubRow(row('giveaway', 'Replica Jersey')), true);
    assert.equal(isJerseyHubRow(row('giveaway', 'Fan Night', 'First 10,000 fans receive hats')), true);
    assert.equal(isBobbleheadHubRow(row('giveaway', 'Kids Day', 'A mini bobblehead for kids 14 and under')), true);
  });

  it('the apparel keyword takes plurals and whole words only', () => {
    assert.equal(isJerseyHubRow(row('giveaway', 'Rally Caps')), true);
    assert.equal(isJerseyHubRow(row('giveaway', 'Capitals Magnet Schedule')), false);
  });

  it('a missing description does not throw or match', () => {
    assert.equal(isJerseyHubRow({ type: 'giveaway', title: 'Magnet' } as Parameters<typeof isJerseyHubRow>[0]), false);
  });
});

// Strip comments so a predicate named in prose cannot satisfy the wiring check.
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
const code = (path: string) => strip(readFileSync(path, 'utf8'));

describe('every surface that counts toward a hub uses the hub predicate', () => {
  const surfaces: Array<[string, Array<'isBobbleheadHubRow' | 'isJerseyHubRow'>]> = [
    ['src/app/promos/bobbleheads/page.tsx', ['isBobbleheadHubRow']],
    ['src/app/promos/jersey-giveaways/page.tsx', ['isJerseyHubRow']],
    ['src/components/redesign/home-category-tiles.ts', ['isBobbleheadHubRow', 'isJerseyHubRow']],
    ['src/app/page.tsx', ['isBobbleheadHubRow', 'isJerseyHubRow']],
    ['src/components/team-related-aggregators.tsx', ['isBobbleheadHubRow', 'isJerseyHubRow']],
  ];
  for (const [path, preds] of surfaces) {
    it(path, () => {
      const src = code(path);
      for (const pred of preds) assert.match(src, new RegExp(`\\b${pred}\\b[\\s\\S]*\\b${pred}\\b`), `${pred} imported and used`);
      assert.doesNotMatch(src, /\/bobblehead\/i/, 'no local bobblehead keyword filter');
      assert.doesNotMatch(src, /\\b\(jersey\|/, 'no local apparel keyword filter');
    });
  }

  it('the hub FAQ copy describes the giveaway-only list', () => {
    const jersey = code('src/app/promos/jersey-giveaways/page.tsx');
    assert.doesNotMatch(jersey, /pulls any promo/);
    assert.match(jersey, /Theme nights and ceremonies without a giveaway are not listed\./);
    const bobble = code('src/app/promos/bobbleheads/page.tsx');
    assert.doesNotMatch(bobble, /it also shows theme nights/);
    // The published count still comes from the strict population.
    assert.match(bobble, /const strict = strictBobbleheadGiveaways\(all\);/);
  });
});
