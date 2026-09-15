import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isUsableAdsTxt, resolveAdsTxt } from '../ads-txt';
import {
  ADS_TXT_FALLBACK,
  ADS_TXT_REVALIDATE_SECONDS,
  ADS_TXT_SOURCE_URL,
} from '../ads-txt-fallback';

const LIVE_BODY = [
  '#Raptive ads.txt (CafeMedia/AdThrive) v9.99-auto',
  'managerdomain=cafemedia.com',
  'contact=info@raptive.com',
  'google.com, pub-8501674430909082, DIRECT, f08c47fec0942fa0 #video, banner',
  'somenewpartner.com, 4242, RESELLER, abc123 #banner',
  'ownerdomain=getpromonight.com',
].join('\n');

function res(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('isUsableAdsTxt', () => {
  it('accepts a real ads.txt body', () => {
    assert.equal(isUsableAdsTxt(LIVE_BODY), true);
  });

  it('accepts the committed snapshot, so the fallback can never be rejected', () => {
    assert.equal(isUsableAdsTxt(ADS_TXT_FALLBACK), true);
  });

  it('rejects an empty body', () => {
    assert.equal(isUsableAdsTxt(''), false);
    assert.equal(isUsableAdsTxt('   \n  \n'), false);
  });

  it('rejects a 200 that is only comments, which authorizes nobody', () => {
    assert.equal(
      isUsableAdsTxt('# nothing here\n# still nothing\n# and a third line to clear the length floor aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      false,
    );
  });

  it('rejects an HTML error page served with 200', () => {
    assert.equal(
      isUsableAdsTxt('<!doctype html><html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway, upstream did not respond in time</body></html>'),
      false,
    );
  });

  it('rejects a truncated body that lost its records', () => {
    assert.equal(isUsableAdsTxt('managerdomain=cafemedia.com\ncontact=info@raptive.com'), false);
  });
});

describe('resolveAdsTxt', () => {
  it('returns upstream bytes UNMODIFIED when upstream is healthy', async () => {
    const out = await resolveAdsTxt(async () => res(LIVE_BODY));
    assert.equal(out.source, 'upstream');
    assert.equal(out.reason, 'upstream-ok');
    // byte-for-byte, including the variables and the trailing ownerdomain line
    assert.equal(out.body, LIVE_BODY);
  });

  it('requests the Raptive URL, not something else', async () => {
    let seen = '';
    await resolveAdsTxt(async (url) => {
      seen = String(url);
      return res(LIVE_BODY);
    });
    assert.equal(seen, ADS_TXT_SOURCE_URL);
  });

  it('serves the snapshot on a 500, never an error', async () => {
    const out = await resolveAdsTxt(async () => res('upstream exploded', 500));
    assert.equal(out.source, 'fallback');
    assert.equal(out.reason, 'upstream-status-500');
    assert.equal(out.body, ADS_TXT_FALLBACK);
  });

  it('serves the snapshot on a 404', async () => {
    const out = await resolveAdsTxt(async () => res('not found', 404));
    assert.equal(out.source, 'fallback');
    assert.equal(out.reason, 'upstream-status-404');
  });

  it('serves the snapshot when the fetch THROWS (DNS, TLS, timeout)', async () => {
    const out = await resolveAdsTxt(async () => {
      throw new Error('ENOTFOUND ads.adthrive.com');
    });
    assert.equal(out.source, 'fallback');
    assert.equal(out.reason, 'upstream-unreachable');
    assert.equal(out.body, ADS_TXT_FALLBACK);
  });

  it('serves the snapshot on a 200 with an EMPTY body', async () => {
    const out = await resolveAdsTxt(async () => res(''));
    assert.equal(out.source, 'fallback');
    assert.equal(out.reason, 'upstream-body-unusable');
    assert.equal(out.body, ADS_TXT_FALLBACK);
  });

  it('serves the snapshot on a 200 carrying an HTML error page', async () => {
    const out = await resolveAdsTxt(async () =>
      res('<!doctype html><html><body>503 Service Unavailable from the edge cache</body></html>'),
    );
    assert.equal(out.source, 'fallback');
    assert.equal(out.reason, 'upstream-body-unusable');
  });

  it('NEVER returns an empty body on any failure path', async () => {
    const failures: Array<() => Promise<Response>> = [
      async () => res('', 200),
      async () => res('', 500),
      async () => res('x', 200),
      async () => { throw new Error('boom'); },
    ];
    for (const f of failures) {
      const out = await resolveAdsTxt(f);
      assert.ok(out.body.length > 1000, `empty-ish body from a failure path: ${out.reason}`);
      assert.ok(isUsableAdsTxt(out.body));
    }
  });

  it('passes an hourly revalidate to the fetch rather than fetching per request', async () => {
    let init: RequestInit | undefined;
    await resolveAdsTxt(async (_url, i) => {
      init = i;
      return res(LIVE_BODY);
    });
    assert.equal((init as { next?: { revalidate?: number } })?.next?.revalidate, 3600);
  });
});

describe('route segment config', () => {
  it('the literal revalidate in the route matches ADS_TXT_REVALIDATE_SECONDS', async () => {
    // The route cannot import the constant: Next.js statically analyses route
    // segment config and fails the build on a non-literal. So the two are kept
    // in step here instead. If someone retunes the constant, this fails and
    // points at the literal that also has to move.
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/app/ads.txt/route.ts', 'utf8'),
    );
    const match = src.match(/export const revalidate = (\d+);/);
    assert.ok(match, 'route.ts must export a literal `revalidate`');
    assert.equal(Number(match![1]), ADS_TXT_REVALIDATE_SECONDS);
  });
});
