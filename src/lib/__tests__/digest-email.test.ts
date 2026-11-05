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
function upcoming(teamId: string, date: string, title: string, themeKey: string | null = null): DigestUpcoming {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { teamId, date, title, themeKey, href: pageHref(teamId, date, title, slug), pageSlug: slug };
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
  };
}

/** A week for the Panthers and Heat, the hero candidate first. */
function week(withHero: boolean): DigestPromo[] {
  seq = 0;
  return [
    promo('florida-panthers', '2026-11-04', 'Star Wars Night', { imageTier: withHero ? 1 : 3, themeKey: 'star-wars', quantity: 'First 10,000 fans' }),
    promo('miami-heat', '2026-11-06', 'Heat Culture Tee Night', { typeLabel: 'Giveaway', opponent: 'Hornets', venueName: 'Kaseya Center', quantity: 'First 5,000 fans' }),
    promo('florida-panthers', '2026-11-08', 'Family Sunday: $2 hot dogs', { typeLabel: 'Food Deal', opponent: 'Bruins', time: '5:00 PM' }),
    promo('florida-panthers', '2026-11-08', 'Kids Club Skate', { typeLabel: 'Kids', opponent: 'Bruins', time: '5:00 PM' }),
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

// ── links ───────────────────────────────────────────────────────────────────

test('every promo link is a promoPageHref path, tagged with the surface subId1', async () => {
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

test('the plain-text part lists every promo, the hero included', async () => {
  for (const c of CASES) {
    const { text, hero } = await c.build();
    const set = c.name === 'empty-nohero' ? week(true) : week(c.name.endsWith('-hero'));
    for (const p of set) {
      assert.ok(text.includes(p.title), `${c.name}: ${p.title} missing from text`);
      assert.ok(text.includes(`${SITE}${p.href}?subId1=`), `${c.name}: ${p.title} link missing from text`);
    }
    if (hero) assert.ok(text.indexOf(hero.title) < text.indexOf(set.find((p) => p.title !== hero.title)!.title));
  }
});

// ── the hero rule and the sections ──────────────────────────────────────────

test('the hero is removed from the rows below it', async () => {
  const { html, hero } = await CASES[0].build();
  assert.ok(hero);
  // The hero's row eyebrow would be "PANTHERS · THEME NIGHT"; the no-hero
  // render of the same week has exactly that row.
  assert.strictEqual(count(html, '>PANTHERS · THEME NIGHT<'), 0, 'the hero promo has no row');
  const { html: noHero } = await CASES[1].build();
  assert.strictEqual(count(noHero, '>PANTHERS · THEME NIGHT<'), 1);
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

test('hero rule: exactly one promo, else the earliest tier 1 photo, else none', async () => {
  const { pickHero } = await import('../digest-email');
  seq = 0;
  const a = promo('florida-panthers', '2026-11-05', 'A');
  const b = promo('miami-heat', '2026-11-04', 'B', { imageTier: 1 });
  const c = promo('miami-heat', '2026-11-06', 'C', { imageTier: 1 });
  assert.strictEqual(pickHero([a]), a, 'a single promo is the hero');
  assert.strictEqual(pickHero([a, c, b]), b, 'earliest tier 1 wins');
  assert.strictEqual(pickHero([a, promo('miami-heat', '2026-11-07', 'D')]), null, 'no tier 1, no hero');
  assert.strictEqual(pickHero([a], 3), null, 'one shown of four is not "exactly one"');
  assert.strictEqual(pickHero([{ ...a, hasPage: false, promoId: null }]), null, 'no page, no hero');
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
  for (const c of CASES) {
    const { html, text } = await c.build();
    if (c.name === 'empty-hero') {
      assert.ok(html.includes(`>${lead.proxy}</td>`), 'team-proxy lead-in in the HTML');
      assert.ok(text.includes(lead.proxy));
      assert.ok(!html.includes(lead.national));
    } else if (c.name === 'empty-nohero') {
      assert.ok(html.includes(`>${lead.national}</td>`), 'national-fallback lead-in in the HTML');
      assert.ok(text.includes(lead.national));
      assert.ok(!html.includes(lead.proxy));
    } else {
      for (const l of Object.values(lead)) {
        assert.ok(!html.includes(l), `${c.name}: lead-in "${l}" leaked`);
        assert.ok(!text.includes(l), `${c.name}: lead-in "${l}" leaked into text`);
      }
    }
  }
});

test('the lead-in sits after the ink rule, directly above the first row', async () => {
  const { html } = await CASES[5].build();
  const leadAt = html.indexOf('Around the league this week');
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
  assert.deepStrictEqual(themeSiblings(one, withHero.hero), [], 'one sibling is not enough');
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

test('the subject lines are unchanged', async () => {
  const { buildPersonalizedDigest, buildGenericDigest, buildEmptyWindowDigest } = await builders();
  const ctx = context();
  assert.strictEqual(buildPersonalizedDigest({ email: 'a@example.com', manageToken: TOKEN, promos: week(false), total: 4, teamIds: [], context: ctx }).subject, "Your teams' promos this week on PromoNight");
  assert.strictEqual(buildGenericDigest({ email: 'a@example.com', manageToken: TOKEN, featured: [], context: ctx }).subject, "This week's hottest pro sports promos");
  assert.strictEqual(buildEmptyWindowDigest({ email: 'a@example.com', manageToken: TOKEN, teamIds: [], teamNames: [], level: 'national-fallback', localPromos: [], featured: [], context: ctx }).subject, 'Your teams are quiet this week on PromoNight');
});

test('List-Unsubscribe headers carry the recipient token on every variant', async () => {
  for (const c of CASES) {
    const b = (await c.build()) as unknown as { headers: Record<string, string> };
    assert.strictEqual(b.headers['List-Unsubscribe'], `<${SITE}/api/unsubscribe?token=${TOKEN}>`);
    assert.strictEqual(b.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  }
});
