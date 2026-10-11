/* The team page's app card (app funnel G1C, 2026-10-11).
 *
 *  - Inside the promo list, after the visible upcoming rows and before
 *    "Show all" and the past promos; never inside `.page-content`, whose
 *    children are Raptive in-content anchors.
 *  - Season over: after the "All N promotions on record" line.
 *  - Nothing upcoming, season not over: after the pointer line.
 *  - Without `appCard` the list is exactly what it was.
 *  - The card's own markup: the copy, the /download link a server renders, and
 *    nothing Raptive selects (no <aside>, no `contents`, `page-content` or
 *    `rd-weave-item`). */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoList } from '@/components/promo-list';
import { AppAlertCard } from '@/components/app-alert-card';
import type { Promo, Team } from '@/lib/types';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T12:00:00Z') });

const mk = (id: string, league: string, city: string, name: string): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug: league.toLowerCase(), division: 'Test' }) as Team;
const WILD = mk('minnesota-wild', 'NHL', 'Minnesota', 'Wild');
const TWINS = mk('minnesota-twins', 'MLB', 'Minnesota', 'Twins');
const HEAT = mk('miami-heat', 'NBA', 'Miami', 'Heat');

const promo = (date: string, title: string, over: Partial<Promo> = {}): Promo => ({
  date, time: '', opponent: 'Visitors', type: 'theme', title, description: '', highlight: false, icon: '', recurring: false, ...over,
});

const MARK = '<div data-test="app-card"></div>';
/** Where the past promos start: the archive heading. Off a season-scoped page
 *  the archive rows are collapsed and not in the server HTML, so the heading is
 *  the first thing of the archive that is. */
const archiveAt = (html: string) => html.search(/COMPLETED|LAST SEASON/);
const card = <div data-test="app-card" />;

function list(team: Team, promos: Promo[], opts: { seasonScoped?: boolean; withCard?: boolean } = {}) {
  return renderToStaticMarkup(
    <PromoList
      promos={promos}
      teamSlug={team.id}
      teamName={`${team.city} ${team.name}`}
      league={team.league}
      sport={team.sportSlug}
      variant="light"
      showAppPitch={false}
      seasonScoped={opts.seasonScoped ?? false}
      scopeLive
      team={team}
      {...(opts.withCard === false ? {} : { appCard: card })}
    />,
  );
}

/** Is index `at` still inside the element opened at `open` (a <div>)? */
function insideDiv(html: string, open: number, at: number): boolean {
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = open;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && m.index < at) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return false;
  }
  return depth > 0;
}

const upcoming = Array.from({ length: 14 }, (_, i) =>
  promo(`2026-${String(10 + Math.floor(i / 9)).padStart(2, '0')}-${String(10 + (i % 9) * 2).padStart(2, '0')}`, `Ahead ${i + 1}`),
);
const past = [promo('2026-03-14', 'Old Theme'), promo('2025-11-07', 'Dynasty Bobblehead', { type: 'giveaway' })];

test('upcoming rows: after the tenth visible row, outside .page-content, before "Show all" and the past promos', () => {
  const html = list(WILD, [...upcoming, ...past]);
  const at = html.indexOf(MARK);
  assert.ok(at > 0, 'card rendered');
  assert.equal(html.split(MARK).length - 1, 1, 'exactly once');
  assert.ok(html.lastIndexOf('Ahead 10', at) > 0 && html.indexOf('Ahead 10') < at, 'after the tenth (last visible) row');
  assert.ok(at < html.indexOf('Show all 14 upcoming promos'), 'before Show all');
  assert.ok(archiveAt(html) > 0 && at < archiveAt(html), 'before the past promos');
  const pc = html.indexOf('page-content');
  assert.ok(pc > 0, 'the list has its anchor groups');
  const pcOpen = html.lastIndexOf('<div', pc);
  assert.equal(insideDiv(html, pcOpen, at), false, 'not inside .page-content');
  assert.ok(html.indexOf('Ahead 9') > pc, 'the rows just above are the tail, which is outside .page-content');
});

test('four or fewer upcoming rows (no .page-content at all): after the rows, before the past promos', () => {
  const html = list(WILD, [...upcoming.slice(0, 3), ...past]);
  const at = html.indexOf(MARK);
  assert.ok(html.indexOf('Ahead 3') < at && archiveAt(html) > at);
  assert.equal(html.indexOf('page-content'), -1);
});

test('season over: after the "All N promotions on record" line, before the archive rows', () => {
  const html = list(TWINS, [promo('2026-05-02', 'Bobblehead One', { type: 'giveaway' }), promo('2026-06-02', 'Theme Two')], { seasonScoped: true });
  const at = html.indexOf(MARK);
  const line = html.indexOf('on record for the');
  assert.ok(line > 0 && line < at, 'after the on-record line');
  assert.ok(at < html.indexOf('Bobblehead One'), 'before the archive rows');
});

test('nothing upcoming, season not over: after the pointer line', () => {
  const html = list(HEAT, [promo('2026-04-29', 'Mashup Logo Night')]);
  const at = html.indexOf(MARK);
  assert.ok(html.indexOf('No upcoming Miami Heat promos scheduled right now') < at);
  assert.ok(archiveAt(html) > at, 'before the archive');
});

test('without appCard the list is unchanged', () => {
  const a = list(WILD, [...upcoming, ...past], { withCard: false });
  const b = list(WILD, [...upcoming, ...past]).replace(`<div class="mt-3">${MARK}</div>`, '');
  assert.equal(a, b);
});

test('the card: copy, icon, feature row, server-rendered /download link, nothing Raptive selects', () => {
  const html = renderToStaticMarkup(<AppAlertCard teamId="minnesota-twins" teamName="Minnesota Twins" />);
  const t = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.match(t, /Get alerts for Minnesota Twins promos/);
  assert.match(t, /Free app\. A reminder the morning of every bobblehead night, giveaway and theme night\./);
  assert.match(t, /Morning-of reminders Home screen widgets Game Day parking and bag policy/);
  assert.match(t, /Get the app/);
  assert.match(html, /<img[^>]*alt="PromoNight app icon"[^>]*width="48"[^>]*height="48"/);
  assert.match(html, /src="\/promonight-app-icon\.png"/);
  assert.match(html, /<a href="\/download\?src=team_cta_minnesota-twins"/);
  assert.doesNotMatch(html, /\u2014/, 'no em dash');
  assert.doesNotMatch(html, /<aside|<article/);
  for (const cls of ['contents', 'page-content', 'rd-weave-item', 'rd-weave-shell']) {
    assert.doesNotMatch(html, new RegExp(`class="[^"]*(?<![\\w-])${cls}(?![\\w-])`), cls);
  }
});

test('the off-season card (zero-promo pages): its heading, the same link', () => {
  const html = renderToStaticMarkup(<AppAlertCard teamId="dallas-cowboys" teamName="Dallas Cowboys" variant="offseason" />);
  const t = html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(t, /Get alerts when Dallas Cowboys promos are posted/);
  assert.doesNotMatch(t, /Get alerts for/);
  assert.match(html, /href="\/download\?src=team_cta_dallas-cowboys"/);
});

test('spacing: 12px (mt-3) outside a row group, none inside one (space-y-3 gives it)', () => {
  const after = list(WILD, [...upcoming, ...past]);
  assert.ok(after.includes('<div class="mt-3">' + MARK + '</div>'));
  const inGroup = list(WILD, upcoming.slice(0, 3));
  assert.ok(!inGroup.includes('<div class="mt-3">' + MARK));
});

/* Nothing below the rows in the list (no "Show all", no archive): the card
 * would end the promo weave item, where Raptive inserts a unit, so it goes
 * before the last visible row, and with a one-row tail into the last group. */
const parentOfCard = (html: string) => {
  const at = html.indexOf(MARK);
  const open = [...html.slice(0, at).matchAll(/<div\b[^>]*>/g)];
  // innermost still-open <div> before the card
  for (let k = open.length - 1; k >= 0; k--) {
    if (insideDiv(html, open[k].index!, at)) return open[k][0];
  }
  return '';
};

test('nothing below the rows: 1 row, the card comes before it', () => {
  const html = list(WILD, upcoming.slice(0, 1));
  const at = html.indexOf(MARK);
  assert.ok(at > 0 && at < html.indexOf('Ahead 1'));
  assert.equal(html.split(MARK).length - 1, 1);
});

test('nothing below the rows: 3 rows, between the second and the third', () => {
  const html = list(WILD, upcoming.slice(0, 3));
  const at = html.indexOf(MARK);
  assert.ok(html.indexOf('Ahead 2') < at && at < html.indexOf('Ahead 3'));
});

test('nothing below the rows: 10 rows, before the tenth, in the tail (outside .page-content)', () => {
  const html = list(WILD, upcoming.slice(0, 10));
  const at = html.indexOf(MARK);
  assert.ok(html.indexOf('Ahead 9') < at && at < html.indexOf('Ahead 10'));
  const pcOpen = html.lastIndexOf('<div', html.indexOf('page-content'));
  assert.equal(insideDiv(html, pcOpen, at), false);
});

test('nothing below the rows: 5 rows (one-row tail), inside the last group before its last row, never a direct child of .page-content', () => {
  const html = list(WILD, upcoming.slice(0, 5));
  const at = html.indexOf(MARK);
  assert.ok(html.indexOf('Ahead 3') < at && at < html.indexOf('Ahead 4') && html.indexOf('Ahead 5') > at);
  const pcOpen = html.lastIndexOf('<div', html.indexOf('page-content'));
  assert.equal(insideDiv(html, pcOpen, at), true, 'inside .page-content ...');
  assert.doesNotMatch(parentOfCard(html), /page-content/, '... but inside a row group, not as an anchor');
  assert.match(parentOfCard(html), /class="space-y-3"/);
});

test('with rows hidden or an archive below, the card stays after the rows', () => {
  const withArchive = list(WILD, [...upcoming.slice(0, 3), ...past]);
  assert.ok(withArchive.indexOf('Ahead 3') < withArchive.indexOf(MARK));
});
