// The explainer library (docs/per-promo-pages-v2-spec.md, "The explainer
// library"): one authored Markdown file per key under content/promo-explainers,
// read from disk once per server process. The copy is general knowledge about
// a promo type or theme, reviewed by Matt before merge; nothing here generates
// a word, and a page with no matching entry renders no block.
//
// FRONTMATTER: key, kind (type|theme), title, faqs (a list of {q, a}). BODY:
// the explainer prose, paragraphs separated by blank lines. The parser is
// deliberately narrow: it reads exactly that shape and throws on anything
// else, so a malformed entry fails the build-time test
// (src/lib/__tests__/promo-explainers.test.ts) rather than rendering oddly.
//
// LOOKUP CASCADE (spec): the row's themeKey entry, else the entry for its
// type, else nothing. "Type" here is the library's vocabulary, which names
// the ITEM for a gate giveaway (bobblehead, jersey, hat) and the kind of
// night otherwise (theme-night, food-deal, fireworks, ticket-package).
//
// DEPLOY NOTE: the files are read with fs at request time, so next.config.ts
// lists them in outputFileTracingIncludes for the promo route; without that
// the serverless bundle would not carry them and every page would render no
// guide, silently.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { PromoType } from './types';
import { BOBBLEHEAD_RE, FIREWORKS_RE, HAT_RE, JERSEY_RE } from './promo-helpers';

export interface PromoExplainerFaq {
  q: string;
  a: string;
}

export interface PromoExplainer {
  key: string;
  kind: 'type' | 'theme';
  title: string;
  /** Body paragraphs, in order. */
  paragraphs: string[];
  /** Words in the body (whitespace-separated). */
  wordCount: number;
  faqs: PromoExplainerFaq[];
  /** The source file's basename, for messages. */
  file: string;
}

export const EXPLAINERS_DIR = join(process.cwd(), 'content', 'promo-explainers');
export const EXPLAINER_WORDS = { min: 80, max: 160 } as const;
export const EXPLAINER_FAQS = { min: 2, max: 4 } as const;
/** The small-caps label every rendered guide sits under (spec: decided yes). */
export const EXPLAINER_LABEL = 'General guide';

const unquote = (s: string): string => {
  const t = s.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t;
};

/** Parse one explainer file. Throws with the file name on any malformation. */
export function parseExplainer(source: string, file: string): PromoExplainer {
  const text = source.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) throw new Error(`${file}: no frontmatter fence at the top`);
  const close = text.indexOf('\n---\n', 4);
  if (close === -1) throw new Error(`${file}: frontmatter never closes`);
  const front = text.slice(4, close).split('\n');
  const body = text.slice(close + 5).trim();

  let key: string | null = null;
  let kind: string | null = null;
  let title: string | null = null;
  const faqs: PromoExplainerFaq[] = [];
  let inFaqs = false;
  for (const raw of front) {
    if (!raw.trim()) continue;
    if (!raw.startsWith(' ')) {
      inFaqs = false;
      const m = /^([a-z]+):\s*(.*)$/.exec(raw);
      if (!m) throw new Error(`${file}: unreadable frontmatter line "${raw}"`);
      const [, k, v] = m;
      if (k === 'key') key = unquote(v);
      else if (k === 'kind') kind = unquote(v);
      else if (k === 'title') title = unquote(v);
      else if (k === 'faqs') {
        if (v.trim()) throw new Error(`${file}: faqs must be a list`);
        inFaqs = true;
      } else throw new Error(`${file}: unknown frontmatter key "${k}"`);
      continue;
    }
    if (!inFaqs) throw new Error(`${file}: indented line outside faqs: "${raw}"`);
    const q = /^\s*-\s+q:\s*(.*)$/.exec(raw);
    const a = /^\s+a:\s*(.*)$/.exec(raw);
    if (q) faqs.push({ q: unquote(q[1]), a: '' });
    else if (a) {
      const last = faqs[faqs.length - 1];
      if (!last || last.a) throw new Error(`${file}: an answer without its question`);
      last.a = unquote(a[1]);
    } else throw new Error(`${file}: unreadable faq line "${raw}"`);
  }
  if (!key) throw new Error(`${file}: missing key`);
  if (kind !== 'type' && kind !== 'theme') throw new Error(`${file}: kind must be type or theme`);
  if (!title) throw new Error(`${file}: missing title`);
  for (const f of faqs) if (!f.q || !f.a) throw new Error(`${file}: a faq is missing its question or answer`);
  if (!body) throw new Error(`${file}: empty body`);
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  return { key, kind, title, paragraphs, wordCount, faqs, file };
}

/** Every entry file in a directory (README.md and non-Markdown files aside). */
export function explainerFiles(dir: string = EXPLAINERS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((f) => join(dir, f));
}

let cached: Map<string, PromoExplainer> | null = null;

/** The library, keyed on `key`, read once per process. A file whose key does
 *  not match its name throws: the key is the lookup, the name is the URL of
 *  the review, and the two must agree. */
export function loadExplainers(dir: string = EXPLAINERS_DIR): Map<string, PromoExplainer> {
  if (cached && dir === EXPLAINERS_DIR) return cached;
  const out = new Map<string, PromoExplainer>();
  for (const path of explainerFiles(dir)) {
    const file = basename(path);
    const entry = parseExplainer(readFileSync(path, 'utf-8'), file);
    if (entry.key !== file.replace(/\.md$/, '')) throw new Error(`${file}: key "${entry.key}" does not match the file name`);
    if (out.has(entry.key)) throw new Error(`${file}: duplicate key "${entry.key}"`);
    out.set(entry.key, entry);
  }
  if (dir === EXPLAINERS_DIR) cached = out;
  return out;
}

export interface ExplainerSubject {
  themeKey: string | null;
  type: PromoType;
  title: string;
  ticketPackageRequired: boolean | null;
}

/** The library's type key for a row: the item of a gate giveaway (the title
 *  names it), fireworks on any kind of night, the special-ticket package,
 *  else the kind of night. Null only when the type itself is unknown. */
export function explainerTypeKey(s: Omit<ExplainerSubject, 'themeKey'>): string | null {
  if (s.ticketPackageRequired === true) return 'ticket-package';
  if (FIREWORKS_RE.test(s.title)) return 'fireworks';
  if (s.type === 'giveaway') {
    if (BOBBLEHEAD_RE.test(s.title)) return 'bobblehead';
    if (JERSEY_RE.test(s.title)) return 'jersey';
    if (HAT_RE.test(s.title)) return 'hat';
    return 'giveaway';
  }
  if (s.type === 'theme') return 'theme-night';
  if (s.type === 'food') return 'food-deal';
  if (s.type === 'kids') return 'kids';
  return null;
}

/** The cascade: themeKey entry, else type entry, else null. */
export function explainerFor(s: ExplainerSubject, library: ReadonlyMap<string, PromoExplainer> = loadExplainers()): PromoExplainer | null {
  const themeKey = s.themeKey && s.themeKey !== 'none' ? s.themeKey : null;
  const theme = themeKey ? library.get(themeKey) : undefined;
  if (theme && theme.kind === 'theme') return theme;
  const typeKey = explainerTypeKey(s);
  const type = typeKey ? library.get(typeKey) : undefined;
  return type && type.kind === 'type' ? type : null;
}
