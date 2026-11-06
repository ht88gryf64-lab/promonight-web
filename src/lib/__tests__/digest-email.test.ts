// The weekly digest redesign (docs/digest-redesign/digest-redesign-spec.md):
// the spec's test list, run through the REAL builders in src/lib/email.ts and
// the REAL renderer in src/lib/digest-email.ts. Nothing here reads Firestore
// or sends: the builders return the message, the senders are not called.
//
// GOLDEN FILES. Each variant, with and without a hero, is compared byte for
// byte against src/lib/__tests__/__fixtures__/digest-<variant>-<hero>.html.
// After an intended change, regenerate and review the diff:
//   UPDATE_DIGEST_GOLDEN=1 npm test
// The files open in a browser as the email renders.
//
// Run with:
//   node --import tsx --experimental-test-module-mocks --test <this file>

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestContext, DigestPromo, DigestTeam, DigestUpcoming } from '../digest';
import type { Promo } from '../types';
import { promoPageHref } from '../promo-page-href';

mock.module('server-only', { namedExports: {} });

const SITE = 'https://www.getpromonight.com';
const TOKEN = 'test-manage-token';
const WINDOW = { start: '2026-11-03', end: '2026-11-09' };
const PARTNER_DOMAINS = ['lusg.net', 'evyy.net', 'spothero.com', 'expedia.com'];
const FIXTURES = join(process.cwd(), 'src', 'lib', '__tests__', '__fixtures__');

// ── fixtures ────────────────────────────────────────────────────────────────

const TEAMS: DigestTeam[] = [
  { id: 'florida-panthers', name: 'Florida Panthers', short: 'Panthers', sportSlug: 'nhl', league: 'NHL' },
  { id: 'miami-heat', name: 'Miami Heat', short: 'Heat', sportSlug: 'nba', league: 'NBA' },
  { id: 'pittsburgh-penguins', name: 'Pittsburgh Penguins', short: 'Penguins', sportSlug: 'nhl', league: 'NHL' },
  { id: 'charlotte-hornets', name: 'Charlotte Hornets', short: 'Hornets', sportSlug: 'nba', league: 'NBA' },
  { id: 'washington-capitals', name: 'Washington Capitals', short: 'Capitals', sportSlug: 'nhl', league: 'NHL' },
  { id: 'tampa-bay-lightning', name: 'Tampa Bay Lightning', short: 'Lightning', sportSlug: 'nhl', league: 'NHL' },
];
const teamById = new Map(TEAMS.map((t) => [t.id, t]));

/** Every href below comes out of promoPageHref, never built by hand. */
const PAGE_HREFS = new Set<string>();
function pageHref(teamId: string, date: string, title: string, pageSlug: string): string {
  const team = teamById.get(teamId)!;
  const promo = { date, title, pageSlug, type: 'theme' } as Promo;
  const href = promoPageHref(promo, team);
  assert.ok(href, `fixture ${pageSlug} has no page href`);
  PAGE_HREFS.add(href!);
  return href!;
}

let seq = 0;
function promo(teamId: string, date: string, title: string, over: Partial<DigestPromo> = {}): DigestPromo {
  const team = teamById.get(teamId)!;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  seq += 1;
  return {
    date,
    title,
    type: 'theme',
    typeLabel: 'Theme Night',
    icon: '',
    highlight: false,
    time: '7:30 PM',
    opponent: 'Blackhawks',
    teamId,
    teamName: team.name,
    league: team.league,
    leagueIcon: '',
    sportSlug: team.sportSlug,
    href: pageHref(teamId, date, title, slug),
    hasPage: true,
    pageSlug: slug,
    promoId: `promo${seq}`,
    updatedAt: '2026-11-01T12:00:00.000Z',
    imageTier: 3,
    themeKey: null,
    quantity: null,
    venueName: 'Amerant Bank Arena',
    teamShort: team.short,
    ...over,
  };
}
function upcoming(teamId: string, date: string, title: string, themeKey: string | null = null, type: DigestUpcoming['type'] = 'theme'): DigestUpcoming {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { teamId, date, title, type, themeKey, href: pageHref(teamId, date, title, slug), pageSlug: slug };
}

function context(): DigestContext {
  return {
    window: WINDOW,
    teams: teamById,
    upcoming: [
      upcoming('florida-panthers', '2026-11-12', 'Military Appreciation Night'),
      upcoming('pittsburgh-penguins', '2026-12-06', 'Star Wars Night', 'star-wars'),
      upcoming('florida-panthers', '2026-11-21', 'Hockey Fights Cancer Night'),
      upcoming('charlotte-hornets', '2027-01-25', 'Star Wars Night', 'star-wars'),
      upcoming('washington-capitals', '2027-02-16', 'Star Wars Night', 'star-wars'),
    ].sort((a, b) => a.date.localeCompare(b.date)),
    windowEntries: 41,
    windowGiveawayEntries: 17,
  };
}

/** A week for the Panthers and Heat, the hero candidate first. */
function week(withHero: boolean): DigestPromo[] {
  seq = 0;
  return [
    promo('florida-panthers', '2026-11-04', 'Star Wars Night', { imageTier: withHero ? 1 : 3, themeKey: 'star-wars', quantity: 'First 10,000 fans' }),
    promo('miami-heat', '2026-11-06', 'Heat Culture Tee Night', { type: 'giveaway', typeLabel: 'Giveaway', opponent: 'Hornets', venueName: 'Kaseya Center', quantity: 'First 5,000 fans' }),
    // Same team, same date: one entry, the food deal leading (type order).
    promo('florida-panthers', '2026-11-08', 'Family Sunday: $2 hot dogs', { type: 'food', typeLabel: 'Food Deal', opponent: 'Bruins', time: '5:00 PM' }),
    promo('florida-panthers', '2026-11-08', 'Kids Club Skate', { type: 'kids', typeLabel: 'Kids', opponent: 'Bruins', time: '5:00 PM' }),
  ];
}

/** Proxy promos for a quiet Lightning fan: nearby Panthers and Heat rows. */
const PROXY_TEAM = ['tampa-bay-lightning'];
const PROXY_NAMES = ['Tampa Bay Lightning'];

async function builders() {
  return import('../email');
}

beforeEach(() => {
  delete process.env.TICKETNETWORK_EMAIL_APPROVED;
});

type Case = { name: string; build: () => Promise<{ html: string; text: string; hero: DigestPromo | null }> };

const CASES: Case[] = [
  {
    name: 'personalized-hero',
    build: async () => (await builders()).buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: week(true), total: 4, teamIds: ['florida-panthers', 'miami-heat'], context: context() }),
  },
  {
    name: 'personalized-nohero',
    build: async () => (await builders()).buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: week(false), total: 4, teamIds: ['florida-panthers', 'miami-heat'], context: context() }),
  },
  {
    name: 'generic-hero',
    build: async () => (await builders()).buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: week(true), context: context() }),
  },
  {
    name: 'generic-nohero',
    build: async () => (await builders()).buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: week(false), context: context() }),
  },
  {
    name: 'empty-hero',
    build: async () => (await builders()).buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'team-proxy', localPromos: week(true), featured: [], context: context() }),
  },
  {
    // national-fallback: the hero never fires there (spec v2), even with a
    // tier 1 photo in the set, so this is the empty variant's no-hero case.
    name: 'empty-nohero',
    build: async () => (await builders()).buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'national-fallback', localPromos: [], featured: week(true), context: context() }),
  },
];

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const count = (s: string, needle: string) => s.split(needle).length - 1;

// ── snapshots ───────────────────────────────────────────────────────────────

for (const c of CASES) {
  test(`golden: ${c.name}`, async () => {
    const { html, hero } = await c.build();
    assert.strictEqual(!!hero, c.name.endsWith('-hero'), `${c.name}: hero presence`);
    const file = join(FIXTURES, `digest-${c.name}.html`);
    if (process.env.UPDATE_DIGEST_GOLDEN === '1' || !existsSync(file)) {
      mkdirSync(FIXTURES, { recursive: true });
      writeFileSync(file, html);
      if (process.env.UPDATE_DIGEST_GOLDEN !== '1') assert.fail(`wrote missing golden ${file}; review it and re-run`);
      return;
    }
    assert.strictEqual(html, readFileSync(file, 'utf8'), `${c.name} drifted from its golden file`);
  });
}

// A tier 3 hero (the generated card, the single-promo rule): the case where the
// below-image block was missing before the 2026-11-05 ruling.
test('golden: personalized-hero-card', async () => {
  const { buildPersonalizedDigest } = await builders();
  seq = 0;
  const lone = promo('florida-panthers', '2026-11-04', 'Hockey Night', { imageTier: 3 });
  const { html, hero } = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: [lone], total: 1, teamIds: ['florida-panthers', 'miami-heat'], context: context() });
  assert.strictEqual(hero, lone);
  const file = join(FIXTURES, 'digest-personalized-hero-card.html');
  if (process.env.UPDATE_DIGEST_GOLDEN === '1' || !existsSync(file)) {
    writeFileSync(file, html);
    if (process.env.UPDATE_DIGEST_GOLDEN !== '1') assert.fail(`wrote missing golden ${file}; review it and re-run`);
    return;
  }
  assert.strictEqual(html, readFileSync(file, 'utf8'), 'personalized-hero-card drifted from its golden file');
});

// ── no-promo week (ruling 2026-11-05: send, never skip) ────────────────────

async function noPromoBuilds() {
  const { buildGenericDigest, buildEmptyWindowDigest } = await builders();
  return {
    generic: buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: [], context: context() }),
    empty: buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'national-fallback', localPromos: [], featured: [], context: context() }),
  };
}

test('golden: generic-nopromos', async () => {
  const { generic } = await noPromoBuilds();
  const file = join(FIXTURES, 'digest-generic-nopromos.html');
  if (process.env.UPDATE_DIGEST_GOLDEN === '1' || !existsSync(file)) {
    writeFileSync(file, generic.html);
    if (process.env.UPDATE_DIGEST_GOLDEN !== '1') assert.fail(`wrote missing golden ${file}; review it and re-run`);
    return;
  }
  assert.strictEqual(generic.html, readFileSync(file, 'utf8'), 'generic-nopromos drifted from its golden file');
});

test('a no-promo week sends the line and three collection links, and no rows, hero or lead-in', async () => {
  const { NO_PROMOS_LINE, NO_PROMOS_LINE_GENERIC } = await import('../digest-email');
  const { generic, empty } = await noPromoBuilds();
  for (const [name, b, line] of [['generic', generic, NO_PROMOS_LINE_GENERIC], ['empty', empty, NO_PROMOS_LINE]] as const) {
    assert.strictEqual(b.hero, null, `${name}: no hero`);
    assert.ok(b.html.includes(`>${line}</td>`), `${name}: the line`);
    assert.ok(b.text.includes(line), `${name}: the line in text`);
    for (const [label, path] of [['Hot this week', '/promos/this-week'], ['Bobbleheads', '/promos/bobbleheads'], ['Theme nights', '/promos/theme-nights']]) {
      assert.ok(b.html.includes(`href="${SITE}${path}"`) && b.html.includes(`>${label}</a>`), `${name}: ${label} link`);
      assert.ok(b.text.includes(`${label}: ${SITE}${path}`), `${name}: ${label} in text`);
    }
    assert.ok(b.html.includes('bgcolor="#F3F2EE"'), `${name}: the Coming up panel style`);
    assert.ok(!b.html.includes('Around the league this week') && !b.html.includes('Nearby this week'), `${name}: no lead-in without rows`);
    assert.ok(!/subId1=web_email_(generic|empty)_/.test(b.html), `${name}: no promo rows`);
    assert.ok(b.html.includes('Get the app') && b.html.includes('Unsubscribe'), `${name}: the rest of the email still renders`);
  }
  assert.ok(!generic.html.includes('for your teams'), 'generic follows no teams');
});

test('the no-promo block is absent whenever any promo renders', async () => {
  const { NO_PROMOS_LINE, NO_PROMOS_LINE_GENERIC } = await import('../digest-email');
  for (const c of CASES) {
    const { html, text } = await c.build();
    for (const l of [NO_PROMOS_LINE, NO_PROMOS_LINE_GENERIC]) {
      assert.ok(!html.includes(l) && !text.includes(l), `${c.name}: no-promo line with promos present`);
    }
    assert.ok(!html.includes(`href="${SITE}/promos/bobbleheads"`), `${c.name}: collection links with promos present`);
  }
  // A lone tier 3 promo that heroes: no rows below it, still not a no-promo week.
  const { buildPersonalizedDigest } = await builders();
  seq = 0;
  const lone = promo('florida-panthers', '2026-11-04', 'Hockey Night');
  const b = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: [lone], total: 1, teamIds: ['florida-panthers'], context: context() });
  assert.ok(b.hero && !b.html.includes(NO_PROMOS_LINE));
});

// ── links ───────────────────────────────────────────────────────────────────

// The renderer side of the rule: it builds no promo path of its own, only
// makes the producers' hrefs absolute. The producers themselves (the window
// join and upcomingLinks) are tested against promoPageHref in
// digest-data.test.ts.
test('the renderer emits only the hrefs it was given, tagged with the surface subId1', async () => {
  for (const c of CASES) {
    const { html } = await c.build();
    const surface = c.name.startsWith('personalized') ? 'web_email_personalized' : c.name.startsWith('generic') ? 'web_email_generic' : 'web_email_empty';
    for (const h of hrefs(html)) {
      if (!h.startsWith(SITE)) assert.fail(`${c.name}: off-site link ${h}`);
      const path = h.slice(SITE.length);
      if (path.startsWith('/preferences?') || path.startsWith('/download?')) continue;
      const m = /^([^?]+)\?subId1=([a-z0-9_-]+)$/.exec(path);
      assert.ok(m, `${c.name}: unexpected link shape ${h}`);
      assert.ok(PAGE_HREFS.has(m![1]), `${c.name}: ${m![1]} did not come from promoPageHref`);
      assert.ok(m![2].startsWith(`${surface}_`), `${c.name}: subId1 ${m![2]} is not ${surface}_{team}`);
    }
  }
});

test('zero partner-domain links in any variant while TICKETNETWORK_EMAIL_APPROVED is unset', async () => {
  for (const c of CASES) {
    const { html, text } = await c.build();
    for (const d of PARTNER_DOMAINS) {
      assert.strictEqual(count(html, d), 0, `${c.name}: ${d} in the HTML`);
      assert.strictEqual(count(text, d), 0, `${c.name}: ${d} in the text part`);
    }
  }
});

test('the gate is the exact string "true"', async () => {
  const { isTicketNetworkEmailApproved } = await builders();
  for (const v of [undefined, '', 'TRUE', '1', 'yes', 'true ']) {
    assert.strictEqual(isTicketNetworkEmailApproved({ TICKETNETWORK_EMAIL_APPROVED: v } as unknown as NodeJS.ProcessEnv), false, String(v));
  }
  assert.strictEqual(isTicketNetworkEmailApproved({ TICKETNETWORK_EMAIL_APPROVED: 'true' } as unknown as NodeJS.ProcessEnv), true);
});

test('gate on: exactly one lusg.net link, on the hero button, and none without a hero', async () => {
  process.env.TICKETNETWORK_EMAIL_APPROVED = 'true';
  for (const c of CASES) {
    const { html, text, hero } = await c.build();
    if (hero) {
      assert.strictEqual(count(html, 'lusg.net'), 1, `${c.name}: lusg.net count`);
      const ticket = hrefs(html).find((h) => h.includes('lusg.net'))!;
      assert.match(ticket, /subId1=web_email_(personalized|generic|empty)_florida-panthers/);
      assert.match(ticket, /subId3=star-wars-night/);
      assert.match(html, />Get tickets<\/a>/);
      assert.ok(!html.includes('See this game'), `${c.name}: the button became Get tickets`);
    } else {
      assert.strictEqual(count(html, 'lusg.net'), 0, `${c.name}: no hero, no ticket link`);
    }
    for (const d of ['evyy.net', 'spothero.com', 'expedia.com']) assert.strictEqual(count(html, d), 0, `${c.name}: ${d}`);
    assert.strictEqual(count(text, 'lusg.net'), 0, `${c.name}: the text part keeps the promo page`);
  }
});

test('gate on: a club TicketNetwork does not list keeps "See this game"', async () => {
  process.env.TICKETNETWORK_EMAIL_APPROVED = 'true';
  const ctx = context();
  const teams = new Map(ctx.teams);
  teams.set('florida-panthers', { ...teams.get('florida-panthers')!, tnHomeUnavailable: true });
  const { buildPersonalizedDigest } = await builders();
  const { html, hero } = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: week(true), total: 4, teamIds: ['florida-panthers'], context: { ...ctx, teams } });
  assert.ok(hero);
  assert.strictEqual(count(html, 'lusg.net'), 0);
  assert.match(html, />See this game<\/a>/);
});

// ── size and text ───────────────────────────────────────────────────────────

test('HTML stays under 102KB with 12 promos', async () => {
  const { buildPersonalizedDigest, buildGenericDigest } = await builders();
  const { GMAIL_CLIP_BYTES } = await import('../digest-email');
  seq = 0;
  const twelve = Array.from({ length: 12 }, (_, i) =>
    promo(i % 2 ? 'miami-heat' : 'florida-panthers', `2026-11-0${3 + (i % 7)}`, `Promo night number ${i + 1} with a longer title`, { imageTier: i === 0 ? 1 : 3, themeKey: i === 0 ? 'star-wars' : null, quantity: 'First 10,000 fans' }),
  ).sort((a, b) => a.date.localeCompare(b.date));
  for (const b of [
    buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: twelve, total: 12, teamIds: ['florida-panthers', 'miami-heat'], context: context() }),
    buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: twelve, context: context() }),
  ]) {
    const bytes = Buffer.byteLength(b.html, 'utf8');
    assert.ok(bytes < GMAIL_CLIP_BYTES, `${bytes} bytes is over the Gmail clip`);
  }
});

test('HTML stays under 102KB at the personalized cap of 40 rows', async () => {
  const { buildPersonalizedDigest } = await builders();
  const { GMAIL_CLIP_BYTES } = await import('../digest-email');
  seq = 0;
  const forty = Array.from({ length: 40 }, (_, i) =>
    promo(i % 2 ? 'miami-heat' : 'florida-panthers', `2026-11-0${3 + (i % 7)}`, `Promo night number ${i + 1} with a longer title than most`, { quantity: 'First 10,000 fans', venueName: 'Amerant Bank Arena' }),
  ).sort((a, b) => a.date.localeCompare(b.date));
  const b = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: forty, total: 55, teamIds: ['florida-panthers', 'miami-heat'], context: context() });
  const bytes = Buffer.byteLength(b.html, 'utf8');
  assert.ok(bytes < GMAIL_CLIP_BYTES, `${bytes} bytes at 40 rows is over the Gmail clip`);
});

test('Outlook: no anchor wraps a table and no anchor nests inside another', async () => {
  for (const c of CASES) {
    const { html } = await c.build();
    let depth = 0;
    for (const m of html.matchAll(/<(\/?)(a|table)\b/g)) {
      if (m[2] === 'a') {
        depth += m[1] ? -1 : 1;
        assert.ok(depth <= 1, `${c.name}: nested anchor`);
      } else if (!m[1]) {
        assert.strictEqual(depth, 0, `${c.name}: a <table> opens inside an <a>`);
      }
    }
    assert.strictEqual(depth, 0, `${c.name}: unbalanced anchors`);
  }
});

test('every row links all three cells to its promo page', async () => {
  const { html } = await CASES[1].build();
  const href = 'https://www.getpromonight.com/nba/miami-heat/promos/heat-culture-tee-night?subId1=web_email_personalized_miami-heat';
  // date rail, text block, thumbnail
  assert.strictEqual(count(html, `href="${href}"`), 3);
});

test('the plain-text part lists every promo, the hero included', async () => {
  for (const c of CASES) {
    const { text, hero } = await c.build();
    const set = c.name === 'empty-nohero' ? week(true) : week(c.name.endsWith('-hero'));
    const { collapseEntries } = await import('../digest-email');
    for (const p of set) assert.ok(text.includes(p.title), `${c.name}: ${p.title} missing from text`);
    for (const e of collapseEntries(set)) assert.ok(text.includes(`${SITE}${e.lead.href}?subId1=`), `${c.name}: ${e.lead.title} link missing from text`);
    if (hero) assert.ok(text.indexOf(hero.title) < text.indexOf(set.find((p) => p.title !== hero.title)!.title));
  }
});

// ── the hero rule and the sections ──────────────────────────────────────────

test('the hero is removed from the rows below it', async () => {
  const { html, hero } = await CASES[0].build();
  assert.ok(hero);
  // The hero links its page four times (image, button, Parking, Remind me);
  // a row for it would add three more (rail, text, thumbnail).
  const heroHref = `href="${SITE}${hero!.href}?subId1=web_email_personalized_florida-panthers"`;
  assert.strictEqual(count(html, heroHref), 4, 'the hero promo has no row');
  const { html: noHero } = await CASES[1].build();
  assert.strictEqual(count(noHero, heroHref), 3, 'without a hero it is an ordinary row');
});

test('the hero carries the team + type label above its title, in the row label style', async () => {
  for (const c of CASES) {
    const { html, hero } = await c.build();
    if (!hero) continue;
    const label = `>${`${hero.teamShort} · ${hero.typeLabel}`.toUpperCase()}</div>`;
    const at = html.indexOf(label);
    const titleAt = html.indexOf(`>${hero.title}</div>`);
    assert.ok(at > 0 && titleAt > at, `${c.name}: label sits above the hero title`);
    assert.ok(html.slice(html.lastIndexOf('<div', at), at).includes('font-size:11px;font-weight:600;letter-spacing:0.06em'), `${c.name}: row label style`);
  }
});

// ── same team, same date: one entry (review fix 2026-11-05) ───────────────

test('a giveaway and a theme night at one game are one entry with both names, never hero plus row', async () => {
  const { buildEmptyWindowDigest, buildPersonalizedDigest } = await builders();
  seq = 0;
  // The Cardinals send: the Suns' theme night and jersey giveaway, Nov 7.
  const theme = promo('florida-panthers', '2026-11-07', 'ORIGINATIV Night', { type: 'theme', typeLabel: 'Theme Night', opponent: 'Rockets', venueName: 'Amerant Bank Arena' });
  const jersey = promo('florida-panthers', '2026-11-07', 'Artist Collaboration Originativ Replica Jersey', { type: 'giveaway', typeLabel: 'Giveaway', imageTier: 1, opponent: 'Rockets', venueName: 'Amerant Bank Arena', quantity: 'First 5,000 fans' });
  for (const set of [[theme, jersey], [jersey, theme]]) {
    const b = buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'team-proxy', localPromos: set, featured: [], context: context() });
    assert.strictEqual(b.hero, jersey, 'the giveaway leads and heroes');
    assert.ok(b.html.includes('>Artist Collaboration Originativ Replica Jersey</div>'), 'giveaway is the title');
    assert.ok(b.html.includes('vs Rockets · 7:30 PM · Amerant Bank Arena · First 5,000 fans · ORIGINATIV Night'), 'the theme night appends to the game line');
    assert.ok(!b.html.includes('>ORIGINATIV Night</div>'), 'the theme night is not a row of its own');
    assert.ok(!b.html.includes(`${SITE}${theme.href}`), 'the entry links to the title promo only');
    assert.ok(!b.html.includes('Around the league') && !b.html.includes('NEARBY THIS WEEK'), 'one entry heroes, so no rows and no lead-in');
    assert.ok(b.text.includes('ORIGINATIV Night') && b.text.includes('Artist Collaboration Originativ Replica Jersey'));
  }
  // As a row (no tier 1 to hero, two entries): one row, both names.
  const t3 = { ...jersey, imageTier: 3 as const };
  const other = promo('miami-heat', '2026-11-09', 'Heat Culture Tee Night', { type: 'giveaway', typeLabel: 'Giveaway' });
  const r = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: [theme, t3, other], total: 3, teamIds: ['florida-panthers', 'miami-heat'], context: context() });
  assert.strictEqual(r.hero, null);
  assert.strictEqual(count(r.html, '>PANTHERS · GIVEAWAY</div>'), 1, 'one row for the game');
  assert.ok(r.html.includes('First 5,000 fans · ORIGINATIV Night'));
  assert.strictEqual(r.subject, 'Your teams this week: 2 promo nights', 'the count is entries, not promos');
});

test('the lead type order is the site category order', async () => {
  const { DIGEST_TYPE_ORDER, collapseEntries } = await import('../digest-email');
  const { RD_CATEGORY_ORDER } = await import('../../components/redesign/categories');
  assert.deepStrictEqual([...DIGEST_TYPE_ORDER], [...RD_CATEGORY_ORDER]);
  seq = 0;
  const kids = promo('florida-panthers', '2026-11-08', 'K', { type: 'kids' });
  const food = promo('florida-panthers', '2026-11-08', 'F', { type: 'food' });
  const theme = promo('florida-panthers', '2026-11-08', 'T', { type: 'theme' });
  const [e] = collapseEntries([kids, food, theme]);
  assert.strictEqual(e.lead, theme);
  assert.deepStrictEqual(e.others, [food, kids]);
  // Two giveaways: the tier 1 photo leads.
  const g1 = promo('florida-panthers', '2026-11-08', 'G1', { type: 'giveaway', imageTier: 3 });
  const g2 = promo('florida-panthers', '2026-11-08', 'G2', { type: 'giveaway', imageTier: 1 });
  assert.strictEqual(collapseEntries([g1, g2])[0].lead, g2);
  // Different team or different date stays apart.
  assert.strictEqual(collapseEntries([kids, promo('miami-heat', '2026-11-08', 'H'), promo('florida-panthers', '2026-11-09', 'N')]).length, 3);
});

test('"Coming up" collapses a game to one line with both names', async () => {
  const { buildPersonalizedDigest } = await builders();
  const ctx = context();
  ctx.upcoming = [...ctx.upcoming, upcoming('florida-panthers', '2026-11-12', 'Military Hat', null, 'giveaway')].sort((a, b) => a.date.localeCompare(b.date));
  const b = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: week(false), total: 4, teamIds: ['florida-panthers'], context: ctx });
  assert.ok(b.html.includes('Nov 12 · Military Hat · Military Appreciation Night'), 'giveaway leads, theme appended');
  assert.ok(b.html.includes('Nov 21 · Hockey Fights Cancer Night'), 'the second line is the next game, not the same one');
});

// ── subject lines (review fix 2026-11-05) ───────────────────────────────────

const BANNED = /\b(hottest|hot|promos|deal)\b/i;

test('subjects: the four shapes, singular and plural, no banned words', async () => {
  const { digestSubject } = await import('../digest-email');
  const panthers = { id: 'florida-panthers', short: 'Panthers' };
  const heat = { id: 'miami-heat', short: 'Heat' };
  const cases: [Parameters<typeof digestSubject>[0], string][] = [
    [{ variant: 'personalized', teams: [panthers], entries: 3, giveawayEntries: 2 }, 'Your Panthers week: 2 games with giveaways'],
    [{ variant: 'personalized', teams: [panthers], entries: 1, giveawayEntries: 1 }, 'Your Panthers week: 1 game with a giveaway'],
    [{ variant: 'personalized', teams: [panthers], entries: 2, giveawayEntries: 0 }, 'Your Panthers week: 2 promo nights'],
    [{ variant: 'personalized', teams: [panthers, heat], entries: 5, giveawayEntries: 3 }, 'Your teams this week: 5 promo nights'],
    [{ variant: 'personalized', teams: [panthers, heat], entries: 1, giveawayEntries: 1 }, 'Your teams this week: 1 promo night'],
    [{ variant: 'generic', windowEntries: 41, windowGiveawayEntries: 17 }, '17 giveaways across pro sports this week'],
    [{ variant: 'generic', windowEntries: 41, windowGiveawayEntries: 1 }, '1 giveaway across pro sports this week'],
    [{ variant: 'generic', windowEntries: 4, windowGiveawayEntries: 0 }, '4 promo nights across pro sports this week'],
    [{ variant: 'empty', teams: [panthers], level: 'team-proxy' }, 'Panthers are quiet this week. Here is what is nearby'],
    [{ variant: 'empty', teams: [heat], level: 'national-fallback' }, 'Heat is quiet this week. Here is what is on around the league'],
    [{ variant: 'empty', teams: [{ id: 'seattle-sounders', short: 'Seattle Sounders' }], level: 'team-proxy' }, 'Seattle Sounders are quiet this week. Here is what is nearby'],
    [{ variant: 'empty', teams: [{ id: 'inter-miami', short: 'Inter Miami' }], level: 'team-proxy' }, 'Inter Miami is quiet this week. Here is what is nearby'],
    [{ variant: 'empty', teams: [panthers, heat], level: 'national-fallback' }, 'Your teams are quiet this week. Here is what is on around the league'],
    [{ variant: 'no-promos', generic: false }, 'Nothing announced yet for your teams'],
    [{ variant: 'no-promos', generic: true }, 'Nothing announced yet this week'],
  ];
  for (const [input, want] of cases) {
    const got = digestSubject(input);
    assert.strictEqual(got, want);
    assert.ok(!BANNED.test(got), `banned word in "${got}"`);
    assert.ok(!got.includes('\u2014'), `em dash in "${got}"`);
  }
});

test('subjects: two consecutive windows with different counts never share a subject', async () => {
  const { buildPersonalizedDigest, buildGenericDigest } = await builders();
  seq = 0;
  const thisWeek = week(false);
  const nextWeek = [...week(false), promo('florida-panthers', '2026-11-09', 'Bobblehead Night', { type: 'giveaway' })];
  const one = (promos: DigestPromo[]) => buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos, total: promos.length, teamIds: ['florida-panthers'], context: context() }).subject;
  assert.notStrictEqual(one(thisWeek), one(nextWeek));
  assert.strictEqual(one(nextWeek), 'Your Panthers week: 2 games with giveaways');
  const gen = (n: number) => buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: week(false), context: { ...context(), windowGiveawayEntries: n } }).subject;
  assert.notStrictEqual(gen(17), gen(12));
});

test('subjects: every built variant, including the no-promo week, is free of banned words', async () => {
  const { buildGenericDigest, buildEmptyWindowDigest } = await builders();
  const subjects = (await Promise.all(CASES.map(async (c) => ((await c.build()) as unknown as { subject: string }).subject)));
  subjects.push(buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: [], context: context() }).subject);
  subjects.push(buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'national-fallback', localPromos: [], featured: [], context: context() }).subject);
  assert.deepStrictEqual(subjects, [
    'Your teams this week: 3 promo nights',
    'Your teams this week: 3 promo nights',
    '17 giveaways across pro sports this week',
    '17 giveaways across pro sports this week',
    'Lightning is quiet this week. Here is what is nearby',
    'Lightning is quiet this week. Here is what is on around the league',
    'Nothing announced yet this week',
    'Nothing announced yet for your teams',
  ]);
  for (const s of subjects) assert.ok(!BANNED.test(s), `banned word in "${s}"`);
});

test('images off: the hero with its img stripped still names the promo, team, date, game and building', async () => {
  for (const c of CASES) {
    const { html, hero } = await c.build();
    if (!hero) continue;
    const imagesOff = html.replace(/<img\b[^>]*>/g, '');
    assert.ok(!imagesOff.includes('<img'), `${c.name}: an img survived the strip`);
    assert.ok(!imagesOff.includes('alt="'), `${c.name}: the check must not lean on alt text`);
    for (const piece of [hero.title, hero.teamName, 'Wed Nov 4', 'vs Blackhawks', '7:30 PM', 'Amerant Bank Arena']) {
      assert.ok(imagesOff.includes(`${piece}`), `${c.name}: "${piece}" is gone with images off`);
    }
  }
  // A tier 3 hero (the generated card) gets the same block: single-promo week.
  const { buildPersonalizedDigest } = await builders();
  seq = 0;
  const lone = promo('florida-panthers', '2026-11-04', 'Hockey Night', { imageTier: 3 });
  const b = buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: [lone], total: 1, teamIds: ['florida-panthers'], context: context() });
  assert.strictEqual(b.hero, lone);
  const off = b.html.replace(/<img\b[^>]*>/g, '');
  assert.ok(off.includes('>Hockey Night</div>'), 'tier 3 hero title block');
  assert.ok(off.includes('Florida Panthers · Wed Nov 4 · vs Blackhawks · 7:30 PM · Amerant Bank Arena'), 'tier 3 hero meta line');
});

test('hero rule on entries: exactly one entry, else the earliest tier 1 lead, else none', async () => {
  const { pickHero, collapseEntries } = await import('../digest-email');
  const lead = (es: ReturnType<typeof collapseEntries<DigestPromo>>, set: DigestPromo[]) => pickHero(es) ? pickHero(collapseEntries(set))!.lead : null;
  seq = 0;
  const a = promo('florida-panthers', '2026-11-05', 'A');
  const b = promo('miami-heat', '2026-11-04', 'B', { imageTier: 1 });
  const c = promo('miami-heat', '2026-11-06', 'C', { imageTier: 1 });
  assert.strictEqual(lead(collapseEntries([a]), [a]), a, 'a single entry is the hero');
  assert.strictEqual(lead(collapseEntries([a, c, b]), [a, c, b]), b, 'earliest tier 1 wins');
  assert.strictEqual(pickHero(collapseEntries([a, promo('miami-heat', '2026-11-07', 'D')])), null, 'no tier 1, no hero');
  assert.strictEqual(pickHero(collapseEntries([a]), 3), null, 'one shown of four is not "exactly one"');
  assert.strictEqual(pickHero(collapseEntries([{ ...a, hasPage: false, promoId: null }])), null, 'no page, no hero');
  // Two promos at ONE game are one entry, so "exactly one" holds.
  const g = promo('florida-panthers', '2026-11-05', 'G', { type: 'giveaway' });
  assert.strictEqual(pickHero(collapseEntries([a, g]))!.lead, g, 'one game, two promos: the giveaway heroes');
});

test('no hero renders on national-fallback content, even a single tier 1 promo', async () => {
  const { buildEmptyWindowDigest } = await builders();
  seq = 0;
  const lone = promo('florida-panthers', '2026-11-04', 'Star Wars Night', { imageTier: 1, themeKey: 'star-wars' });
  const national = buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'national-fallback', localPromos: [], featured: [lone], context: context() });
  assert.strictEqual(national.hero, null);
  assert.ok(!national.html.includes('See this game'));
  assert.ok(!national.html.includes('at other clubs'.toUpperCase()), 'no hero, no sibling section');
  const proxy = buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: PROXY_TEAM, teamNames: PROXY_NAMES, level: 'team-proxy', localPromos: [lone], featured: [], context: context() });
  assert.strictEqual(proxy.hero, lone, 'the same promo heroes on team-proxy');
});

test('the empty-window lead-in matches the cascade level and appears nowhere else', async () => {
  const lead = { proxy: 'Nearby this week', national: 'Around the league this week' };
  const up = (l: string) => l.toUpperCase();
  for (const c of CASES) {
    const { html, text } = await c.build();
    if (c.name === 'empty-hero') {
      assert.ok(html.includes(`>${up(lead.proxy)}</div>`), 'team-proxy lead-in in the HTML');
      assert.ok(text.includes(lead.proxy));
      assert.ok(!html.includes(up(lead.national)));
    } else if (c.name === 'empty-nohero') {
      assert.ok(html.includes(`>${up(lead.national)}</div>`), 'national-fallback lead-in in the HTML');
      assert.ok(text.includes(lead.national));
      assert.ok(!html.includes(up(lead.proxy)));
    } else {
      for (const l of Object.values(lead)) {
        assert.ok(!html.includes(up(l)) && !html.includes(l), `${c.name}: lead-in "${l}" leaked`);
        assert.ok(!text.includes(l), `${c.name}: lead-in "${l}" leaked into text`);
      }
    }
  }
});

test('the lead-in is a section label in the COMING UP style, not a caption', async () => {
  const { html } = await CASES[5].build();
  const at = html.indexOf('>AROUND THE LEAGUE THIS WEEK</div>');
  assert.ok(at > 0);
  const tag = html.slice(html.lastIndexOf('<div', at), at);
  assert.ok(tag.includes('font-size:11px;font-weight:600;letter-spacing:0.08em') && tag.includes('color:#6B6861'), tag);
  assert.ok(!html.includes('font-size:13px;line-height:1.4;color:#6B6861;">Around the league'), 'not the old 13px sentence');
});

test('the lead-in sits after the ink rule, directly above the first row', async () => {
  const { html } = await CASES[5].build();
  const leadAt = html.indexOf('AROUND THE LEAGUE THIS WEEK');
  const firstRow = html.indexOf('HEAT · GIVEAWAY');
  assert.ok(leadAt > 0 && firstRow > leadAt);
});

test('"Coming up" shows the followed teams past the window, and never on generic', async () => {
  const per = await CASES[0].build();
  assert.ok(per.html.includes('Nov 12 · Military Appreciation Night'));
  assert.ok(per.html.includes('Nov 21 · Hockey Fights Cancer Night'));
  const gen = await CASES[2].build();
  assert.ok(!gen.html.includes('COMING UP'));
  // A quiet Lightning fan: Coming up reads THEIR team, which has nothing next.
  const empty = await CASES[4].build();
  assert.ok(!empty.html.includes('COMING UP'));
});

test('"at other clubs" needs a hero and two siblings', async () => {
  const withHero = await CASES[0].build();
  assert.ok(withHero.html.includes('STAR WARS AT OTHER CLUBS'));
  for (const name of ['Pittsburgh Penguins', 'Charlotte Hornets', 'Washington Capitals']) assert.ok(withHero.html.includes(name));
  const noHero = await CASES[1].build();
  assert.ok(!noHero.html.includes('AT OTHER CLUBS'));
  const { themeSiblings } = await import('../digest-email');
  const ctx = context();
  const one = { ...ctx, upcoming: ctx.upcoming.filter((u) => u.teamId !== 'charlotte-hornets' && u.teamId !== 'washington-capitals') };
  assert.deepStrictEqual(themeSiblings(one, { lead: withHero.hero!, others: [] }), [], 'one sibling is not enough');
});

test('copy: no em dashes, no superlatives, the spec titles', async () => {
  const titles: Record<string, string> = { personalized: 'This week for your teams', generic: 'Hot promos this week', empty: 'Nothing on the calendar for the Tampa Bay Lightning this week' };
  for (const c of CASES) {
    const { html, text } = await c.build();
    assert.ok(!html.includes('\u2014') && !text.includes('\u2014'), `${c.name}: em dash`);
    assert.ok(!/\b(cheapest|lowest|best deal|hottest|best)\b/i.test(html + text), `${c.name}: superlative in copy`);
    assert.ok(html.includes(`>${titles[c.name.split('-')[0]]}</h1>`), `${c.name}: title`);
  }
});

test('footer keeps its content and adds the disclosure; buttons meet 44px', async () => {
  for (const c of CASES) {
    const { html } = await c.build();
    assert.ok(html.includes('Unsubscribe'));
    assert.ok(html.includes(`${SITE}/preferences?token=${TOKEN}&amp;unsub=1`));
    assert.ok(html.includes('PromoNight may earn a commission on purchases through links in this email.'));
    assert.ok(html.includes('Kovalik Digital LLC, 1250 Wayzata Blvd E, Unit #1856, Wayzata, MN 55391'));
    assert.ok(html.includes(c.name.startsWith('generic') ? 'Star your teams to personalize' : 'Manage your teams'));
    // 13px top + 18px line + 13px bottom = 44px on both button kinds.
    assert.match(html, /padding:13px 16px;[^"]*line-height:18px;[^"]*">Get the app</, 'app button tap height');
    if (c.name.endsWith('-hero')) assert.match(html, /padding:13px 22px;[^"]*line-height:18px;[^"]*">See this game</, 'hero button tap height');
  }
});

test('List-Unsubscribe headers carry the recipient token on every variant', async () => {
  for (const c of CASES) {
    const b = (await c.build()) as unknown as { headers: Record<string, string> };
    assert.strictEqual(b.headers['List-Unsubscribe'], `<${SITE}/api/unsubscribe?token=${TOKEN}>`);
    assert.strictEqual(b.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  }
});
