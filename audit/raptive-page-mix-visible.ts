/**
 * raptive-page-mix-visible.ts
 *
 * Sibling of raptive-page-mix.ts (kept intact for comparability) that counts
 * VISIBLE UNIQUE words instead of raw main-content words. Three deltas from
 * the original, matching the known inflation causes:
 *
 *   1. JSON-LD: stripped in BOTH scripts (the original removes <script> before
 *      counting), so FAQ-into-JSON-LD duplication never inflated word counts;
 *      it only doubles served bytes. Recorded here for the avoidance of doubt.
 *   2. Block dedupe: any text segment of 4+ words that renders more than once
 *      in the same document (the twice-mounted Plan-your-visit and Tickets
 *      cards on venue pages, repeated per-row CTA copy elsewhere) is counted
 *      ONCE. Segments under 4 words (chips, labels, dates) keep duplicates.
 *   3. Seasonal promo rails: sections whose aria-labelledby matches the
 *      in-week promo surfaces (venue "promos-this-week" scroller, league-hub
 *      "{league}-this-week" and "{league}-today" rails) are measured
 *      separately and EXCLUDED from the corrected count, since those words
 *      vanish off-season. Team-page schedule/promo rows are page content and
 *      are NOT excluded.
 *
 * Per page it reports: wordsRaw (original method), wordsUnique (deduped,
 * rails included), railWords, wordsCorrected (deduped, rails excluded; the
 * off-season planning number).
 *
 * KNOWN LIMITATION of the dedupe: recurring promos whose rows repeat the same
 * title and description verbatim on one page (e.g. an every-Friday deal listed
 * per date) are collapsed to one occurrence, so promo-heavy route types read
 * conservatively LOW. This is accepted by the visible-unique definition
 * (repeated text is repeated text, whatever produced it); treat the corrected
 * numbers as a floor, not a midpoint, on promo-dense pages.
 *
 * Run: npx tsx audit/raptive-page-mix-visible.ts
 * Output: audit/raptive-page-mix-visible.md (numbers only, no conclusions)
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.getpromonight.com";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const CONCURRENCY = 5;
const DELAY_MS = 250;
const FETCH_TIMEOUT_MS = 20_000;
const RETRIES = 2;
const USER_AGENT = "promonight-internal-audit/1.0 (raptive-page-mix-visible)";

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "raptive-page-mix-visible.md");

// Sections excluded as seasonal in-week promo rails, by aria-labelledby.
const RAIL_ARIA_RE = /^(promos-this-week|[a-z]+-this-week|[a-z]+-today)$/;

type RouteType =
  | "mlb-team" | "nfl-team" | "nba-team" | "nhl-team" | "mls-team" | "wnba-team"
  | "cfb-school" | "venue" | "aggregator" | "hub" | "other";

interface PageResult {
  url: string;
  path: string;
  routeType: RouteType;
  status: number;
  wordsRaw: number;
  wordsUnique: number;
  railWords: number;
  wordsCorrected: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------------- route classification (identical to the original) ------- */

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
  return "other";
}

/* ---------------- fetching (identical mechanics) ------------------------- */

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
        await sleep(DELAY_MS);
      }
    })
  );
  return results;
}

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
    if (/<sitemapindex[\s>]/i.test(xml)) queue.push(...locs);
    else urls.push(...locs);
  }
  return [...new Set(urls)];
}

/* ---------------- HTML processing (helpers match the original) ----------- */

function stripBalanced(html: string, tag: string): string {
  const openRe = new RegExp(`<${tag}(?=[\\s/>])`, "i");
  let out = html;
  for (let guard = 0; guard < 500; guard++) {
    const m = openRe.exec(out);
    if (!m) break;
    const start = m.index;
    const end = balancedEnd(out, tag, start);
    out = out.slice(0, start) + " " + out.slice(end);
  }
  return out;
}

// Index just past the close tag that balances the open tag at `start`.
function balancedEnd(html: string, tag: string, start: number): number {
  const lower = html.toLowerCase();
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const nextOpen = lower.indexOf(`<${tag}`, i);
    const nextClose = lower.indexOf(`</${tag}`, i);
    if (nextClose === -1) return html.length;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      const c = lower.charAt(nextOpen + tag.length + 1);
      if (c === " " || c === ">" || c === "/" || c === "\t" || c === "\n") depth++;
      i = nextOpen + tag.length + 1;
    } else {
      const c = lower.charAt(nextClose + tag.length + 2);
      const gt = lower.indexOf(">", nextClose);
      i = gt === -1 ? html.length : gt + 1;
      if (c === ">" || c === " " || c === "\t" || c === "\n") {
        depth--;
        if (depth <= 0) return i;
      }
    }
  }
  return html.length;
}

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

/* ---------------- the three new measures --------------------------------- */

// Removes every <section aria-labelledby="<rail id>"> block; returns the
// remaining HTML and the concatenated removed HTML.
function extractRails(html: string): { rest: string; rails: string } {
  let rest = html;
  let rails = "";
  const re = /<section\b[^>]*aria-labelledby=["']([^"']+)["'][^>]*>/gi;
  for (let guard = 0; guard < 100; guard++) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = re.exec(rest)) !== null) {
      if (RAIL_ARIA_RE.test(m[1])) {
        const end = balancedEnd(rest, "section", m.index);
        rails += " " + rest.slice(m.index, end);
        rest = rest.slice(0, m.index) + " " + rest.slice(end);
        found = true;
        break; // restart scan on the mutated string
      }
    }
    if (!found) break;
  }
  return { rest, rails };
}

// Words counted with every 4+ word text segment counted once per document.
// Segments come from htmlToText's block boundaries (one per closed block
// element). Sub-4-word segments (chips, labels, dates) keep duplicates.
function countUniqueWords(text: string): number {
  const seen = new Set<string>();
  let words = 0;
  for (const seg of text.split("\n")) {
    const t = seg.trim();
    if (!t) continue;
    const w = countWords(t);
    if (w >= 4) {
      const key = t.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
    }
    words += w;
  }
  return words;
}

function processPage(url: string, path: string, routeType: RouteType, status: number, html: string): PageResult {
  let doc = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head(?![a-zA-Z])[\s\S]*?<\/head\s*>/i, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ");
  for (const tag of ["template", "iframe", "svg"]) doc = stripBalanced(doc, tag);

  const mainRegion = extractMain(doc) ?? ["header", "nav", "footer"].reduce((h, t) => stripBalanced(h, t), doc);
  const content = stripBalanced(mainRegion, "nav");

  const wordsRaw = countWords(htmlToText(content));
  const wordsUnique = countUniqueWords(htmlToText(content));
  const { rest, rails } = extractRails(content);
  const railWords = countWords(htmlToText(rails));
  const wordsCorrected = countUniqueWords(htmlToText(rest));

  return { url, path, routeType, status, wordsRaw, wordsUnique, railWords, wordsCorrected };
}

/* ---------------- stats -------------------------------------------------- */

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

/* ---------------- main --------------------------------------------------- */

async function main(): Promise<void> {
  console.error(`Fetching sitemap: ${SITEMAP_URL}`);
  const urls = await collectSitemapUrls();
  console.error(`Sitemap URLs: ${urls.length}`);

  const results = await pool(urls, CONCURRENCY, async (url, i): Promise<PageResult> => {
    const path = url.replace(SITE, "").replace(/^$/, "/") || "/";
    const routeType = classify(path);
    const { status, html, error } = await fetchPage(url, i);
    if (status !== 200 || !html) {
      return { url, path, routeType, status, wordsRaw: 0, wordsUnique: 0, railWords: 0, wordsCorrected: 0, error };
    }
    try {
      return processPage(url, path, routeType, status, html);
    } catch (e) {
      return {
        url, path, routeType, status, wordsRaw: 0, wordsUnique: 0, railWords: 0, wordsCorrected: 0,
        error: `parse: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  });

  const ok = results.filter((r) => r.status === 200 && !r.error);
  const failed = results.filter((r) => r.status !== 200 || r.error);

  const types: RouteType[] = [
    "mlb-team", "nfl-team", "nba-team", "nhl-team", "mls-team", "wnba-team",
    "cfb-school", "venue", "aggregator", "hub", "other",
  ];

  const lines: string[] = [];
  lines.push("# Raptive page mix, visible unique words");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Sibling of audit/raptive-page-mix.ts; raw counts use the identical method for comparability.`);
  lines.push(`Corrections applied here: 4+ word text segments deduplicated within each document; seasonal in-week promo rails (section aria-labelledby promos-this-week / {league}-this-week / {league}-today) measured separately and excluded from the corrected count. JSON-LD is stripped before counting in BOTH scripts, so it never inflated word counts.`);
  lines.push("");
  lines.push(`Total sitemap URLs ${urls.length}; HTTP 200 ${ok.length}; failures ${failed.length}.`);
  lines.push("");
  lines.push("## Per route type");
  lines.push("");
  lines.push("| route type | count | raw median | unique median | dup delta median | rail median | corrected median | corrected mean |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const t of types) {
    const rows = ok.filter((r) => r.routeType === t);
    if (!rows.length) continue;
    const dup = rows.map((r) => r.wordsRaw - r.wordsUnique);
    lines.push(
      `| ${t} | ${rows.length} | ${median(rows.map((r) => r.wordsRaw))} | ${median(rows.map((r) => r.wordsUnique))} | ` +
      `${median(dup)} | ${median(rows.map((r) => r.railWords))} | ${median(rows.map((r) => r.wordsCorrected))} | ${mean(rows.map((r) => r.wordsCorrected))} |`
    );
  }
  lines.push("");
  lines.push("## Sitewide thresholds");
  lines.push("");
  const raw1000 = ok.filter((r) => r.wordsRaw >= 1000).length;
  const uniq1000 = ok.filter((r) => r.wordsUnique >= 1000).length;
  const corr1000 = ok.filter((r) => r.wordsCorrected >= 1000).length;
  const raw1500 = ok.filter((r) => r.wordsRaw >= 1500).length;
  const uniq1500 = ok.filter((r) => r.wordsUnique >= 1500).length;
  const corr1500 = ok.filter((r) => r.wordsCorrected >= 1500).length;
  lines.push(`- Raw (original method): >=1000 ${raw1000} of ${ok.length} (${pct(raw1000, ok.length)}); >=1500 ${raw1500} (${pct(raw1500, ok.length)})`);
  lines.push(`- Unique (deduped, rails included): >=1000 ${uniq1000} (${pct(uniq1000, ok.length)}); >=1500 ${uniq1500} (${pct(uniq1500, ok.length)})`);
  lines.push(`- Corrected (deduped, rails excluded; off-season baseline): >=1000 ${corr1000} (${pct(corr1000, ok.length)}); >=1500 ${corr1500} (${pct(corr1500, ok.length)})`);
  lines.push("");
  lines.push("## Rail (seasonal) words per route type");
  lines.push("");
  lines.push("| route type | pages with a rail | rail words median (those pages) | rail words max |");
  lines.push("|---|---|---|---|");
  for (const t of types) {
    const rows = ok.filter((r) => r.routeType === t && r.railWords > 0);
    if (!rows.length) continue;
    lines.push(`| ${t} | ${rows.length} | ${median(rows.map((r) => r.railWords))} | ${Math.max(...rows.map((r) => r.railWords))} |`);
  }
  lines.push("");
  if (failed.length) {
    lines.push("## Failures");
    lines.push("");
    for (const f of failed) lines.push(`- ${f.path} HTTP ${f.status} ${f.error ?? ""}`);
    lines.push("");
  }

  writeFileSync(OUT_PATH, lines.join("\n"));
  // Per-page dump so downstream planning math can use the corrected numbers
  // without re-deriving them from the summary tables.
  writeFileSync(
    OUT_PATH.replace(/\.md$/, ".json"),
    JSON.stringify(
      ok.map((r) => ({
        path: r.path, routeType: r.routeType, wordsRaw: r.wordsRaw,
        wordsUnique: r.wordsUnique, railWords: r.railWords, wordsCorrected: r.wordsCorrected,
      })),
    )
  );
  console.error(`Wrote ${OUT_PATH}`);
  console.error(`raw>=1000: ${raw1000}  unique>=1000: ${uniq1000}  corrected>=1000: ${corr1000} of ${ok.length}`);
  const venue = ok.filter((r) => r.routeType === "venue");
  console.error(`venue corrected median: ${median(venue.map((r) => r.wordsCorrected))}  corrected>=1000: ${venue.filter((r) => r.wordsCorrected >= 1000).length}/${venue.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
