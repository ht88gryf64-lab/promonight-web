// /ads.txt and /app-ads.txt must answer 200 to every client (chore/bot-firewall,
// 2026-11-02). Ad exchanges' ads.txt crawlers (Google-adstxt, Trade Desk,
// BidSwitch, IAB Tech Lab and others) fetch them with every kind of user agent,
// and every firewall rule exempts both paths. This file guards the app side:
// the route always answers 200 text/plain, the static file exists, and neither
// path is shadowed or intercepted. The served-bytes twin, fetched with several
// user agents, is in scripts/live/team-pages.live.test.ts (npm run test:live).

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { GET } from '../ads.txt/route';

const ROOT = join(__dirname, '..', '..', '..');
const realFetch = globalThis.fetch;

function stubFetch(impl: () => Promise<Response>) {
  globalThis.fetch = (async () => impl()) as typeof fetch;
}

describe('/ads.txt route', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const cases: Array<[string, () => Promise<Response>]> = [
    [
      'upstream answers',
      async () =>
        new Response(
          'google.com, pub-8501674430909082, DIRECT, f08c47fec0942fa0\nownerdomain=getpromonight.com\n' + '#'.repeat(80),
          { status: 200 },
        ),
    ],
    ['upstream 500', async () => new Response('err', { status: 500 })],
    ['upstream throws', async () => { throw new Error('network down'); }],
  ];

  for (const [name, impl] of cases) {
    it(`answers 200 text/plain with a body when ${name}`, async () => {
      stubFetch(impl);
      const res = await GET();
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
      const body = await res.text();
      assert.match(body, /google\.com, pub-\d+, DIRECT/);
    });
  }
});

describe('/app-ads.txt static file', () => {
  it('exists in public/ and lists a DIRECT seller line', () => {
    const file = join(ROOT, 'public', 'app-ads.txt');
    assert.ok(existsSync(file));
    assert.match(readFileSync(file, 'utf8'), /^google\.com, pub-\d+, DIRECT/m);
  });

  it('is not shadowed by a route, and /ads.txt is not shadowed by a static file', () => {
    assert.equal(existsSync(join(ROOT, 'src', 'app', 'app-ads.txt')), false);
    assert.equal(existsSync(join(ROOT, 'public', 'ads.txt')), false);
  });
});

describe('middleware', () => {
  it('its matcher skips both files', () => {
    const src = readFileSync(join(ROOT, 'src', 'middleware.ts'), 'utf8');
    const m = src.match(/matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'([^']+)'/);
    assert.ok(m, 'matcher literal found');
    const re = new RegExp(`^${m[1].replace(/\\\\/g, '\\')}$`);
    for (const p of ['/ads.txt', '/app-ads.txt']) assert.equal(re.test(p), false, p);
    assert.equal(re.test('/nhl/boston-bruins'), true, 'the matcher still runs on pages');
  });
});
