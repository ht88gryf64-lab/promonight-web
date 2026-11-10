// /cfb/rivalries rendered end to end (fix/gsc-cleanup-2026-11): the real
// page and its real generateMetadata over a stubbed index read. The H1, the
// lede and the Rivalry Week line must carry the stored game days, and the
// old typed "November 21 through 29" must be gone.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test src/app/cfb/rivalries/__tests__/rivalries-page.test.tsx
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { RivalryIndexRow } from '@/lib/cfb/rivalry-index';

const row = (slug: string, date: string | null): RivalryIndexRow => ({ slug, name: slug, date, matchup: 'Alabama vs Auburn', venueName: null, trophy: null, colors: [null, null] });
const ROWS: RivalryIndexRow[] = [
  row('big-game', '2026-11-21'),
  row('egg-bowl', '2026-11-27'),
  row('iron-bowl', '2026-11-28'),
  row('red-river', '2026-10-10'),
];

mock.module('server-only', { namedExports: {} });
mock.module(new URL('../../../../lib/cfb/matchups.ts', import.meta.url).href, { namedExports: { getMatchupIndexRows: async () => ROWS } });
mock.module(new URL('../../../../components/cfb/rivalry/fonts.ts', import.meta.url).href, { namedExports: { barlowCondensed: { variable: 'font-cfb-condensed' } } });

async function html(el: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(el);
  let out = '';
  for await (const c of prelude) out += c;
  return out;
}
const text = (h: string) => h.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('the H1 and the <title> carry the Rivalry Week dates', async () => {
  const mod = await import('../page');
  const h = await html(await mod.default());
  const h1s = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
  assert.deepEqual(h1s, ['College Football Rivalry Week 2026: Nov 27-28']);
  const md = await mod.generateMetadata();
  assert.equal(md.title, 'College Football Rivalry Week 2026: Nov 27-28');
  assert.equal(md.title, h1s[0], 'the H1 is the title');
});

test('the first sentence answers "when", the section line is derived, no typed dates remain', async () => {
  const mod = await import('../page');
  const h = await html(await mod.default());
  const lede = text(h.slice(h.indexOf('</h1>'), h.indexOf('</p>', h.indexOf('</h1>'))));
  assert.match(lede, /^College football Rivalry Week 2026 is Friday, November 27 and Saturday, November 28\. /);
  assert.ok(text(h).includes('Friday, November 27 and Saturday, November 28.'));
  assert.doesNotMatch(text(h), /November 21 through 29|regular season, November/);
  // Big Game leaves the section and stays in the full list: one row link.
  assert.equal([...h.matchAll(/href="\/cfb\/rivalries\/big-game"/g)].length, 1);
  assert.equal([...h.matchAll(/href="\/cfb\/rivalries\/iron-bowl"/g)].length, 2, 'in the section and the full list');
});

test('the page source types no Rivalry Week date', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /November \d|Nov \d/);
});

// ── tense with the clock set (Gate 3 follow-up, ruling 2026-11-10) ───────────
async function renderAt(iso: string) {
  mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
  try {
    const mod = await import('../page');
    const h = await html(await mod.default());
    const md = await mod.generateMetadata();
    return { h, md };
  } finally {
    mock.timers.reset();
  }
}
const ldOf = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

for (const [label, iso, verb, played] of [
  ['Nov 20, before the window', '2026-11-20T17:00:00Z', 'is', 'are'],
  ['Nov 30, after the window', '2026-11-30T17:00:00Z', 'was', 'were'],
] as const) {
  test(`tense on ${label}: description, first sentence and FAQ read "${verb}"; title, H1 and ItemList name unchanged`, async () => {
    const { h, md } = await renderAt(iso);
    const answer = `College football Rivalry Week 2026 ${verb} Friday, November 27 and Saturday, November 28.`;
    assert.ok(String(md.description).startsWith(answer), String(md.description));
    const lede = text(h.slice(h.indexOf('</h1>'), h.indexOf('</p>', h.indexOf('</h1>'))));
    assert.ok(lede.startsWith(answer), lede);
    const ld = ldOf(h);
    const faq = ld.find((x) => x['@type'] === 'FAQPage');
    const rw = faq.mainEntity.find((q: { name: string }) => /Rivalry Week/.test(q.name));
    assert.ok(rw.acceptedAnswer.text.startsWith(answer), rw.acceptedAnswer.text);
    assert.match(rw.acceptedAnswer.text, new RegExp(` ${played} played on those days\\.$`));
    assert.ok(text(h).includes(rw.acceptedAnswer.text), 'the FAQ shown on the page says the same');
    // Unchanged by tense.
    assert.equal(md.title, 'College Football Rivalry Week 2026: Nov 27-28');
    assert.deepEqual([...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1])), ['College Football Rivalry Week 2026: Nov 27-28']);
    assert.equal(ld.find((x) => x['@type'] === 'ItemList').name, 'College Football Rivalries 2026');
  });
}
