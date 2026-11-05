/* eslint-disable no-console */
// READ-ONLY. Runs the bag-answer builders over the published-hub fixture and
// prints the Gate 2 counts: eligible buildings, title variants and tiers,
// description lengths, topic questions, and the substring check.
// Run: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks scripts/serp/probe-bag-answers.ts
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../src/lib/firebase.ts', import.meta.url).href, { namedExports: { db: {} } });

async function main() {
  const A = await import('../../src/lib/venue-bag-answer');
  const hubs = JSON.parse(readFileSync(new URL('../../src/components/venue-hub/__tests__/fixtures/venue-hubs-published.json', import.meta.url), 'utf8'));
  const elig = hubs.filter(A.isBagAnswerEligible);
  const count = (xs: string[]) => xs.reduce((a: Record<string, number>, x) => ((a[x] = (a[x] ?? 0) + 1), a), {});
  console.log('eligible', elig.length, 'of', hubs.length);
  console.log('variants', count(elig.map(A.bagTitleVariant)));
  const tier = (h: any) => A.venueBagTitleCandidates(h).indexOf(A.venueBagTitle(h));
  console.log('title tiers (0 full,1 drop 2nd term,2 drop 1st term,3 drop year)', count(elig.map((h: any) => String(tier(h)))));
  const over = elig.filter((h: any) => A.venueBagTitle(h).length > 60);
  console.log('titles over 60', over.map((h: any) => h.slug));
  const dl = elig.map((h: any) => A.venueBagDescription(h).length);
  console.log('desc len min', Math.min(...dl), 'max', Math.max(...dl), 'out of 120-155', elig.filter((h: any) => { const n = A.venueBagDescription(h).length; return n < 120 || n > 155; }).map((h: any) => `${h.slug}:${A.venueBagDescription(h).length}`));
  let answers = 0, bad = 0;
  const topicCount: Record<string, number> = {};
  for (const h of elig) {
    const prose = A.sourcedBagProse(h).map((p) => p.text);
    const m = A.bagAnswerModel(h)!;
    for (const q of [m.lead, m.clutch].filter(Boolean)) { answers++; if (!prose.some((t) => t.includes(q!.text))) { bad++; console.log('BAD', h.slug, q!.text); } }
    for (const q of A.bagTopicQuestions(h)) { answers++; for (const t of q.topics) topicCount[t] = (topicCount[t] ?? 0) + 1; if (!prose.some((t) => t.includes(q.answer))) { bad++; console.log('BAD', h.slug, q.answer); } }
  }
  console.log('quoted strings', answers, 'not a substring', bad);
  console.log('topic coverage', topicCount, 'questions', elig.reduce((n: number, h: any) => n + A.bagTopicQuestions(h).length, 0));
  console.log('last verified shown on', elig.filter((h: any) => A.bagAnswerModel(h)!.lastVerified).map((h: any) => h.slug));
  // HOLDS=1 prints the condensed bag line (promo pages, CFB block) for each held
  // building before and after its holds, since promo pages cannot be previewed
  // (PROMO_PAGES_LIVE is production-only).
  if (process.env.HOLDS) {
    const { buildCondensedLogistics } = await import('../../src/lib/venue-hub-condensed');
    const { BAG_HOLDS, withBagHolds } = await import('../../src/lib/venue-bag-holds');
    for (const slug of [...new Set(BAG_HOLDS.map((x) => x.hub))]) {
      const h = hubs.find((x: any) => x.slug === slug);
      const line = (x: any) => buildCondensedLogistics(x, x.tenantOverlays?.[0]?.teamId ?? '').find((l: any) => l.key === 'bag')?.text ?? '(none)';
      console.log(`HOLD ${slug}\n  before: ${line(h)}\n  after:  ${line(withBagHolds(slug, h))}`);
    }
  }
  // TOPIC=storage prints every answer filed under that topic, for eyeballing.
  if (process.env.TOPIC) {
    for (const h of elig) for (const q of A.bagTopicQuestions(h)) if (q.topics.includes(process.env.TOPIC as never)) console.log(`${h.slug} [${q.topics}] ${q.answer}`);
  }
  for (const s of (process.argv[2] ?? '').split(',').filter(Boolean)) {
    const h = hubs.find((x: any) => x.slug === s);
    console.log(`\n== ${s} eligible=${A.isBagAnswerEligible(h)}`);
    if (!A.isBagAnswerEligible(h)) continue;
    console.log('title:', A.venueBagTitle(h), A.venueBagTitle(h).length);
    console.log('h1   :', A.venueBagHeading(h));
    console.log('desc :', A.venueBagDescription(h), A.venueBagDescription(h).length);
    console.log('model:', JSON.stringify(A.bagAnswerModel(h), (k, v) => (k === 'start' || k === 'end' ? undefined : v)));
    for (const q of A.bagTopicQuestions(h)) console.log('  Q', q.question, '\n    A', q.answer);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
