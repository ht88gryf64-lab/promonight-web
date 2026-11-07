// The explainer library is checked at build time (docs/per-promo-pages-v2-spec.md):
// every file parses, carries 80 to 160 words and 2 to 4 FAQs, matches its key
// to its name, and uses no em dash (house rule). The cascade is checked on
// fixtures: a theme entry wins, the type entry follows, nothing else renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  EXPLAINER_FAQS,
  EXPLAINER_WORDS,
  explainerFiles,
  explainerFor,
  explainerTypeKey,
  loadExplainers,
  parseExplainer,
  type PromoExplainer,
} from '../promo-explainers';

test('every explainer file parses and meets the length and FAQ rules', () => {
  const files = explainerFiles();
  assert.ok(files.length >= 10, `expected the first ten approved entries, found ${files.length}`);
  for (const path of files) {
    const file = basename(path);
    const e = parseExplainer(readFileSync(path, 'utf-8'), file);
    assert.equal(e.key, file.replace(/\.md$/, ''), `${file}: key matches the file name`);
    assert.ok(e.kind === 'type' || e.kind === 'theme', `${file}: kind`);
    assert.ok(e.title.length > 0, `${file}: title`);
    assert.ok(e.wordCount >= EXPLAINER_WORDS.min && e.wordCount <= EXPLAINER_WORDS.max, `${file}: ${e.wordCount} words, need ${EXPLAINER_WORDS.min} to ${EXPLAINER_WORDS.max}`);
    assert.ok(e.faqs.length >= EXPLAINER_FAQS.min && e.faqs.length <= EXPLAINER_FAQS.max, `${file}: ${e.faqs.length} FAQs, need ${EXPLAINER_FAQS.min} to ${EXPLAINER_FAQS.max}`);
    for (const f of e.faqs) assert.ok(f.q.trim() && f.a.trim(), `${file}: every FAQ has a question and an answer`);
    const all = [e.title, ...e.paragraphs, ...e.faqs.flatMap((f) => [f.q, f.a])].join('\n');
    assert.ok(!all.includes('—'), `${file}: no em dash`);
  }
  const lib = loadExplainers();
  assert.equal(lib.size, files.length);
});

test('the parser rejects a malformed entry rather than guessing', () => {
  assert.throws(() => parseExplainer('key: x\n', 'x.md'), /no frontmatter fence/);
  assert.throws(() => parseExplainer('---\nkey: x\nkind: type\ntitle: T\n---\n', 'x.md'), /empty body/);
  assert.throws(() => parseExplainer('---\nkey: x\nkind: other\ntitle: T\n---\nBody.', 'x.md'), /kind must be/);
  assert.throws(() => parseExplainer('---\nkey: x\nkind: type\ntitle: T\nextra: y\n---\nBody.', 'x.md'), /unknown frontmatter key/);
  assert.throws(() => parseExplainer('---\nkey: x\nkind: type\ntitle: T\nfaqs:\n  - q: Q?\n---\nBody.', 'x.md'), /missing its question or answer/);
  const ok = parseExplainer('---\nkey: x\nkind: type\ntitle: "T: colon"\nfaqs:\n  - q: Q one?\n    a: A: with colon.\n  - q: Q two?\n    a: A two.\n---\nFirst para.\n\nSecond para here.', 'x.md');
  assert.equal(ok.title, 'T: colon');
  assert.deepEqual(ok.faqs, [{ q: 'Q one?', a: 'A: with colon.' }, { q: 'Q two?', a: 'A two.' }]);
  assert.deepEqual(ok.paragraphs, ['First para.', 'Second para here.']);
  assert.equal(ok.wordCount, 5);
});

const entry = (key: string, kind: 'type' | 'theme'): PromoExplainer => ({ key, kind, title: key, paragraphs: ['p'], wordCount: 1, faqs: [], file: `${key}.md` });
const lib = new Map<string, PromoExplainer>([...['bobblehead', 'jersey', 'hat', 'fireworks', 'food-deal', 'theme-night'].map((k): [string, PromoExplainer] => [k, entry(k, 'type')]), ['pride', entry('pride', 'theme')], ['star-wars', entry('star-wars', 'theme')]]);

test('the type key names the item of a gate giveaway and the kind of night otherwise', () => {
  assert.equal(explainerTypeKey({ type: 'giveaway', title: 'Esa Lindell Bobblehead', ticketPackageRequired: null }), 'bobblehead');
  assert.equal(explainerTypeKey({ type: 'giveaway', title: 'Replica Jersey', ticketPackageRequired: null }), 'jersey');
  assert.equal(explainerTypeKey({ type: 'giveaway', title: 'Blaze Orange Hat', ticketPackageRequired: null }), 'hat');
  assert.equal(explainerTypeKey({ type: 'giveaway', title: 'Winter Beanie', ticketPackageRequired: null }), 'hat');
  assert.equal(explainerTypeKey({ type: 'giveaway', title: 'Lapel Pin Set', ticketPackageRequired: null }), 'giveaway');
  // A theme-ticket hat is not a gate giveaway: the night, not the item.
  assert.equal(explainerTypeKey({ type: 'theme', title: 'Hat Night', ticketPackageRequired: null }), 'theme-night');
  assert.equal(explainerTypeKey({ type: 'theme', title: 'Fireworks Night', ticketPackageRequired: null }), 'fireworks');
  assert.equal(explainerTypeKey({ type: 'food', title: 'Dollar Dogs', ticketPackageRequired: null }), 'food-deal');
  assert.equal(explainerTypeKey({ type: 'theme', title: 'Star Wars Night', ticketPackageRequired: true }), 'ticket-package');
});

test('the cascade: themeKey entry, else type entry, else nothing', () => {
  assert.equal(explainerFor({ themeKey: 'pride', type: 'theme', title: 'Pride Night', ticketPackageRequired: null }, lib)?.key, 'pride');
  // A themeKey with no entry falls through to the type.
  assert.equal(explainerFor({ themeKey: 'hockey-fights-cancer', type: 'theme', title: 'Hockey Fights Cancer Night', ticketPackageRequired: null }, lib)?.key, 'theme-night');
  assert.equal(explainerFor({ themeKey: 'none', type: 'giveaway', title: 'Blaze Orange Hat', ticketPackageRequired: null }, lib)?.key, 'hat');
  // No theme and no item: nothing, never a generic filler.
  assert.equal(explainerFor({ themeKey: null, type: 'giveaway', title: 'Lapel Pin Set', ticketPackageRequired: null }, lib), null);
  assert.equal(explainerFor({ themeKey: 'none', type: 'kids', title: 'Kids Run the Bases', ticketPackageRequired: null }, lib), null);
  // A type-kind entry is never served for a themeKey of the same name, and vice versa.
  const crossed = new Map<string, PromoExplainer>([['pride', entry('pride', 'type')]]);
  assert.equal(explainerFor({ themeKey: 'pride', type: 'theme', title: 'Pride Night', ticketPackageRequired: null }, crossed), null);
});
