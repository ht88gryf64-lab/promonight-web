// The per-promo page route (Phase 3b), end to end on the server side: a fake
// Firestore holding an NHL-shaped corpus, the real data module, the real
// resolver and context, the real view, the real metadata. Only the fonts, the
// building hub and the clock are stood in.
//
// THE GUARD (brief C.10): every indexable page rendered here links out to at
// least 8 distinct internal paths, and never to a page that is noindexed or
// tombstoned past its date. The fixture holds exactly those traps: a
// tombstoned past row, a tombstoned future row (indexable, but not a
// promotion the lists may name), a dateless row and a special-ticket row.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test 'src/app/*/*/promos/*/__tests__/promo-page.test.tsx'
// (a literal path fails: node --test reads [sport] as a glob character class).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'UTC';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T16:00:00Z') });
const TODAY = '2026-10-29';

type Data = Record<string, unknown>;
type Doc = { id: string; path: string; exists: true; data: () => Data; get: (f: string) => unknown; ref: { parent: { parent: { id: string } | null } } };

// ── a fake Firestore over a path -> data map ────────────────────────────────
const store = new Map<string, Data>();
const reads: string[] = [];
const ts = (iso: string) => ({ toDate: () => new Date(iso) });
function put(path: string, data: Data) {
  store.set(path, data);
}
function docAt(path: string): Doc {
  const seg = path.split('/');
  const data = store.get(path) ?? {};
  return { id: seg[seg.length - 1], path, exists: true, data: () => data, get: (f) => data[f], ref: { parent: { parent: seg.length >= 4 ? { id: seg[seg.length - 3] } : null } } };
}
function query(match: (path: string) => boolean, label: string): any {
  const clauses: [string, string, unknown][] = [];
  let order: string | null = null;
  const q: any = {
    where(field: string, op: string, value: unknown) {
      if (value === undefined) throw new Error('Unsupported field value: undefined');
      clauses.push([field, op, value]);
      return q;
    },
    orderBy(f: string) {
      order = f;
      return q;
    },
    limit: () => q,
    async get() {
      reads.push(label);
      let docs = [...store.keys()].filter(match).map(docAt);
      for (const [f, op, v] of clauses) {
        docs = docs.filter((d) => {
          const x = d.data()[f] as any;
          if (op === '==') return x === v;
          if (op === '>=') return typeof x === 'string' && x >= (v as string);
          if (op === '<=') return typeof x === 'string' && x <= (v as string);
          if (op === '!=') return x !== v;
          throw new Error(`unsupported op ${op}`);
        });
      }
      docs.sort((a, b) => (order ? String(a.data()[order]).localeCompare(String(b.data()[order])) : 0) || a.path.localeCompare(b.path));
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: Doc) => void) => docs.forEach(fn), data: () => ({ count: docs.length }) };
    },
  };
  return q;
}
const depth = (p: string) => p.split('/').length;
function collectionRef(base: string) {
  const prefix = base ? `${base}/` : '';
  const d = depth(`${prefix}x`);
  const q = query((p) => p.startsWith(prefix) && depth(p) === d, `${prefix}*`);
  q.doc = (id: string) => {
    const path = `${prefix}${id}`;
    return {
      path,
      async get() {
        reads.push(path);
        const data = store.get(path);
        return { id, exists: data !== undefined, data: () => data, get: (f: string) => data?.[f], ref: { parent: { parent: null } } };
      },
      collection: (sub: string) => collectionRef(`${path}/${sub}`),
    };
  };
  return q;
}
const db = {
  collection: (name: string) => collectionRef(name),
  collectionGroup: (name: string) => query((p) => { const s = p.split('/'); return s.length >= 2 && s[s.length - 2] === name; }, `group:${name}`),
};

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../../../lib/firebase.ts', import.meta.url).href, { namedExports: { db } });
mock.module(new URL('../../../../../../components/redesign/fonts-house.ts', import.meta.url).href, { namedExports: { archivoHouse: { variable: 'font-archivo-var' } } });

// The building hub, as stored: the Wild's arena, verified, with a sourced
// bag rule, two lots, a transit line and an outside-food rule. The real
// venue-hub loaders read it from the fake, through the published view.
put('venueHubs/xcel-energy-center', {
  slug: 'xcel-energy-center', name: 'Grand Casino Arena', formerNames: [{ name: 'Xcel Energy Center', sourceUrl: 'https://x/rename' }], city: 'St Paul', state: 'Minnesota', lat: 44.9448, lng: -93.101, verified: true,
  tenants: [{ teamId: 'minnesota-wild', league: 'NHL' }], parkingLots: [{ name: 'RiverCentre Ramp' }, { name: 'Lawson Ramp' }], publicTransit: { lines: ['Green Line'], notes: 'Green Line to Central Station, two blocks east.' },
  bagMaxDimensions: { unit: 'in', d: 6, w: 12, h: 12 }, clearBagRequired: false, outsideFoodAllowed: false,
  sources: { bagMaxDimensions: 'https://x/bag', clearBagRequired: 'https://x/bag', parkingLots: 'https://x/parking', 'publicTransit.notes': 'https://x/transit', 'publicTransit.lines': 'https://x/transit', outsideFoodAllowed: 'https://x/food' },
});

// ── the corpus ───────────────────────────────────────────────────────────────
const team = (id: string, city: string, name: string, league = 'NHL') =>
  put(`teams/${id}`, { league, city, name, abbreviation: name.slice(0, 3).toUpperCase(), primaryColor: 4279584564, secondaryColor: 4289075502, division: 'Central', sportSlug: league.toLowerCase(), ticketmasterSlug: id, ticketmasterAttractionId: '805974' });
team('minnesota-wild', 'Minnesota', 'Wild');
team('detroit-red-wings', 'Detroit', 'Red Wings');
team('anaheim-ducks', 'Anaheim', 'Ducks');
team('pittsburgh-penguins', 'Pittsburgh', 'Penguins');
team('dallas-stars', 'Dallas', 'Stars');
team('houston-dynamo', 'Houston', 'Dynamo', 'MLS');
put('venues/xcel-energy-center', { name: 'Grand Casino Arena', address: '199 W Kellogg Blvd, St Paul, MN 55102', lat: 44.9448, lng: -93.101, team: 'Minnesota Wild', sport: 'NHL', league: 'NHL', teamId: 'min' });
put('scannerState/NHL/hashes/minnesota-wild', { updatedAt: ts('2026-10-23T13:38:09.000Z') });

const UPDATED = '2026-10-29T17:29:54.000Z';
const promo = (teamId: string, id: string, over: Data) =>
  put(`teams/${teamId}/promos/${id}`, {
    date: '2026-10-29', time: '7:00 PM', opponent: 'Islanders', type: 'giveaway', title: 'Promo', description: '', highlight: false, icon: '', recurring: false,
    attendanceCap: null, presentedBy: null, whileSuppliesLast: null, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null, ticketPackageName: null,
    sourceUrl: 'https://www.nhl.com/wild/fans/giveaway-schedule', pageSeason: '2026-27', themeKey: 'none', imageTier: 3, updatedAt: ts(UPDATED), ...over,
  });
// The tier 1 single-date page, as stored on 2026-10-29.
promo('minnesota-wild', 'c7057219198efd77', { title: 'Blaze Orange Hat', pageSlug: 'blaze-orange-hat', description: 'All fans receive a blaze orange hat. Presented by Federal Ammunition.', presentedBy: 'Federal Ammunition', imageTier: 1, imageRef: 'promo-images/c7057219198efd77.png', imageSourceUrl: 'https://www.nhl.com/wild/fans/giveaway-schedule', imageCredit: 'Image: Minnesota Wild' });
// Siblings and traps on the Wild.
promo('minnesota-wild', 'a1', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', description: 'Pride Night at the arena.' });
promo('minnesota-wild', 'a2', { title: 'Hockey Fights Cancer Night', pageSlug: 'hockey-fights-cancer-night', type: 'theme', themeKey: 'hockey-fights-cancer', date: '2026-11-20', opponent: 'Bruins' });
promo('minnesota-wild', 'a3', { title: 'Winter Beanie', pageSlug: 'winter-beanie', date: '2026-12-05', opponent: 'Blackhawks', attendanceCap: 10000 });
promo('minnesota-wild', 'a4', { title: 'Tombstoned Past Hat', pageSlug: 'tombstoned-past-hat', date: '2026-10-20', tombstoned: true, tombstonedAt: ts('2026-10-21T12:00:00Z') });
promo('minnesota-wild', 'a5', { title: 'Removed Future Poster', pageSlug: 'removed-future-poster', date: '2026-11-30', tombstoned: true, tombstonedAt: ts('2026-10-05T21:46:46Z'), attendanceCap: 5000, description: 'First 5,000 fans receive a poster.' });
promo('minnesota-wild', 'a6', { title: 'Pride Night', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26', type: 'theme', themeKey: 'pride', date: '2026-03-10', updatedAt: ts('2026-03-01T00:00:00Z') });
promo('minnesota-wild', 'a7', { title: 'Scout Pack', pageSlug: 'scout-pack', ticketPackageRequired: true, ticketPackageName: 'Scout Pack' });
promo('minnesota-wild', 'a8', { title: 'Dateless Deal', pageSlug: 'dateless-deal', date: null, type: 'food' });
promo('minnesota-wild', 'a9', { title: 'Postseason Row', pageSlug: 'postseason-row', isPostseason: true, date: '2027-04-20' });
// A same-date, same-title twin under one slug: one game line, one Event.
promo('minnesota-wild', 't1', { title: 'Twin Night', pageSlug: 'twin-night', type: 'theme', date: '2026-12-20', opponent: 'Flames' });
promo('minnesota-wild', 't2', { title: 'Twin Night', pageSlug: 'twin-night', type: 'theme', date: '2026-12-20', opponent: 'Flames' });
// Outside NHL and NBA the stored flag is the extractor's guess: never a package.
promo('houston-dynamo', 'm1', { title: 'Family 4-Pack', pageSlug: 'family-4-pack', type: 'kids', date: '2026-11-07', opponent: 'Austin FC', ticketPackageRequired: true, ticketPackageName: 'Family Pack', sourceUrl: 'https://www.houstondynamofc.com/promos' });
// The multi-date series on the Red Wings, and a Pride Night there.
for (const [id, date, opp] of [['o1', '2026-10-29', 'Blackhawks'], ['o2', '2026-11-18', 'Bruins'], ['o3', '2026-12-11', 'NY Rangers']] as const) {
  promo('detroit-red-wings', id, { title: 'Original Six Matchup', pageSlug: 'original-six-matchup', type: 'theme', date, opponent: opp, description: 'Original Six matchup theme night.', updatedAt: ts(id === 'o2' ? '2026-10-30T09:00:00.000Z' : UPDATED) });
}
promo('detroit-red-wings', 'p1', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-05', opponent: 'Flyers' });
promo('anaheim-ducks', 'p2', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-12' });
for (const [id, date] of [['g2', '2026-11-01'], ['g2b', '2026-11-08'], ['g2c', '2026-11-15'], ['g2d', '2026-11-22'], ['g2e', '2026-11-29']] as const) {
  promo('anaheim-ducks', id, { title: 'Kids Socks Giveaway', pageSlug: 'kids-socks-giveaway', date, opponent: 'Sharks' });
}
promo('pittsburgh-penguins', 'p3', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-20' });
promo('pittsburgh-penguins', 'g3', { title: 'Lapel Pin Set', pageSlug: 'lapel-pin-set', date: '2026-11-05', attendanceCap: 7500 });
promo('dallas-stars', 'p4', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2027-01-05' });
promo('dallas-stars', 'g4', { title: 'Esa Lindell Bobblehead', pageSlug: 'esa-lindell-bobblehead', date: '2026-11-15', gateOpenTime: '5:30 PM', imageTier: 1, imageRef: 'promo-images/g4.png', imageCredit: 'Image: Dallas Stars' });

// ── helpers ──────────────────────────────────────────────────────────────────
async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const params = (sport: string, team: string, slug: string) => ({ params: Promise.resolve({ sport, team, slug }) });
const page = () => import('../page');
const jsonLd = (h: string): Record<string, any>[] => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")));
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
/** Distinct internal PATHNAMES the page links to (a fragment on the team page
 *  is the team page). The app-store route (/download) is a CTA, not an
 *  outbound content link, and is left out of the count. */
const internalLinks = (h: string): string[] =>
  [...new Set([...h.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => decode(m[1]).replace(/[#?].*$/, '')).filter((u) => u.startsWith('/') && !u.startsWith('/download')))].sort();
const is404 = (err: unknown) => String((err as { digest?: string }).digest ?? '').includes('404');
const articleChildren = (h: string): string[] => {
  const start = h.indexOf('<article ');
  const end = h.lastIndexOf('</article>');
  const inner = h.slice(h.indexOf('>', start) + 1, end);
  // Direct children: top-level tags of the article body.
  const out: string[] = [];
  let depth = 0;
  for (const m of inner.matchAll(/<\/?([a-z0-9]+)[^>]*?(\/?)>/g)) {
    const closing = m[0].startsWith('</');
    const selfClosing = m[2] === '/' || ['img', 'meta', 'link', 'br', 'input'].includes(m[1]);
    if (!closing && depth === 0) out.push(m[0]);
    if (!closing && !selfClosing) depth++;
    if (closing) depth--;
  }
  return out;
};

const NEVER_LINKED = ['/nhl/minnesota-wild/promos/tombstoned-past-hat', '/nhl/minnesota-wild/promos/removed-future-poster', '/nhl/minnesota-wild/promos/dateless-deal', '/nhl/minnesota-wild/promos/scout-pack', '/nhl/minnesota-wild/promos/postseason-row'];

async function render(sport: string, team: string, slug: string) {
  const { default: Page, generateMetadata } = await page();
  const h = await html(await Page(params(sport, team, slug)));
  const meta = await generateMetadata(params(sport, team, slug));
  return { h, meta };
}

function guard(h: string, name: string) {
  const links = internalLinks(h);
  assert.ok(links.length >= 8, `${name}: ${links.length} distinct internal links, need 8:\n${links.join('\n')}`);
  for (const bad of NEVER_LINKED) assert.ok(!links.includes(bad), `${name} links to ${bad}`);
  // One article, page-content, the ad region; no display:contents between it and the sections.
  assert.equal((h.match(/<article /g) ?? []).length, 1, `${name}: one article`);
  assert.match(h, /<article class="page-content[^"]*" data-ad-region="content">/);
  const kids = articleChildren(h);
  assert.ok(kids.length >= 6, `${name}: ${kids.length} direct children`);
  for (const k of kids) assert.ok(!/class="[^"]*\bcontents\b/.test(k) && !/display:\s*contents/.test(k), `${name}: display:contents child ${k}`);
  return links;
}

// ── tests ────────────────────────────────────────────────────────────────────

test('flag unset: the route is a 404 before any read, and the metadata is empty', async () => {
  delete process.env.PROMO_PAGES_LIVE;
  const { default: Page, generateMetadata } = await page();
  reads.length = 0;
  await assert.rejects(() => Page(params('nhl', 'minnesota-wild', 'blaze-orange-hat')), is404);
  assert.deepEqual(await generateMetadata(params('nhl', 'minnesota-wild', 'blaze-orange-hat')), {});
  assert.deepEqual(reads, []);
  process.env.PROMO_PAGES_LIVE = 'true';
});

test('unknown slug, unknown team and a wrong league segment are 404s', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { default: Page } = await page();
  await assert.rejects(() => Page(params('nhl', 'minnesota-wild', 'no-such-slug')), is404);
  await assert.rejects(() => Page(params('nhl', 'no-such-team', 'blaze-orange-hat')), is404);
  await assert.rejects(() => Page(params('mlb', 'minnesota-wild', 'blaze-orange-hat')), is404);
});

test('tier 1 single-date NHL page: H1, the stored photo, the head, the schema and the link guard', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h, meta } = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.match(h, /<h1 class="rd-display[^"]*">Blaze Orange Hat<\/h1>/);
  // Rulings 2026-10-29: the third crumb is Promos on every page; a single-date
  // page names the opponent once (the matchup line), not again under the date;
  // the secondary CTA row wraps rather than clips; a renamed building shows its
  // former name; a cross-team card names the club and never repeats the tile date.
  assert.match(h, /href="\/nhl\/minnesota-wild#promo-2026-10-29-blaze-orange-hat">Promos<\/a>/);
  assert.ok(!h.slice(h.indexOf('<header'), h.indexOf('</header>')).includes('<span class="block">vs Islanders</span>'), 'no repeated opponent line');
  assert.match(h, /<div class="flex flex-wrap gap-2"><a href="https:\/\/tracking\.spothero\.com[^"]*" class="flex h-11 min-w-\[104px\] flex-1 basis-0/);
  assert.match(h, /Formerly Xcel Energy Center\./);
  assert.ok(!/Dallas Stars · Nov 15/.test(h), 'cross-team card subtitle never repeats the tile date');
  assert.match(h, /<img src="https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/promonight\.firebasestorage\.app\/o\/promo-images%2Fc7057219198efd77\.png\?alt=media" alt="Blaze Orange Hat, the Minnesota Wild giveaway item"/);
  assert.match(h, /Image: Minnesota Wild/);
  assert.match(h, /Minnesota Wild vs Islanders/);
  assert.match(h, /Thursday, Oct 29, 2026 · 7:00 PM/);
  assert.match(h, /href="\/venues\/xcel-energy-center"[^>]*>Grand Casino Arena</);
  assert.match(h, /Presented by<\/span><span class="font-rd[^"]*">Federal Ammunition</);
  assert.match(h, /Get tickets<\/a>/);
  // The read date is the team's scan stamp, never the row's updatedAt.
  assert.match(h, /Source: <a href="https:\/\/www\.nhl\.com\/wild\/fans\/giveaway-schedule"[^>]*>nhl\.com<\/a><span> · read Oct 23, 2026<\/span>/);
  // Quick facts from the building: bag, transit, parking, outside food.
  assert.match(h, /Grand Casino Arena, quick facts/);
  for (const t of ['Max bag 12&quot; x 12&quot; x 6&quot;.', 'Green Line to Central Station', 'Lots: RiverCentre Ramp, Lawson Ramp.', 'No outside food or drink.']) assert.ok(h.includes(t), t);
  // Also at this game: Pride Night, never the special-ticket row.
  assert.match(h, /Also at this game/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/pride-night"/);
  // Next two: Nov 20 and Dec 5.
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/hockey-fights-cancer-night"/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/winter-beanie"/);
  // No theme: the league's other giveaways coming up (3), in the section 10 slot.
  assert.match(h, /More NHL giveaways coming up/);
  assert.match(h, /href="\/nhl\/dallas-stars\/promos\/esa-lindell-bobblehead"/);
  assert.match(h, /href="\/promos\/jersey-giveaways"/);
  const links = guard(h, 'blaze-orange-hat');
  for (const must of ['/nhl', '/nhl/minnesota-wild', '/venues/xcel-energy-center', '/promos/jersey-giveaways']) assert.ok(links.includes(must), must);

  assert.equal(meta.title, 'Blaze Orange Hat | Minnesota Wild Oct 29, 2026');
  assert.equal(meta.description, 'All fans receive a blaze orange hat. Presented by Federal Ammunition. Minnesota Wild vs Islanders, Oct 29, 2026 at Grand Casino Arena.');
  assert.equal(meta.alternates?.canonical, 'https://www.getpromonight.com/nhl/minnesota-wild/promos/blaze-orange-hat');
  const og = meta.openGraph as any;
  assert.equal(og.url, meta.alternates?.canonical);
  assert.equal(og.images[0].url, 'https://firebasestorage.googleapis.com/v0/b/promonight.firebasestorage.app/o/promo-images%2Fc7057219198efd77.png?alt=media');
  assert.equal(meta.robots, undefined);

  const ld = jsonLd(h);
  assert.deepEqual(ld.map((s) => s['@type']), ['WebPage', 'Event', 'FAQPage', 'BreadcrumbList']);
  assert.equal(ld[0].dateModified, UPDATED);
  assert.equal(ld[1].startDate, '2026-10-29');
  assert.equal(ld[1].location.name, 'Grand Casino Arena');
  assert.equal(ld[1].location.address.streetAddress, '199 W Kellogg Blvd, St Paul, MN 55102');
  assert.equal(ld[1].location.address.addressLocality, 'St Paul');
  assert.match(ld[1].offers.url, /^https:\/\/www\.ticketmaster\.com\/minnesota-wild-tickets\/artist\/805974/);
  assert.equal(ld[1].eventStatus, 'https://schema.org/EventScheduled');
  assert.deepEqual(ld[1].image, [og.images[0].url]);
  // One FAQ: no door time is stored, so "What time should I arrive?" does not exist.
  assert.equal(ld[2].mainEntity.length, 1);
  assert.equal(ld[2].mainEntity[0].name, 'Who presents the Blaze Orange Hat?');
  assert.equal(ld[3].itemListElement.length, 3);
});

test('a series with more than three dates shows the next three and folds the rest; every date stays in the FAQ and the Events', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h, meta } = await render('nhl', 'anaheim-ducks', 'kids-socks-giveaway');
  const header = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
  const open = header.slice(0, header.indexOf('<details'));
  const folded = header.slice(header.indexOf('<details'));
  assert.equal((open.match(/<li /g) ?? []).length, 3, 'three dates shown');
  assert.match(folded, /<summary[^>]*>\+2 more dates<\/summary>/);
  assert.equal((folded.match(/<li /g) ?? []).length, 2, 'two dates folded');
  for (const d of ['Sunday, Nov 1, 2026', 'Sunday, Nov 8, 2026', 'Sunday, Nov 15, 2026', 'Sunday, Nov 22, 2026', 'Sunday, Nov 29, 2026']) assert.ok(header.includes(d), d);
  assert.ok(open.includes('<span class="block">vs Sharks</span>'), 'a series names the opponent per date');
  assert.equal(meta.title, 'Kids Socks Giveaway | Anaheim Ducks 2026-27');
  const ld = jsonLd(h);
  assert.equal(ld.filter((s) => s['@type'] === 'Event').length, 5);
  const faq = ld.find((s) => s['@type'] === 'FAQPage');
  assert.ok(faq, 'a FAQPage');
  assert.match(faq!.mainEntity[0].acceptedAnswer.text, /^5 Anaheim Ducks home games this season: Nov 1, 2026, Nov 8, 2026, Nov 15, 2026, Nov 22, 2026, Nov 29, 2026\.$/);
  // The CTA row follows the header directly.
  assert.match(h, /<\/header><section class="mt-4 flex flex-col gap-2\.5"><a href="https:\/\/www\.ticketmaster\.com/);
});

test('multi-date series: a dates list in place of the game line, one Event per date, the season in the title, dateModified the latest row', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h, meta } = await render('nhl', 'detroit-red-wings', 'original-six-matchup');
  assert.match(h, /<h1 class="rd-display[^"]*">Original Six Matchup<\/h1>/);
  for (const d of ['Thursday, Oct 29, 2026', 'Wednesday, Nov 18, 2026', 'Friday, Dec 11, 2026']) assert.ok(h.includes(d), d);
  assert.ok(!h.includes('Detroit Red Wings vs Blackhawks</p>'), 'no single game line');
  assert.equal((h.slice(h.indexOf('<header'), h.indexOf('</header>')).match(/<li /g) ?? []).length, 3, 'three dates in the header');
  // The card is keyed on the page's latest stamp (o2, 2026-10-30T09:00Z), not the primary row's.
  assert.match(h, /<img src="\/api\/promo-card\/o1\?team=detroit-red-wings&amp;v=1793350800000" alt="Original Six Matchup: Detroit Red Wings, Oct 29, 2026" width="1200" height="630"/);
  assert.equal(meta.title, 'Original Six Matchup | Detroit Red Wings 2026-27');
  assert.equal((meta.openGraph as any).images[0].url, 'https://www.getpromonight.com/api/promo-card/o1?team=detroit-red-wings&v=1793350800000');
  assert.ok(!h.slice(h.indexOf('<header'), h.indexOf('</header>')).includes('<details'), 'three dates: nothing to fold');
  const ld = jsonLd(h);
  assert.deepEqual(ld.map((s) => s['@type']), ['WebPage', 'Event', 'Event', 'Event', 'FAQPage', 'BreadcrumbList']);
  assert.deepEqual(ld.slice(1, 4).map((e) => e.startDate), ['2026-10-29', '2026-11-18', '2026-12-11']);
  assert.equal(ld[0].dateModified, '2026-10-30T09:00:00.000Z');
  assert.match(ld[4].mainEntity[0].name, /Which games is Original Six Matchup on\?/);
  // No hub for the Red Wings in this fixture: no venue link, no quick facts; the
  // guard still clears 8 through the breadcrumb, the aggregator, the team's
  // next promos and the league block.
  assert.ok(!h.includes('quick facts'));
  guard(h, 'original-six-matchup');
});

test('theme match: the same promo at other clubs (3 to 5), one per club, and the previous edition under its suffixed slug', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h } = await render('nhl', 'minnesota-wild', 'pride-night');
  assert.match(h, /Same promo, other teams/);
  assert.match(h, /Pride at other clubs this season/);
  for (const t of ['detroit-red-wings', 'anaheim-ducks', 'pittsburgh-penguins', 'dallas-stars']) assert.match(h, new RegExp(`href="/nhl/${t}/promos/pride-night"`));
  assert.ok(!h.includes('More NHL theme nights coming up'));
  assert.match(h, /Previous edition/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/pride-night-2025-26"[^>]*>Pride Night 2025-26</);
  // Also at this game: the Blaze Orange Hat, never the special-ticket row.
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/blaze-orange-hat"/);
  guard(h, 'pride-night');
});

test('tombstoned before its date: the removed page, indexable, cancelled in the schema, no ticket CTA, the links kept', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h, meta } = await render('nhl', 'minnesota-wild', 'removed-future-poster');
  // PROMO_PAGE_DUMP=1 prints this render's header and image, the Gate A
  // tombstoned evidence: no production row was tombstoned with a slug yet.
  if (process.env.PROMO_PAGE_DUMP) console.log('[dump removed-future-poster]\n' + h.slice(h.indexOf('<article'), h.indexOf('</figure>') + 9) + '\n[meta] ' + JSON.stringify(meta) + '\n[jsonld] ' + JSON.stringify(jsonLd(h)));
  assert.match(h, /<h1 class="rd-display[^"]*">Removed Future Poster<\/h1>/);
  assert.match(h, /Removed from the Minnesota Wild schedule on Oct 5, 2026\./);
  assert.match(h, />Removed</);
  assert.ok(!h.includes('Get tickets'), 'no ticket CTA on a removed page');
  assert.match(h, /<img src="\/api\/promo-card\/a5\?team=minnesota-wild&amp;v=/);
  assert.match(h, /First 5,000 fans receive a poster\./);
  assert.equal(meta.robots, undefined);
  assert.match(String(meta.description), /^Removed from the Minnesota Wild schedule\. First 5,000 fans receive a poster\./);
  const ld = jsonLd(h);
  assert.equal(ld[1]['@type'], 'Event');
  assert.equal(ld[1].eventStatus, 'https://schema.org/EventCancelled');
  assert.equal(ld[1].offers, undefined);
  assert.equal(ld[0].dateModified, UPDATED);
  assert.match(ld[2].mainEntity[0].name, /still happening/);
  guard(h, 'removed-future-poster');
});

test('a same-date twin is one date, and a flagged row outside NHL and NBA is not a package', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const twin = await render('nhl', 'minnesota-wild', 'twin-night');
  assert.equal((twin.h.slice(twin.h.indexOf('<header'), twin.h.indexOf('</header>')).match(/<li /g) ?? []).length, 1, 'one game line');
  assert.deepEqual(jsonLd(twin.h).map((s) => s['@type']), ['WebPage', 'Event', 'BreadcrumbList']);
  assert.equal(twin.meta.title, 'Twin Night | Minnesota Wild Dec 20, 2026');
  const mls = await render('mls', 'houston-dynamo', 'family-4-pack');
  assert.match(mls.h, />Kids</);
  assert.ok(!mls.h.includes('Ticket package') && !mls.h.includes('ticket package'), 'no package copy outside NHL and NBA');
  assert.match(mls.h, /About this promotion/);
  // No scan stamp for the Dynamo in the fixture: no read date is claimed.
  assert.ok(!/· read /.test(mls.h), 'no read date without a scan stamp');
});

test('tombstoned past its date: noindex; a row with no date: noindex', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const past = await render('nhl', 'minnesota-wild', 'tombstoned-past-hat');
  assert.deepEqual(past.meta.robots, { index: false, follow: true });
  assert.match(past.h, /Removed from the Minnesota Wild schedule on Oct 21, 2026\./);
  const dateless = await render('nhl', 'minnesota-wild', 'dateless-deal');
  assert.deepEqual(dateless.meta.robots, { index: false, follow: true });
  assert.equal(dateless.meta.title, 'Dateless Deal | Minnesota Wild');
  assert.deepEqual(jsonLd(dateless.h).map((s) => s['@type']), ['WebPage', 'BreadcrumbList'], 'no Event without a date, no FAQ without a door time');
});

// ── Inbound stays OFF this phase (brief C.10) ───────────────────────────────
// Team rows, the aggregators, the homepage cards, the venue pages, the digest
// and the social feed keep their anchors until the flip. This static guard
// refuses a promo page path built anywhere outside the promo page family.
test('no surface outside the promo page family links to a promo page yet', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, relative } = await import('node:path');
  const ROOT = process.cwd();
  const ALLOWED = new Set(['src/lib/promo-pages.ts', 'src/lib/promo-page-copy.ts', 'src/components/promo-page/PromoPageView.tsx', 'src/app/[sport]/[team]/promos/[slug]/page.tsx', 'src/app/api/promo-card/[promoId]/route.tsx', 'src/app/sitemap.ts']);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== '__tests__' && name !== 'node_modules') walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
      const rel = relative(ROOT, full);
      if (ALLOWED.has(rel)) continue;
      const text = readFileSync(full, 'utf8');
      if (/promoPagePath\(|\/promos\/\$\{|getPromoPageSitemapEntries|from '@\/lib\/promo-pages'/.test(text)) offenders.push(rel);
    }
  };
  for (const dir of ['src/app', 'src/components', 'src/lib']) walk(join(ROOT, dir));
  assert.deepEqual(offenders, [], `promo page links outside the family:\n${offenders.join('\n')}`);
});

test('the sitemap section: upcoming pages only, one URL per page, lastmod the latest row, nothing with the flag off', async () => {
  const { getPromoPageSitemapEntries } = await import('@/lib/promo-pages');
  delete process.env.PROMO_PAGES_LIVE;
  assert.deepEqual(await getPromoPageSitemapEntries(TODAY), []);
  process.env.PROMO_PAGES_LIVE = 'true';
  const entries = await getPromoPageSitemapEntries(TODAY);
  const paths = entries.map((e) => e.path).sort();
  assert.ok(paths.includes('/nhl/minnesota-wild/promos/blaze-orange-hat'));
  assert.ok(paths.includes('/nhl/minnesota-wild/promos/scout-pack'), 'a special-ticket row has a page');
  assert.equal(paths.filter((p) => p === '/nhl/detroit-red-wings/promos/original-six-matchup').length, 1);
  for (const bad of ['/nhl/minnesota-wild/promos/tombstoned-past-hat', '/nhl/minnesota-wild/promos/removed-future-poster', '/nhl/minnesota-wild/promos/dateless-deal', '/nhl/minnesota-wild/promos/pride-night-2025-26', '/nhl/minnesota-wild/promos/postseason-row']) assert.ok(!paths.includes(bad), bad);
  assert.equal(entries.find((e) => e.path === '/nhl/detroit-red-wings/promos/original-six-matchup')?.lastModified?.toISOString(), '2026-10-30T09:00:00.000Z');
});
