// POST /api/revalidate/venue-hubs: the pipeline names buildings, the site
// refreshes every page that shows them and pings IndexNow.
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { NextResponse } from 'next/dist/server/web/spec-extension/response';

const revalidated: string[] = [];
const afterFns: Array<() => Promise<void>> = [];
const submitted: string[][] = [];

mock.module('server-only', { namedExports: {} });
mock.module('next/cache', { namedExports: { revalidatePath: (p: string) => { revalidated.push(p); } } });
mock.module('next/server', { namedExports: { NextResponse, after: (fn: () => Promise<void>) => { afterFns.push(fn); } } });
mock.module(new URL('../../../../../lib/indexnow.ts', import.meta.url).href, {
  namedExports: { submitToIndexNow: async (urls: string[]) => { submitted.push(urls); } },
});

const HUBS: Record<string, { tenants: Array<{ teamId: string; league: string }>; indexable: boolean }> = {
  'target-field': { tenants: [{ teamId: 'minnesota-twins', league: 'MLB' }], indexable: true },
  'us-bank-stadium': { tenants: [{ teamId: 'minnesota-vikings', league: 'NFL' }], indexable: false },
};
mock.module(new URL('../../../../../lib/venue-hub.ts', import.meta.url).href, {
  namedExports: {
    getVenueHub: async (slug: string) => (HUBS[slug] ? { slug, ...HUBS[slug] } : null),
    resolveTenantTeamLinks: async (hub: { tenants: Array<{ teamId: string; league: string }> }) =>
      hub.tenants.map((t) => ({ href: `/${t.league.toLowerCase()}/${t.teamId}` })),
    venueHubIsIndexable: (hub: { indexable: boolean }) => hub.indexable,
  },
});

const SECRET = 'test-secret';
process.env.REVALIDATE_SECRET = SECRET;

const post = async (body: unknown, secret: string | null = SECRET) => {
  const { POST } = await import('../route');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret) headers['x-revalidate-secret'] = secret;
  const res = await POST(new Request('https://www.getpromonight.com/api/revalidate/venue-hubs', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  return { status: res.status, json: await res.json() };
};

beforeEach(() => { revalidated.length = 0; afterFns.length = 0; submitted.length = 0; });

test('the plan: venue page, index, bag comparison for MLB, tenant pages; IndexNow only an indexable venue page', async () => {
  // Imported here, after the mocks: a static import would load next/cache first.
  const { hubRevalidationPlan } = await import('@/lib/venue-hub-revalidate');
  assert.deepEqual(
    hubRevalidationPlan({ slug: 'target-field', hub: { tenants: [{ league: 'MLB' }] }, indexable: true, tenantHrefs: ['/mlb/minnesota-twins'] }),
    {
      paths: ['/venues/target-field', '/venues', '/venues/bag-policies', '/mlb/minnesota-twins'],
      indexNowUrls: ['https://www.getpromonight.com/venues/target-field', 'https://www.getpromonight.com/mlb/minnesota-twins'],
    },
  );
  const nfl = hubRevalidationPlan({ slug: 'us-bank-stadium', hub: { tenants: [{ league: 'NFL' }] }, indexable: false, tenantHrefs: ['/nfl/minnesota-vikings'] });
  assert.ok(!nfl.paths.includes('/venues/bag-policies'));
  assert.deepEqual(nfl.indexNowUrls, ['https://www.getpromonight.com/nfl/minnesota-vikings']);
  const gone = hubRevalidationPlan({ slug: 'old-arena', hub: null, indexable: false, tenantHrefs: [] });
  assert.deepEqual(gone, { paths: ['/venues/old-arena', '/venues'], indexNowUrls: [] });
});

test('auth: wrong or missing secret is 401 and refreshes nothing', async () => {
  assert.equal((await post({ slugs: ['target-field'] }, 'nope')).status, 401);
  assert.equal((await post({ slugs: ['target-field'] }, null)).status, 401);
  assert.deepEqual(revalidated, []);
});

test('validation: bad JSON, non-array, empty, too many and malformed slugs are 400', async () => {
  assert.equal((await post('{')).status, 400);
  assert.equal((await post({ slugs: 'target-field' })).status, 400);
  assert.equal((await post({ slugs: [] })).status, 400);
  assert.equal((await post({ slugs: Array.from({ length: 26 }, (_, i) => `hub-${i}`) })).status, 400);
  const bad = await post({ slugs: ['target-field', 'Target_Field'] });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.slug, 'Target_Field');
  assert.deepEqual(revalidated, [], 'one bad slug fails the batch');
});

test('a batch refreshes every page that shows the buildings, then pings IndexNow after the response', async () => {
  const { status, json } = await post({ slugs: ['target-field', 'us-bank-stadium', 'target-field', 'gone-arena'] });
  assert.equal(status, 200);
  assert.deepEqual(json.slugs, ['target-field', 'us-bank-stadium', 'gone-arena']);
  assert.deepEqual(json.unknown, ['gone-arena']);
  assert.deepEqual(revalidated.sort(), [
    '/mlb/minnesota-twins', '/nfl/minnesota-vikings', '/venues', '/venues/bag-policies',
    '/venues/gone-arena', '/venues/target-field', '/venues/us-bank-stadium',
  ]);
  assert.equal(json.revalidated, 7);
  assert.equal(submitted.length, 0, 'IndexNow waits for after()');
  for (const fn of afterFns) await fn();
  assert.deepEqual(submitted[0].sort(), [
    'https://www.getpromonight.com/mlb/minnesota-twins',
    'https://www.getpromonight.com/nfl/minnesota-vikings',
    'https://www.getpromonight.com/venues/target-field',
  ]);
});
