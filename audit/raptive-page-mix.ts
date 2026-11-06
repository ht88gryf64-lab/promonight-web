/**
 * raptive-page-mix.ts
 *
 * Standalone read-only audit of the live site's page mix for Raptive review.
 * Fetches every URL in the production sitemap, measures main-content word
 * counts, classifies each URL by route pattern, detects byline/date/schema
 * signals, and reports template similarity for venue and cfb-school pages.
 *
 * Run: npx tsx audit/raptive-page-mix.ts
 * Output: audit/raptive-page-mix.md (numbers only, no conclusions)
 *
 * Uses only Node builtins and global fetch. Does not touch Firestore or any
 * app code. Concurrency 5 with a polite per-worker delay and a cache-busting
 * query param on every page fetch.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.getpromonight.com";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const CONCURRENCY = 5;
const DELAY_MS = 300;
const FETCH_TIMEOUT_MS = 20_000;
const RETRIES = 2;
const USER_AGENT = "promonight-internal-audit/1.0 (raptive-page-mix)";
const SAMPLE_SIZE = 5;
const RNG_SEED = 42;

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "raptive-page-mix.md");

type RouteType =
  | "mlb-team"
  | "nfl-team"
  | "nba-team"
  | "nhl-team"
  | "mls-team"
  | "wnba-team"
  | "cfb-school"
  | "venue"
  | "aggregator"
  | "hub"
  | "other";

interface PageResult {
  url: string;
  path: string;
  routeType: RouteType;
  status: number; // 0 = network failure after retries
  words: number;
  byline: boolean;
  labeledDate: boolean;
  timeTag: boolean;
  personSchema: boolean;
  articleSchema: boolean;
  sentences: string[]; // normalized, only kept for similarity-sampled groups
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------------- route classification ---------------- */

function classify(path: string): RouteType {
  const p = path.replace(/\/+$/, "") || "/";
  const seg = p.split("/").filter(Boolean);

  if (seg.length === 2) {
    const [league, slug] = seg;
    if (league === "mlb") return "mlb-team";
    if (league === "nfl") return "nfl-team";
    if (league === "nba") return "nba-team";
    if (league === "nhl") return "nhl-team";
    if (league === "mls") return "mls-team";
    if (league === "wnba") return "wnba-team";
    if (league === "cfb") return slug === "rivalries" ? "other" : "cfb-school";
    if (league === "venues") return "venue";
    if (league === "promos") return "aggregator";
    if (league === "best-promos") return "aggregator";
  }
  if (seg.length === 1) {
    const [s] = seg;
    if (["mlb", "wnba", "mls", "nfl", "cfb", "teams", "venues"].includes(s)) return "hub";
    if (["best-promos", "team-rankings"].includes(s)) return "aggregator";
  }
  return "other"; // homepage, legal, /follow, /download, /world-cup, /cfb/rivalries/*
}

/* ---------------- fetching ---------------- */

// The timer stays armed through the body read so a stalled download aborts too.
async function fetchWithTimeout(url: string): Promise<{ status: number; html: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    const html = res.ok ? await res.text() : "";
    return { status: res.status, html };
  } finally {
    clearTimeout(t);
  }
}

async function fetchPage(url: string, i: number): Promise<{ status: number; html: string; error?: string }> {
  const sep = url.includes("?") ? "&" : "?";
  const busted = `${url}${sep}cb=${Date.now().toString(36)}${i.toString(36)}`;
  let lastError = "";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const { status, html } = await fetchWithTimeout(busted);
      if (status >= 500 && attempt < RETRIES) {
        lastError = `HTTP ${status}`;
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return { status, html };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt < RETRIES) await sleep(1000 * (attempt + 1));
    }
  }
  return { status: 0, html: "", error: lastError };
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) break;
        results[i] = await fn(items[i], i);
        done++;
        if (done % 50 === 0) console.error(`  ...${done}/${items.length}`);
        await sleep(DELAY_MS); // polite per-worker delay
      }
    })
  );
  return results;
}

/* ---------------- sitemap ---------------- */

async function collectSitemapUrls(): Promise<string[]> {
  const seen = new Set<string>();
  const queue = [SITEMAP_URL];
  const urls: string[] = [];
  while (queue.length) {
    const smUrl = queue.shift()!;
    if (seen.has(smUrl)) continue;
    seen.add(smUrl);
    const { status, html: xml } = await fetchWithTimeout(smUrl);
    if (status !== 200 || !xml) throw new Error(`Sitemap fetch failed: ${smUrl} HTTP ${status}`);
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
    if (/<sitemapindex[\s>]/i.test(xml)) {
      queue.push(...locs);
    } else {
      urls.push(...locs);
    }
  }
  return [...new Set(urls)];
}

/* ---------------- HTML processing ---------------- */

// Removes every occurrence of a block element, tolerating nested same-name tags.
function stripBalanced(html: string, tag: string): string {
  const openRe = new RegExp(`<${tag}(?=[\\s/>])`, "i");
  let out = html;
  for (let guard = 0; guard < 500; guard++) {
    const m = openRe.exec(out);
    if (!m) break;
    const start = m.index;
    const lower = out.toLowerCase();
    let depth = 0;
    let i = start;
    let end = -1;
    while (i < out.length) {
      const nextOpen = lower.indexOf(`<${tag}`, i);
      const nextClose = lower.indexOf(`</${tag}`, i);
      if (nextClose === -1) {
        end = out.length;
        break;
      }
      if (nextOpen !== -1 && nextOpen < nextClose) {
        const c = lower.charAt(nextOpen + tag.length + 1);
        if (c === " " || c === ">" || c === "/" || c === "\t" || c === "\n") depth++;
        i = nextOpen + tag.length + 1;
      } else {
        const c = lower.charAt(nextClose + tag.length + 2);
        const gt = lower.indexOf(">", nextClose);
        i = gt === -1 ? out.length : gt + 1;
        if (c === ">" || c === " " || c === "\t" || c === "\n") {
          depth--;
          if (depth <= 0) {
            end = i;
            break;
          }
        }
      }
    }
    if (end === -1) end = out.length;
    out = out.slice(0, start) + " " + out.slice(end);
  }
  return out;
}

// Returns inner HTML of the first balanced <main> block, or null.
function extractMain(html: string): string | null {
  const m = /<main(?=[\s/>])[^>]*>/i.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const lower = html.toLowerCase();
  let depth = 1;
  let i = start;
  while (i < html.length) {
    const nextOpen = lower.indexOf("<main", i);
    const nextClose = lower.indexOf("</main", i);
    if (nextClose === -1) return html.slice(start);
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const c = lower.charAt(nextOpen + 5);
      if (c === " " || c === ">" || c === "/") depth++;
      i = nextOpen + 5;
    } else {
      const c = lower.charAt(nextClose + 6);
      if (c === ">" || c === " " || c === "\t" || c === "\n") {
        depth--;
        if (depth === 0) return html.slice(start, nextClose);
      }
      i = nextClose + 6;
    }
  }
  return html.slice(start);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-",
  hellip: "...", copy: "(c)", reg: "(r)", trade: "(tm)", bull: "*",
  middot: "*", times: "x", eacute: "e",
};

function codePointToChar(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return " ";
  if (code === 8216 || code === 8217) return "'";
  if (code === 8220 || code === 8221) return '"';
  return String.fromCodePoint(code);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => codePointToChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePointToChar(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function htmlToText(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|li|h[1-6]|div|section|article|tr|td|th)>/gi, " \n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

/* ---------------- JSON-LD ---------------- */

function collectJsonLdTypes(html: string): Set<string> {
  const types = new Set<string>();
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      walkTypes(JSON.parse(b[1].trim()), types);
    } catch {
      // unparseable block, skip
    }
  }
  return types;
}

function walkTypes(node: unknown, out: Set<string>): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) walkTypes(n, out);
    return;
  }
  if (typeof node === "object") {
    const t = (node as Record<string, unknown>)["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") out.add(x);
    for (const v of Object.values(node as Record<string, unknown>)) walkTypes(v, out);
  }
}

const ARTICLE_TYPES = new Set(["Article", "NewsArticle", "BlogPosting", "TechArticle", "Report", "ScholarlyArticle"]);

/* ---------------- byline and date signals ---------------- */

const BYLINE_TEXT_STOPWORDS = new Set([
  "Clicking", "Using", "Continuing", "Submitting", "Signing", "Subscribing",
  "Entering", "Checking", "Visiting", "Purchasing", "Default",
]);

function detectByline(mainHtml: string, mainText: string): boolean {
  if (/rel=["']author["']/i.test(mainHtml)) return true;
  if (/(class|id|data-testid)=["'][^"']*\b(byline|author)\b[^"']*["']/i.test(mainHtml)) return true;
  const m = /(^|[\s>])By\s+([A-Z][a-zA-Z'.-]+)\s+[A-Z][a-zA-Z'.-]+/.exec(mainText);
  if (m && !BYLINE_TEXT_STOPWORDS.has(m[2])) return true;
  return false;
}

const MONTH = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const LABELED_DATE_RE = new RegExp(
  `(published|last updated|updated)[^.!?\\n]{0,40}?(${MONTH}\\.?\\s+\\d{1,2}(,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})`,
  "i"
);

function detectLabeledDate(mainText: string): boolean {
  return LABELED_DATE_RE.test(mainText);
}

function detectTimeTag(mainHtml: string): boolean {
  // A <time> element that renders something (not an immediately closed empty tag).
  return /<time(?=[\s/>])[^>]*>\s*(?!<\/time)/i.test(mainHtml);
}

/* ---------------- sentences and similarity ---------------- */

function extractSentences(mainText: string): string[] {
  const flat = mainText.replace(/\n+/g, ". ");
  const rough = flat.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const r of rough) {
    const norm = r
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (norm.split(" ").length >= 5) out.push(norm);
  }
  return [...new Set(out)];
}

function wordNgrams(sentences: string[], n: number): Set<string> {
  const grams = new Set<string>();
  for (const s of sentences) {
    const w = s.split(" ");
    for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(" "));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function meanPairwiseJaccard(sets: Set<string>[]): number {
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i], sets[j]);
      pairs++;
    }
  }
  return pairs ? (sum / pairs) * 100 : 0;
}

// Deterministic PRNG so the sample is reproducible across runs.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleN<T>(items: T[], n: number, rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/* ---------------- stats helpers ---------------- */

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function mean(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

function pct(n: number, d: number): string {
  return d ? `${((n / d) * 100).toFixed(1)}%` : "0.0%";
}

function processPage(url: string, path: string, routeType: RouteType, status: number, html: string): PageResult {
  const types = collectJsonLdTypes(html);

  // Strip non-content, then take the main region.
  let doc = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head(?![a-zA-Z])[\s\S]*?<\/head\s*>/i, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ");
  for (const tag of ["template", "iframe", "svg"]) doc = stripBalanced(doc, tag);

  const mainRegion = extractMain(doc) ?? ["header", "nav", "footer"].reduce((h, t) => stripBalanced(h, t), doc);
  // Even inside <main>, drop any nested nav elements (breadcrumbs, pill bars).
  const content = stripBalanced(mainRegion, "nav");
  const text = htmlToText(content);
  const keepSentences = routeType === "venue" || routeType === "cfb-school";

  return {
    url,
    path,
    routeType,
    status,
    words: countWords(text),
    byline: detectByline(content, text),
    labeledDate: detectLabeledDate(text),
    timeTag: detectTimeTag(content),
    personSchema: types.has("Person"),
    articleSchema: [...types].some((t) => ARTICLE_TYPES.has(t) || t.endsWith("Article")),
    sentences: keepSentences ? extractSentences(text) : [],
  };
}

/* ---------------- main ---------------- */

async function main(): Promise<void> {
  console.error(`Fetching sitemap: ${SITEMAP_URL}`);
  const urls = await collectSitemapUrls();
  console.error(`Sitemap URLs: ${urls.length}`);

  const results = await pool(urls, CONCURRENCY, async (url, i): Promise<PageResult> => {
    const path = url.replace(SITE, "").replace(/^$/, "/") || "/";
    const routeType = classify(path);
    const { status, html, error } = await fetchPage(url, i);
    if (status !== 200 || !html) {
      return {
        url, path, routeType, status, words: 0, byline: false, labeledDate: false,
        timeTag: false, personSchema: false, articleSchema: false, sentences: [], error,
      };
    }

    try {
      return processPage(url, path, routeType, status, html);
    } catch (e) {
      return {
        url, path, routeType, status, words: 0, byline: false, labeledDate: false,
        timeTag: false, personSchema: false, articleSchema: false, sentences: [],
        error: `parse: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  });

  const ok = results.filter((r) => r.status === 200 && !r.error);
  const failed = results.filter((r) => r.status !== 200 || r.error);

  /* per-route stats */
  const ROUTE_ORDER: RouteType[] = [
    "mlb-team", "nfl-team", "nba-team", "nhl-team", "mls-team", "wnba-team",
    "cfb-school", "venue", "aggregator", "hub", "other",
  ];
  const routeRows = ROUTE_ORDER.map((rt) => {
    const pages = ok.filter((r) => r.routeType === rt);
    const w = pages.map((p) => p.words);
    return {
      rt,
      count: pages.length,
      median: median(w),
      mean: mean(w),
      min: w.length ? Math.min(...w) : 0,
      max: w.length ? Math.max(...w) : 0,
    };
  });

  const over1000 = ok.filter((r) => r.words >= 1000).length;
  const over1500 = ok.filter((r) => r.words >= 1500).length;
  const lowest10 = [...ok].sort((a, b) => a.words - b.words).slice(0, 10);

  const bylineCount = ok.filter((r) => r.byline).length;
  const labeledDateCount = ok.filter((r) => r.labeledDate).length;
  const timeTagCount = ok.filter((r) => r.timeTag).length;
  const personCount = ok.filter((r) => r.personSchema).length;
  const articleCount = ok.filter((r) => r.articleSchema).length;

  /* similarity */
  const rng = mulberry32(RNG_SEED);
  const similarityRows: { group: string; urls: string[]; n: number; pairs: number; sentencePct: string; gramPct: string }[] = [];
  for (const group of ["venue", "cfb-school"] as const) {
    const pages = ok.filter((r) => r.routeType === group && r.sentences.length > 0);
    const sample = sampleN(pages, SAMPLE_SIZE, rng);
    const n = sample.length;
    const pairs = (n * (n - 1)) / 2;
    const sentenceSets = sample.map((p) => new Set(p.sentences));
    const gramSets = sample.map((p) => wordNgrams(p.sentences, 5));
    similarityRows.push({
      group,
      urls: sample.map((p) => p.path),
      n,
      pairs,
      sentencePct: pairs ? `${meanPairwiseJaccard(sentenceSets).toFixed(1)}%` : "n/a",
      gramPct: pairs ? `${meanPairwiseJaccard(gramSets).toFixed(1)}%` : "n/a",
    });
  }

  /* markdown report */
  const lines: string[] = [];
  lines.push("# Raptive page mix audit");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Source: ${SITEMAP_URL}`);
  lines.push(`Fetch: concurrency ${CONCURRENCY}, per-worker delay ${DELAY_MS}ms, cache-busting query param, UA "${USER_AGENT}"`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Total indexed URLs in sitemap: ${urls.length}`);
  lines.push(`- Fetched HTTP 200: ${ok.length}`);
  lines.push(`- Fetch or parse failures, or non-200: ${failed.length}`);
  lines.push("");
  lines.push("Word counts below cover only HTTP 200 pages. Words are counted in the main content region: the first balanced <main> element if present, otherwise the document with header, nav, and footer removed. Script, style, noscript, svg, iframe, template, comments, and nested nav are always removed.");
  lines.push("");
  lines.push("## Per route type");
  lines.push("");
  lines.push("| route type | count | median words | mean words | min | max |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of routeRows) {
    lines.push(`| ${r.rt} | ${r.count} | ${r.median} | ${r.mean} | ${r.min} | ${r.max} |`);
  }
  lines.push("");
  lines.push("## Word count thresholds (all HTTP 200 pages)");
  lines.push("");
  lines.push(`- At or above 1000 words: ${over1000} of ${ok.length} (${pct(over1000, ok.length)})`);
  lines.push(`- At or above 1500 words: ${over1500} of ${ok.length} (${pct(over1500, ok.length)})`);
  lines.push("");
  lines.push("## Ten lowest word-count pages");
  lines.push("");
  lines.push("| url | words | route type |");
  lines.push("|---|---|---|");
  for (const p of lowest10) lines.push(`| ${p.url} | ${p.words} | ${p.routeType} |`);
  lines.push("");
  lines.push("## Byline, date, and schema signals (all HTTP 200 pages)");
  lines.push("");
  lines.push(`- Visible author byline present: ${bylineCount} (${pct(bylineCount, ok.length)})`);
  lines.push(`- Visible labeled published or updated date present: ${labeledDateCount} (${pct(labeledDateCount, ok.length)})`);
  lines.push(`- Any <time> element with text in main content: ${timeTagCount} (${pct(timeTagCount, ok.length)})`);
  lines.push(`- Person schema in JSON-LD: ${personCount} (${pct(personCount, ok.length)})`);
  lines.push(`- Article-family schema in JSON-LD (Article, NewsArticle, BlogPosting, etc.): ${articleCount} (${pct(articleCount, ok.length)})`);
  lines.push("");
  lines.push("## Template similarity");
  lines.push("");
  lines.push(`Method: random sample of up to ${SAMPLE_SIZE} pages per group (seeded PRNG, seed ${RNG_SEED}); actual sample and pair counts are reported per row. Sentences are extracted from main content, lowercased, stripped of punctuation, and deduplicated; sentences under 5 words are dropped. Reported numbers are the mean pairwise Jaccard overlap across all sampled page pairs, as a percentage. Two measures: exact shared sentences, and shared word 5-grams drawn from those sentences.`);
  lines.push("");
  lines.push("| group | pages sampled | pairs | shared sentences | shared word 5-grams | sampled pages |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of similarityRows) {
    lines.push(`| ${s.group} | ${s.n} | ${s.pairs} | ${s.sentencePct} | ${s.gramPct} | ${s.urls.join(", ")} |`);
  }
  lines.push("");
  if (failed.length) {
    lines.push("## Fetch or parse failures and non-200 responses");
    lines.push("");
    lines.push("| url | status | error |");
    lines.push("|---|---|---|");
    for (const f of failed) lines.push(`| ${f.url} | ${f.status || "network"} | ${f.error ?? ""} |`);
    lines.push("");
  }
  lines.push("## Route classifier map");
  lines.push("");
  lines.push("| pattern | route type |");
  lines.push("|---|---|");
  lines.push("| /mlb/{slug} | mlb-team |");
  lines.push("| /nfl/{slug} | nfl-team |");
  lines.push("| /nba/{slug} | nba-team |");
  lines.push("| /nhl/{slug} | nhl-team |");
  lines.push("| /mls/{slug} | mls-team |");
  lines.push("| /wnba/{slug} | wnba-team |");
  lines.push("| /cfb/{slug} except /cfb/rivalries | cfb-school |");
  lines.push("| /venues/{slug} | venue |");
  lines.push("| /promos/{slug}, /best-promos, /best-promos/{slug}, /team-rankings | aggregator |");
  lines.push("| /mlb, /wnba, /mls, /nfl, /cfb, /teams, /venues | hub |");
  lines.push("| everything else (homepage, legal, /follow, /download, /world-cup, /cfb/rivalries and matchup pages) | other |");
  lines.push("");

  writeFileSync(OUT_PATH, lines.join("\n"));
  console.error(`Wrote ${OUT_PATH}`);

  /* stdout summary */
  console.log(`total=${urls.length} ok=${ok.length} failed=${failed.length}`);
  console.log(`>=1000w: ${over1000} (${pct(over1000, ok.length)})  >=1500w: ${over1500} (${pct(over1500, ok.length)})`);
  console.log(`byline=${bylineCount} labeledDate=${labeledDateCount} timeTag=${timeTagCount} person=${personCount} article=${articleCount}`);
  for (const r of routeRows) {
    console.log(`${r.rt}: n=${r.count} median=${r.median} mean=${r.mean} min=${r.min} max=${r.max}`);
  }
  for (const s of similarityRows) {
    console.log(`similarity ${s.group}: n=${s.n} pairs=${s.pairs} sentences=${s.sentencePct} grams5=${s.gramPct}`);
  }
  for (const p of lowest10) console.log(`low: ${p.words}w ${p.path} (${p.routeType})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
