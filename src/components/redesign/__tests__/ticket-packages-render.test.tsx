/* Special-ticket items are not theme nights, giveaways or food deals
 * (WEB6 addendum, 2026-10-05). Rendered as the WHOLE team page.
 *
 * The route splits a team's rows once (partitionTicketPackages, right after
 * getTeamPromos) and gives every
 * count site the counted array. These tests render RedesignTeamPage the way the
 * route calls it and check each count site in the served markup:
 *   hero tiles and the season sentence, the promo list's "N upcoming events"
 *   and "All N promotions on record" lines, By the Numbers, the content
 *   sections, the visible FAQ, and the JSON-LD (events and FAQPage).
 * A package title may appear in ONE place: the "Ticket packages (N)" group,
 * where every row says the item comes with a special ticket. A page with no
 * packages renders exactly as it does without the prop. */
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Promo, Team } from '@/lib/types';
import type { GameContext } from '@/lib/data';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T12:00:00Z') });
const emptyQuery: any = {
  where: () => emptyQuery,
  orderBy: () => emptyQuery,
  limit: () => emptyQuery,
  select: () => emptyQuery,
  doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), collection: () => emptyQuery }),
  get: async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }),
  count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
};
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../lib/firebase.ts', import.meta.url).href, {
  namedExports: { db: { collection: () => emptyQuery, collectionGroup: () => emptyQuery } },
});
mock.module(new URL('../fonts.ts', import.meta.url).href, { namedExports: { archivo: { variable: 'font-archivo' } } });

const TODAY = '2026-10-05';
const mk = (id: string, league: string, city: string, name: string, sportSlug = league.toLowerCase()): Team =>
  ({ id, league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: '#123456', secondaryColor: '#654321', sportSlug, division: 'Pacific' }) as Team;
const WARRIORS = mk('golden-state-warriors', 'NBA', 'Golden State', 'Warriors');
const RED_WINGS = mk('detroit-red-wings', 'NHL', 'Detroit', 'Red Wings');
const TWINS = mk('minnesota-twins', 'MLB', 'Minnesota', 'Twins');

const promo = (date: string, title: string, type: Promo['type'] = 'theme', over: Partial<Promo> = {}): Promo => ({
  date, time: '', opponent: 'Brooklyn Nets', type, title, description: `${title} details.`, highlight: false, icon: '', recurring: false, ...over,
});

// The Warriors on 2026-10-05: three plain theme nights and special-ticket rows
// of every type (the pipeline demotes most to theme; food and kids occur too).
const PLAIN = [promo('2026-11-10', 'Educators Night'), promo('2027-03-05', 'Womens Empowerment Month'), promo('2027-04-01', 'Sustainability Night')];
const PACKAGES = [
  promo('2026-10-01', 'Expired Package Night'),
  promo('2026-11-01', 'Healthcare Heroes Night'),
  promo('2026-12-01', 'Lunch Box Night', 'food'),
  promo('2026-12-05', 'Hat Night Package', 'giveaway', { highlight: true }),
  promo('2027-01-10', 'Kids Pack Day', 'kids'),
  promo('2027-03-09', 'Asian Heritage Night'),
];
const PACKAGE_TITLES = PACKAGES.map((p) => p.title);

const coverage = { teamCount: 169, leagueList: 'MLB, NBA, NFL, NHL, MLS, and WNBA', appLeagueList: 'MLB, NBA, NHL, and MLS' } as never;

async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}

/** The route's derivation, call for call (src/app/[sport]/[team]/page.tsx):
 *  partition, split by date, count, resolve the claim. */
async function page(team: Team, all: Promo[], flagged: Promo[], extra: { gameContexts?: GameContext[]; omitProp?: boolean } = {}) {
  const { partitionTicketPackages, upcomingTicketPackages } = await import('@/lib/ticket-packages');
  const { splitPromosByDate, countPromosByType, teamDisplayName } = await import('@/lib/promo-helpers');
  const { resolveClaimMode } = await import('@/lib/season-scope');
  const { RedesignTeamPage } = await import('../RedesignTeamPage');
  const isPkg = new Set(flagged);
  const { promos, ticketPackages } = partitionTicketPackages(all, (p) => isPkg.has(p), team.league);
  const { upcoming } = splitPromosByDate(promos, TODAY);
  const packagesAhead = upcomingTicketPackages(ticketPackages, TODAY);
  const out = await html(
    <RedesignTeamPage
      team={team}
      coverage={coverage}
      venue={null}
      promos={promos}
      upcomingPromos={upcoming}
      upcomingCounts={countPromosByType(upcoming)}
      claim={resolveClaimMode(promos, team.league, TODAY)}
      displayName={teamDisplayName(team)}
      gameContexts={extra.gameContexts}
      today={TODAY}
      recurringDeals={[]}
      playoffsActive={false}
      inPlayoffs={false}
      playoffPromos={[]}
      playoffRound=""
      playoffLastUpdated={null}
      {...(extra.omitProp ? {} : { ticketPackages: packagesAhead })}
    />,
  );
  return { out, promos, ticketPackages, packagesAhead };
}

const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const jsonLd = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
/** The page with the package group cut out: what every count site sees. */
const withoutGroup = (h: string) => h.replace(/<section[^>]*aria-labelledby="ticket-packages-heading"[\s\S]*?<\/section>/, '');
const tiles = (h: string) => {
  const t = text(h);
  const n = (label: string) => Number(new RegExp(`(\\d+) ${label}\\b`).exec(t)?.[1]);
  return { giveaway: n('Giveaways'), theme: n('Theme Nights'), food: n('Food Deals'), kids: n('Kids') };
};

describe('the Warriors shape: 3 theme nights, 6 special-ticket rows', () => {
  test('hero tiles and the season sentence count the 3 theme nights only', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    assert.deepEqual(tiles(out), { giveaway: 0, theme: 3, food: 0, kids: 0 });
    assert.match(text(out), /3 promotions in the 2026-27 season, all still to come/);
  });

  test('the promo list: "3 upcoming events", no package row in it', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    const t = text(withoutGroup(out));
    assert.match(t, /UPCOMING PROMOS 3 upcoming events/);
    for (const title of PACKAGE_TITLES) assert.ok(!t.includes(title), `${title} outside the package group`);
  });

  test('"All N promotions on record" counts the counted rows only', async () => {
    // Every counted row past, packages still ahead, no games: the season-
    // complete state, which prints the "All N ... on record" line.
    const past = [promo('2026-10-02', 'Opening Night'), promo('2026-10-03', 'Second Night')];
    const { out } = await page(WARRIORS, [...past, ...PACKAGES], PACKAGES);
    assert.match(text(out), /All 2 Golden State Warriors promotions on record for the 2026-27 season are below\./);
  });

  test('the visible FAQ and By the Numbers: 3, and no package named', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    const t = text(withoutGroup(out));
    assert.match(t, /How many promotional nights do the Warriors have in the 2026-27 season\?/);
    assert.match(t, /The Golden State Warriors have 3 promotional events in the 2026-27 season, including 3 theme nights\. 3 are still to come\./);
    assert.match(t, /have 3 theme nights scheduled at their home stadium during the 2026-27 season, 3 still to come/);
    for (const title of PACKAGE_TITLES) assert.ok(!t.includes(title), `${title} named outside the group`);
  });

  test('structured data: 3 events, the FAQPage says 3, no package anywhere in JSON-LD', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    const blocks = jsonLd(out);
    const raw = JSON.stringify(blocks);
    for (const title of PACKAGE_TITLES) assert.ok(!raw.includes(title), `${title} in JSON-LD`);
    const events = JSON.stringify(blocks).match(/"@type":"Event"/g) ?? [];
    assert.ok(events.length <= 3, `at most the 3 counted events, saw ${events.length}`);
    const faq = blocks.flatMap((b) => (Array.isArray(b['@graph']) ? b['@graph'] : [b])).find((b: any) => b['@type'] === 'FAQPage');
    assert.ok(faq, 'FAQPage present');
    assert.match(JSON.stringify(faq), /have 3 promotional events in the 2026-27 season/);
  });

  test('the group: "Ticket packages (5)", upcoming only, every row says special ticket', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    const group = /<section[^>]*aria-labelledby="ticket-packages-heading"[\s\S]*?<\/section>/.exec(out)?.[0] ?? '';
    const t = text(group);
    assert.match(t, /Ticket packages \(5\)/);
    assert.match(t, /not counted as theme nights, giveaways, food deals or kids events/);
    assert.equal(t.split('Comes with a special ticket.').length - 1, 5, 'one note per row');
    assert.ok(!t.includes('Expired Package Night'), 'a past package is not offered');
    for (const title of PACKAGE_TITLES.slice(1)) assert.ok(t.includes(title), title);
    // Four shown, the fifth behind a details toggle; no ad anchor inside.
    const details = /<details[\s\S]*<\/details>/.exec(group)?.[0] ?? '';
    assert.match(text(details), /^ ?Show 1 more ticket package Tue, Mar 9 · vs Brooklyn Nets Asian Heritage Night/);
    assert.doesNotMatch(group, /page-content/);
    // Deep links: every row keeps its #promo- anchor (round 3), and the closed
    // group is marked for PromoArrivalHighlight to open.
    for (const p of PACKAGES.slice(1)) assert.ok(group.includes(`id="promo-${p.date}-`), `${p.title} anchor`);
    assert.match(group, /<details class="mt-3" data-ticket-packages="true">/);
    assert.doesNotMatch(group, /promo-arrival|PromoArrivalHighlight/, 'list page: the list mounts the arrival effect, not the group');
    // No HOT flame on a package, even one stored with highlight true.
    assert.doesNotMatch(group, /HOT/);
  });

  test('the group sits after the promo list, inside the same weave item', async () => {
    const { out } = await page(WARRIORS, [...PLAIN, ...PACKAGES], PACKAGES);
    const item = /<div class="rd-weave-item order-\[40\]">([\s\S]*?)<div class="rd-weave-item order-\[4[12]\]/.exec(out)?.[1] ?? '';
    assert.ok(item.indexOf('UPCOMING PROMOS') >= 0 && item.indexOf('Ticket packages (5)') > item.indexOf('UPCOMING PROMOS'));
  });
});

describe('the Red Wings shape, packages and lunch boxes, on NHL', () => {
  test('food-typed special-ticket rows do not count as food deals', async () => {
    const plain = [promo('2026-10-10', 'Hockey Fights Cancer'), promo('2026-10-12', 'Bobblehead Night', 'giveaway')];
    const pk = [promo('2026-10-29', 'Albanian Heritage Layered Hoodie'), promo('2026-11-05', 'Lunch Box One', 'food'), promo('2026-11-06', 'Lunch Box Two', 'food')];
    const { out } = await page(RED_WINGS, [...plain, ...pk], pk);
    assert.deepEqual(tiles(out), { giveaway: 1, theme: 1, food: 0, kids: 0 });
    assert.match(text(out), /Ticket packages \(3\)/);
  });
});

describe('pages with no special-ticket items render exactly as before', () => {
  test('NBA, nothing flagged: identical with and without the prop, and no group', async () => {
    const a = (await page(WARRIORS, PLAIN, [])).out;
    const b = (await page(WARRIORS, PLAIN, [], { omitProp: true })).out;
    assert.equal(a, b);
    assert.doesNotMatch(a, /Ticket packages|ticket-packages-heading/);
  });

  test('NBA, packages all past: no group, identical to the page without the prop', async () => {
    const past = [promo('2026-09-01', 'Old Package')];
    const a = (await page(WARRIORS, [...PLAIN, ...past], past)).out;
    const b = (await page(WARRIORS, PLAIN, [], { omitProp: true })).out;
    assert.equal(a, b);
  });

  test('MLB: the raw flag is ignored, the partition returns the input array itself', async () => {
    const { partitionTicketPackages } = await import('@/lib/ticket-packages');
    const all = [...PLAIN, ...PACKAGES];
    const r = partitionTicketPackages(all, () => true, 'MLB');
    assert.equal(r.promos, all, 'identity, not a copy');
    assert.equal(r.ticketPackages.length, 0);
    const nothing = partitionTicketPackages(all, () => false, 'NBA');
    assert.equal(nothing.promos, all, 'NBA with nothing flagged: identity too');
    const a = (await page(TWINS, all, PACKAGES)).out;
    const b = (await page(TWINS, all, [], { omitProp: true })).out;
    assert.equal(a, b);
  });
});

describe('the route wires every count site to the counted array', () => {
  const src = readFileSync('src/app/[sport]/[team]/page.tsx', 'utf8');
  test('both reads are split right after the read, and nothing else reads allPromos', () => {
    assert.match(src, /const \{ promos, ticketPackages \} = partitionTicketPackages\(allPromos, isTicketPackagePromo, team\.league\);/);
    assert.match(src, /const \{ promos \} = partitionTicketPackages\(allPromos, isTicketPackagePromo, team\.league\);/);
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.equal(code.match(/\ballPromos\b/g)?.length, 4, 'two reads, two splits, no other use');
  });
  test('ticketPackages reaches one place: the group, upcoming only', () => {
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    // The destructure, the one read (upcomingTicketPackages), and the prop name.
    assert.equal(code.match(/\bticketPackages\b/g)?.length, 3, 'declared once, read once');
    assert.match(src, /const packagesAhead = upcomingTicketPackages\(ticketPackages, todayStr\);/);
    assert.match(src, /ticketPackages=\{packagesAhead\}/);
  });
  test('RedesignTeamPage hands ticketPackages to the group, and its presence to the status line, nowhere else', () => {
    const t = readFileSync('src/components/redesign/RedesignTeamPage.tsx', 'utf8');
    const uses = t.split('\n').filter((l) => /\bticketPackages\b/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    assert.deepEqual(uses.map((l) => l.trim()), [
      'ticketPackages?: Promo[];',
      'ticketPackages = [],',
      'hasTicketPackages: ticketPackages.length > 0,',
      '{ticketPackages.length > 0 ? (',
      '<TicketPackageList packages={ticketPackages} arrivalHighlight={hasNoPromosAtAll} />',
    ]);
  });
});
