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
// The eBay block (step 5a) needs the EPN campaign and a Browse API keyset to
// make its call; the call itself goes to the fake below (api.ebay.com).
process.env.NEXT_PUBLIC_EBAY_CAMPID = '5339000000';
process.env.EBAY_CLIENT_ID = 'app-id';
process.env.EBAY_CLIENT_SECRET = 'cert-id';
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T16:00:00Z') });
const TODAY = '2026-10-29';

type Data = Record<string, unknown>;
type Doc = { id: string; path: string; exists: true; data: () => Data; get: (f: string) => unknown; ref: { path: string; parent: { parent: { id: string } | null } } };

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
  return { id: seg[seg.length - 1], path, exists: true, data: () => data, get: (f) => data[f], ref: { path, parent: { parent: seg.length >= 4 ? { id: seg[seg.length - 3] } : null } } };
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
          if (op === '<') return typeof x === 'string' && x < (v as string);
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
// The team page the data guard renders loads the redesign face.
mock.module(new URL('../../../../../../components/redesign/fonts.ts', import.meta.url).href, { namedExports: { archivo: { variable: 'font-archivo' } } });

// The stored photos, as the route reads their size (src/lib/image-dimensions.ts):
// a PNG header naming 800x600, served for a range request.
const PNG_800x600 = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x03, 0x20, 0, 0, 0x02, 0x58, 8, 6, 0, 0, 0]);
const photoFetches: string[] = [];
const realFetch = globalThis.fetch;
// The eBay Browse API (step 5a): failing by default, so every page rendered
// here proves a failed call never throws; the eBay test swaps the handler.
let ebayHandler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response('', { status: 500 });
const ebayCalls: string[] = [];
let nwsHandler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response('', { status: 500 });
const nwsCalls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('https://api.ebay.com/')) {
    ebayCalls.push(url);
    return ebayHandler(url, init);
  }
  // The NWS (step 5b): failing by default, so every page within the forecast
  // window rendered here proves a failed call never throws; the forecast test
  // swaps the handler. Never the real network.
  if (url.startsWith('https://api.weather.gov/')) {
    nwsCalls.push(url);
    return nwsHandler(url, init);
  }
  if (!url.startsWith('https://firebasestorage.googleapis.com/')) return realFetch(input, init);
  photoFetches.push(`${url} ${new Headers(init?.headers).get('range')}`);
  return new Response(PNG_800x600, { status: 206, headers: { 'content-type': 'image/png' } });
}) as typeof fetch;

// The building hub, as stored: the Wild's arena, verified, with a sourced
// bag rule, two lots, a transit line and an outside-food rule. The real
// venue-hub loaders read it from the fake, through the published view.
put('venueHubs/xcel-energy-center', {
  slug: 'xcel-energy-center', name: 'Grand Casino Arena', formerNames: [{ name: 'Xcel Energy Center', sourceUrl: 'https://x/rename' }], city: 'St Paul', state: 'Minnesota', lat: 44.9448, lng: -93.101, verified: true,
  roof: 'fixed', roofDraft: true,
  tenants: [{ teamId: 'minnesota-wild', league: 'NHL' }], parkingLots: [{ name: 'RiverCentre Ramp' }, { name: 'Lawson Ramp' }], publicTransit: { lines: ['Green Line'], notes: 'Green Line to Central Station, two blocks east.' },
  bagMaxDimensions: { unit: 'in', d: 6, w: 12, h: 12 }, clearBagRequired: false, outsideFoodAllowed: false,
  sources: { bagMaxDimensions: 'https://x/bag', clearBagRequired: 'https://x/bag', parkingLots: 'https://x/parking', 'publicTransit.notes': 'https://x/transit', 'publicTransit.lines': 'https://x/transit', outsideFoodAllowed: 'https://x/food', roof: 'https://x/roof-source-never-shipped' },
  // Step 4 (Before you go): the per-field state and read time the pipeline
  // writes. Bag and parking rendered and dated (provenance rows); transit
  // sourced with no state and outside food rendered but not a provenance
  // class, so both reach the block through the union, undated.
  fieldStates: { bagMaxDimensions: 'rendered', clearBagRequired: 'rendered', parkingLots: 'rendered', outsideFoodAllowed: 'rendered' },
  observedAtByField: { bagMaxDimensions: '2026-10-07T14:30:16.621Z', clearBagRequired: '2026-10-07T14:30:16.621Z', parkingLots: '2026-10-08T09:00:00.000Z', outsideFoodAllowed: '2026-10-07T14:30:16.621Z' },
});
// The Ducks' building: verified and sourced like a legacy doc, with NO state
// map. Zero rendered fields, so the Ducks pages get no Before you go block
// and take the quick facts fallback (ruling 2026-11-08).
put('venueHubs/honda-center', {
  slug: 'honda-center', name: 'Honda Center', formerNames: [], city: 'Anaheim', state: 'California', lat: 33.8078, lng: -117.8765, verified: true,
  tenants: [{ teamId: 'anaheim-ducks', league: 'NHL' }], parkingLots: [{ name: 'Lot 1' }], bagMaxDimensions: { unit: 'in', d: 6, w: 14, h: 14 },
  sources: { bagMaxDimensions: 'https://x/ducks-bag', parkingLots: 'https://x/ducks-parking' },
});
// The gray club's building: one rendered, dated claim (the prohibition), the
// clear-bag answer in operator conflict (its value nulled, the pointer kept),
// transit held, and the lots rendered but never dated. Exactly one row.
put('venueHubs/gray-arena', {
  slug: 'gray-arena', name: 'Gray Arena', formerNames: [], city: 'Gray', state: 'Minnesota', lat: 45, lng: -93, verified: true,
  tenants: [{ teamId: 'gray-club', league: 'NHL' }], parkingLots: [{ name: 'Gray Lot A' }], publicTransit: { lines: ['Gray Line'], notes: 'Light rail to Gray Station.' },
  bagsProhibited: true, bagMaxDimensions: { unit: 'in', d: 3, w: 5, h: 9 }, clearBagRequired: null, bagPolicyUrl: 'https://x/gray-bag-policy',
  sources: { bagsProhibited: 'https://x/gray-bag', bagMaxDimensions: 'https://x/gray-bag', parkingLots: 'https://x/gray-parking', publicTransit: 'https://x/gray-transit' },
  fieldStates: { bagsProhibited: 'rendered', bagMaxDimensions: 'rendered', clearBagRequired: 'operator-conflict', parkingLots: 'rendered', publicTransit: 'held' },
  observedAtByField: { bagsProhibited: '2026-10-01T08:00:00.000Z', bagMaxDimensions: '2026-10-01T08:00:00.000Z' },
});
// The gray club's overlay: a sourced, dated gate rule in state rendered (the
// gates provenance row).
put('venueHubs/gray-arena/tenants/gray-club', {
  teamId: 'gray-club', league: 'NHL', displayName: 'Gray Club', verified: true,
  gatesOpen: { ruleText: 'Doors open 90 minutes before puck drop', minutesBefore: 90 },
  sources: { gatesOpen: 'https://x/gates' }, observedAtByField: { gatesOpen: '2026-10-10T12:00:00.000Z' }, fieldStates: { gatesOpen: 'rendered' },
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
team('phoenix-suns', 'Phoenix', 'Suns', 'NBA');
team('nashville-predators', 'Nashville', 'Predators');
team('new-york-islanders', 'New York', 'Islanders');
// A club whose colours both fail the theme gate (content floor, 2026-11-07):
// a mid-gray primary (neither white nor the ink clears 4.5:1 on it) and a
// white secondary (invisible on the cream ground). The page takes the house red.
put('teams/gray-club', { league: 'NHL', city: 'Gray', name: 'Club', abbreviation: 'GRY', primaryColor: 4286611584, secondaryColor: 4294967295, division: 'Central', sportSlug: 'nhl', ticketmasterSlug: 'gray-club', ticketmasterAttractionId: '805974' });
// The Wild's home games on the spine (content floor, "This game"): the game
// behind the Blaze Orange Hat, one before it and one after, so the position
// in the home schedule is 2 of 3. The stored promo time and opponent stay
// the display values (the join fills empty slots only).
const game = (id: string, date: string, away: string) =>
  put(`games/${id}`, { id, league: 'nhl', date, gameTime: '00:00', gameTimeTz: 'America/Chicago', homeTeamSlug: 'minnesota-wild', awayTeamSlug: away, venueName: 'Grand Casino Arena', status: 'scheduled', seasonType: 'regular' });
game('nhl-min-1', '2026-10-20', 'dallas-stars');
game('nhl-min-2', '2026-10-29', 'new-york-islanders');
game('nhl-min-3', '2026-12-28', 'detroit-red-wings');
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
promo('minnesota-wild', 'a1', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', description: 'Pride Night at the arena.', gateOpenTime: '5:30 PM' });
promo('minnesota-wild', 'a2', { title: 'Hockey Fights Cancer Night', pageSlug: 'hockey-fights-cancer-night', type: 'theme', themeKey: 'hockey-fights-cancer', date: '2026-11-20', opponent: 'Bruins' });
promo('minnesota-wild', 'a3', { title: 'Winter Beanie', pageSlug: 'winter-beanie', date: '2026-12-05', opponent: 'Blackhawks', attendanceCap: 10000, presentedBy: 'Great Clips', description: 'All fans receive a winter beanie.' });
// A second Wild giveaway in December (content floor: the building's other giveaways in the month).
promo('minnesota-wild', 'a10', { title: 'Holiday Scarf', pageSlug: 'holiday-scarf', date: '2026-12-18', opponent: 'Jets' });
// The gray club's one page (the house-red fallback).
promo('gray-club', 'gc1', { title: 'Gray Towel', pageSlug: 'gray-towel', date: '2026-11-09', opponent: 'Wild', description: 'All fans receive a gray towel.' });
promo('minnesota-wild', 'a4', { title: 'Tombstoned Past Hat', pageSlug: 'tombstoned-past-hat', date: '2026-10-20', tombstoned: true, tombstonedAt: ts('2026-10-21T12:00:00Z') });
promo('minnesota-wild', 'a5', { title: 'Removed Future Poster', pageSlug: 'removed-future-poster', date: '2026-11-30', tombstoned: true, tombstonedAt: ts('2026-10-05T21:46:46Z'), attendanceCap: 5000, description: 'First 5,000 fans receive a poster.' });
promo('minnesota-wild', 'a6', { title: 'Pride Night', pageSlug: 'pride-night-2025-26', pageSeason: '2025-26', type: 'theme', themeKey: 'pride', date: '2026-03-10', updatedAt: ts('2026-03-01T00:00:00Z') });
// A played special-ticket row (step 6, ux-review D3): not a promotion, so neither the archive nor the team page's count sees it.
promo('minnesota-wild', 'a7p', { title: 'Played Puck Package', pageSlug: 'played-puck-package', date: '2026-10-15', opponent: 'Flames', ticketPackageRequired: true, ticketPackageName: 'Puck Package', updatedAt: ts('2026-10-01T00:00:00Z') });
promo('minnesota-wild', 'a7', { title: 'Scout Pack', pageSlug: 'scout-pack', ticketPackageRequired: true, ticketPackageName: 'Scout Pack' });
// Two more package rows (2026-10-31): one with no stored name, one whose name
// already ends in "Ticket Package" (the shape that used to read "... Ticket
// Package ticket package.").
promo('minnesota-wild', 'p1', { title: 'Puck Package Night', pageSlug: 'puck-package-night', type: 'theme', date: '2026-11-12', opponent: 'Kraken', ticketPackageRequired: true, ticketPackageName: null });
promo('minnesota-wild', 'p2', { title: 'Wizard Night', pageSlug: 'wizard-night', type: 'theme', date: '2026-11-14', opponent: 'Stars', ticketPackageRequired: true, ticketPackageName: 'Wizard Night Special Ticket Package' });
promo('minnesota-wild', 'a8', { title: 'Dateless Deal', pageSlug: 'dateless-deal', date: null, type: 'food' });
promo('minnesota-wild', 'a9', { title: 'Postseason Row', pageSlug: 'postseason-row', isPostseason: true, date: '2027-04-20' });
// A same-date, same-title twin under one slug: one game line, one Event.
promo('minnesota-wild', 't1', { title: 'Twin Night', pageSlug: 'twin-night', type: 'theme', date: '2026-12-20', opponent: 'Flames' });
promo('minnesota-wild', 't2', { title: 'Twin Night', pageSlug: 'twin-night', type: 'theme', date: '2026-12-20', opponent: 'Flames' });
// A club for the played state (ruling 2026-11-08): one page dated yesterday
// (a door time and a presenter stored, so the arrival and presenter FAQs
// would both be answerable), one dated tomorrow with the same fields, and
// the yesterday page's editions in the seasons either side.
// Food deals, so the club joins no cross-team cascade another fixture asserts on.
team('past-club', 'Past', 'Club');
promo('past-club', 'y1', { title: 'Yesterday Towel', pageSlug: 'yesterday-towel', type: 'food', date: '2026-10-28', opponent: 'Wild', gateOpenTime: '5:30 PM', presentedBy: 'Towel Co', description: 'Dollar dogs and a towel.' });
promo('past-club', 'y0', { title: 'Yesterday Towel', pageSlug: 'yesterday-towel-2025-26', pageSeason: '2025-26', type: 'food', date: '2026-03-02', opponent: 'Wild', updatedAt: ts('2026-02-01T00:00:00Z') });
promo('past-club', 'y2', { title: 'Yesterday Towel', pageSlug: 'yesterday-towel-2027-28', pageSeason: '2027-28', type: 'food', date: '2027-10-20', opponent: 'Wild' });
promo('past-club', 't1', { title: 'Tomorrow Towel', pageSlug: 'tomorrow-towel', type: 'food', date: '2026-10-30', opponent: 'Stars', gateOpenTime: '5:30 PM', presentedBy: 'Towel Co', description: 'Dollar dogs and a towel.' });
// An all-played series: two dates under one slug, both before today.
promo('past-club', 's1', { title: 'Two Nights', pageSlug: 'two-nights', type: 'food', date: '2026-10-20', opponent: 'Wild' });
promo('past-club', 's2', { title: 'Two Nights', pageSlug: 'two-nights', type: 'food', date: '2026-10-27', opponent: 'Stars' });
// A towel two seasons back (step 6): outside the index window, served noindex, in the archive.
promo('past-club', 'pc-ancient', { title: 'Ancient Towel', pageSlug: 'ancient-towel', pageSeason: '2023-24', type: 'food', date: '2024-03-01', opponent: 'Wild', updatedAt: ts('2024-03-02T00:00:00Z') });
// Outside NHL and NBA the stored flag is the extractor's guess: never a package.
promo('houston-dynamo', 'm1', { title: 'Family 4-Pack', pageSlug: 'family-4-pack', type: 'kids', date: '2026-11-07', opponent: 'Austin FC', ticketPackageRequired: true, ticketPackageName: 'Family Pack', sourceUrl: 'https://www.houstondynamofc.com/promos', description: 'Four tickets, four hot dogs and four drinks.' });
// The multi-date series on the Red Wings, and a Pride Night there.
for (const [id, date, opp] of [['o1', '2026-10-29', 'Blackhawks'], ['o2', '2026-11-18', 'Bruins'], ['o3', '2026-12-11', 'NY Rangers']] as const) {
  promo('detroit-red-wings', id, { title: 'Original Six Matchup', pageSlug: 'original-six-matchup', type: 'theme', date, opponent: opp, description: 'Original Six matchup theme night.', updatedAt: ts(id === 'o2' ? '2026-10-30T09:00:00.000Z' : UPDATED) });
}
// A tombstoned sibling under the series carries the newest stamp: the page
// and the card key on it.
promo('detroit-red-wings', 'o4', { title: 'Original Six Matchup', pageSlug: 'original-six-matchup', type: 'theme', date: '2027-01-09', opponent: 'Bruins', tombstoned: true, tombstonedAt: ts('2026-10-31T10:00:00.000Z'), updatedAt: ts('2026-10-31T10:00:00.000Z') });
promo('detroit-red-wings', 'p1', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-05', opponent: 'Flyers' });
// A series with two played dates and three to come, and one with one to come.
for (const [id, date] of [['c1', '2026-10-10'], ['c2', '2026-10-20'], ['c3', '2026-11-05'], ['c4', '2026-11-20'], ['c5', '2026-12-01']] as const) {
  promo('pittsburgh-penguins', id, { title: 'Community Night', pageSlug: 'community-night', type: 'theme', date, opponent: 'Rangers' });
}
for (const [id, date] of [['r1', '2026-10-05'], ['r2', '2026-10-15'], ['r3', '2026-10-25'], ['r4', '2026-11-10']] as const) {
  // A theme night, so the Stars' earliest upcoming GIVEAWAY stays the bobblehead the league block names.
  promo('dallas-stars', id, { title: 'Rally Towel', pageSlug: 'rally-towel', type: 'theme', date, opponent: 'Kings' });
}
promo('anaheim-ducks', 'p2', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-12' });
for (const [id, date] of [['g2', '2026-11-01'], ['g2b', '2026-11-08'], ['g2c', '2026-11-15'], ['g2d', '2026-11-22'], ['g2e', '2026-11-29']] as const) {
  promo('anaheim-ducks', id, { title: 'Kids Socks Giveaway', pageSlug: 'kids-socks-giveaway', date, opponent: 'Sharks' });
}
promo('pittsburgh-penguins', 'p3', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2026-11-20' });
promo('pittsburgh-penguins', 'g3', { title: 'Lapel Pin Set', pageSlug: 'lapel-pin-set', date: '2026-11-05', attendanceCap: 7500 });
promo('dallas-stars', 'p4', { title: 'Pride Night', pageSlug: 'pride-night', type: 'theme', themeKey: 'pride', date: '2027-01-05' });
promo('dallas-stars', 'g4', { title: 'Esa Lindell Bobblehead', pageSlug: 'esa-lindell-bobblehead', date: '2026-11-15', gateOpenTime: '5:30 PM', imageTier: 1, imageRef: 'promo-images/g4.png', imageCredit: 'Image: Dallas Stars' });
// ── the canonical rule (ruling 2026-10-29): the three ruled examples ─────────
// Suns Nov 7: a theme night and two tier 1 giveaways; the most specific tier 1
// giveaway, the jersey, is the canonical of all three.
const suns = (id: string, over: Data) => promo('phoenix-suns', id, { opponent: 'Lakers', sourceUrl: 'https://www.nba.com/suns/promotions', ...over });
suns('s1', { title: 'ORIGINATIV Night', pageSlug: 'originativ-night', type: 'theme', date: '2026-11-07' });
suns('s2', { title: 'ORIGINATIV', pageSlug: 'originativ', date: '2026-11-07', imageTier: 1, imageRef: 'promo-images/s2.png', imageSourceUrl: 'https://www.nba.com/suns/promotions', imageCredit: 'Image: Phoenix Suns' });
suns('s3', { title: 'Artist Collaboration Originativ Replica Jersey', pageSlug: 'artist-collaboration-originativ-replica-jersey', date: '2026-11-07', imageTier: 1, imageRef: 'promo-images/s3.png', imageSourceUrl: 'https://www.nba.com/suns/promotions', imageCredit: 'Image: Phoenix Suns' });
// Suns Nov 4: a theme night and a giveaway with no stored image; the longer
// title wins. The giveaway's slug was re-minted (the old slugifier dropped the
// accented letter), so its old slug lives in previousSlugs.
suns('s4', { title: 'Día de los Muertos Night', pageSlug: 'dia-de-los-muertos-night', type: 'theme', themeKey: 'dia-de-los-muertos', date: '2026-11-04', opponent: 'Nuggets' });
suns('s5', { title: 'Día de los Muertos', pageSlug: 'dia-de-los-muertos', themeKey: 'dia-de-los-muertos', previousSlugs: ['d-a-de-los-muertos'], date: '2026-11-04', opponent: 'Nuggets' });
// Ten more Suns nights (2026-10-31), so the Suns carry more upcoming rows than
// the team page shows before "Show all": the first orphan cause of
// 2026-10-31, which the data guard below must see.
for (const [i, [title, date]] of ([
  ['Noche Latina', '2026-11-20'], ['Hockey Watch Party Night', '2026-11-25'], ['Veterans Appreciation Night', '2026-12-01'],
  ['Holiday Sweater Night', '2026-12-15'], ['Kids Day', '2026-12-28'], ['Lunar New Year Night', '2027-01-29'],
  ['Black History Month Night', '2027-02-10'], ['Pride Night', '2027-03-05'], ['Fan Appreciation Night', '2027-04-02'], ['Fireworks Night', '2027-04-10'],
] as const).entries()) {
  suns(`sx${i}`, { title, pageSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), type: 'theme', date, opponent: 'Spurs' });
}
// A Suns bobblehead with no stored image (step 5a, 2026-11-08): the eBay
// block's page. Its own date, so the canonical rule leaves it alone.
suns('s9', { title: 'Devin Booker Bobblehead', pageSlug: 'devin-booker-bobblehead', date: '2026-12-20', opponent: 'Mavericks', attendanceCap: 5000, description: 'The first 5,000 fans receive a Devin Booker bobblehead.' });
// Seven played Suns nights (archive pass, step 6, 2026-11-08): the team page
// server-renders five of them and links the archive page for all seven.
for (const [i, [title, date]] of ([
  ['Ring Night', '2026-10-01'], ['Opening Night', '2026-10-03'], ['Legends Night', '2026-10-05'], ['Hispanic Heritage Night', '2026-10-07'],
  ['Pink Out', '2026-10-09'], ['Military Night', '2026-10-11'], ['Rally Towel', '2026-10-13'],
] as const).entries()) {
  suns(`sp${i}`, { title, pageSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), type: 'theme', date, opponent: 'Jazz' });
}
// Predators Nov 7: a theme night whose title contains the tier 1 giveaway's;
// the giveaway is the canonical.
promo('nashville-predators', 'n1', { title: 'Hometown Remix & Catfish Gravy Boat', pageSlug: 'hometown-remix-catfish-gravy-boat', type: 'theme', date: '2026-11-07', opponent: 'Blues', sourceUrl: 'https://www.nhl.com/predators/fans/promotions' });
promo('nashville-predators', 'n2', { title: 'Catfish Gravy Boat', pageSlug: 'catfish-gravy-boat', date: '2026-11-07', opponent: 'Blues', imageTier: 1, imageRef: 'promo-images/n2.png', imageSourceUrl: 'https://www.nhl.com/predators/fans/promotions', imageCredit: 'Image: Nashville Predators' });
// A series is never a duplicate: the Stars' four-date Rally Towel shares its
// last date with a more specific single-date night. In the upcoming index the
// series has ONE date left, which is the sitemap's trap.
promo('dallas-stars', 'r5', { title: 'Rally Towel Night', pageSlug: 'rally-towel-night', type: 'theme', date: '2026-11-10', opponent: 'Kings' });

// ── same-game pairs (rulings 2026-11-10, fix/gsc-cleanup-2026-11) ────────────
// The pipeline's two rows per game, theme and item or package, on the
// Islanders (a team with no other rows here).
const isles = (id: string, over: Data) => promo('new-york-islanders', id, { opponent: 'Rangers', sourceUrl: 'https://www.nhl.com/islanders/tickets/promotions', ...over });
// Rule 1, item named: both pages stay their own canonical and link each other.
isles('i1', { title: 'Elf Hat', pageSlug: 'elf-hat', date: '2026-12-12', description: 'Elf hat giveaway.' });
isles('i2', { title: 'ELF Night', pageSlug: 'elf-night', type: 'theme', date: '2026-12-12' });
// Rule 1, no item that sets the giveaway apart (the Ducks' real pair): the
// giveaway canonicals to the night.
isles('i3', { title: 'Hockey is for Everyone Giveaway', pageSlug: 'hockey-is-for-everyone-giveaway', date: '2027-01-14', attendanceCap: 10000 });
isles('i4', { title: 'Hockey is for Everyone Night', pageSlug: 'hockey-is-for-everyone-night', type: 'theme', date: '2027-01-14' });
// Rule 2: a special-ticket package beside its theme night (the Penguins' and
// Timberwolves' shape). The package page's title says so; the night does not
// link it (WEB6 G2); the package page links the night.
isles('i5', { title: '90s Night', pageSlug: '90s-night', type: 'theme', date: '2026-12-18' });
isles('i6', { title: '90s Night T-Shirt', pageSlug: '90s-night-t-shirt', type: 'theme', date: '2026-12-18', ticketPackageRequired: true, ticketPackageName: '90s Night T-Shirt Ticket Package' });
// Rule 2 past the budget: a long package name whose team shapes do not fit 60
// with the suffix. The title drops the suffix and the stored "Islanders"
// prefix, never the team (Gate 2 item 3).
isles('i7', { title: 'Hockey Fights Cancer Night', pageSlug: 'hockey-fights-cancer-night', type: 'theme', date: '2026-11-21' });
isles('i8', { title: 'Islanders Hockey Fights Cancer Lavender Warmup Jersey', pageSlug: 'islanders-hockey-fights-cancer-lavender-warmup-jersey', type: 'theme', date: '2026-11-21', ticketPackageRequired: true, ticketPackageName: 'Lavender Warmup Jersey' });

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
  assert.match(h, /<article class="page-content[^"]*" data-ad-region="content" style="--pp-accent:#[0-9a-f]{6};[^"]*">/);
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
  // The last crumb is this page's title, not a link (ruling 2026-11-08; it was
  // "Promos" linking to the team-page anchor until then); a single-date
  // page names the opponent once (the matchup line), not again under the date;
  // the secondary CTA row wraps rather than clips; a renamed building shows its
  // former name; a cross-team card names the club and never repeats the tile date.
  assert.match(h, /<span aria-current="page" class="[^"]*">Blaze Orange Hat<\/span><\/nav>/);
  assert.ok(!h.includes('#promo-2026-10-29-blaze-orange-hat'), 'no dead anchor into the team page');
  // The game line is a <time> with the Chicago offset, the zone after the time.
  assert.match(h, /<time dateTime="2026-10-29T19:00:00-05:00">Thursday, Oct 29, 2026 · 7:00 PM CT<\/time>/);
  assert.ok(!h.slice(h.indexOf('<header'), h.indexOf('</header>')).includes('<span class="block">vs Islanders</span>'), 'no repeated opponent line');
  assert.match(h, /<div class="[^"]*\bflex-wrap\b[^"]*"><a href="https:\/\/tracking\.spothero\.com[^"]*" class="[^"]*\bmin-w-\[104px\][^"]*"[^>]*aria-label="Reserve parking near Grand Casino Arena on SpotHero">Parking<\/a>/);
  // Same-team promos are the rail (step 3, 2026-11-07): a card per promo, the
  // mini date tile, the type icon through the sprite, the name; never the
  // opponent line and never the tile date twice.
  assert.match(h, /<a role="listitem" class="[^"]*" href="\/nhl\/minnesota-wild\/promos\/hockey-fights-cancer-night">[\s\S]*?FRI NOV<\/span><span class="rd-numerals[^"]*">20<\/span>[\s\S]*?<use href="#pn-icon-theme-night"><\/use>[\s\S]*?Hockey Fights Cancer Night<\/span><\/a>/);
  assert.match(h, /Grand Casino Arena<span>, formerly Xcel Energy Center<\/span>/);
  assert.ok(!/Dallas Stars · Nov 15/.test(h), 'cross-team card subtitle never repeats the tile date');
  assert.match(h, /<img src="https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/promonight\.firebasestorage\.app\/o\/promo-images%2Fc7057219198efd77\.png\?alt=media" alt="Blaze Orange Hat, the Minnesota Wild giveaway item"/);
  // The hero (follow-up 2026-10-31): the stored photo's own size from its
  // header, never lazy, high priority. og:image is the share card
  // (2026-11-03), 1200x630, never the photo's own size.
  assert.match(h, /<img src="https:\/\/firebasestorage[^"]*c7057219198efd77\.png\?alt=media" alt="[^"]*" width="800" height="600" loading="eager" fetchPriority="high" decoding="async"/);
  assert.ok(photoFetches.some((f) => f.includes('c7057219198efd77.png') && f.endsWith('bytes=0-65535')), photoFetches.join('\n'));
  assert.deepEqual([(meta.openGraph as any).images[0].width, (meta.openGraph as any).images[0].height], [1200, 630]);
  assert.ok(!/loading="lazy"/.test(h), 'no lazy image on the page');
  assert.match(h, /Image: Minnesota Wild/);
  assert.match(h, /Minnesota Wild vs Islanders/);
  assert.match(h, /Thursday, Oct 29, 2026 · 7:00 PM/);
  assert.match(h, /href="\/venues\/xcel-energy-center"[^>]*>Grand Casino Arena</);
  // The sponsor is a line inside About, never a tile (content floor, 2026-11-07);
  // this description already names it, so the name appears once in the body.
  assert.ok(!/Presented by<\/span>/.test(h), 'no Presented-by tile');
  assert.equal((h.slice(h.indexOf('<article'), h.lastIndexOf('</article>')).match(/Presented by Federal Ammunition\./g) ?? []).length, 1, 'once in the body (the schema descriptions aside)');
  assert.match(h, /Get tickets<\/a>/);
  // "Remind me" is the promo_cta surface (hotfix 2026-10-31): the team in src,
  // the promo id and page slug as their own params, never team_cta.
  assert.match(h, /<a href="\/download\?src=promo_cta_minnesota-wild&amp;promoId=[A-Za-z0-9]+&amp;pageSlug=blaze-orange-hat"[^>]*>Remind me<\/a>/);
  assert.ok(!h.includes('team_cta_'), 'no team_cta link on a promo page');
  // The read date is the team's scan stamp, never the row's updatedAt.
  assert.match(h, /Source: <a href="https:\/\/www\.nhl\.com\/wild\/fans\/giveaway-schedule"[^>]*>nhl\.com<\/a><span> · checked Oct 23, 2026<\/span>/);
  // Before you go (step 4): the dated provenance rows plus the card's other
  // classes (the union, ruling 2026-11-08); the card itself is gone from
  // this page.
  assert.match(h, />Before you go<\/h2>/);
  assert.ok(!h.includes('quick facts'));
  for (const t of ['Max bag 12&quot; x 12&quot; x 6&quot;.', 'Green Line to Central Station, two blocks east. Lines: Green Line.', 'Lots: RiverCentre Ramp, Lawson Ramp.', 'No outside food or drink.']) assert.ok(h.includes(t), t);
  // Also at this game: Pride Night, never the special-ticket row.
  assert.match(h, /Also at this game/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/pride-night"/);
  // The rail: the next five by date (Nov 20, Dec 5, Dec 18, Dec 20 here), one sprite on the page.
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/hockey-fights-cancer-night"/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/winter-beanie"/);
  assert.equal((h.match(/role="listitem"/g) ?? []).length, 4, 'four rail cards');
  assert.equal((h.match(/<symbol id="pn-icon-/g) ?? []).length, 11, 'the sprite, once');
  // No theme: the league's other giveaways coming up (3), in the section 10 slot.
  assert.match(h, /More NHL giveaways coming up/);
  assert.match(h, /href="\/nhl\/dallas-stars\/promos\/esa-lindell-bobblehead"/);
  assert.match(h, /href="\/promos\/jersey-giveaways"/);
  const links = guard(h, 'blaze-orange-hat');
  for (const must of ['/nhl', '/nhl/minnesota-wild', '/venues/xcel-energy-center', '/promos/jersey-giveaways']) assert.ok(links.includes(must), must);

  assert.equal(meta.title, 'Blaze Orange Hat | Minnesota Wild Oct 29, 2026');
  // The structured lead, then whole source sentences that do not name the
  // promo (rulings 2026-10-31): "All fans receive a blaze orange hat." names
  // it, so the next sentence is taken.
  assert.equal(meta.description, 'Blaze Orange Hat: Minnesota Wild giveaway vs Islanders, Oct 29, 2026 at Grand Casino Arena. Presented by Federal Ammunition.');
  assert.equal(meta.alternates?.canonical, 'https://www.getpromonight.com/nhl/minnesota-wild/promos/blaze-orange-hat');
  const og = meta.openGraph as any;
  assert.equal(og.url, meta.alternates?.canonical);
  // The share card (2026-11-03) on og:image and twitter:image, keyed on the
  // page's stamp; the Event schema keeps the stored photo.
  assert.match(og.images[0].url, /^https:\/\/www\.getpromonight\.com\/api\/share-card\/[A-Za-z0-9]+\?team=minnesota-wild&v=\d+$/);
  assert.equal((meta.twitter as any).card, 'summary_large_image');
  assert.equal((meta.twitter as any).images[0].url, og.images[0].url);
  assert.equal(og.images[0].alt, 'Blaze Orange Hat: Minnesota Wild, Oct 29, 2026');
  assert.equal(meta.robots, undefined);

  const ld = jsonLd(h);
  assert.deepEqual(ld.map((s) => s['@type']), ['WebPage', 'Event', 'FAQPage', 'BreadcrumbList']);
  assert.equal(ld[0].dateModified, UPDATED);
  assert.equal(ld[1].startDate, '2026-10-29');
  assert.equal(ld[1].location.name, 'Grand Casino Arena');
  assert.equal(ld[1].location.address.streetAddress, '199 W Kellogg Blvd, St Paul, MN 55102');
  assert.equal(ld[1].location.address.addressLocality, 'St Paul');
  // offers.url follows the primary "Get tickets": TicketNetwork since the
  // event-link rulings of 2026-11-02 (performer page here: no game doc carries
  // a tnEventUrl in this fixture).
  assert.equal(ld[1].offers.url, 'https://ticketnetwork.lusg.net/c/7236189/120057/2322?u=https%3A%2F%2Fwww.ticketnetwork.com%2Fe%2Fperformers%2Fminnesota-wild-tickets&partnerpropertyid=8313917&MediaPartnerPropertyId=8313917&subId1=web_promo_page_minnesota-wild&subId3=blaze-orange-hat');
  assert.match(h, />Also on Ticketmaster<\/a>/);
  assert.equal(ld[1].eventStatus, 'https://schema.org/EventScheduled');
  // The Event image stays the stored photo, unchanged by the share card.
  assert.deepEqual(ld[1].image, ['https://firebasestorage.googleapis.com/v0/b/promonight.firebasestorage.app/o/promo-images%2Fc7057219198efd77.png?alt=media']);
  // One stored-field FAQ in the schema (no door time, so no arrival question);
  // the hat library's two are in the visible block only (ruling 2026-11-07).
  assert.deepEqual(ld[2].mainEntity.map((q: any) => q.name), ['Who presents the Blaze Orange Hat?']);
  assert.equal(ld[3].itemListElement.length, 3);
  assert.deepEqual(ld[3].itemListElement.map((i: any) => i.name), ['NHL', 'Minnesota Wild', 'Blaze Orange Hat']);
  assert.equal(ld[3].itemListElement[2].item, 'https://www.getpromonight.com/nhl/minnesota-wild/promos/blaze-orange-hat');
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
  assert.match(h, /<\/header><section class="[^"]*">(?:<div class="flex shrink-0 flex-col gap-1\.5">[\s\S]*?<\/div>)?<div class="flex min-w-0 flex-1 flex-col gap-2\.5"><div class="flex gap-2"><a href="https:\/\/ticketnetwork\.lusg\.net\/[^"]*"[^>]*aria-label="Get Anaheim Ducks tickets on TicketNetwork"/);
});

test('a series pads the open list to three with played dates, and a fold of played dates says "earlier"', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const pens = await render('nhl', 'pittsburgh-penguins', 'community-night');
  let header = pens.h.slice(pens.h.indexOf('<header'), pens.h.indexOf('</header>'));
  let open = header.slice(0, header.indexOf('<details'));
  assert.equal((open.match(/<li /g) ?? []).length, 3);
  for (const d of ['Thursday, Nov 5, 2026', 'Friday, Nov 20, 2026', 'Tuesday, Dec 1, 2026']) assert.ok(open.includes(d), d);
  assert.match(header, /<summary[^>]*>\+2 earlier dates<\/summary>/);
  const stars = await render('nhl', 'dallas-stars', 'rally-towel');
  header = stars.h.slice(stars.h.indexOf('<header'), stars.h.indexOf('</header>'));
  open = header.slice(0, header.indexOf('<details'));
  assert.equal((open.match(/<li /g) ?? []).length, 3, 'one upcoming date, padded with the two most recent played');
  for (const d of ['Thursday, Oct 15, 2026', 'Sunday, Oct 25, 2026', 'Tuesday, Nov 10, 2026']) assert.ok(open.includes(d), d);
  assert.match(header, /<summary[^>]*>\+1 earlier date<\/summary>/);
  assert.equal(stars.meta.title, 'Rally Towel | Dallas Stars 2026-27');
});

test('the card stamp is the page stamp: the newest row under the slug, tombstoned or not', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { getPromoCardRow } = await import('@/lib/promo-pages');
  const card = await getPromoCardRow('detroit-red-wings', 'o1');
  assert.ok(card);
  assert.equal(card!.updatedAt, '2026-10-31T10:00:00.000Z');
  assert.deepEqual(card!.seriesDates, ['2026-10-29', '2026-11-18', '2026-12-11'], 'live dates only');
  const { h } = await render('nhl', 'detroit-red-wings', 'original-six-matchup');
  // The card left the body (v2 prerequisite, 2026-11-07); the Event schema still carries it, on the same stamp.
  const events = jsonLd(h).filter((x) => x['@type'] === 'Event');
  assert.ok(events.length > 0 && events.every((e) => JSON.stringify(e.image).includes(`/api/promo-card/o1?team=detroit-red-wings&v=${Date.parse('2026-10-31T10:00:00.000Z')}`)), 'the Event schema keys the card on the same stamp');
});

test('multi-date series: a dates list in place of the game line, one Event per date, the season in the title, dateModified the latest row', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h, meta } = await render('nhl', 'detroit-red-wings', 'original-six-matchup');
  assert.match(h, /<h1 class="rd-display[^"]*">Original Six Matchup<\/h1>/);
  for (const d of ['Thursday, Oct 29, 2026', 'Wednesday, Nov 18, 2026', 'Friday, Dec 11, 2026']) assert.ok(h.includes(d), d);
  assert.ok(!h.includes('Detroit Red Wings vs Blackhawks</p>'), 'no single game line');
  assert.equal((h.slice(h.indexOf('<header'), h.indexOf('</header>')).match(/<li /g) ?? []).length, 3, 'three dates in the header');
  // Tier 3 (v2 prerequisite, 2026-11-07): the generated card is NOT in the body, so no image block at all;
  // it stays the Event image, keyed on the page's latest stamp (the tombstoned o4, 2026-10-31T10:00Z), not the primary row's.
  assert.ok(!h.includes('<figure'), 'no image block without a tier 1 photo');
  assert.ok(!h.includes('/api/promo-card/o1?team=detroit-red-wings&amp;v='), 'no card <img> in the body');
  for (const e of jsonLd(h).filter((x) => x['@type'] === 'Event')) assert.ok(JSON.stringify(e.image).includes('/api/promo-card/o1?team=detroit-red-wings&v=1793440800000'), 'Event image is the card on the page stamp');
  // The title cascade (ruling 2026-10-30): with the season the bare title is
  // 48, 61 rendered, so the full name alone is the shape taken.
  assert.equal(meta.title, 'Original Six Matchup | Detroit Red Wings');
  // og:image is the share card on the same stamp; the card stays the Event image.
  assert.equal((meta.openGraph as any).images[0].url, 'https://www.getpromonight.com/api/share-card/o1?team=detroit-red-wings&v=1793440800000');
  assert.ok(!h.slice(h.indexOf('<header'), h.indexOf('</header>')).includes('<details'), 'three dates: nothing to fold');
  const ld = jsonLd(h);
  assert.deepEqual(ld.map((s) => s['@type']), ['WebPage', 'Event', 'Event', 'Event', 'FAQPage', 'BreadcrumbList']);
  assert.deepEqual(ld.slice(1, 4).map((e) => e.startDate), ['2026-10-29', '2026-11-18', '2026-12-11']);
  assert.equal(ld[0].dateModified, '2026-10-31T10:00:00.000Z');
  assert.match(ld[4].mainEntity[0].name, /Which games is Original Six Matchup on\?/);
  // No hub for the Red Wings in this fixture: no venue link, no Before you go;
  // the guard still clears 8 through the breadcrumb, the aggregator, the
  // team's next promos and the league block.
  assert.ok(!h.includes('Before you go'));
  guard(h, 'original-six-matchup');
});

test('theme match: the same promo at other clubs (3 to 5), one per club, and the previous edition under its suffixed slug', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h } = await render('nhl', 'minnesota-wild', 'pride-night');
  assert.match(h, /Same promo, other teams/);
  assert.match(h, /Pride at other clubs this season/);
  for (const t of ['detroit-red-wings', 'anaheim-ducks', 'pittsburgh-penguins', 'dallas-stars']) assert.match(h, new RegExp(`href="/nhl/${t}/promos/pride-night"`));
  assert.ok(!h.includes('More NHL theme nights coming up'));
  // The editions block (archive pass, step 6): one row per prior edition, the
  // name and season on the row, after This game.
  assert.match(h, /Previous editions/);
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/pride-night-2025-26"[^>]*>(?:<img[^>]*>)?<span[^>]*><span[^>]*>Pride Night 2025-26</);
  assert.ok(h.indexOf('>This game</h2>') < h.search(/>Previous editions<\/h2>/), 'after This game');
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
  // No tier 1 photo, so no image block (v2 prerequisite); the card stays the schema image.
  assert.ok(!h.includes('<figure'), 'no image block on a removed page without a photo');
  assert.ok(JSON.stringify(jsonLd(h)).includes('/api/promo-card/a5?team=minnesota-wild&v='), 'the card stays in the schema');
  assert.match(h, /First 5,000 fans receive a poster\./);
  assert.equal(meta.robots, undefined);
  assert.equal(meta.description, 'Removed from the Minnesota Wild schedule: Removed Future Poster vs Islanders, Nov 30, 2026 at Grand Casino Arena. First 5,000 fans receive a poster.');
  const ld = jsonLd(h);
  assert.equal(ld[1]['@type'], 'Event');
  assert.equal(ld[1].eventStatus, 'https://schema.org/EventCancelled');
  assert.equal(ld[1].offers, undefined);
  assert.equal(ld[0].dateModified, UPDATED);
  assert.match(ld[2].mainEntity[0].name, /still happening/);
  guard(h, 'removed-future-poster');
});

test('package rows: "Comes with a special ticket package." on every one, the stored name on its own line, never doubled (ruling 2026-10-24)', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const article = (h: string) => h.slice(h.indexOf('<article '), h.lastIndexOf('</article>'));
  const SENTENCE = '>Comes with a special ticket package.</p>';
  const named = article((await render('nhl', 'minnesota-wild', 'wizard-night')).h);
  const scout = article((await render('nhl', 'minnesota-wild', 'scout-pack')).h);
  const unnamed = article((await render('nhl', 'minnesota-wild', 'puck-package-night')).h);
  for (const [name, h] of [['wizard-night', named], ['scout-pack', scout], ['puck-package-night', unnamed]] as const) {
    assert.equal(h.split(SENTENCE).length - 1, 1, `${name}: the sentence exactly once`);
    assert.match(h, />Ticket package</, `${name}: the badge`);
    // Review finding 5: the heading names the package, never a promo type.
    assert.match(h, />About this ticket package</, `${name}: the heading`);
    assert.ok(!/About this (theme night|giveaway|food deal|promotion)/.test(h), `${name}: no promo-type heading`);
    assert.ok(!/Comes with the /.test(h), `${name}: the old "Comes with the {name}" form is gone`);
    // The doubled wording cannot occur: no "ticket package" directly after another, in any case.
    assert.ok(!/ticket package(?:\s|<!-- -->)*ticket package/i.test(h), `${name}: doubled wording`);
    assert.ok(!/package(?:\s|<!-- -->)+ticket package/i.test(h), `${name}: "Package ticket package"`);
  }
  // With a stored name: on its own line, exactly as stored, nothing appended.
  assert.ok(named.includes('>Package: Wizard Night Special Ticket Package</p>'), 'the name line, as stored');
  assert.ok(scout.includes('>Package: Scout Pack</p>'));
  // Without one: no name line at all.
  assert.ok(!unnamed.includes('Package:'), 'no name line without a stored name');
  // The meta description of a package row says "ticket package".
  assert.match(String((await render('nhl', 'minnesota-wild', 'puck-package-night')).meta.description), /special ticket package/);
});

test('a same-date twin is one date, and a flagged row outside NHL and NBA is not a package', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const twin = await render('nhl', 'minnesota-wild', 'twin-night');
  assert.equal((twin.h.slice(twin.h.indexOf('<header'), twin.h.indexOf('</header>')).match(/<li /g) ?? []).length, 1, 'one game line');
  // A theme night with no themeKey takes the theme-night library entry; its FAQs are visible, never structured data.
  assert.deepEqual(jsonLd(twin.h).map((s) => s['@type']), ['WebPage', 'Event', 'BreadcrumbList']);
  assert.ok(twin.h.includes('Fan guide'), 'the guide renders');
  assert.equal(twin.meta.title, 'Twin Night | Minnesota Wild Dec 20, 2026');
  const mls = await render('mls', 'houston-dynamo', 'family-4-pack');
  assert.match(mls.h, />Kids</);
  assert.ok(!mls.h.includes('Ticket package') && !mls.h.includes('ticket package'), 'no package copy outside NHL and NBA');
  assert.match(mls.h, /About this promotion/);
  // No scan stamp for the Dynamo in the fixture: no read date is claimed.
  assert.ok(!/· checked /.test(mls.h), 'no read date without a scan stamp');
});

test('tombstoned past its date: noindex; a row with no date: noindex', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const past = await render('nhl', 'minnesota-wild', 'tombstoned-past-hat');
  assert.deepEqual(past.meta.robots, { index: false, follow: true });
  assert.match(past.h, /Removed from the Minnesota Wild schedule on Oct 21, 2026\./);
  const dateless = await render('nhl', 'minnesota-wild', 'dateless-deal');
  assert.deepEqual(dateless.meta.robots, { index: false, follow: true });
  assert.equal(dateless.meta.title, 'Dateless Deal | Minnesota Wild');
  // No Event without a date, no FAQPage without a stored-field FAQ: the food-deal library's FAQs stay out of the schema.
  assert.deepEqual(jsonLd(dateless.h).map((s) => s['@type']), ['WebPage', 'BreadcrumbList'], 'no Event without a date, no FAQ without a door time');
});

// ── The data guard (fix/promo-orphans-meta, 2026-10-31) ─────────────────────
// Every indexable promo URL in the sitemap is an href in its team page's
// server HTML. This replaces the Phase 3c static test that checked each
// surface IMPORTED promoPageHref: that test passed while 786 sitemap URLs had
// no inbound link on production (the rows past "Show all" mounted on click,
// and the ticket-package names were plain text), because importing the helper
// says nothing about which rows reach the HTML.
//
// Both sides are production code over the same stored docs: the sitemap's own
// getPromoPageSitemapEntries, and the team page's own promo read
// (getTeamPromos, then the route's package partition and date split) rendered
// as the whole RedesignTeamPage, through prerender. The route itself is not
// rendered (it also loads venues, games, playoffs and coverage); its wiring of
// these props is pinned by source below instead, so a route edit that drops or
// slices them fails here (review finding 3, 2026-10-31). The expected hrefs
// are the sitemap's paths, never promoPageHref's output, so the guard cannot
// agree with itself. The live twin, against a deployed host's real sitemap and
// team pages, is scripts/live/team-pages.live.test.ts.
async function teamPageHtml(teamId: string): Promise<{ html: string; upcoming: number; packagesAhead: number }> {
  const { getTeamBySlug, getTeamPromos, isTicketPackagePromo } = await import('@/lib/data');
  const { partitionTicketPackages, upcomingTicketPackages } = await import('@/lib/ticket-packages');
  const { splitPromosByDate, countPromosByType, teamDisplayName } = await import('@/lib/promo-helpers');
  const { resolveClaimMode } = await import('@/lib/season-scope');
  const { RedesignTeamPage } = await import('@/components/redesign/RedesignTeamPage');
  const team = (await getTeamBySlug(teamId))!;
  const all = await getTeamPromos(team.id);
  const { promos, ticketPackages } = partitionTicketPackages(all, isTicketPackagePromo, team.league);
  const { upcoming } = splitPromosByDate(promos, TODAY);
  const packagesAhead = upcomingTicketPackages(ticketPackages, TODAY);
  const out = await html(
    <RedesignTeamPage
      team={team}
      coverage={{ teamCount: 169, leagueList: 'MLB, NBA, NFL, NHL, MLS, and WNBA', appLeagueList: 'MLB, NBA, NHL, and MLS' } as never}
      venue={null}
      promos={promos}
      upcomingPromos={upcoming}
      upcomingCounts={countPromosByType(upcoming)}
      claim={resolveClaimMode(promos, team.league, TODAY)}
      displayName={teamDisplayName(team)}
      today={TODAY}
      recurringDeals={[]}
      playoffsActive={false}
      inPlayoffs={false}
      playoffPromos={[]}
      playoffRound=""
      playoffLastUpdated={null}
      ticketPackages={packagesAhead}
    />,
  );
  return { html: out, upcoming: upcoming.length, packagesAhead: packagesAhead.length };
}

test('share (2026-11-03): the share card on og:image and twitter:image on every variant; Share beside Get tickets and on the image; no subId2 in served HTML; Impact links carry subId1 + subId3', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const CARD = /^https:\/\/www\.getpromonight\.com\/api\/share-card\/[A-Za-z0-9_-]+\?team=[a-z0-9-]+&v=\d+$/;
  // The fifth column: whether the body carries the tier 1 photo (v2
  // prerequisite, 2026-11-07: without one there is no figure and no image icon).
  const variants: [string, string, string, 'live' | 'removed', 'photo' | 'none'][] = [
    ['nhl', 'minnesota-wild', 'blaze-orange-hat', 'live', 'photo'], // tier 1, single date
    ['nhl', 'detroit-red-wings', 'original-six-matchup', 'live', 'none'], // series, tier 3
    ['nhl', 'pittsburgh-penguins', 'community-night', 'live', 'none'], // series with played dates
    ['nhl', 'minnesota-wild', 'removed-future-poster', 'removed', 'none'], // tombstoned before its date
    ['nhl', 'minnesota-wild', 'tombstoned-past-hat', 'removed', 'none'], // tombstoned and played
  ];
  for (const [sport, team, slug, kind, body] of variants) {
    const { h, meta } = await render(sport, team, slug);
    const og = meta.openGraph as any;
    const tw = meta.twitter as any;
    assert.match(og.images[0].url, CARD, `${slug}: og:image`);
    assert.ok(og.images[0].url.includes(`team=${team}&`), `${slug}: the card names the team`);
    assert.deepEqual([og.images[0].width, og.images[0].height], [1200, 630], `${slug}: og:image size`);
    assert.equal(tw.card, 'summary_large_image', `${slug}: twitter:card`);
    assert.equal(tw.images[0].url, og.images[0].url, `${slug}: twitter:image`);
    assert.ok(og.title && og.description, `${slug}: og:title and og:description`);
    // The canonical stays the clean URL.
    assert.ok(!String(meta.alternates?.canonical).includes('?'), `${slug}: clean canonical`);
    // The Event schema never carries the share card.
    for (const e of jsonLd(h).filter((x) => x['@type'] === 'Event')) assert.ok(!JSON.stringify(e.image ?? '').includes('/api/share-card/'), `${slug}: Event image`);
    // Never subId2 in served HTML: it is added on the client, in a shared session only.
    assert.ok(!/subId2/i.test(h), `${slug}: no subId2 in the served HTML`);
    // subId3 (ruling 2026-11-04): every Impact link in the served HTML carries
    // subId1 unchanged and subId3 = the page slug, side by side.
    const impact = [...h.replace(/&amp;/g, '&').matchAll(/https:\/\/[a-z0-9.-]+\/c\/\d+\/\d+\/\d+\?[^"\s\\]+/g)].map((m) => m[0]);
    if (kind === 'live') assert.ok(impact.length >= 2, `${slug}: the Get tickets anchor and its JSON-LD offer at least`);
    for (const u of impact) {
      assert.match(new URL(u).searchParams.get('subId1') ?? '', /^web_promo_(page|date)_[a-z0-9-]+$/, `${slug}: subId1 ${u}`);
      assert.equal(new URL(u).searchParams.get('subId3'), slug, `${slug}: subId3 ${u}`);
    }
    const shares = (h.match(/aria-label="Share this promo"/g) ?? []).length;
    if (kind === 'removed') {
      assert.equal(shares, 0, `${slug}: no Share on a removed page`);
    } else {
      assert.equal(shares, body === 'photo' ? 2 : 1, `${slug}: the row Share${body === 'photo' ? ' and the image icon' : ' only (no image block without a tier 1 photo)'}`);
      // Tickets and Share on one row, tickets first and filling the width.
      assert.match(h, /<div class="flex gap-2"><a href="[^"]*"[^>]*class="flex h-\[52px\] min-w-0 flex-1 [^"]*bg-\[var\(--pp-accent\)\][^"]*"[^>]*>Get tickets<\/a><div class="relative shrink-0"><button type="button" aria-label="Share this promo"[^>]*class="flex h-\[52px\] [^"]*bg-white[^"]*text-rd-ink shadow-\[inset_0_0_0_1\.5px_var\(--color-rd-ink\)\][^"]*">/, `${slug}: the tickets + Share row (1.5px ink outline as an inset shadow)`);
      assert.match(h, /<span class="max-\[339px\]:sr-only">Share<\/span>/, `${slug}: the label hides at very narrow widths`);
      // The image icon: absolutely placed in the (now relative) figure, on a tier 1 photo only.
      if (body === 'photo') {
        assert.match(h, /<figure class="relative [^"]*">[\s\S]*?<div class="absolute right-2\.5 top-2\.5 z-10"><button type="button" aria-label="Share this promo"[^>]*class="flex h-10 w-10 [^"]*bg-white text-rd-ink shadow-\[inset_0_0_0_1\.5px_var\(--color-rd-ink\)/, `${slug}: the image icon`);
      } else {
        assert.ok(!h.includes('<figure'), `${slug}: no image block without a tier 1 photo`);
      }
      // Share is never brand red, and nothing about it is fixed or sticky.
      const shareMarkup = h.match(/<button type="button" aria-label="Share this promo"[^>]*>/g) ?? [];
      for (const b of shareMarkup) assert.ok(!/rd-red|\bfixed\b|\bsticky\b/.test(b), `${slug}: ${b}`);
    }
    // Still one article with its anchor children free of display:contents.
    assert.equal((h.match(/<article /g) ?? []).length, 1, `${slug}: one article`);
  }
});

test('data guard: every indexable promo URL in the sitemap is an href in its team page server HTML', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { getPromoPageSitemapEntries } = await import('@/lib/promo-pages');
  const entries = await getPromoPageSitemapEntries(TODAY);
  const byTeam = new Map<string, string[]>();
  for (const { path } of entries) {
    const teamId = path.split('/')[2];
    byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), path]);
  }
  // The route derives and passes exactly what teamPageHtml passes.
  const { readFileSync } = await import('node:fs');
  const route = readFileSync('src/app/[sport]/[team]/page.tsx', 'utf8');
  for (const wiring of [
    'const { promos, ticketPackages } = partitionTicketPackages(allPromos, isTicketPackagePromo, team.league);',
    'const { upcoming: upcomingPromos } = splitPromosByDate(promos, todayStr);',
    'const packagesAhead = upcomingTicketPackages(ticketPackages, todayStr);',
    'ticketPackages={packagesAhead}',
    'upcomingPromos={upcomingPromos}',
    'promos={promos}',
  ]) assert.ok(route.includes(wiring), `the team route no longer wires: ${wiring}`);
  const { UPCOMING_VISIBLE } = await import('@/components/promo-list');
  const seen = { collapsed: false, packages: false };
  const missing: string[] = [];
  for (const [teamId, paths] of byTeam) {
    const page = await teamPageHtml(teamId);
    // The fixture must exercise both orphan causes, or the guard proves nothing.
    if (page.upcoming > UPCOMING_VISIBLE) seen.collapsed = true;
    if (page.packagesAhead > 0) seen.packages = true;
    for (const p of paths) if (!page.html.includes(`href="${p}"`)) missing.push(p);
  }
  assert.ok(seen.collapsed, 'the fixture has a team with more upcoming rows than the page shows before "Show all"');
  assert.ok(seen.packages, 'the fixture has a team with upcoming ticket packages');
  assert.ok(entries.length >= 20, `${entries.length} sitemap entries`);
  assert.deepEqual(missing, [], `${missing.length} of ${entries.length} sitemap promo URLs have no href on their team page:\n${missing.join('\n')}`);
});

// The collapse stays visual: the rows past UPCOMING_VISIBLE and past the first
// four packages are in the HTML inside a closed <details>, never mounted on
// click, and a linked package row still says it comes with a special ticket.
test('team page: the extra upcoming rows and packages sit in closed <details>, rendered; package rows keep the special-ticket note', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const suns = (await teamPageHtml('phoenix-suns')).html;
  const details = suns.slice(suns.indexOf('<details class="group/upcoming'), suns.indexOf('</details>', suns.indexOf('<details class="group/upcoming')));
  assert.ok(details.length > 0, 'the upcoming <details>');
  assert.ok(!/<details[^>]*\bopen\b/.test(details.slice(0, 200)), 'closed by default');
  assert.match(details.replace(/<!-- -->/g, ''), /Show all 16 upcoming promos/);
  assert.match(details, /href="\/nba\/phoenix-suns\/promos\/fireworks-night"/, 'the last row is in the HTML');
  assert.match(details, /id="promo-2027-04-10-fireworks-night"/, 'with its deep-link anchor');
  // The completed archive keeps its click-to-mount expander (step 6: the rows
  // past the five are behind it); the upcoming rows have none.
  assert.ok(!suns.slice(0, suns.indexOf('Already happened')).includes('aria-expanded="false"'), 'no click-to-mount expander for upcoming rows');
  const wild = (await teamPageHtml('minnesota-wild')).html;
  const group = wild.slice(wild.indexOf('aria-labelledby="ticket-packages-heading"'), wild.indexOf('</section>', wild.indexOf('aria-labelledby="ticket-packages-heading"')));
  for (const slug of ['puck-package-night', 'wizard-night']) {
    const row = group.slice(group.lastIndexOf('<li', group.indexOf(`href="/nhl/minnesota-wild/promos/${slug}"`)), group.indexOf('</li>', group.indexOf(`href="/nhl/minnesota-wild/promos/${slug}"`)));
    assert.match(row, /Comes with a special ticket package\./, `${slug}: the note under the linked name`);
  }
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

// ── the canonical rule (ruling 2026-10-29) ───────────────────────────────────
test('canonical: the three ruled examples; a duplicate points every URL signal at its winner, leaves the sitemap and stays in the lists', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const C = 'https://www.getpromonight.com';
  const canonicalOf = async (sport: string, team: string, slug: string) => {
    const { h, meta } = await render(sport, team, slug);
    const canonical = meta.alternates?.canonical;
    assert.equal((meta.openGraph as any).url, canonical, `${slug}: og:url`);
    assert.equal(jsonLd(h)[0].url, canonical, `${slug}: WebPage url`);
    assert.equal(jsonLd(h)[1].url, canonical, `${slug}: Event url`);
    assert.equal(meta.robots, undefined, `${slug}: a duplicate is not noindexed`);
    return { canonical, h };
  };
  // Suns Nov 7: the jersey, the most specific tier 1 giveaway, is canonical; the night and the bare giveaway point at it.
  const jersey = `${C}/nba/phoenix-suns/promos/artist-collaboration-originativ-replica-jersey`;
  assert.equal((await canonicalOf('nba', 'phoenix-suns', 'artist-collaboration-originativ-replica-jersey')).canonical, jersey);
  const night = await canonicalOf('nba', 'phoenix-suns', 'originativ-night');
  assert.equal(night.canonical, jersey);
  assert.match(night.h, /<h1 class="rd-display[^"]*">ORIGINATIV Night<\/h1>/, 'the duplicate renders its own body');
  assert.equal((await canonicalOf('nba', 'phoenix-suns', 'originativ')).canonical, jersey);
  // Suns Nov 4: no tier 1 giveaway in the group; the title with more tokens wins.
  const muertosNight = `${C}/nba/phoenix-suns/promos/dia-de-los-muertos-night`;
  assert.equal((await canonicalOf('nba', 'phoenix-suns', 'dia-de-los-muertos-night')).canonical, muertosNight);
  assert.equal((await canonicalOf('nba', 'phoenix-suns', 'dia-de-los-muertos')).canonical, muertosNight);
  // Predators Nov 7: the tier 1 giveaway wins over the longer theme title.
  const boat = `${C}/nhl/nashville-predators/promos/catfish-gravy-boat`;
  const boatPage = await canonicalOf('nhl', 'nashville-predators', 'catfish-gravy-boat');
  assert.equal(boatPage.canonical, boat);
  assert.equal((await canonicalOf('nhl', 'nashville-predators', 'hometown-remix-catfish-gravy-boat')).canonical, boat);
  // The winner's "Also at this game" keeps the duplicate.
  assert.match(boatPage.h, /Also at this game/);
  assert.match(boatPage.h, /href="\/nhl\/nashville-predators\/promos\/hometown-remix-catfish-gravy-boat"/);
  // A series is never a duplicate: the four-date Rally Towel keeps itself as
  // canonical beside the more specific single-date night on its last date.
  assert.equal((await canonicalOf('nhl', 'dallas-stars', 'rally-towel')).canonical, `${C}/nhl/dallas-stars/promos/rally-towel`);
  assert.equal((await canonicalOf('nhl', 'dallas-stars', 'rally-towel-night')).canonical, `${C}/nhl/dallas-stars/promos/rally-towel-night`);
  // Pages in no group are untouched.
  assert.equal((await canonicalOf('nhl', 'minnesota-wild', 'blaze-orange-hat')).canonical, `${C}/nhl/minnesota-wild/promos/blaze-orange-hat`);
  // The sitemap lists the winners and leaves the duplicates out; the series
  // with one upcoming date stays (its stored rows say four).
  const { getPromoPageSitemapEntries } = await import('@/lib/promo-pages');
  const paths = (await getPromoPageSitemapEntries(TODAY)).map((e) => e.path);
  for (const p of ['/nba/phoenix-suns/promos/artist-collaboration-originativ-replica-jersey', '/nba/phoenix-suns/promos/dia-de-los-muertos-night', '/nhl/nashville-predators/promos/catfish-gravy-boat', '/nhl/dallas-stars/promos/rally-towel', '/nhl/dallas-stars/promos/rally-towel-night']) assert.ok(paths.includes(p), `listed: ${p}`);
  for (const p of ['/nba/phoenix-suns/promos/originativ-night', '/nba/phoenix-suns/promos/originativ', '/nba/phoenix-suns/promos/dia-de-los-muertos', '/nhl/nashville-predators/promos/hometown-remix-catfish-gravy-boat']) assert.ok(!paths.includes(p), `not listed: ${p}`);
});

// ── old slugs (the re-mint of 2026-10-29) ────────────────────────────────────
test('an old slug in previousSlugs is a permanent redirect to its row\'s page, or that page\'s canonical when it is a duplicate; the sitemap never lists it; an unknown slug is still a 404', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { default: Page, generateMetadata } = await page();
  await assert.rejects(
    () => Page(params('nba', 'phoenix-suns', 'd-a-de-los-muertos')),
    (err: { digest?: string }) => {
      const d = String(err.digest ?? '');
      assert.ok(d.startsWith('NEXT_REDIRECT;'), d);
      // ONE HOP (ruling 2026-11-10): the row's current page (dia-de-los-muertos)
      // is a duplicate of the night under the canonical rule, so the old slug
      // goes straight to the night.
      assert.ok(d.includes(';/nba/phoenix-suns/promos/dia-de-los-muertos-night;308;'), d);
      return true;
    },
  );
  assert.deepEqual(await generateMetadata(params('nba', 'phoenix-suns', 'd-a-de-los-muertos')), {});
  await assert.rejects(() => Page(params('nba', 'phoenix-suns', 'no-such-slug')), is404);
  // Flag off: the old slug is a 404 like every promo path, before any read.
  delete process.env.PROMO_PAGES_LIVE;
  await assert.rejects(() => Page(params('nba', 'phoenix-suns', 'd-a-de-los-muertos')), is404);
  process.env.PROMO_PAGES_LIVE = 'true';
  const { getPromoPageSitemapEntries } = await import('@/lib/promo-pages');
  const paths = (await getPromoPageSitemapEntries(TODAY)).map((e) => e.path);
  assert.ok(!paths.includes('/nba/phoenix-suns/promos/d-a-de-los-muertos'));
});

test('redirects resolve in one hop: an old slug never lands on a page whose canonical is elsewhere', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { default: Page } = await page();
  const target = await Page(params('nba', 'phoenix-suns', 'd-a-de-los-muertos')).then(
    () => null,
    (err: { digest?: string }) => String(err.digest ?? '').split(';')[2],
  );
  assert.equal(target, '/nba/phoenix-suns/promos/dia-de-los-muertos-night');
  // The target serves its own page (200, its own canonical), not another redirect.
  const { meta } = await render('nba', 'phoenix-suns', 'dia-de-los-muertos-night');
  assert.equal(meta.alternates?.canonical, `https://www.getpromonight.com${target}`);
});

// ── same-game pairs (rulings 2026-11-10) ────────────────────────────────────
test('rule 1: a giveaway that names its item and its theme night keep their own canonical and titles, and link each other', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const C = 'https://www.getpromonight.com/nhl/new-york-islanders/promos';
  const hat = await render('nhl', 'new-york-islanders', 'elf-hat');
  const night = await render('nhl', 'new-york-islanders', 'elf-night');
  assert.equal(hat.meta.alternates?.canonical, `${C}/elf-hat`);
  assert.equal(night.meta.alternates?.canonical, `${C}/elf-night`);
  assert.match(String(hat.meta.title), /^Elf Hat \|/);
  assert.match(String(night.meta.title), /^ELF Night \|/);
  assert.match(hat.h, /href="\/nhl\/new-york-islanders\/promos\/elf-night"/, 'item page links the night');
  assert.match(night.h, /href="\/nhl\/new-york-islanders\/promos\/elf-hat"/, 'night links the item page');
});

test('rule 1 extension: a giveaway with no item of its own canonicals to the night, leaves the sitemap and stays linked', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const C = 'https://www.getpromonight.com/nhl/new-york-islanders/promos';
  const give = await render('nhl', 'new-york-islanders', 'hockey-is-for-everyone-giveaway');
  const night = await render('nhl', 'new-york-islanders', 'hockey-is-for-everyone-night');
  assert.equal(give.meta.alternates?.canonical, `${C}/hockey-is-for-everyone-night`);
  assert.equal((give.meta.openGraph as any).url, `${C}/hockey-is-for-everyone-night`);
  assert.equal(give.meta.robots, undefined, 'a duplicate is not noindexed');
  assert.equal(night.meta.alternates?.canonical, `${C}/hockey-is-for-everyone-night`);
  assert.match(night.h, /href="\/nhl\/new-york-islanders\/promos\/hockey-is-for-everyone-giveaway"/);
  assert.match(give.h, /href="\/nhl\/new-york-islanders\/promos\/hockey-is-for-everyone-night"/);
  const { getPromoPageSitemapEntries } = await import('@/lib/promo-pages');
  const paths = (await getPromoPageSitemapEntries(TODAY)).map((e) => e.path);
  assert.ok(paths.includes('/nhl/new-york-islanders/promos/hockey-is-for-everyone-night'));
  assert.ok(!paths.includes('/nhl/new-york-islanders/promos/hockey-is-for-everyone-giveaway'));
});

test('rule 2: a special-ticket package page beside its theme night carries "Ticket Package" in its title; the night is unchanged and does not link it', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const pkg = await render('nhl', 'new-york-islanders', '90s-night-t-shirt');
  const night = await render('nhl', 'new-york-islanders', '90s-night');
  assert.match(String(pkg.meta.title), /^90s Night T-Shirt Ticket Package \|/);
  assert.equal((pkg.meta.openGraph as any).title, `${pkg.meta.title} | PromoNight`);
  assert.match(pkg.h, /<h1 class="rd-display[^"]*">90s Night T-Shirt<\/h1>/, 'the H1 keeps the stored name');
  assert.match(String(night.meta.title), /^90s Night \|/);
  assert.doesNotMatch(night.h, /href="\/nhl\/new-york-islanders\/promos\/90s-night-t-shirt"/, 'WEB6 G2: no link to the package page');
  assert.match(pkg.h, /href="\/nhl\/new-york-islanders\/promos\/90s-night"/);
  // Both are their own canonical: two pages, two searches.
  assert.equal(pkg.meta.alternates?.canonical, 'https://www.getpromonight.com/nhl/new-york-islanders/promos/90s-night-t-shirt');
  // Past the budget: an absolute title, no suffix, team kept, prefix cut.
  const long = await render('nhl', 'new-york-islanders', 'islanders-hockey-fights-cancer-lavender-warmup-jersey');
  assert.deepEqual(long.meta.title, { absolute: 'Hockey Fights Cancer Lavender Warmup Jersey Ticket Package | Islanders' });
  assert.equal((long.meta.openGraph as any).title, 'Hockey Fights Cancer Lavender Warmup Jersey Ticket Package | Islanders', 'no suffix on the social title either');
  assert.match(long.h, /<h1 class="rd-display[^"]*">Islanders Hockey Fights Cancer Lavender Warmup Jersey<\/h1>/);
  // A package page with no related page on its game keeps its stored title.
  const lone = await render('nhl', 'minnesota-wild', 'puck-package-night');
  assert.match(String(lone.meta.title), /^Puck Package Night \|/);
});

// ── The family wrapper (hotfix 2026-10-30, option 3) ────────────────────────
// The route's layout renders ONE server-rendered <div class="pn-promo-page">
// as the first-byte parent of the page's <article>, the hook Raptive's
// custom layout targets by descendant selector. Nothing sits between the two.
test('the route layout wraps the page in div.pn-promo-page, the direct parent of the article', async () => {
  const { default: Layout } = await import('../layout');
  const { default: Page } = await page();
  const h = await html(Layout({ children: await Page(params('nhl', 'minnesota-wild', 'blaze-orange-hat')) }));
  assert.equal((h.match(/pn-promo-page/g) ?? []).length, 1, 'one wrapper');
  // The wrapper opens, the JSON-LD scripts follow as earlier children, then the article: no other element between.
  assert.match(h, /<div class="[^"]*\brd-root\b[^"]*\bpn-promo-page\b[^"]*">(?:<script type="application\/ld\+json">[^<]*<\/script>)*<article class="page-content[^"]*" data-ad-region="content" style="[^"]*">/, 'the wrapper is the article\'s parent');
  assert.ok(h.trimEnd().endsWith('</article></div>'), 'the wrapper closes right after the article');
  // The house wrapper and the hook are the layout's; the view renders no wrapper of its own.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../layout.tsx', import.meta.url), 'utf8');
  assert.match(src, /rd-root min-h-screen pn-promo-page/);
  assert.doesNotMatch(readFileSync(new URL('../../../../../../components/promo-page/PromoPageView.tsx', import.meta.url), 'utf8'), /rd-root min-h-screen/);
});

// ── the content floor (docs/per-promo-pages-v2-spec.md build order 2, 2026-11-07) ──

test('content floor: the team colour on the article, the band, the badge and the CTA; the house red when both colours fail AA', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const wild = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  // One source: the team doc's ARGB colours as mapTeamDoc turns them to hex,
  // the same two the tier 3 card route reads. Dark green takes white ink and
  // reads on the cream ground, so the numeral is the colour too.
  assert.match(wild.h, /<article class="page-content[^"]*" data-ad-region="content" style="--pp-accent:#154734;--pp-accent-ink:#ffffff;--pp-accent-text:#154734;overflow-anchor:none">/);
  assert.match(wild.h, /<header class="[^"]*"><div aria-hidden="true" class="h-\[3px\] w-full rounded-full bg-\[var\(--pp-accent\)\]"><\/div>/, 'the band under the breadcrumb, inside the header');
  assert.match(wild.h, /class="rounded-md px-2 py-1 [^"]*bg-\[var\(--pp-accent\)\] text-\[var\(--pp-accent-ink\)\]">Giveaway<\/span>/, 'the badge');
  assert.match(wild.h, /class="flex h-\[52px\] min-w-0 flex-1 [^"]*bg-\[var\(--pp-accent\)\][^"]*text-\[var\(--pp-accent-ink\)\][^"]*"[^>]*>Get tickets<\/a>/, 'the CTA');
  assert.match(wild.h, /<h2 class="rd-display[^"]*"><span aria-hidden="true" class="[^"]*bg-\[var\(--pp-accent\)\]"><\/span>About this giveaway<\/h2>/, 'the section rule');
  // Mid-gray primary, white secondary: neither clears the gate, so the house red, with white ink.
  const gray = await render('nhl', 'gray-club', 'gray-towel');
  assert.match(gray.h, /style="--pp-accent:#da2d20;--pp-accent-ink:#ffffff;--pp-accent-text:#[0-9a-f]{6};overflow-anchor:none"/);
  assert.ok(!gray.h.includes('#808080') && !gray.h.includes('--pp-accent:#ffffff'), 'the failing colours never reach the page');
  // The article's direct children are unchanged in kind: the band adds no ad anchor.
  const kids = articleChildren(wild.h);
  assert.ok(kids[0].startsWith('<nav') && kids[1].startsWith('<header'), kids.slice(0, 2).join('\n'));
});

test('content floor: the date tile reads the venue day; tonight with doors, tonight without, tomorrow, the count of days beyond (never the weekday, ruling 2026-11-08); a series stacks shrunk tiles', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  // Today in Chicago (the game's zone), no door time: "Tonight", no arrival line, no Doors row.
  const blaze = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.match(blaze.h, /<span class="rd-numerals leading-none text-\[var\(--pp-accent-text\)\] text-\[38px\]">29<\/span><span class="[^"]*">OCT<\/span>/);
  assert.match(blaze.h, />Tonight<\/span>/);
  assert.ok(!/Tonight · gates/.test(blaze.h), 'no arrival line without a stored door time');
  assert.ok(!/>Doors</.test(blaze.h), 'no Doors row without a stored door time');
  // Today with a door time.
  const pride = await render('nhl', 'minnesota-wild', 'pride-night');
  assert.match(pride.h, />Tonight · gates 5:30 PM<\/span>/);
  assert.match(pride.h, /<dt class="[^"]*">Doors<\/dt><dd class="[^"]*">5:30 PM<\/dd>/);
  // The count of days, however far out; "Tomorrow" for one.
  const lapel = await render('nhl', 'pittsburgh-penguins', 'lapel-pin-set');
  assert.match(lapel.h, />In 7 days<\/span>/);
  const beanie = await render('nhl', 'minnesota-wild', 'winter-beanie');
  assert.match(beanie.h, />In 37 days<\/span>/);
  assert.ok(!/>Saturday<\/span>/.test(beanie.h), 'never the weekday');
  const tomorrow = await render('nhl', 'past-club', 'tomorrow-towel');
  assert.match(tomorrow.h, />Tomorrow<\/span>/);
  // A played date has no state line at all.
  const played = await render('nhl', 'past-club', 'yesterday-towel');
  assert.ok(!/<span class="mt-1 font-rd text-\[10px\] font-semibold uppercase/.test(played.h.slice(played.h.indexOf('<section'), played.h.indexOf('</section>'))), 'no state line on a played tile');
  // A series: the next three dates as shrunk tiles beside the CTA column, the state line on the next one only.
  const series = await render('nhl', 'pittsburgh-penguins', 'community-night');
  const minis = series.h.match(/<span class="rd-numerals leading-none text-\[var\(--pp-accent-text\)\] text-\[22px\]">(\d+)<\/span>/g) ?? [];
  assert.equal(minis.length, 3, 'three shrunk tiles');
  assert.equal((series.h.match(/>In 7 days<\/span>/g) ?? []).length, 1, 'Nov 5 is in 7 days; one state line');
  // The CTA row still opens the column beside the tile(s): CTA above the first in-content unit.
  for (const page of [blaze, series]) assert.ok(page.h.indexOf('Get tickets</a>') < page.h.search(/>(This|Next) game<\/h2>/), 'CTA before the first in-content unit');
});

test('content floor: the general guide is the themeKey entry, else the type entry, else absent; it sits after This game', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { loadExplainers } = await import('@/lib/promo-explainers');
  const lib = loadExplainers();
  // Type entry: a hat giveaway.
  const blaze = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.match(blaze.h, /<p class="[^"]*">Fan guide<\/p><h2 class="rd-display[^"]*"><span[^>]*><\/span>What to expect at a hat giveaway<\/h2>/);
  for (const para of lib.get('hat')!.paragraphs) assert.ok(blaze.h.includes(para), 'every paragraph of the entry, verbatim');
  // Specific facts first, the general guide second (ruling 2026-11-07).
  assert.ok(blaze.h.indexOf('About this giveaway') < blaze.h.indexOf('>This game</h2>') && blaze.h.indexOf('>This game</h2>') < blaze.h.indexOf('Fan guide'), 'About, This game, guide');
  // Theme entry wins over the type.
  const pride = await render('nhl', 'anaheim-ducks', 'pride-night');
  assert.ok(pride.h.includes(lib.get('pride')!.title), 'the pride entry');
  assert.ok(!pride.h.includes(lib.get('theme-night')!.title), 'not the theme-night entry');
  // No themeKey and no item in the title: no block at all, no label.
  const lapel = await render('nhl', 'pittsburgh-penguins', 'lapel-pin-set');
  assert.ok(!lapel.h.includes('Fan guide'), 'no Fan guide block');
  assert.ok(!lapel.h.includes('What to expect'), 'no explainer title');
  // A removed page carries no guide.
  const removed = await render('nhl', 'minnesota-wild', 'removed-future-poster');
  assert.ok(!removed.h.includes('Fan guide'));
});

test('content floor: This game is derived only: the opponent link from the spine, the date siblings, the building count; no Game or Home schedule row (ruling 2026-11-08); no row without data', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const blaze = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.match(blaze.h, /<dt class="[^"]*">Opponent<\/dt><dd class="[^"]*"><a [^>]*href="\/nhl\/new-york-islanders"[^>]*>New York Islanders<\/a><\/dd>/);
  // The date row and the home-schedule row are gone: the header has the date,
  // the timeline caption the position.
  assert.ok(!/<dt class="[^"]*">(Game|Next date|Home schedule)<\/dt>/.test(blaze.h), 'no Game or Home schedule rows');
  assert.match(blaze.h, /home game 2 of 3<\/span>/);
  assert.match(blaze.h, /<dt class="[^"]*">Also at this game<\/dt><dd class="[^"]*"><ul[^>]*><li[^>]*><a [^>]*href="\/nhl\/minnesota-wild\/promos\/pride-night"/);
  assert.ok(!/This month<\/dt>/.test(blaze.h), 'no other giveaways at the building in October');
  // No game on the spine for Dec 5: the stored opponent, unlinked; no position.
  const beanie = await render('nhl', 'minnesota-wild', 'winter-beanie');
  assert.match(beanie.h, /<dt class="[^"]*">Opponent<\/dt><dd class="[^"]*">Blackhawks<\/dd>/);
  assert.ok(!/Home schedule/.test(beanie.h));
  // The building's other giveaway in December, linking to the building page.
  assert.match(beanie.h, /<dt class="[^"]*">In December<\/dt><dd class="[^"]*"><a [^>]*href="\/venues\/xcel-energy-center"[^>]*>1 more giveaway at Grand Casino Arena<\/a><\/dd>/);
  // The sponsor line inside About when the description does not name it; no tile anywhere.
  assert.match(beanie.h, /<p class="m-0 text-\[15px\] leading-\[1\.55\] text-rd-ink-soft">All fans receive a winter beanie\.<\/p><p class="m-0 text-\[15px\] leading-\[1\.55\] text-rd-ink-soft">Presented by Great Clips\.<\/p>/);
  assert.ok(!/Presented by<\/span>/.test(beanie.h));
  // The fact tiles are gone: quantity stays in the header line, doors in This game.
  assert.ok(!/>Quantity<\/span>/.test(beanie.h));
  assert.match(beanie.h, /First 10,000 fans/);
  // A removed page has no This game block.
  const removed = await render('nhl', 'minnesota-wild', 'removed-future-poster');
  assert.ok(!removed.h.includes('>This game</h2>'));
});

test('content floor: 390px HTML snapshots when PROMO_PAGE_SNAPSHOT_DIR is set', async () => {
  const dir = process.env.PROMO_PAGE_SNAPSHOT_DIR;
  if (!dir) return;
  process.env.PROMO_PAGES_LIVE = 'true';
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  const pages: [string, string, string, string][] = [
    ['nhl', 'dallas-stars', 'esa-lindell-bobblehead', 'bobblehead'],
    ['nhl', 'anaheim-ducks', 'pride-night', 'theme-night-pride'],
    ['nhl', 'pittsburgh-penguins', 'lapel-pin-set', 'no-library-match'],
    ['nhl', 'minnesota-wild', 'blaze-orange-hat', 'hat-giveaway-this-game'],
  ];
  for (const [sport, team, slug, name] of pages) {
    const { h } = await render(sport, team, slug);
    writeFileSync(`${dir}/${name}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title><link rel="stylesheet" href="promo-page.css"></head><body style="margin:0"><div class="rd-root min-h-screen pn-promo-page">${h}</div></body></html>`);
  }
});

test('content floor: a library FAQ is in the visible block and never in the FAQPage schema; the whole FAQ card is the summary hit area; no Home schedule row', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { loadExplainers } = await import('@/lib/promo-explainers');
  const hat = loadExplainers().get('hat')!;
  const { h } = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  const schema = jsonLd(h);
  const faqPage = schema.find((x) => x['@type'] === 'FAQPage');
  assert.ok(faqPage, 'the stored-field FAQ keeps the FAQPage');
  const schemaText = JSON.stringify(schema);
  for (const f of hat.faqs) {
    assert.ok(h.includes(`<summary class="cursor-pointer px-3.5 py-3 text-[14px] font-semibold text-rd-ink">${f.q}</summary>`), `${f.q}: in the visible block`);
    assert.ok(!schemaText.includes(f.q), `${f.q}: not in any schema`);
  }
  // The visible block: stored first, then the library's, in the library's order.
  const summaries = [...h.matchAll(/<summary class="[^"]*">([^<]+)<\/summary>/g)].map((m) => decode(m[1]));
  assert.deepEqual(summaries, ['Who presents the Blaze Orange Hat?', ...hat.faqs.map((f) => f.q)]);
  // The position lives in the timeline caption only (ruling 2026-11-08); no
  // Home schedule row, so no season label to wrap.
  assert.match(h, /home game 2 of 3<\/span>/);
  assert.ok(!/Home schedule/.test(h));
  put('games/nhl-dal-next', { id: 'nhl-dal-next', league: 'nhl', date: '2027-10-09', gameTime: '00:00', gameTimeTz: 'America/Chicago', homeTeamSlug: 'dallas-stars', awayTeamSlug: 'minnesota-wild', venueName: 'American Airlines Center', status: 'scheduled', seasonType: 'regular' });
  promo('dallas-stars', 'next1', { title: 'Opening Night Magnet', pageSlug: 'opening-night-magnet', date: '2027-10-09', pageSeason: '2027-28', opponent: 'Wild' });
  const next = await render('nhl', 'dallas-stars', 'opening-night-magnet');
  assert.ok(!/Home schedule/.test(next.h), 'no Home schedule row on next season\'s opener either');
});

test('about (ruling 2026-11-07): no description and no package, no About block; the source credit is a meta line under the venue line in the header', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  // No description, no package, no sponsor: no "About this" heading at all.
  const lapel = await render('nhl', 'pittsburgh-penguins', 'lapel-pin-set');
  assert.ok(!/About this /.test(lapel.h), 'no About heading');
  const header = lapel.h.slice(lapel.h.indexOf('<header'), lapel.h.indexOf('</header>'));
  assert.match(header, /<p class="m-0 font-rd text-\[12px\] text-rd-ink-faint">Source: <a href="https:\/\/www\.nhl\.com\/wild\/fans\/giveaway-schedule"[^>]*>nhl\.com<\/a><\/p>/, 'the source meta line in the header');
  assert.equal((lapel.h.match(/Source: /g) ?? []).length, 1, 'the credit appears once');
  // With a description the block stays, source line inside it, nothing in the header.
  const blaze = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  const about = blaze.h.indexOf('About this giveaway');
  assert.ok(about > 0 && about < blaze.h.indexOf('Source: '), 'the source line sits inside About');
  assert.ok(!blaze.h.slice(blaze.h.indexOf('<header'), blaze.h.indexOf('</header>')).includes('Source: '), 'no source line in the header');
  // A package row with no description keeps the block for its package sentence (ruling 2026-10-24).
  const pack = await render('nhl', 'minnesota-wild', 'scout-pack');
  assert.match(pack.h, /About this ticket package/);
  assert.match(pack.h, /Comes with a special ticket package\./);
  // A sponsor on a description-less page goes to the header meta with the credit.
  put('teams/pittsburgh-penguins/promos/g9', { ...(store.get('teams/pittsburgh-penguins/promos/g3') as Data), title: 'Puck Light', pageSlug: 'puck-light', date: '2026-11-25', presentedBy: 'Duquesne Light', attendanceCap: null });
  const puck = await render('nhl', 'pittsburgh-penguins', 'puck-light');
  assert.ok(!/About this /.test(puck.h));
  assert.match(puck.h.slice(puck.h.indexOf('<header'), puck.h.indexOf('</header>')), /<p class="m-0 font-rd text-\[12px\] text-rd-ink-faint">Presented by Duquesne Light\.<\/p><p class="m-0 font-rd text-\[12px\] text-rd-ink-faint">Source: /);
});

test('step 3: the rail replaces the same-team list (nothing below two cards), the timeline sits in This game and needs three home games', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  // The Wild: four upcoming others -> a rail; three home games on the spine -> a timeline with a dot per linked promo on those dates.
  const blaze = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.equal((blaze.h.match(/role="listitem"/g) ?? []).length, 4);
  assert.ok(!/<span class="block font-semibold">Hockey Fights Cancer Night<\/span>/.test(blaze.h), 'no PromoCard for the same team');
  const thisGame = blaze.h.slice(blaze.h.indexOf('>This game</h2>'), blaze.h.indexOf('</section>', blaze.h.indexOf('>This game</h2>')));
  assert.match(thisGame, /<svg viewBox="0 0 600 40"[^>]*aria-label="Minnesota Wild home schedule, 3 games, 2 promos">/);
  assert.ok(!/role="button"|tabindex=/.test(thisGame), 'the dots are not controls (ruling 2026-11-08)');
  assert.equal((thisGame.match(/<title>/g) ?? []).length, 2, 'the hat and Pride Night on Oct 29; nothing on Oct 20 or Dec 28');
  assert.equal((thisGame.match(/<circle cx="[0-9.]+" cy="22" r="9" fill="none" stroke="var\(--pp-accent\)"/g) ?? []).length, 1, 'this game ringed, once');
  assert.equal((thisGame.match(/<circle [^>]*fill="var\(--color-rd-ink\)" fill-opacity="0\.[47]"/g) ?? []).length, 2, 'every dot the muted ink');
  assert.ok(!/#(f97316|7c3aed|16a34a|2563eb)/i.test(thisGame), 'no category colour on the bar');
  assert.match(thisGame, /Oct 29 · <\/span><span class="font-semibold text-rd-ink">Blaze Orange Hat<\/span><span class="text-rd-ink-faint"> · home game 2 of 3<\/span>/);
  // The Stars: one game on the spine -> no timeline; several other upcoming promos -> a rail.
  const stars = await render('nhl', 'dallas-stars', 'esa-lindell-bobblehead');
  assert.ok(!stars.h.includes('home schedule,'), 'no timeline below three home games');
  assert.ok((stars.h.match(/role="listitem"/g) ?? []).length >= 2, 'a rail');
  // The gray club: its one promo has no siblings and no spine -> no rail, no card, no timeline, the links row still there.
  const gray = await render('nhl', 'gray-club', 'gray-towel');
  assert.equal((gray.h.match(/role="listitem"/g) ?? []).length, 0, 'no rail below two cards');
  assert.ok(!gray.h.includes('home schedule,'));
  assert.match(gray.h, /All Gray Club promos<\/a>/);
  // Every rail card is a plain anchor: no role=button, no nested control.
  let cards = 0;
  for (const m of blaze.h.matchAll(/<a role="listitem"[^>]*>([\s\S]*?)<\/a>/g)) {
    cards++;
    assert.ok(!/<(button|a) /.test(m[1]), 'nothing interactive inside a card');
  }
  assert.equal(cards, 4);
  assert.ok(!/role="listitem"[^>]*onclick/i.test(blaze.h));
});

test('step 4: Before you go is the union: provenance rows (rendered, dated) first, then the quick-facts classes not already present, undated; nothing twice; conflicted and held never render; zero provenance rows falls back to the quick-facts card', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  // The Wild: bag and parking rendered and dated; transit sourced with no
  // state; outside food rendered and dated but not a provenance class. Four
  // rows: the two dated first, then the card's two, undated.
  const { h } = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  const start = h.indexOf('<section id="before-you-go"');
  assert.ok(start > 0, 'the block');
  const block = h.slice(start, h.indexOf('</section>', start));
  assert.match(block, />Before you go<\/h2>/);
  assert.match(block, /Grand Casino Arena<span>, formerly Xcel Energy Center<\/span>/);
  const labels = [...block.matchAll(/<dt [^>]*>([^<]+)<\/dt>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Bag policy', 'Parking', 'Transit', 'Outside food']);
  assert.equal(new Set(labels).size, labels.length, 'nothing twice');
  const rows = [...block.matchAll(/<dd class="m-0">([\s\S]*?)<\/dd>/g)].map((m) => m[1]);
  assert.equal(rows.length, 4);
  // Provenance rows: the text, the operator host linked, then this field's own read date.
  assert.match(rows[0], /^Max bag 12&quot; x 12&quot; x 6&quot;\.<span class="[^"]*"><a href="https:\/\/x\/bag" target="_blank" rel="noopener noreferrer" class="[^"]*">x ›<\/a> · Checked Oct 7, 2026<\/span>$/, 'bag');
  assert.match(rows[1], /^Lots: RiverCentre Ramp, Lawson Ramp\.<span class="[^"]*"><a href="https:\/\/x\/parking"[^>]*>x ›<\/a> · Checked Oct 8, 2026<\/span>$/, 'parking');
  // Union rows: the card's text, the operator link, no read date.
  assert.match(rows[2], /^Green Line to Central Station, two blocks east\. Lines: Green Line\.<span class="[^"]*"><a href="https:\/\/x\/transit"[^>]*>x ›<\/a><\/span>$/, 'transit');
  assert.match(rows[3], /^No outside food or drink\.<span class="[^"]*"><a href="https:\/\/x\/food"[^>]*>x ›<\/a><\/span>$/, 'outside food');
  assert.equal((block.match(/Checked/g) ?? []).length, 2, 'two dated rows');
  const guide = h.indexOf('>Fan guide<');
  const rail = h.indexOf('role="listitem"');
  assert.ok(guide < start && start < rail, 'after the guide, before the rail');
  assert.equal((h.match(/formerly Xcel Energy Center/g) ?? []).length, 1, 'the former name once');

  // The gray club: the prohibition rendered and dated; its overlay's gate rule
  // rendered and dated; the lots rendered but never dated, so they reach the
  // block through the union, undated; the clear-bag answer is in operator
  // conflict and transit is held: neither renders anywhere on the page.
  const gray = await render('nhl', 'gray-club', 'gray-towel');
  const gs = gray.h.indexOf('<section id="before-you-go"');
  assert.ok(gs > 0, 'the gray block');
  const gblock = gray.h.slice(gs, gray.h.indexOf('</section>', gs));
  const grows = [...gblock.matchAll(/<dd class="m-0">([\s\S]*?)<\/dd>/g)].map((m) => m[1]);
  assert.deepEqual([...gblock.matchAll(/<dt [^>]*>([^<]+)<\/dt>/g)].map((m) => m[1]), ['Bag policy', 'Gates', 'Parking']);
  // Ruling 2026-11-08: a prohibition with a rendered, dated size names the clutch
  // exception (this read "Bags are not allowed." before the ruling).
  assert.match(grows[0], /^No bags, except clutches up to 5(?:"|&quot;) x 9(?:"|&quot;) x 3(?:"|&quot;)\.<span class="[^"]*"><a href="https:\/\/x\/gray-bag"[^>]*>x ›<\/a> · Checked Oct 1, 2026<\/span>$/, 'gray bag');
  assert.match(grows[1], /^Doors open 90 minutes before puck drop\.<span class="[^"]*"><a href="https:\/\/x\/gates"[^>]*>x ›<\/a> · Checked Oct 10, 2026<\/span>$/, 'gray gates');
  assert.match(grows[2], /^Lots: Gray Lot A\.<span class="[^"]*"><a href="https:\/\/x\/gray-parking"[^>]*>x ›<\/a><\/span>$/, 'gray parking, undated');
  assert.equal((gblock.match(/Checked/g) ?? []).length, 2);
  // Ruling 2026-11-08: the clutch size now prints, once, inside the bag row and
  // never as a limit ('5&quot; x 9&quot;' was in the withheld list before the ruling).
  assert.equal((gray.h.match(/5&quot; x 9&quot; x 3&quot;/g) ?? []).length, 1, 'the clutch size once, in the bag row');
  assert.ok(!gray.h.includes('Max bag 5'), 'never as a limit');
  for (const withheld of ['Clear bag', 'Light rail to Gray Station', 'Gray Line', 'operator', 'conflicting']) {
    assert.ok(!gray.h.includes(withheld), `withheld: ${withheld}`);
  }

  // The Ducks: a verified, sourced building with no state map. Zero provenance
  // rows, so no Before you go heading; THE FALLBACK (ruling 2026-11-08) is
  // the quick facts card exactly as it rendered before step 4: any sourced
  // field, no date line, the two-column grid.
  const ducks = await render('nhl', 'anaheim-ducks', 'pride-night');
  assert.ok(!ducks.h.includes('Before you go'), 'no Before you go heading');
  assert.ok(!ducks.h.includes('before-you-go'));
  assert.match(ducks.h, /<h2 class="rd-display m-0 text-\[22px\] uppercase text-rd-ink"><span aria-hidden="true" class="[^"]*"><\/span>Honda Center, quick facts<\/h2><dl class="m-0 grid grid-cols-2 gap-2.5 text-\[14px\] text-rd-ink"><div><dt class="[^"]*">Bag policy<\/dt><dd class="m-0">Max bag 14&quot; x 14&quot; x 6&quot;\.<\/dd><\/div><div><dt class="[^"]*">Parking<\/dt><dd class="m-0">Lots: Lot 1\.<\/dd><\/div><\/dl>/);
  assert.ok(!ducks.h.includes('Checked'), 'the card carries no date line');
  // Never both: each page has exactly one of the two, or neither.
  for (const [name, page] of [['wild', h], ['gray', gray.h], ['ducks', ducks.h]] as const) {
    const byg = page.includes('>Before you go</h2>');
    const qf = page.includes(', quick facts</h2>');
    assert.ok(byg !== qf, `${name}: exactly one of Before you go (${byg}) and quick facts (${qf})`);
  }
});

test('played (ruling 2026-11-08): every date before today in the venue zone; the header says so, the way forward replaces the tickets, no affiliate link, Events keep EventScheduled without offers, no arrival question; tomorrow and a series with a future date are not played', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { h } = await render('nhl', 'past-club', 'yesterday-towel');
  const header = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
  assert.match(header, /<strong class="text-rd-ink">This game has been played<\/strong>/, 'the header line, under the date');
  assert.ok(header.indexOf('Wednesday, Oct 28, 2026') < header.indexOf('This game has been played'));
  // The way forward in place of the ticket row: the club's next upcoming
  // promo page, Share beside it, then the editions either side.
  assert.match(h, /<a [^>]*href="\/nhl\/past-club\/promos\/tomorrow-towel"[^>]*>Next Past Club promo<\/a>/);
  // The previous edition is a row of the editions block (step 6), not a CTA line.
  assert.ok(!h.includes('Previous edition:'), 'no previous-edition CTA line');
  assert.match(h, /href="\/nhl\/past-club\/promos\/yesterday-towel-2025-26"[^>]*>(?:<img[^>]*>)?<span[^>]*><span[^>]*>Yesterday Towel 2025-26<\/span><span[^>]*>Monday, Mar 2, 2026/);
  assert.match(h, /<a [^>]*href="\/nhl\/past-club\/promos\/yesterday-towel-2027-28"[^>]*>Next edition: Yesterday Towel 2027-28 · Wednesday, Oct 20, 2027<\/a>/);
  // Nothing to sell: no ticket, parking, hotel or reminder link, and no
  // affiliate anchor of any kind.
  for (const gone of ['>Get tickets<', 'Also on Ticketmaster', '>Parking</a>', '>Hotels</a>', '>Remind me<', 'rel="noopener noreferrer sponsored"', '/download?src=promo_cta']) {
    assert.ok(!h.includes(gone), `played page still carries ${gone}`);
  }
  // The Event happened: EventScheduled, no offers.
  const events = jsonLd(h).filter((s) => s['@type'] === 'Event');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventStatus, 'https://schema.org/EventScheduled');
  assert.ok(!('offers' in events[0]), 'no offers on a played Event');
  // The arrival question is gone although a door time is stored; the
  // presenter question stays.
  assert.ok(!h.includes('What time should I arrive?'));
  assert.match(h, /Who presents Yesterday Towel\?/);

  // Tomorrow: not played. The ticket row, the offers and the arrival question are all there.
  const next = await render('nhl', 'past-club', 'tomorrow-towel');
  assert.ok(!next.h.includes('This game has been played'));
  assert.match(next.h, />Get tickets<\/a>/);
  assert.match(next.h, />Parking<\/a>/);
  assert.match(next.h, />Remind me<\/a>/);
  assert.ok(!next.h.includes('Next Past Club promo'));
  const nextEvents = jsonLd(next.h).filter((s) => s['@type'] === 'Event');
  assert.ok(nextEvents[0].offers?.url, 'offers on an upcoming Event');
  assert.match(next.h, /What time should I arrive\?/);

  // An all-played series: the plural line, and the same way forward.
  const series2 = await render('nhl', 'past-club', 'two-nights');
  assert.match(series2.h, /<strong class="text-rd-ink">These games have been played<\/strong>/);
  assert.ok(!series2.h.includes('This game has been played'));
  assert.match(series2.h, /<a [^>]*href="\/nhl\/past-club\/promos\/tomorrow-towel"[^>]*>Next Past Club promo<\/a>/);
  assert.ok(!series2.h.includes('>Get tickets<') && !series2.h.includes('rel="noopener noreferrer sponsored"'));

  // A series with two played dates and three to come is not played; a page
  // dated today is not played.
  const series = await render('nhl', 'pittsburgh-penguins', 'community-night');
  assert.ok(!series.h.includes('This game has been played'));
  assert.match(series.h, />Get tickets<\/a>/);
  const todayPage = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.ok(!todayPage.h.includes('This game has been played'));
  // The article opts out of scroll anchoring (ux-review 2026-11-08, D1; live guard 9).
  assert.match(todayPage.h, /<article class="page-content[^"]*" data-ad-region="content" style="[^"]*overflow-anchor:none[^"]*">/);
});

// ── eBay listings (spec Visuals 6, step 5a, 2026-11-08) ─────────────────────
// The Booker page: a bobblehead giveaway with no stored image, the block's
// case. The fake API fails by default (every render above went through that),
// then answers, and the served HTML carries the block after This game.
test('eBay listings: a failed call renders the page with no block and does not throw; a good call renders up to three confirmed listings after This game; a tier 1 page asks nothing', async () => {
  const { _resetEbayBrowseForTests } = await import('@/lib/ebay-browse');
  _resetEbayBrowseForTests();
  ebayCalls.length = 0;
  const failed = await render('nba', 'phoenix-suns', 'devin-booker-bobblehead');
  assert.doesNotMatch(failed.h, /bobbleheads on eBay<\/h2>/);
  assert.ok(!failed.h.includes('i.ebayimg.com'));
  assert.ok(ebayCalls.length >= 1, 'the page asked eBay');
  assert.match(failed.h, />About this giveaway<\/h2>/);
  guard(failed.h, 'Booker, eBay failed');

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const item = (id: string, title: string) => ({ itemId: `v1|${id}|0`, title, image: { imageUrl: `https://i.ebayimg.com/images/g/${id}/s-l500.webp` }, price: { value: '34.99', currency: 'USD' }, itemWebUrl: `https://www.ebay.com/itm/${id}`, itemAffiliateWebUrl: `https://www.ebay.com/itm/${id}?mkevt=1&mkcid=1&campid=5339000000&customid=web_promo_page_phoenix_suns&toolid=10001` });
  ebayHandler = (url) => (url.includes('/oauth2/token') ? json({ access_token: 'tok', expires_in: 7200 }) : json({ itemSummaries: [item('1', '2026 Devin Booker Phoenix Suns Bobblehead SGA 12/20'), item('2', 'Phoenix Suns 2026 Bobblehead Night SGA'), item('3', 'Booker Suns bobblehead sealed'), item('4', 'Devin Booker bobble 2026'), item('5', 'Devin Booker bobblehead, fifth')] }));
  _resetEbayBrowseForTests();
  ebayCalls.length = 0;
  const ok = await render('nba', 'phoenix-suns', 'devin-booker-bobblehead');
  assert.match(ok.h, />Booker bobbleheads on eBay<\/h2>/);
  const q = new URL(ebayCalls.find((u) => u.includes('/item_summary/search')) as string).searchParams.get('q');
  assert.equal(q, '2026 Suns Devin Booker bobblehead', 'the tier 2 search link’s query');
  const block = ok.h.slice(ok.h.lastIndexOf('<section', ok.h.search(/>Booker bobbleheads on eBay<\/h2>/)), ok.h.indexOf('</section>', ok.h.search(/>Booker bobbleheads on eBay<\/h2>/)));
  const hrefs = [...block.matchAll(/<a href="([^"]+)" target="_blank" rel="sponsored noopener"/g)].map((m) => decode(m[1]));
  assert.deepEqual(hrefs.map((h) => new URL(h).pathname), ['/itm/1', '/itm/3', '/itm/4'], 'three confirmed listings, the club-and-kind title left out');
  assert.equal((block.match(/<img src="https:\/\/i\.ebayimg\.com\/images\/g\/\d\/s-l400\.webp"/g) ?? []).length, 3);
  assert.equal((block.match(/>\$34\.99<\/span>/g) ?? []).length, 3);
  assert.ok(block.includes('PromoNight may earn a commission on purchases made through links on this page.'));
  // After This game (ruling 2026-11-08): the next section after it, with no
  // other heading between, and the Fan guide after the block.
  const thisGameAt = ok.h.indexOf('>This game</h2>');
  const ebayAt = ok.h.search(/>Booker bobbleheads on eBay<\/h2>/);
  assert.ok(thisGameAt > 0 && thisGameAt < ebayAt, 'This game first');
  const between = ok.h.slice(thisGameAt, ebayAt);
  assert.equal((between.match(/<h2/g) ?? []).length, 1, 'no heading between This game and the block');
  assert.equal((between.match(/<\/section><section /g) ?? []).length, 1, 'the block is the section after This game');
  assert.ok(ok.h.indexOf('>Fan guide</p>') > ebayAt, 'the Fan guide follows the block');
  guard(ok.h, 'Booker, eBay ok');

  // The tier 1 Lindell page never asks.
  ebayCalls.length = 0;
  const lindell = await render('nhl', 'dallas-stars', 'esa-lindell-bobblehead');
  assert.doesNotMatch(lindell.h, /bobbleheads on eBay<\/h2>/);
  assert.equal(ebayCalls.length, 0, 'no call for a tier 1 upcoming page');
  ebayHandler = () => new Response('', { status: 500 });
});

// ── the archive pass (step 6, 2026-11-08) ────────────────────────────────────

test('a played page outside the index window serves noindex; one inside it is indexable', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const ancient = await render('nhl', 'past-club', 'ancient-towel');
  assert.deepEqual(ancient.meta.robots, { index: false, follow: true }, '2023-24 is two seasons back on 2026-10-29');
  assert.match(ancient.h, /This game has been played/);
  const lastSeason = await render('nhl', 'past-club', 'yesterday-towel-2025-26');
  assert.equal(lastSeason.meta.robots, undefined, '2025-26 is the previous season: indexable');
});

test('sitemap-past: played pages inside the window only, one per page, never a tombstone, an upcoming page or a page outside the window; the archive page of every team with one', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { getPastPromoSitemap } = await import('@/lib/promo-pages');
  const { pages, archives } = await getPastPromoSitemap(TODAY);
  const paths = pages.map((e) => e.path);
  for (const p of ['/nhl/past-club/promos/yesterday-towel', '/nhl/past-club/promos/yesterday-towel-2025-26', '/nhl/minnesota-wild/promos/pride-night-2025-26', '/nba/phoenix-suns/promos/rally-towel', '/nba/phoenix-suns/promos/ring-night', '/nhl/minnesota-wild/promos/played-puck-package']) assert.ok(paths.includes(p), `listed: ${p}`);
  for (const p of ['/nhl/past-club/promos/ancient-towel', '/nhl/minnesota-wild/promos/tombstoned-past-hat', '/nhl/minnesota-wild/promos/blaze-orange-hat', '/nhl/minnesota-wild/promos/pride-night', '/nhl/past-club/promos/tomorrow-towel']) assert.ok(!paths.includes(p), `not listed: ${p}`);
  assert.equal(new Set(paths).size, paths.length, 'one URL per page');
  for (const e of pages) assert.ok(!e.path.endsWith('/promos/past'), 'the archive pages are not in the past file');
  const archivePaths = archives.map((e) => e.path).sort();
  for (const p of ['/nhl/past-club/promos/past', '/nba/phoenix-suns/promos/past', '/nhl/minnesota-wild/promos/past']) assert.ok(archivePaths.includes(p), `archive listed: ${p}`);
  assert.ok(!archivePaths.includes('/nhl/gray-club/promos/past'), 'a club with nothing played has no archive entry');
  process.env.PROMO_PAGES_LIVE = 'false';
  assert.deepEqual(await getPastPromoSitemap('2099-01-01'), { pages: [], archives: [] });
  process.env.PROMO_PAGES_LIVE = 'true';
});

const archiveParams = (sport: string, team: string) => ({ params: Promise.resolve({ sport, team }) });

test('the archive page: 404 for a club with nothing played; otherwise the seasons newest first, every row a link, breadcrumb, self canonical, description inside the battery’s bounds', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { default: PastPage, generateMetadata: pastMeta } = await import('../../past/page');
  await assert.rejects(() => PastPage(archiveParams('nhl', 'gray-club')), is404, 'nothing played: 404, not an empty page');
  assert.deepEqual(await pastMeta(archiveParams('nhl', 'gray-club')), {});
  await assert.rejects(() => PastPage(archiveParams('nba', 'past-club')), is404, 'the wrong sport is a 404');

  const h = await html(await PastPage(archiveParams('nhl', 'past-club')));
  const meta = await pastMeta(archiveParams('nhl', 'past-club'));
  assert.equal(meta.title, 'Past Club past promos and giveaways');
  assert.equal(meta.alternates?.canonical, 'https://www.getpromonight.com/nhl/past-club/promos/past');
  const desc = String(meta.description);
  assert.ok(desc.length >= 100 && desc.length <= 155, `description ${desc.length} chars: ${desc}`);
  assert.equal(meta.robots, undefined, 'indexable');
  assert.match(h, /<h1[^>]*>Past Club past promos and giveaways<\/h1>/);
  assert.match(h, /<span aria-current="page" class="text-rd-ink-soft">Past promos<\/span>/);
  assert.match(h, /href="\/nhl\/past-club"[^>]*>Past Club</, 'the team crumb');
  const seasons = [...h.matchAll(/>(\d{4}(?:-\d{2})?) season<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(seasons, ['2026-27', '2025-26', '2023-24'], 'newest season first');
  for (const slug of ['yesterday-towel', 'two-nights', 'yesterday-towel-2025-26', 'ancient-towel']) assert.match(h, new RegExp(`href="/nhl/past-club/promos/${slug}"`), `row: ${slug}`);
  assert.ok(!h.includes('href="/nhl/past-club/promos/tomorrow-towel"'), 'nothing upcoming');
  assert.ok(!h.includes('href="/nhl/past-club/promos/yesterday-towel-2027-28"'), 'nothing upcoming, next season');
  const ld = jsonLd(h).find((d) => d['@type'] === 'BreadcrumbList');
  assert.ok(ld, 'a BreadcrumbList');
  assert.equal(ld!.itemListElement[ld!.itemListElement.length - 1].name, 'Past promos');
  assert.equal((h.match(/<article /g) ?? []).length, 1, 'one article');
  assert.match(h, /<article class="page-content[^"]*" data-ad-region="content"/);
});

test('the archive and the team page agree on what a past promo is: a played special-ticket row counts in neither (ux-review D3)', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { default: PastPage } = await import('../../past/page');
  const h = await html(await PastPage(archiveParams('nhl', 'minnesota-wild')));
  assert.ok(!h.includes('href="/nhl/minnesota-wild/promos/played-puck-package"'), 'the pack is not an archive row');
  assert.match(h, /href="\/nhl\/minnesota-wild\/promos\/pride-night-2025-26"/, 'the played theme night is');
  assert.match(h, /1 promotion already played, newest first\./);
  assert.match(h, /<p class="m-0 font-rd text-\[12px\] text-rd-ink-faint">March 2026<\/p>/, 'the season span line');
  assert.match(h, /<time dateTime="2026-03-10"/, 'the row date is machine-readable');
  const wild = (await teamPageHtml('minnesota-wild')).html;
  assert.match(wild, /<a [^>]*href="\/nhl\/minnesota-wild\/promos\/past"[^>]*>All 1 past promo<\/a>/, 'the team page counts the same one');
});

test('team page: the server HTML carries the five most recent completed rows, the rest behind the expander, and the archive link with the full count', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const suns = (await teamPageHtml('phoenix-suns')).html;
  const completedRows = (suns.match(/>Completed<\/span>/g) ?? []).length;
  assert.equal(completedRows, 5, `${completedRows} completed rows server-rendered`);
  assert.match(suns, /Show 2 more completed promos/);
  assert.match(suns, /<a [^>]*href="\/nba\/phoenix-suns\/promos\/past"[^>]*>All 7 past promos<\/a>/);
  // The five are the most recent: Rally Towel (Oct 13) in, Ring Night (Oct 1) out.
  assert.ok(suns.includes('href="/nba/phoenix-suns/promos/rally-towel"'), 'the newest played row is in the HTML');
  assert.ok(!suns.includes('href="/nba/phoenix-suns/promos/ring-night"'), 'the oldest is behind the expander');
});


// ── the forecast (step 5b, rulings 2026-11-08) ──────────────────────────────
test('the forecast row: a failed NWS call renders the page without it and does not throw; a good call renders it inside Before you go with the label by roof; the roof\u2019s source never reaches the page', async () => {
  process.env.PROMO_PAGES_LIVE = 'true';
  const { _resetForecastForTests } = await import('@/lib/forecast');
  _resetForecastForTests();
  nwsCalls.length = 0;
  // The hat is today (within the window), the Wild's building has coordinates.
  const failed = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  assert.ok(!failed.h.includes('data-forecast-row'), 'no row on a failed call');
  assert.ok(nwsCalls.some((u) => u.startsWith('https://api.weather.gov/points/44.9448,-93.1010')), `the page asked NWS: ${nwsCalls.join(' ')}`);
  assert.match(failed.h, /id="before-you-go"/, 'the block still renders its other rows');

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/geo+json' } });
  const period = (startTime: string, endTime: string, isDaytime: boolean, temperature: number, pop: number, shortForecast: string) => ({ startTime, endTime, isDaytime, temperature, temperatureUnit: 'F', probabilityOfPrecipitation: { value: pop }, shortForecast });
  nwsHandler = (url) => (url.startsWith('https://api.weather.gov/points/')
    ? json({ properties: { forecast: 'https://api.weather.gov/gridpoints/MPX/108,72/forecast' } })
    : json({ properties: { updateTime: '2026-10-29T14:06:00+00:00', periods: [period('2026-10-29T06:00:00-05:00', '2026-10-29T18:00:00-05:00', true, 52, 5, 'Sunny'), period('2026-10-29T18:00:00-05:00', '2026-10-30T06:00:00-05:00', false, 36, 20, 'Partly Cloudy')] } }));
  _resetForecastForTests();
  const ok = await render('nhl', 'minnesota-wild', 'blaze-orange-hat');
  const at = ok.h.indexOf('data-forecast-row');
  assert.ok(at > 0, 'the row renders');
  assert.ok(ok.h.indexOf('id="before-you-go"') < at && at < ok.h.indexOf('gameday guide'), 'inside Before you go, after the provenance rows');
  const row = ok.h.slice(at, ok.h.indexOf('</dd>', at));
  assert.match(row, /<dt[^>]*>Outside at puck drop<\/dt>/, 'a fixed roof on an NHL club');
  assert.ok(row.includes('Partly cloudy, high 52°, low 36°, 20% chance of precipitation'), row);
  assert.match(row, /data-forecast-icon="cloud-moon"/);
  assert.ok(row.includes('Forecast from weather.gov, updated Oct 29, 9:06 AM CT'), row);
  assert.ok(!ok.h.includes('roof-source-never-shipped'), 'sources.roof is not in the served HTML or the flight payload');
  // Eight days out: the page asks nothing.
  nwsCalls.length = 0;
  const far = await render('nhl', 'minnesota-wild', 'winter-beanie'); // 2026-12-05, 37 days out
  assert.ok(!far.h.includes('data-forecast-row'));
  assert.equal(nwsCalls.length, 0, 'no call outside the window');
  nwsHandler = () => new Response('', { status: 500 });
});
