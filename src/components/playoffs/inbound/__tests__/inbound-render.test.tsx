// The four inbound modules as HTML, in each of the states the brief names.
// Built from the captured documents through the real mapper, view builder,
// gate and inbound builders. "Not in the playoffs" and "postseason over" are
// the states in which a module does not render at all, so those tests hold
// that the builder returns null and that the host renders nothing for null.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { mapBracketDoc } from '../../../../lib/postseason/map';
import { playoffsLinkState } from '../../../../lib/postseason/gate';
import { clubPlayoffs, homePlayoffs, leagueCard, venueGames, type InboundLeague } from '../../../../lib/postseason/inbound';
import { buildLeagueView } from '../../../../lib/postseason/view';
import { FIELDS_AT, FIXTURE, IN_GAME_AT, capturedTeams, clubs, loadDoc, parks, rawText, seriesKeyIn } from '../../../../lib/postseason/__tests__/helpers';
import { TeamPlayoffsModule } from '../TeamPlayoffsModule';
import { LeaguePlayoffsCard } from '../LeaguePlayoffsCard';
import { HomePlayoffsModule } from '../HomePlayoffsModule';

// The venue module sits in the venue page's own card, whose module reaches
// the firebase client. Stood in, and the component loaded after.
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });
const venueModule = () => import('../VenuePostseasonGames');

function inbound(names: readonly string[], now: Date): InboundLeague[] {
  const brackets = names.map((n) => {
    const d = loadDoc(n);
    const b = mapBracketDoc(d, { league: d.league as 'MLB' | 'WNBA', season: d.season as number });
    assert.ok(b);
    return b;
  });
  if (playoffsLinkState(brackets, now).state === 'hidden') return [];
  return brackets.map((b) => {
    const view = buildLeagueView(b, clubs(), parks(), now);
    assert.ok(view);
    return { league: b.league, href: `/playoffs/${b.league.toLowerCase()}`, view, bracket: b };
  });
}
const MIXED_AT = new Date('2025-10-09T03:08:00Z');
const ENDED = Date.parse('2025-11-02T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const IN_WINDOW = new Date(ENDED + 3 * DAY);
const AFTER_WINDOW = new Date(ENDED + 15 * DAY);
const NOW = inbound([FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT);

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
}
const count = (html: string, needle: string) => html.split(needle).length - 1;
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

const FRESHNESS = /\bhourly\b|\breal[- ]time\b|\blive\b|\bup to the minute\b/i;
// NOTHING IN THE PRESENT TENSE, on any module, in any state. A team page
// stands for a day and a hub for six hours between bracket changes.
const PRESENT_TENSE = /\bin progress\b|\bunder way\b|\bunderway\b|\bnow playing\b|data-game-state="live"/i;
/** What every module must satisfy, whatever it says. */
function sound(html: string, where: string) {
  assert.ok(!PRESENT_TENSE.test(html), `${where}: the present tense`);
  assert.equal(seriesKeyIn(html), null, `${where}: ${seriesKeyIn(html)} has the form of a series key`);
  assert.ok(!/#[A-Z]/.test(html), `${where}: a link target that is not one of the page's own ids`);
  assert.ok(!/<aside\b/.test(html), `${where}: an aside would be taken for the ad sidebar`);
  assert.ok(!/<article\b/.test(html), `${where}: an article would compete with the page's measured root`);
  assert.ok(!/[\u2014\u2013]/.test(html), `${where}: a dash`);
  assert.ok(!FRESHNESS.test(textOf(html)), `${where}: freshness wording`);
  assert.ok(!/\b(undefined|null|NaN)\b/.test(textOf(html)), `${where}: an empty rendering`);
  assert.ok(!/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /.test(html), `${where}: a link inside a link`);
  assert.ok(!/\shidden(=""|\s|>)/.test(html), `${where}: the hidden attribute`);
  for (const h of hrefs(html)) assert.match(h, /^\/(playoffs(\/(mlb|wnba)(#[a-z_]+-\d+)?)?)$/, `${where}: ${h}`);
}

// ================= Team page =================

function team(leagues: InboundLeague[], id: string, name: string): string | null {
  const club = clubPlayoffs(leagues, id);
  return club ? renderToStaticMarkup(<TeamPlayoffsModule club={club} teamId={id} teamName={name} />) : null;
}

test('TEAM, alive: round, opponent, next game in Eastern time, a link to the series, and the stamp', () => {
  const html = team(NOW, 'houston-astros', 'Astros');
  assert.ok(html);
  sound(html, 'team alive');
  assert.match(html, /^<section aria-labelledby="team-playoffs" data-playoffs-module="team" data-playoffs-state="alive"/);
  assert.equal(
    textOf(html),
    '2026 MLB Playoffs Wild Card Series Astros vs White Sox Next: Game 1 · Tue, Sep 29 · 5:00 PM ET Host: Astros · Daikin Park See the series Bracket updated Sep 29, 4:00 PM ET',
  );
  assert.deepEqual(hrefs(html), ['/playoffs/mlb#wild_card-1']);
  assert.equal(count(html, '<h2'), 1);
  assert.equal(count(html, '<h1'), 0, 'the page has its own h1');
});

test('TEAM, alive with a series score, and with a game in progress', () => {
  const liberty = team(NOW, 'new-york-liberty', 'Liberty');
  assert.ok(liberty);
  sound(liberty, 'team alive, score');
  assert.ok(textOf(liberty).includes('First Round Liberty vs Lynx NYL leads 1-0 Next: Game 2 · Tue, Sep 29 · 8:30 PM ET Host: Liberty · Barclays Center'));
  assert.deepEqual(hrefs(liberty), ['/playoffs/wnba#first_round-1']);

  // A game in progress: the module states its scheduled time and nothing
  // about its state. The page it sits on stands for a day.
  const braves = team(inbound([FIXTURE.mlbInGame], IN_GAME_AT), 'atlanta-braves', 'Braves');
  assert.ok(braves);
  sound(braves, 'team alive, a game under way');
  assert.equal(count(braves, 'data-game-state="live"'), 0);
  assert.ok(textOf(braves).includes('Braves vs Phillies Next: Game 1 · Tue, Sep 29 · 2:00 PM ET Host: Braves · Truist Park'));
  assert.ok(!/\bLive\b|in progress/i.test(textOf(braves)));
  assert.ok(!/\b(ATL|PHI) \d/.test(textOf(braves)), 'no score in progress');
});

// ONE LABEL IN EVERY STATE. "Follow the rest of the playoffs" claimed there
// was a rest, and a club that is out is not in the series whose end would
// revalidate its page, so the claim could stand for a day after the
// champion was crowned.
test('TEAM, eliminated while the league plays on: "Season over" and one link to the full bracket', () => {
  const html = team(inbound([FIXTURE.mlbMixed], MIXED_AT), 'boston-red-sox', 'Red Sox');
  assert.ok(html);
  sound(html, 'team eliminated');
  assert.match(html, /data-playoffs-state="eliminated"/);
  assert.equal(textOf(html), '2025 MLB Playoffs Season over Lost the Wild Card Series 2-1 See the full MLB playoff bracket Bracket updated Oct 8, 11:08 PM ET');
  assert.match(html, /<a [^>]*href="\/playoffs\/mlb"[^>]*>See the full MLB playoff bracket<\/a>/);
  assert.deepEqual(hrefs(html), ['/playoffs/mlb']);
  assert.ok(!textOf(html).includes('Next:'));
});

test('TEAM, eliminated once the bracket is finished: the same label, word for word', () => {
  const html = team(inbound([FIXTURE.mlbFinal], IN_WINDOW), 'toronto-blue-jays', 'Blue Jays');
  assert.ok(html);
  sound(html, 'team eliminated, concluded');
  assert.ok(textOf(html).includes('Season over Lost the World Series 4-3 See the full MLB playoff bracket'));
  for (const fixture of [FIXTURE.mlbMixed, FIXTURE.mlbFinal, FIXTURE.wnbaMixed, FIXTURE.wnbaFinal]) {
    const now = fixture.startsWith('MLB') ? (fixture === FIXTURE.mlbFinal ? IN_WINDOW : MIXED_AT) : new Date(fixture === FIXTURE.wnbaFinal ? '2025-10-12T04:00:00Z' : '2025-09-19T05:30:00Z');
    const leagues = inbound([fixture], now);
    for (const t of capturedTeams()) {
      const m = team(leagues, t.id, t.name);
      if (m && m.includes('data-playoffs-state="eliminated"')) {
        assert.ok(textOf(m).includes(`See the full ${t.league} playoff bracket`), `${fixture} ${t.id}`);
        assert.ok(!/Follow the rest|See the final/.test(textOf(m)), `${fixture} ${t.id}`);
      }
    }
  }
});

test('TEAM, champion and advanced', () => {
  const champ = team(inbound([FIXTURE.mlbFinal], IN_WINDOW), 'los-angeles-dodgers', 'Dodgers');
  assert.ok(champ);
  sound(champ, 'team champion');
  assert.equal(textOf(champ), '2025 MLB Playoffs 2025 champion Won the World Series 4-3 See the final MLB bracket Bracket updated Nov 2, 12:00 AM ET');
  const adv = team(inbound([FIXTURE.mlbMixed], MIXED_AT), 'toronto-blue-jays', 'Blue Jays');
  assert.ok(adv);
  sound(adv, 'team advanced');
  assert.ok(textOf(adv).includes('Division Series Blue Jays vs Yankees Won the Division Series 3-1 Open the MLB bracket'));
});

test('TEAM, not in the playoffs: no module', () => {
  for (const id of ['minnesota-twins', 'seattle-storm', 'boston-celtics']) assert.equal(team(NOW, id, 'x'), null, id);
});

test('TEAM, postseason over: no module, for the champion or anyone else', () => {
  const over = inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], AFTER_WINDOW);
  for (const id of ['los-angeles-dodgers', 'toronto-blue-jays', 'las-vegas-aces', 'minnesota-twins']) assert.equal(team(over, id, 'x'), null, id);
});

// ================= League hub =================

function hub(leagues: InboundLeague[], league: string): string | null {
  const card = leagueCard(leagues, league);
  return card ? renderToStaticMarkup(<LeaguePlayoffsCard card={card} surface={league === 'MLB' ? 'web_mlb_hub' : 'web_wnba_hub'} />) : null;
}

test('HUB, alive: the round, a linked line for each series, the league link, the stamp', () => {
  const html = hub(NOW, 'MLB');
  assert.ok(html);
  sound(html, 'hub alive');
  assert.match(html, /^<section aria-labelledby="league-playoffs" data-playoffs-module="league" data-playoffs-state="active"/);
  assert.equal(
    textOf(html),
    '2026 MLB Playoffs Wild Card Series Open the MLB bracket Astros vs White Sox Game 1 · Tue, Sep 29 · 5:00 PM ET Yankees vs Red Sox Game 1 · Tue, Sep 29 · 8:00 PM ET Braves vs Phillies Game 1 · Tue, Sep 29 · 2:00 PM ET Padres vs Cubs Game 1 · Tue, Sep 29 · 10:00 PM ET Bracket updated Sep 29, 4:00 PM ET',
  );
  assert.equal(count(html, 'data-game-state="live"'), 0, 'no badge on a page that stands for hours');
  assert.deepEqual(hrefs(html), ['/playoffs/mlb', '/playoffs/mlb#wild_card-1', '/playoffs/mlb#wild_card-2', '/playoffs/mlb#wild_card-3', '/playoffs/mlb#wild_card-4']);
  const wnba = hub(NOW, 'WNBA');
  assert.ok(wnba);
  sound(wnba, 'hub alive, WNBA');
  assert.ok(textOf(wnba).includes('2026 WNBA Playoffs First Round Open the WNBA bracket Lynx vs Liberty NYL leads 1-0'));
});

test('HUB, eliminated clubs are not on the card; the round has moved on', () => {
  const html = hub(inbound([FIXTURE.mlbMixed], MIXED_AT), 'MLB');
  assert.ok(html);
  sound(html, 'hub later round');
  assert.ok(textOf(html).includes('Division Series'));
  assert.ok(textOf(html).includes('Blue Jays vs Yankees TOR won 3-1'));
  assert.ok(!textOf(html).includes('Red Sox'));
});

test('HUB, a league not in the playoffs: no card', () => {
  assert.equal(hub(inbound([FIXTURE.mlbFields], FIELDS_AT), 'WNBA'), null);
  assert.equal(hub(NOW, 'NBA'), null);
});

test('HUB, postseason over: no card, after the window or inside it', () => {
  assert.equal(hub(inbound([FIXTURE.mlbFinal], AFTER_WINDOW), 'MLB'), null);
  assert.equal(hub(inbound([FIXTURE.mlbFinal], IN_WINDOW), 'MLB'), null);
});

// ================= Homepage =================

function home(leagues: InboundLeague[]): string | null {
  const h = homePlayoffs(leagues);
  return h ? renderToStaticMarkup(<HomePlayoffsModule season={h.season} leagues={h.leagues} />) : null;
}

test('HOME, alive: each league being played, its round, a link to its bracket', () => {
  const html = home(NOW);
  assert.ok(html);
  sound(html, 'home alive');
  assert.equal(count(html, 'data-playoffs-module="home"'), 1);
  assert.equal(textOf(html), 'Postseason 2026 Playoffs All playoff brackets MLB Wild Card Series Open the MLB bracket WNBA First Round Open the WNBA bracket');
  assert.deepEqual(hrefs(html), ['/playoffs', '/playoffs/mlb', '/playoffs/wnba']);
  assert.ok(!/\d:\d\d|leads|tied|Game \d|\bET\b|updated/.test(textOf(html)), 'a round, and nothing that goes stale in six hours');
});

test('HOME, one league finished: only the one still playing', () => {
  const html = home(inbound([FIXTURE.wnbaFinal, FIXTURE.mlbMixed], MIXED_AT));
  assert.ok(html);
  sound(html, 'home one league');
  assert.equal(count(html, 'data-league="'), 1);
  assert.ok(textOf(html).includes('MLB Division Series'));
  assert.ok(!textOf(html).includes('WNBA'));
});

test('HOME, no league in the playoffs, and postseason over: no module', () => {
  assert.equal(home([]), null);
  assert.equal(home(inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], AFTER_WINDOW)), null);
  assert.equal(home(inbound([FIXTURE.mlbFinal, FIXTURE.wnbaFinal], IN_WINDOW)), null);
});

// ================= Venue page =================

async function venue(leagues: InboundLeague[], tenants: string[], slug: string): Promise<string | null> {
  const { VenuePostseasonGames } = await venueModule();
  const games = venueGames(leagues, tenants);
  return games ? renderToStaticMarkup(<VenuePostseasonGames games={games} buildingSlug={slug} />) : null;
}

test('VENUE, alive: "Postseason games here", each with its date and a link to its series', async () => {
  const html = await venue(NOW, ['houston-astros'], 'daikin-park');
  assert.ok(html);
  sound(html, 'venue alive');
  assert.match(html, /^<div data-playoffs-module="venue" data-playoffs-state="hosting" data-building="daikin-park">/);
  assert.match(html, /<h2 [^>]*>Postseason games here<\/h2>/);
  assert.equal(
    textOf(html),
    'Postseason games here White Sox at Astros Wild Card Series · Game 1 Tue, Sep 29 · 5:00 PM ET White Sox at Astros Wild Card Series · Game 2 Wed, Sep 30 · 5:00 PM ET White Sox at Astros Wild Card Series · Game 3 · If necessary Thu, Oct 1 · 5:00 PM ET Bracket updated Sep 29, 4:00 PM ET',
  );
  assert.deepEqual(hrefs(html), ['/playoffs/mlb#wild_card-1', '/playoffs/mlb#wild_card-1', '/playoffs/mlb#wild_card-1']);
  assert.equal(count(html, 'data-venue-game="'), 3);
});

test('VENUE, a shared building: the games of the club that is hosting', async () => {
  const html = await venue(NOW, ['brooklyn-nets', 'new-york-liberty'], 'barclays-center');
  assert.ok(html);
  sound(html, 'venue shared');
  assert.ok(textOf(html).includes('Lynx at Liberty First Round · Game 2 Tue, Sep 29 · 8:30 PM ET'));
  assert.deepEqual(hrefs(html), ['/playoffs/wnba#first_round-1']);
});

test('VENUE, eliminated: a club that is out hosts nothing, so no module', async () => {
  const leagues = inbound([FIXTURE.mlbMixed], MIXED_AT);
  assert.equal(await venue(leagues, ['boston-red-sox'], 'fenway-park'), null);
  assert.equal(await venue(leagues, ['new-york-yankees'], 'yankee-stadium'), null);
});

test('VENUE, not in the playoffs, and a visitor with no home game: no module', async () => {
  assert.equal(await venue(NOW, ['minnesota-twins'], 'target-field'), null);
  assert.equal(await venue(NOW, ['boston-celtics', 'boston-bruins'], 'td-garden'), null);
  assert.equal(await venue(NOW, ['chicago-white-sox'], 'guaranteed-rate-field'), null);
});

test('VENUE, postseason over: no module, after the window or inside it', async () => {
  assert.equal(await venue(inbound([FIXTURE.mlbFinal], AFTER_WINDOW), ['los-angeles-dodgers'], 'dodger-stadium'), null);
  assert.equal(await venue(inbound([FIXTURE.mlbFinal], IN_WINDOW), ['los-angeles-dodgers'], 'dodger-stadium'), null);
});

// ================= Every module, every club =================

test('no module, for any club in any fixture, carries an operator value or a series key', async () => {
  const runs: [string[], Date][] = [
    [[FIXTURE.mlbFields, FIXTURE.wnbaFields], FIELDS_AT],
    [[FIXTURE.mlbInGame], IN_GAME_AT],
    [[FIXTURE.mlbMixed, FIXTURE.wnbaMixed], MIXED_AT],
    [[FIXTURE.mlbFinal, FIXTURE.wnbaFinal], IN_WINDOW],
  ];
  let rendered = 0;
  for (const [names, now] of runs) {
    const leagues = inbound(names, now);
    const secrets = names.flatMap((n) => {
      const d = JSON.parse(rawText(n)) as { runId: string; bracketSha256: string; seeds: { authoredBy: string | null }; series: { seriesKey: string }[] };
      return [d.runId, d.bracketSha256, d.seeds.authoredBy, ...d.series.map((s) => s.seriesKey).filter((k) => k.length >= 4)].filter((v): v is string => typeof v === 'string');
    });
    const pages = [home(leagues), hub(leagues, 'MLB'), hub(leagues, 'WNBA')];
    for (const id of clubs().keys()) {
      pages.push(team(leagues, id, 'Club'));
      pages.push(await venue(leagues, [id], 'building'));
    }
    for (const html of pages) {
      if (html === null) continue;
      rendered += 1;
      sound(html, names.join('+'));
      for (const s of secrets) assert.ok(!html.includes(s), `${s.slice(0, 20)} is in a module`);
    }
  }
  assert.ok(rendered > 60, `${rendered} modules rendered`);
});
