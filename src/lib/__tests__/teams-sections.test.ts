import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { groupLeagueTeams } from '../hub-grouping';
import type { Team } from '../types';

/**
 * /teams in-content ad anchors (known-issues entry 73). The light browser
 * renders one <article> holding a <section> per league, and inside each a
 * `page-content` wrapper whose direct children are the division groups.
 * Each assertion is a way a tidy-up could zero the page's in-content units
 * again or let React disturb the containers Raptive inserted.
 */
const BROWSER = 'src/components/teams-browser.tsx';
const PAGE = 'src/app/teams/page.tsx';
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

const team = (id: string, league: string, division: string): Team =>
  ({ id, city: id, name: id, abbreviation: id, primaryColor: '#000', secondaryColor: '#fff', league, sportSlug: league.toLowerCase(), division }) as Team;

describe('groupLeagueTeams', () => {
  it('orders groups by the hub spec, not by arrival order', () => {
    const groups = groupLeagueTeams(
      [team('a', 'NHL', 'Pacific'), team('b', 'NHL', 'Atlantic'), team('c', 'NHL', 'Central'), team('d', 'NHL', 'Metropolitan')],
      'NHL',
    );
    assert.deepEqual(groups.map((g) => g.key), ['Atlantic', 'Metropolitan', 'Central', 'Pacific']);
    assert.deepEqual(groups.map((g) => g.superGroup), ['Eastern', 'Eastern', 'Western', 'Western']);
  });

  it('keeps input order inside a group, so /teams needs no locale-dependent sort', () => {
    const groups = groupLeagueTeams([team('z', 'MLB', 'AL East'), team('a', 'MLB', 'AL East')], 'MLB');
    assert.deepEqual(groups[0].teams.map((t) => t.id), ['z', 'a']);
  });

  it('never drops a team whose division is outside the spec', () => {
    const groups = groupLeagueTeams([team('a', 'WNBA', 'Eastern'), team('b', 'WNBA', ''), team('c', 'WNBA', 'Expansion')], 'WNBA');
    assert.deepEqual(groups.map((g) => g.key), ['Eastern', 'Expansion', 'Other']);
    assert.equal(groups.flatMap((g) => g.teams).length, 3);
  });
});

describe('TeamsBrowser light layout anchors', () => {
  const code = strip(readFileSync(BROWSER, 'utf8'));

  it('renders exactly one <article>, carrying the content ad region', () => {
    assert.equal(code.split('<article data-ad-region="content"').length - 1, 1);
  });

  it('puts page-content on the per-league division wrapper and nowhere else', () => {
    assert.equal(code.split('page-content').length - 1, 1);
    assert.match(code, /<div className="page-content mt-6 space-y-8">\s*\{section\.groups\.map\(\(group\) => \(\s*<div key=\{group\.key\}>/);
  });

  it('filters by toggling hidden, never by unmounting a section', () => {
    assert.match(code, /className=\{active !== ALL && active !== section\.league \? 'hidden' : undefined\}/);
    assert.match(code, /className=\{active === CFB_CHIP \? 'hidden' : 'space-y-14'\}/);
    assert.doesNotMatch(code, /sections\s*\.filter\(/);
  });

  it('renders the starred row only after hydration and outside the article', () => {
    assert.match(code, /isHydrated\s*\?\s*teams\.filter\(/);
    const yours = code.indexOf('id="teams-yours"');
    const article = code.indexOf('<article data-ad-region="content"');
    assert.ok(yours > 0 && yours < article);
  });

  it('writes no <aside> and reads no clock or locale in render', () => {
    assert.doesNotMatch(code, /<aside|new Date\(|Date\.now\(|toLocale|Intl\./);
  });
});

describe('/teams page groups on the server', () => {
  const code = strip(readFileSync(PAGE, 'utf8'));

  it('builds the sections from the hub taxonomy in pill order', () => {
    assert.match(code, /LEAGUE_ORDER\.map\(\(league\) => \(\{/);
    assert.match(code, /groupLeagueTeams\(/);
    assert.match(code, /sections=\{sections\}/);
  });
});
