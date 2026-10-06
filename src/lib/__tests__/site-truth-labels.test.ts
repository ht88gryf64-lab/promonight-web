import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { AggregatorGroup } from '@/components/aggregator-layout';
import { distinctPromoCount } from '@/lib/aggregator-count';
import { crossLeagueSeasonLabel, splitSeasonLabel, SPLIT_SEASON_START_YEAR } from '@/lib/season-label';

/**
 * Three labels that were false or inconsistent on production 2026-10-06 (OPS,
 * under Matt's standing ruling of that day):
 *   - My Teams called every starred club with no promo in the next 60 days
 *     "Offseason", including in-season clubs.
 *   - The /promos category pages said "2026" in the title, heading and lead
 *     while listing NHL and NBA nights into 2027.
 *   - /promos/theme-nights headed 959 promos over a lead of 938 theme nights,
 *     because a night matching two categories was counted in each.
 */
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

describe('aggregator header count', () => {
  const promo = (title: string) => ({ title }) as unknown as AggregatorGroup['promos'][number];

  it('counts a promo filed under two groups once', () => {
    const a = promo('Military Heritage Night');
    const b = promo('Star Wars Night');
    const c = promo('Fireworks Friday');
    const groups: AggregatorGroup[] = [
      { label: 'HERITAGE', promos: [a] },
      { label: 'COMMUNITY', promos: [a, c] },
      { label: 'STAR WARS', promos: [b] },
    ];
    assert.equal(distinctPromoCount(groups), 3);
  });

  it('equals the sum of group sizes when the groups partition the promos', () => {
    const groups: AggregatorGroup[] = [
      { label: 'OCTOBER 2026', promos: [promo('a'), promo('b')] },
      { label: 'NOVEMBER 2026', promos: [promo('c')] },
    ];
    assert.equal(distinctPromoCount(groups), 3);
  });

  it('is what both hero layouts print', () => {
    const code = strip(readFileSync('src/components/aggregator-layout.tsx', 'utf8'));
    assert.equal(code.split('const totalCount = distinctPromoCount(groups);').length - 1, 2);
    assert.doesNotMatch(code, /groups\.reduce\(\(acc, g\) => acc \+ g\.promos\.length/);
  });
});

describe('cross-league category pages name the two-year season', () => {
  it('labels them with the split-season label, not a calendar year', () => {
    assert.equal(crossLeagueSeasonLabel(), splitSeasonLabel(SPLIT_SEASON_START_YEAR));
    assert.match(crossLeagueSeasonLabel(), /^\d{4}-\d{2}$/);
  });

  for (const page of ['theme-nights', 'jersey-giveaways', 'food-deals', 'bobbleheads']) {
    it(`/promos/${page} carries no bare year in its copy`, () => {
      const code = strip(readFileSync(`src/app/promos/${page}/page.tsx`, 'utf8'));
      assert.match(code, /const SEASON = crossLeagueSeasonLabel\(\);/);
      assert.doesNotMatch(code, /\bYEAR\b/);
      assert.doesNotMatch(code, /\b(?:in|of) 20\d\d\b/);
      assert.match(code, /scheduledPeriodPhrase\(seasonSpan\(/, 'the lead names the span the rows cover');
    });
  }
});

describe('My Teams says what it tested', () => {
  it('never labels a starred club "Offseason"', () => {
    const code = strip(readFileSync('src/components/my-teams-view.tsx', 'utf8'));
    assert.doesNotMatch(code, /offseason/i);
    assert.match(code, /Tracking · Nothing in the next 60 days/);
    assert.match(code, /const PROMO_WINDOW_DAYS = 60;/, 'the copy says 60 days');
  });
});
