/* eslint-disable no-console */
/**
 * CTR diagnostic, Phase 3 PRE-MERGE verification. Reads a LOCAL render of the
 * branch only. Zero production requests.
 *
 * The branch is unmerged, so revalidating and curling getpromonight.com would
 * re-render main and report a false pass on changes that are not deployed. The
 * production revalidate + 7-page curl is the POST-MERGE step.
 *
 * Usage: start the local server first, then
 *   node --require ./scripts/stub-server-only.cjs --import tsx \
 *     --env-file=.env.local audit/ctr-phase3-verify.ts [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

const TREATMENT = ['los-angeles-dodgers', 'new-york-yankees', 'tampa-bay-rays'];
const CONTROL = ['detroit-tigers', 'chicago-white-sox', 'cleveland-guardians'];
const BOILERPLATE = 'special entertainment, themed merchandise';

// Titles captured from PRODUCTION in Phase 0 (Gate 0). Control pages must still
// render these byte-identically after the treatment change.
const GATE0_CONTROL_TITLES: Record<string, string> = {
  'detroit-tigers': 'Detroit Tigers Promos & Giveaways 2026 | PromoNight',
  'chicago-white-sox': 'Chicago White Sox Promos & Giveaways 2026 | PromoNight',
  'cleveland-guardians': 'Cleveland Guardians Promos & Giveaways 2026 | PromoNight',
};

const strip = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
   .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&nbsp;/g, ' ').replace(/&#x2F;/g, '/').replace(/\s+/g, ' ').trim();

function extract(html: string) {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
  const ogTitle = strip((html.match(/<meta property="og:title" content="([^"]*)"/i) ?? [])[1] ?? '');
  const desc = strip((html.match(/<meta name="description" content="([^"]*)"/i) ?? [])[1] ?? '');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

  let parseErrors = 0;
  let webPageName = '';
  const types: string[] = [];
  const faqQuestions: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    const t = o['@type'];
    if (typeof t === 'string') types.push(t);
    if (t === 'WebPage' && typeof o.name === 'string') webPageName = o.name;
    if (t === 'Question' && typeof o.name === 'string') faqQuestions.push(o.name);
    Object.values(o).forEach(walk);
  };
  for (const b of blocks) { try { walk(JSON.parse(b)); } catch { parseErrors++; } }

  const text = strip(html);
  const themeMatch = text.match(/The [^.]*? have \d+ theme nights? scheduled[^.]*\.(?:\s*Next up:[^.]*\.)?/);
  return {
    title, ogTitle, desc, webPageName, blocks: blocks.length, parseErrors,
    types: [...new Set(types)], faqQuestions,
    themePara: themeMatch ? themeMatch[0] : '(no theme paragraph found)',
    hasBoilerplate: html.includes(BOILERPLATE) || text.includes(BOILERPLATE),
    heroSubtitleGiveawaysTheme: /Giveaways &(?:amp;)? Theme Nights 2026/.test(html),
    heroSubtitlePromosGiveaways: /Promos &(?:amp;)? Giveaways 2026/.test(html),
    raw: html,
  };
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return extract(await res.text());
}

async function main() {
  const fails: string[] = [];
  const ok = (cond: boolean, msg: string) => { if (!cond) fails.push(msg); return cond ? 'PASS' : 'FAIL'; };

  console.log(`base: ${BASE}\n`);
  console.log('## Treatment pages (expect "Giveaways & Theme Nights 2026")\n');
  for (const slug of TREATMENT) {
    const r = await get(`/mlb/${slug}`);
    const want = ' Giveaways & Theme Nights 2026 | PromoNight';
    const t = ok(r.title.endsWith(want), `${slug}: <title> is "${r.title}"`);
    const o = ok(r.ogTitle === r.title, `${slug}: og:title "${r.ogTitle}" != title "${r.title}"`);
    const w = ok(r.webPageName + ' | PromoNight' === r.title, `${slug}: WebPage name "${r.webPageName}" does not match title`);
    const h = ok(r.heroSubtitleGiveawaysTheme && !r.heroSubtitlePromosGiveaways, `${slug}: hero subtitle not switched (treat=${r.heroSubtitleGiveawaysTheme} control=${r.heroSubtitlePromosGiveaways})`);
    const b = ok(!r.hasBoilerplate, `${slug}: boilerplate STILL PRESENT`);
    const j = ok(r.parseErrors === 0, `${slug}: ${r.parseErrors} JSON-LD parse errors`);
    console.log(`### ${slug}`);
    console.log(`  title(${r.title.length})   ${t}  ${r.title}`);
    console.log(`  og:title       ${o}`);
    console.log(`  WebPage name   ${w}  ${r.webPageName}`);
    console.log(`  hero subtitle  ${h}`);
    console.log(`  no boilerplate ${b}`);
    console.log(`  json-ld parse  ${j}  (${r.blocks} blocks, 0 errors expected)`);
    console.log(`  theme para     ${r.themePara}`);
    console.log(`  description    ${r.desc}\n`);
  }

  console.log('## Control pages (expect Gate 0 title byte-identical)\n');
  for (const slug of CONTROL) {
    const r = await get(`/mlb/${slug}`);
    const t = ok(r.title === GATE0_CONTROL_TITLES[slug], `${slug}: title drifted from Gate 0. got "${r.title}" want "${GATE0_CONTROL_TITLES[slug]}"`);
    const w = ok(r.webPageName + ' | PromoNight' === r.title, `${slug}: WebPage name "${r.webPageName}" does not match title`);
    const h = ok(r.heroSubtitlePromosGiveaways && !r.heroSubtitleGiveawaysTheme, `${slug}: hero subtitle should be unchanged`);
    const b = ok(!r.hasBoilerplate, `${slug}: boilerplate STILL PRESENT`);
    const j = ok(r.parseErrors === 0, `${slug}: ${r.parseErrors} JSON-LD parse errors`);
    console.log(`### ${slug}`);
    console.log(`  title(${r.title.length})   ${t}  ${r.title}`);
    console.log(`  WebPage name   ${w}`);
    console.log(`  hero subtitle  ${h}`);
    console.log(`  no boilerplate ${b}`);
    console.log(`  json-ld parse  ${j}  (${r.blocks} blocks)`);
    console.log(`  theme para     ${r.themePara}\n`);
  }

  console.log('## truist-park (article fix)\n');
  const v = await get('/venues/truist-park');
  const goodQ = 'Where do you park for an Atlanta Braves game?';
  const badQ = 'Where do you park for a Atlanta Braves game?';
  const inJson = v.faqQuestions.includes(goodQ);
  const inHtml = v.raw.includes(goodQ);
  const noBad = !v.raw.includes(badQ);
  console.log(`  visible H2 has "an"   ${ok(inHtml, 'truist-park: "an Atlanta Braves" missing from HTML')}`);
  console.log(`  FAQPage JSON-LD "an"  ${ok(inJson, 'truist-park: "an Atlanta Braves" missing from FAQPage JSON-LD')}`);
  console.log(`  old "a Atlanta" gone  ${ok(noBad, 'truist-park: old "a Atlanta Braves" still present')}`);
  console.log(`  json-ld parse         ${ok(v.parseErrors === 0, `truist-park: ${v.parseErrors} JSON-LD parse errors`)}`);
  console.log(`  FAQ questions: ${JSON.stringify(v.faqQuestions)}\n`);

  console.log('='.repeat(60));
  if (fails.length === 0) {
    console.log('ALL CHECKS PASS (7 pages)');
  } else {
    console.log(`${fails.length} FAILURE(S):`);
    fails.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};
