/* Season labels and the NHL/NBA schedule, as rendered (WEB6, 2026-10-05).
 *
 *  - The archive on NHL and NBA is grouped by season: "COMPLETED 2026-27
 *    PROMOS ... this season" over this season's rows only, "LAST SEASON
 *    (2025-26)" over last season's. The Heat shape (only Jan to Apr 2026 rows)
 *    never prints a "2026 season" heading or an "All N on record" line.
 *  - The resale lift stays capped at three across the whole archive.
 *  - MLB keeps "COMPLETED 2026 PROMOS ... this season".
 *  - The NHL and NBA schedule: collapsed months, every row in the HTML,
 *    "2026-27", "every scheduled game", date, opponent and home/away, the NHL
 *    puck drop shown, no NBA time, no venue line, the status line above, and
 *    no ad anchor inside a month.
 *  - The zero-promo copy and the status line make only the claims allowed. */
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { PromoList } from '@/components/promo-list';
import { ZeroPromoFallback } from '@/components/zero-promo-fallback';
import { ScheduleBlock } from '../ScheduleBlock';
import { AuthorityStats } from '@/components/authority-stats';
import { resolveClaimMode } from '@/lib/season-scope';
import { announcementLine, nothingPublishedVerified, NOTHING_PUBLISHED, scheduleStatusLine, VERIFIED_FOR_DAYS } from '@/lib/announcement-status';
import type { GameContext } from '@/lib/data';
import type { Game, Promo, Team } from '@/lib/types';

const TODAY = '2026-10-05';
// splitPromosByDate reads the clock: pin it, so `npm run test:future` and any
// later run see the same past and upcoming rows. Only Date is mocked.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T12:00:00Z') });
const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const DETROIT = mk('detroit-red-wings', 'NHL', 'Detroit', 'Red Wings');
const HEAT = mk('miami-heat', 'NBA', 'Miami', 'Heat');
const KNICKS = mk('new-york-knicks', 'NBA', 'New York', 'Knicks');
const RANGERS = mk('new-york-rangers', 'NHL', 'New York', 'Rangers');
const BRAVES = mk('atlanta-braves', 'MLB', 'Atlanta', 'Braves');

const promo = (date: string, title: string, over: Partial<Promo> = {}): Promo => ({
  date, time: '', opponent: 'Visitors', type: 'theme', title, description: '', highlight: false, icon: '', recurring: false, ...over,
});

const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

function list(team: Team, promos: Promo[], seasonScoped = false) {
  return renderToStaticMarkup(
    <PromoList promos={promos} teamSlug={team.id} teamName={`${team.city} ${team.name}`} league={team.league} sport={team.sportSlug} variant="light" showAppPitch={false} seasonScoped={seasonScoped} scopeLive team={team} />,
  );
}

describe('the archive, by season', () => {
  const detroit = [
    promo('2027-01-08', 'Ahead One'),
    promo('2027-02-18', 'Ahead Two'),
    promo('2026-10-02', 'Opening Night'),
    promo('2026-10-04', 'Kids Day', { type: 'kids' }),
    promo('2026-03-14', 'Old Theme'),
    promo('2025-11-07', 'Dynasty Bobblehead', { type: 'giveaway' }),
  ];

  test('NHL mixed archive: this season and last season under separate headings', () => {
    const t = text(list(DETROIT, detroit, true));
    assert.match(t, /COMPLETED 2026-27 PROMOS 2 completed events this season/);
    assert.match(t, /LAST SEASON \(2025-26\) 2 completed events, November 2025 to March 2026/);
    assert.ok(t.indexOf('COMPLETED 2026-27 PROMOS') < t.indexOf('LAST SEASON (2025-26)'), 'current season first');
    assert.doesNotMatch(t, /COMPLETED 2025 TO 2026/);
    // "this season" appears once, over the current season.
    assert.equal(t.split('this season').length - 1, 1);
  });

  test('NBA Heat shape: last season only, no season heading, no "on record" line, pointer names 2025-26', () => {
    const heat = [promo('2026-04-29', 'Mashup Logo Night'), promo('2026-04-22', 'Vice Logo Night')];
    const t = text(list(HEAT, heat, false));
    assert.match(t, /No upcoming Miami Heat promos scheduled right now\. See completed 2025-26 promos below\./);
    assert.match(t, /LAST SEASON \(2025-26\) 2 completed events ▸/);
    assert.doesNotMatch(t, /SEASON PROMOS/);
    assert.doesNotMatch(t, /on record for the/);
    assert.doesNotMatch(t, /this season/);
    assert.doesNotMatch(t, /COMPLETED 2026 PROMOS/);
  });

  test('NBA season complete: "All N on record for the 2026-27 season" counts that season only', () => {
    const rows = [promo('2026-10-01', 'Preseason Night'), promo('2026-10-03', 'Another'), promo('2026-03-03', 'Last Year')];
    const t = text(list(HEAT, rows, true));
    assert.match(t, /2026-27 SEASON PROMOS/);
    assert.match(t, /All 2 Miami Heat promotions on record for the 2026-27 season are below\./);
    assert.match(t, /LAST SEASON \(2025-26\) 1 completed event ▸/);
  });

  test('the resale lift stays at three across both seasons', () => {
    // Five completed bobbleheads: two this season, three last season. The lift
    // takes the current season first (A, B) and has ONE left for last season
    // (C); D and E stay behind the collapse, out of the server HTML. Without
    // the shared budget, last season would lift three more.
    const bh = (d: string, n: string) => promo(d, `${n} Bobblehead`, { type: 'giveaway' });
    const rows = [bh('2026-10-02', 'A'), bh('2026-10-01', 'B'), bh('2026-03-01', 'C'), bh('2026-02-01', 'D'), bh('2025-12-01', 'E')];
    const html = list(DETROIT, rows, true);
    const shown = ['A', 'B', 'C', 'D', 'E'].filter((n) => html.includes(`${n} Bobblehead`));
    assert.deepEqual(shown, ['A', 'B', 'C']);
  });

  test('MLB: unchanged "COMPLETED 2026 PROMOS ... this season"', () => {
    const t = text(list(BRAVES, [promo('2026-09-20', 'A'), promo('2026-08-01', 'B')], true));
    assert.match(t, /COMPLETED 2026 PROMOS 2 completed events this season/);
    assert.match(t, /2026 SEASON PROMOS/);
    assert.match(t, /All 2 Atlanta Braves promotions on record for the 2026 season are below\./);
  });
});

// ── The NHL and NBA schedule ──

const game = (league: 'nhl' | 'nba', date: string, home: boolean, opp: string, extra: Partial<Game> = {}): Game => ({
  id: `${league}-${date}-${opp}`,
  league,
  date,
  gameTime: league === 'nhl' ? '23:00' : '',
  gameTimeTz: league === 'nhl' ? 'America/New_York' : '',
  gameTimeZoneAbbrev: league === 'nhl' ? 'EDT' : undefined,
  homeTeamSlug: home ? 'x' : opp,
  awayTeamSlug: home ? opp : 'x',
  venueName: 'Somewhere Arena',
  status: 'scheduled',
  season: 2026,
  seasonType: 'regular',
  ...extra,
});
const OPP = mk('boston-bruins', 'NHL', 'Boston', 'Bruins');
const season = (league: 'nhl' | 'nba'): GameContext[] => {
  const out: GameContext[] = [];
  let day = Date.UTC(2026, 9, 7);
  for (let i = 0; i < 24; i++, day += 8 * 86_400_000) {
    const d = new Date(day).toISOString().slice(0, 10);
    out.push({ game: game(league, d, i % 2 === 0, 'boston-bruins'), isHome: i % 2 === 0, opponentTeam: OPP, opponentVenue: null, promos: [] });
  }
  return out;
};

type Node = { tag: string; attrs: string; children: Node[]; text: string; parent: Node | null };
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'path', 'svg']);
function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: '', children: [], text: '', parent: null };
  let cur = root;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { cur.text += m[4]; continue; }
    const [, close, tag, attrs] = m;
    if (close) { if (cur.tag === tag) cur = cur.parent!; continue; }
    const node: Node = { tag, attrs, children: [], text: '', parent: cur };
    cur.children.push(node);
    if (!VOID.has(tag) && !attrs.endsWith('/')) cur = node;
  }
  return root;
}
const all = (n: Node, pred: (x: Node) => boolean, out: Node[] = []): Node[] => {
  for (const c of n.children) { if (pred(c)) out.push(c); all(c, pred, out); }
  return out;
};
const cls = (n: Node) => (/class="([^"]*)"/.exec(n.attrs)?.[1] ?? '').split(/\s+/);
const hasAncestor = (n: Node, pred: (x: Node) => boolean) => { for (let p = n.parent; p; p = p.parent) if (pred(p)) return true; return false; };

describe('the NHL and NBA schedule', () => {
  const nhl = renderToStaticMarkup(<ScheduleBlock contexts={season('nhl')} team={RANGERS} teamName="New York Rangers" today={TODAY} statusLine="The New York Rangers line." />);
  const nba = renderToStaticMarkup(<ScheduleBlock contexts={season('nba')} team={KNICKS} teamName="New York Knicks" today={TODAY} />);

  test('collapsed month sections, every game row in the HTML', () => {
    for (const html of [nhl, nba]) {
      const root = parse(html);
      const details = all(root, (n) => n.tag === 'details');
      assert.ok(details.length >= 5, 'one section per month');
      for (const d of details) assert.doesNotMatch(d.attrs, /\sopen/, 'collapsed by default');
      assert.equal(all(root, (n) => n.tag === 'li').length, 24, 'every game in the HTML');
    }
  });

  test('the season is named 2026-27, and the intro says every SCHEDULED game', () => {
    for (const html of [nhl, nba]) {
      const t = text(html);
      assert.match(t, /2026-27 season/);
      assert.match(t, /Game Schedule/);
      assert.match(t, /2026-27 Game Schedule/);
      assert.match(t, /Every scheduled game of the 2026-27 regular season, by month\./);
      assert.doesNotMatch(t, /\b2026 season\b|2026 regular season|2026 Game Schedule/);
    }
  });

  test('rows: date, opponent and home/away; NHL shows the puck drop, NBA shows no time; no venue line', () => {
    const tn = text(nhl);
    assert.match(tn, /7:00 PM/);
    assert.doesNotMatch(tn, /Somewhere Arena/);
    const tb = text(nba);
    assert.doesNotMatch(tb, /\d{1,2}:\d{2}\s?(AM|PM)/);
    assert.doesNotMatch(tb, /Somewhere Arena/);
    assert.match(tb, /vs Boston Bruins/);
    assert.match(tb, /at Boston Bruins/);
    assert.match(tb, /Home/);
    assert.match(tb, /Away/);
  });

  test('the ticket invitation only while a game is still ahead (the spine never marks a game played)', () => {
    assert.match(text(nhl), /and a game for tickets, parking and hotels on the road\./);
    const over = renderToStaticMarkup(<ScheduleBlock contexts={season('nhl')} team={RANGERS} teamName="New York Rangers" today="2027-06-01" />);
    assert.doesNotMatch(text(over), /tickets/i);
    const noClock = renderToStaticMarkup(<ScheduleBlock contexts={season('nba')} team={KNICKS} teamName="New York Knicks" />);
    assert.doesNotMatch(text(noClock), /tickets/i, 'no clock read, no claim');
  });

  test('the status line sits above the schedule heading, and only when passed', () => {
    const t = text(nhl);
    assert.ok(t.indexOf('The New York Rangers line.') >= 0);
    assert.ok(t.indexOf('The New York Rangers line.') < t.indexOf('Game Schedule'));
    assert.doesNotMatch(text(nba), /haven't announced|hasn't recorded/);
  });

  test('ad anchors only between months: none on or inside a details block or a row', () => {
    for (const html of [nhl, nba]) {
      const root = parse(html);
      const anchors = all(root, (n) => cls(n).includes('page-content'));
      assert.equal(anchors.length, 1, 'one anchor wrapper');
      for (const a of anchors) {
        assert.notEqual(a.tag, 'details');
        assert.ok(!hasAncestor(a, (p) => p.tag === 'details' || p.tag === 'li'));
        for (const c of a.children) assert.equal(c.tag, 'div', 'each month is its own block inside the wrapper');
      }
      for (const d of all(root, (n) => n.tag === 'details')) {
        assert.equal(all(d, (n) => cls(n).includes('page-content')).length, 0);
      }
    }
  });
});

describe('what the zero-promo pages may claim', () => {
  test('ZeroPromoFallback on NHL and NBA names 2026-27 and makes no claim about the club', () => {
    for (const team of [RANGERS, HEAT]) {
      const t = text(renderToStaticMarkup(<ZeroPromoFallback team={team} venue={null} teamName={`${team.city} ${team.name}`} variant="light" />));
      assert.match(t, /2026-27/);
      // Says nothing about what is listed: the status line above the schedule
      // says that once per page (review round 1 removed the repeat here).
      assert.doesNotMatch(t, /PromoNight has no|hasn't recorded|listed yet/);
      assert.doesNotMatch(t, /haven't announced/);
      assert.doesNotMatch(t, /\b2026 (?!-)/);
    }
  });

  test('"haven\'t announced" only for a verified club, inside its window; otherwise "hasn\'t recorded"', () => {
    // The check date rides in the sentence, so a page served stale long after
    // the window (ISR is stale-while-revalidate) still states a true, dated fact.
    assert.equal(announcementLine('new-york-knicks', 'New York Knicks', '2026-10-05'), "The New York Knicks haven't announced 2026-27 promotions yet (checked October 5).");
    assert.equal(announcementLine('golden-state-warriors', 'Golden State Warriors', '2026-10-05'), "PromoNight hasn't recorded any Golden State Warriors 2026-27 promotions yet.");
    // The window: verified 2026-10-05, good for VERIFIED_FOR_DAYS days.
    assert.equal(VERIFIED_FOR_DAYS, 14);
    // Rendered through 10-17; with the one-day ISR window a visitor can see it
    // through 10-18, the 14th day, and never on 10-19.
    assert.equal(nothingPublishedVerified('new-york-knicks', '2026-10-17'), true, 'last render day');
    assert.equal(nothingPublishedVerified('new-york-knicks', '2026-10-18'), false, 'not rendered on the 14th day, it may be served stale through it');
    assert.equal(nothingPublishedVerified('new-york-knicks', '2026-10-04'), false, 'not before the check');
    assert.equal(nothingPublishedVerified('new-york-knicks', 'garbage'), false);
    assert.match(announcementLine('new-york-knicks', 'New York Knicks', '2026-10-19'), /^PromoNight hasn't recorded/);
  });

  test('the line shows only on an NHL or NBA schedule page with no season rows', () => {
    const base = { league: 'NBA', showSchedule: true, seasonResolved: false, teamId: 'new-york-knicks', displayName: 'New York Knicks', today: TODAY };
    assert.equal(scheduleStatusLine(base), "The New York Knicks haven't announced 2026-27 promotions yet (checked October 5).");
    // A page listing special-ticket packages has published something: only the
    // sentence about our record (review round 2).
    assert.equal(scheduleStatusLine({ ...base, hasTicketPackages: true }), "PromoNight hasn't recorded any New York Knicks 2026-27 promotions yet.");
    assert.match(readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8'), /hasTicketPackages: ticketPackages\.length > 0,/);
    assert.equal(scheduleStatusLine({ ...base, seasonResolved: true }), null, 'the season resolved: the club has rows');
    assert.equal(scheduleStatusLine({ ...base, showSchedule: false }), null, 'no schedule, nothing to sit above');
    assert.equal(scheduleStatusLine({ ...base, league: 'MLB' }), null);
    assert.equal(scheduleStatusLine({ ...base, league: 'NFL' }), null);
    // The page passes its own season resolution, not a constant.
    assert.match(readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8'), /seasonResolved: !!seasonScope,/);
    assert.match(scheduleStatusLine({ ...base, league: 'NHL', teamId: 'minnesota-wild', displayName: 'Minnesota Wild' })!, /^PromoNight hasn't recorded any Minnesota Wild 2026-27 promotions yet\.$/);
  });

  test('no club that had published on 2026-10-05 is in the verified list', () => {
    for (const published of ['golden-state-warriors', 'boston-celtics', 'san-antonio-spurs', 'minnesota-wild', 'toronto-raptors']) {
      assert.equal(NOTHING_PUBLISHED[published], undefined, published);
    }
  });
});

describe('the NHL season claim in the by-the-numbers paragraph', () => {
  test('2026-27 rows only, over 42 NHL home games (the 84-game season)', () => {
    const rows: Promo[] = [];
    for (let i = 0; i < 20; i++) rows.push(promo(new Date(Date.UTC(2026, 9, 6 + i * 8)).toISOString().slice(0, 10), `N${i}`));
    rows.push(promo('2026-03-14', 'Last season'));
    const claim = resolveClaimMode(rows, 'NHL', TODAY);
    assert.equal(claim.kind, 'season');
    const t = text(renderToStaticMarkup(<AuthorityStats team={DETROIT} promos={rows.filter((p) => p.date >= TODAY)} promoCounts={{ giveaway: 0, theme: 20, food: 0, kids: 0 }} claim={claim} venue={null} teamName="Detroit Red Wings" variant="light" />));
    assert.match(t, /have 20 promotional events scheduled across 42 NHL home games/);
  });
});
