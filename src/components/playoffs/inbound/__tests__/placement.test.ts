// Where each inbound module sits in its host, held at the source.
//
// These are rules about ads as much as about layout. The ad placer chooses
// its anchors by counting the direct children of one wrapper per template,
// so WHERE a module is mounted decides whether every ad below it moves. The
// served pages are checked in a browser as well; this holds the rule in the
// suite, where a refactor meets it first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const TEAM = src('components/redesign/RedesignTeamPage.tsx');
const TEAM_ROUTE = src('app/[sport]/[team]/page.tsx');
const HOME = src('components/redesign/HomePageV2.tsx');
const HOME_ROUTE = src('app/page.tsx');
const VENUE = src('components/venue-hub/VenueHubView.tsx');
const VENUE_ROUTE = src('app/venues/[slug]/page.tsx');
const HUBS: [string, string, string][] = [
  ['MLB', 'mlb', src('app/mlb/page.tsx')],
  ['WNBA', 'wnba', src('app/wnba/page.tsx')],
];

/** Source with its comments removed, so a rule is checked against code. */
const code = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MODULES = readdirSync(new URL('../', import.meta.url))
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => [f, readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')] as const);

test('the four modules exist, and are server components', () => {
  assert.deepEqual(MODULES.map(([f]) => f).sort(), ['HomePlayoffsModule.tsx', 'LeaguePlayoffsCard.tsx', 'TeamPlayoffsModule.tsx', 'VenuePostseasonGames.tsx']);
  for (const [f, s] of MODULES) assert.ok(!/^['"]use client['"]/m.test(s), `${f} is rendered on the server`);
});

test('no module writes an aside, an article, or a page-content wrapper of its own', () => {
  for (const [f, s] of MODULES) {
    const c = code(s);
    assert.ok(!/<aside\b/.test(c), `${f}: an aside receives the sidebar ad stack`);
    assert.ok(!/<article\b/.test(c), `${f}: the tallest article is the element the ad placer measures`);
    assert.ok(!/page-content/.test(c), `${f}: a second page-content would make its children anchors`);
    assert.ok(!/data-ad-region/.test(c), f);
    assert.ok(!/AdSlot/.test(c), `${f}: a module carries no ad of its own`);
  }
});

test('no module brings a font with it', () => {
  // A font module is preloaded by every route that imports it. These are on
  // the team pages, the hubs, the homepage and the venue pages.
  for (const [f, s] of MODULES) {
    assert.ok(!/next\/font/.test(s), f);
    assert.ok(!/cfb\/rivalry\/fonts|fonts-house|\.\/fonts/.test(s), f);
    assert.ok(!/CONDENSED/.test(s), `${f} uses the host page's own faces`);
  }
});

test('every module is fed by the one gated read', () => {
  for (const [name, route] of [['home', HOME_ROUTE], ['venue', VENUE_ROUTE], ...HUBS.map(([l, , s]) => [l, s] as [string, string])]) {
    assert.match(route, /getPlayoffsInboundOrNone\(/, `${name} asks the gated read`);
    assert.ok(!/getBracket\(|getLeaguePageData\(|readCurrentBrackets\(/.test(route), `${name} does not read a bracket around the gate`);
  }
  // The team route asks through getTeamPostseason, which asks the gated read
  // and nothing else for the bracket.
  assert.ok(!/getBracket\(|getLeaguePageData\(|readCurrentBrackets\(/.test(TEAM_ROUTE), 'team does not read a bracket around the gate');
  const data = src('lib/postseason/data.ts');
  const teamFn = data.slice(data.indexOf('export async function getTeamPostseason'), data.indexOf('export async function readLeaguesWithBracket'));
  assert.match(teamFn, /await getPlayoffsInboundOrNone\(/);
  assert.ok(!/getBracket\(|getLeaguePageData\(|readCurrentBrackets\(/.test(teamFn), 'the team function reads no bracket around the gate');
  assert.match(data, /export async function buildPlayoffsInbound\([^)]*\)[^{]*\{\s*if \(playoffsLinkState\(brackets, now\)\.state === 'hidden'\) return \[\];/);
});

// ---- Team page ----

test('TEAM: the module rides inside the first weave item and adds no item of its own', () => {
  const c = code(TEAM);
  assert.match(
    c,
    /\{postseason \? \(\s*<div className=\{`rd-weave-item \$\{showSchedule \? 'order-\[11\]' : 'order-\[10\]'\}`\}>\s*\{postseason\}\s*\{seasonBlock\}\s*<\/div>\s*\) : \(\s*<div className=\{`rd-weave-item \$\{showSchedule \? 'order-\[11\]' : 'order-\[10\]'\}`\}>\{seasonBlock\}<\/div>\s*\)\}/,
  );
  assert.equal((c.match(/\{postseason\}/g) ?? []).length, 1, 'mounted in one place');
  // The lowest order in the weave is still the season slot's.
  const orders = [...c.matchAll(/order-\[(\d+)\]/g)].map((m) => Number(m[1]));
  assert.equal(Math.min(...orders), 10);
});

test('TEAM: the shells the ad placer matches by their whole class string are untouched', () => {
  const c = code(TEAM);
  assert.ok(c.includes('<div className="rd-weave-shell contents lg:block lg:min-w-0 lg:order-1 [&>*]:min-w-0">'));
  assert.ok(c.includes('className="rd-weave-shell contents lg:block lg:space-y-6 lg:order-2 [&>*]:min-w-0"'));
  assert.ok(c.includes('className="rd-weave grid grid-cols-1 gap-x-8 lg:grid-cols-[1fr_336px] lg:items-start"'));
  assert.match(c, /<article\s+className="rd-weave /, 'the weave root is still the article');
  assert.equal((c.match(/<article\b/g) ?? []).length, 1);
  assert.equal((c.match(/<aside\b/g) ?? []).length, 1, 'the one aside is the sidebar column');
});

test('TEAM: the route asks one function, and passes the module its club and its line', () => {
  const c = code(TEAM_ROUTE);
  assert.match(c, /const postseason = await getTeamPostseason\(team\.sportSlug, team\.id\);/);
  assert.match(
    c,
    /postseason=\{\s*postseason \? <TeamPlayoffsModule club=\{postseason\.club\} teamId=\{team\.id\} teamName=\{team\.name\} pick=\{postseason\.pick\} \/> : null\s*\}/,
  );
  assert.equal((c.match(/getTeamPostseason\(/g) ?? []).length, 1);
  assert.equal((c.match(/getPredictedBracket|predictedBrackets|loadTeamPick|getPlayoffsInbound/g) ?? []).length, 0, 'the route reads the postseason only through getTeamPostseason');
});

// ---- Hubs ----

for (const [league, lower, page] of HUBS) {
  test(`HUB /${lower}: the card is at the top of page-content and shares the first child`, () => {
    const c = code(page);
    const wrapper = c.indexOf('<div className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12 page-content">');
    assert.ok(wrapper > 0, 'the page-content wrapper is as it was');
    const after = c.slice(wrapper);
    assert.match(
      after,
      new RegExp(
        `^<div className="mx-auto max-w-6xl space-y-16 px-6 pb-20 pt-12 page-content">\\s*\\{playoffs \\|\\| finalCard \\? \\(\\s*<div data-playoffs-top className="space-y-16">\\s*\\{playoffs \\? \\(\\s*<LeaguePlayoffsCard card=\\{playoffs\\} surface="web_${lower}_hub" />\\s*\\) : \\(\\s*<LeagueFinalBracketCard card=\\{finalCard!\\} surface="web_${lower}_hub" />\\s*\\)\\}\\s*\\{todayPromos\\}\\s*</div>\\s*\\) : \\(\\s*todayPromos\\s*\\)\\}\\s*<HubThisWeek`,
      ),
    );
    assert.match(c, new RegExp(`const inbound = await getPlayoffsInboundOrNone\\('/${lower}'\\);\\s*const playoffs = leagueCard\\(inbound, '${league}'\\);`));
    assert.match(c, new RegExp(`const finalCard = playoffs \\? null : leagueFinalCard\\(inbound, '${league}'\\);`));
    assert.equal((c.match(/<LeagueFinalBracketCard/g) ?? []).length, 1);
    assert.equal((c.match(/page-content/g) ?? []).length, 1);
    assert.equal((c.match(/<LeaguePlayoffsCard/g) ?? []).length, 1);
    assert.ok(!/<aside\b/.test(c));
  });
}

for (const [league, lower, page] of HUBS) {
  test(`HUB /${lower}: the hero line is in the hero, above the stat bar, outside page-content`, () => {
    const c = code(page);
    assert.match(c, new RegExp(`const heroLine = leagueHeroLine\\(inbound, '${league}'\\);`));
    const hero = c.slice(c.indexOf('<HubHero'), c.indexOf('</HubHero>'));
    assert.match(hero, new RegExp(`notice=\\{heroLine \\? <LeaguePlayoffsHeroLine line=\\{heroLine\\} surface="web_${lower}_hub" /> : undefined\\}`));
    assert.ok(c.indexOf('</HubHero>') < c.indexOf('page-content'), 'the hero closes before page-content opens');
    assert.equal((c.match(/<LeaguePlayoffsHeroLine/g) ?? []).length, 1);
  });
}

test('HUB HERO: with no notice the hero is the element it always was; the notice goes before the stat bar', () => {
  const c = code(src('components/hub/HubHero.tsx'));
  assert.match(c, /\{notice \? withNotice\(inner, notice\) : inner\}/);
  assert.match(c, /cloneElement\(el, undefined, \.\.\.kids\.slice\(0, -1\), notice, kids\[kids\.length - 1\]\)/);
});

// ---- Homepage ----

test('HOME: the module rides inside the Tonight section, the first child of page-content', () => {
  const c = code(HOME);
  assert.match(
    c,
    /<div className="page-content">\s*\{playoffs \? \(\s*<section className="px-6 pt-14">\s*\{playoffs\}\s*\{tonightRail\}\s*<\/section>\s*\) : \(\s*<section className="px-6 pt-14">\{tonightRail\}<\/section>\s*\)\}\s*<div className="mx-auto max-w-6xl px-6 pt-8">\s*<AdSlot config=\{AD_SLOTS\.HEADER_LEADERBOARD\}/,
  );
  assert.equal((c.match(/\{playoffs\}/g) ?? []).length, 1);
  assert.equal((c.match(/className="page-content"/g) ?? []).length, 1);
  assert.match(code(HOME_ROUTE), /const playoffs = homePlayoffs\(await getPlayoffsInboundOrNone\('\/'\)\);/);
});

// ---- Venue ----

test('VENUE: the module follows the bag capsule inside page-content and shares its place, and the rail is still the only aside', () => {
  const c = code(VENUE);
  assert.match(
    c,
    /<div className="min-w-0 page-content">\s*\{postseason \? \(\s*<div data-playoffs-top>\s*\{bagCard\}\s*\{postseason\}\s*<\/div>\s*\) : \(\s*bagCard\s*\)\}\s*<HubPromosThisWeek/,
  );
  assert.equal((c.match(/\{postseason\}/g) ?? []).length, 1);
  assert.equal((c.match(/<aside\b/g) ?? []).length, 1);
  const r = code(VENUE_ROUTE);
  assert.match(r, /venueGames\(await getPlayoffsInboundOrNone\(`\/venues\/\$\{slug\}`\), tenantIds\)/);
  assert.match(r, /const tenantIds = \(hub\.tenants \?\? \[\]\)\.map\(\(t\) => t\.teamId\)/, 'the clubs come from the building, not from a name match');
});
