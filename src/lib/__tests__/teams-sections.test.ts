import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { groupLeagueTeams } from '../hub-grouping';
import { leaguesByUpcoming } from '../teams-order';
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
    assert.match(code, /<div className=\{shown && active !== CFB_CHIP \? 'page-content mt-6' : 'mt-6'\}>\s*\{section\.groups\.map\(\(group\) => \(\s*<div key=\{group\.key\} className="py-4 first:pt-0 last:pb-0">/);
    assert.doesNotMatch(code, /page-content[^'"]*space-y/, 'space-y left about 10px under an ad');
  });

  it('anchors only shown leagues: a hidden section drops page-content by class, not by unmount', () => {
    assert.match(code, /const shown = active === ALL \|\| active === section\.league;/);
    assert.match(code, /className=\{shown \? undefined : 'hidden'\}/);
  });

  it('applies an arrival ?league= in a layout effect, so it beats the async Raptive script', () => {
    assert.match(code, /useLayoutEffect\(\(\) => \{\s*setActive\(paramToLeague\(new URLSearchParams\(window\.location\.search\)\.get\('league'\)\)\);\s*\}, \[paramToLeague\]\);/);
  });

  it('filters by toggling hidden, never by unmounting a section', () => {
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
    assert.match(code, /leaguesByUpcoming\(LEAGUE_ORDER, upcomingByLeague\)\.map\(\(league\) => \(\{/);
    assert.match(code, /groupLeagueTeams\(/);
    assert.match(code, /sections=\{sections\}/);
  });
});

describe('/teams hydrates in the same commit as RaptiveLoader (known-issues entry 73)', () => {
  // TeamsBrowser applies an arrival ?league= in a layout effect so the hidden
  // sections lose page-content before the async Raptive script can run. That
  // ordering holds only while /teams hydrates in ONE commit with the root
  // layout's RaptiveLoader. A loading boundary or a Suspense around the root layout's main element lets
  // the loader's effect run in an earlier commit, and an ad can fill inside a
  // hidden section again.
  it('has no loading boundary on the route or above it', () => {
    for (const dir of ['src/app/teams', 'src/app']) {
      for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
        const f = `${dir}/loading.${ext}`;
        assert.ok(
          !existsSync(f),
          `${f} exists. It wraps /teams in a Suspense boundary, so the ?league= filter can apply after Raptive scans (known-issues entry 73).`,
        );
      }
    }
  });

  it('keeps the main element outside every Suspense boundary in the root layout', () => {
    const layout = strip(readFileSync('src/app/layout.tsx', 'utf8'));
    const at = layout.indexOf('<main');
    assert.ok(at > 0, 'root layout renders no main element');
    const before = layout.slice(0, at);
    const open = before.split('<Suspense').length - 1;
    const closed = before.split('</Suspense>').length - 1;
    assert.equal(
      open - closed,
      0,
      'src/app/layout.tsx wraps its main element in a Suspense boundary, so the /teams ?league= filter can apply after Raptive scans (known-issues entry 73).',
    );
  });

  it('adds no Suspense-bearing layout or template of its own', () => {
    for (const f of ['src/app/teams/layout.tsx', 'src/app/teams/template.tsx']) {
      if (!existsSync(f)) continue;
      assert.doesNotMatch(
        strip(readFileSync(f, 'utf8')),
        /<Suspense/,
        `${f} adds a Suspense boundary around /teams (known-issues entry 73).`,
      );
    }
  });
});

describe('leaguesByUpcoming', () => {
  const PILLS = ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA'];
  it('puts the league with the most upcoming promos first', () => {
    assert.deepEqual(leaguesByUpcoming(PILLS, { NHL: 500, NBA: 400, NFL: 90, MLS: 20 }), ['NHL', 'NBA', 'NFL', 'MLS', 'MLB', 'WNBA']);
  });
  it('breaks ties, zeros included, by pill order', () => {
    assert.deepEqual(leaguesByUpcoming(PILLS, { WNBA: 5, NBA: 5 }), ['NBA', 'WNBA', 'MLB', 'NFL', 'NHL', 'MLS']);
    assert.deepEqual(leaguesByUpcoming(PILLS, {}), PILLS);
  });
});
