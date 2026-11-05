/* eslint-disable no-console */
// READ-ONLY. Builds the two fixtures the serp-targeting tests read, from a
// Firestore dump of venueHubs + tenants (scripts/serp/dump-venue-hubs.cjs).
//
//   1. venue-hubs-published.json: every building AFTER publishedView, i.e. the
//      exact object the venue page renders. `ungated` is stripped, so the file
//      holds only values the site already publishes (this repo is public).
//   2. venue-view-baseline.json: for every building, the venue title, meta
//      description, and the sha256 + byte length of the VenueHubView markup.
//      Generated ONCE from main (0373191) on 2026-11-05 before any change on
//      feature/serp-targeting, so the byte-identity test compares the branch
//      against main's own render, not against a re-derivation of it.
//
// Run (from the repo root):
//   TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx \
//     --experimental-test-module-mocks scripts/serp/venue-view-baseline.tsx <dump.json>
//
// Re-running it on a later commit overwrites the baseline with THAT commit's
// render, which defeats the test. Regenerate only from main, deliberately.
//
// BASELINE_OUT=<name.json> writes ONLY a baseline under that name and leaves
// both default fixtures alone. fix/venue-bag-holds uses it for
// venue-view-baseline-76579e7.json, main's render the day the holds were added.
import { mock } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../src/lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

const FIXTURE_DIR = new URL('../../src/components/venue-hub/__tests__/fixtures/', import.meta.url);

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) throw new Error('usage: venue-view-baseline.tsx <dump.json>');
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8')) as {
    hubs: Record<string, Record<string, unknown>>;
    tenants: Record<string, Array<Record<string, unknown>>>;
  };
  const { toVenueHub, venueHubTitle, venueHubDescription } = await import('../../src/lib/venue-hub');
  const { publishedView } = await import('../../src/lib/venue-published-view');
  const { overlayFromDoc } = await import('../../src/components/venue-hub/__tests__/fixtures/overlay-from-doc');
  const { renderVenueView } = await import('../../src/components/venue-hub/__tests__/fixtures/render-venue-view');

  const published: unknown[] = [];
  const baseline: Record<string, { title: string; description: string; htmlSha256: string; htmlBytes: number }> = {};
  for (const slug of Object.keys(dump.hubs).sort()) {
    const overlays = (dump.tenants[slug] ?? []).map(overlayFromDoc);
    const hub = publishedView(toVenueHub(slug, dump.hubs[slug], overlays));
    const { ungated: _drop, ...rest } = hub;
    // A held building publishes no claim, so its provenance maps are not
    // published either: drop them from the public fixture. The baseline is
    // rendered from this same stripped object, so the comparison stays exact.
    const pub = rest.verified ? rest : { ...rest, sources: {}, observedAtByField: {}, fieldStates: {} };
    published.push(pub);
    const html = renderVenueView(pub);
    baseline[slug] = {
      title: venueHubTitle(pub, { hasVendors: false }),
      description: venueHubDescription(pub),
      htmlSha256: createHash('sha256').update(html).digest('hex'),
      htmlBytes: Buffer.byteLength(html),
    };
  }
  mkdirSync(dirname(new URL('x', FIXTURE_DIR).pathname), { recursive: true });
  if (process.env.BASELINE_OUT) {
    writeFileSync(new URL(process.env.BASELINE_OUT, FIXTURE_DIR), JSON.stringify(baseline, null, 1) + '\n');
    console.log(`baseline only -> ${process.env.BASELINE_OUT}`);
  } else {
    writeFileSync(new URL('venue-hubs-published.json', FIXTURE_DIR), JSON.stringify(published, null, 1) + '\n');
    writeFileSync(new URL('venue-view-baseline.json', FIXTURE_DIR), JSON.stringify(baseline, null, 1) + '\n');
  }
  console.log(`buildings ${published.length}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
