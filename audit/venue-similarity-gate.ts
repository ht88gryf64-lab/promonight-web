/**
 * venue-similarity-gate.ts
 *
 * Regression gate for venue-page template similarity (audit/venue-thickening-plan.md
 * section 9e). Samples venue pages with a seeded PRNG, measures mean pairwise
 * shared word 5-grams (Jaccard, the raptive-page-mix method), and FAILS
 * (exit 1) above the threshold. Run against production for the before number
 * and against a local `next build && next start` for the after number, so no
 * similarity regression ships.
 *
 * Usage:
 *   npx tsx audit/venue-similarity-gate.ts                       # prod, sample 12, threshold 5%
 *   npx tsx audit/venue-similarity-gate.ts --base http://localhost:3199
 *   npx tsx audit/venue-similarity-gate.ts --sample 16 --threshold 5
 */

const args = process.argv.slice(2);
function argOf(name: string, dflt: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const BASE = argOf("base", "https://www.getpromonight.com").replace(/\/$/, "");
const SAMPLE = parseInt(argOf("sample", "12"), 10);
const THRESHOLD = parseFloat(argOf("threshold", "5"));
const SEED = 42;
const UA = "promonight-internal-audit/1.0 (venue-similarity-gate)";

async function fetchText(url: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}cb=${Date.now().toString(36)}${i}`, {
        headers: { "user-agent": UA, "cache-control": "no-cache" },
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return await r.text();
    } catch {
      /* retry */
    }
    await new Promise((r2) => setTimeout(r2, 500));
  }
  throw new Error(`fetch failed: ${url}`);
}

function stripAll(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head(?![a-zA-Z])[\s\S]*?<\/head\s*>/i, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, " ");
}

function mainText(html: string): string {
  const m = html.match(/<main[\s>][\s\S]*?<\/main>/i);
  return (m ? m[0] : html)
    .replace(/<nav\b[\s\S]*?<\/nav\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const norm = raw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (norm.split(" ").length >= 5) out.add(norm);
  }
  return [...out];
}

function grams5(sents: string[]): Set<string> {
  const g = new Set<string>();
  for (const s of sents) {
    const w = s.split(" ");
    for (let i = 0; i + 5 <= w.length; i++) g.add(w.slice(i, i + 5).join(" "));
  }
  return g;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

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

async function main(): Promise<void> {
  const xml = await fetchText(`${BASE}/sitemap.xml`);
  const venuePaths = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .filter((p) => /^\/venues\/[^/]+$/.test(p))
    .sort();
  if (venuePaths.length === 0) throw new Error("no venue paths in sitemap");

  const rng = mulberry32(SEED);
  const shuffled = [...venuePaths];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, Math.min(SAMPLE, shuffled.length));

  const sets: Set<string>[] = [];
  for (const p of sample) {
    const html = await fetchText(`${BASE}${p}`);
    sets.push(grams5(sentences(mainText(stripAll(html)))));
  }

  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i], sets[j]);
      pairs++;
    }
  }
  const pct = pairs ? (sum / pairs) * 100 : 0;
  console.log(`base=${BASE} sample=${sample.length} pairs=${pairs} shared-5-gram=${pct.toFixed(2)}% threshold=${THRESHOLD}%`);
  console.log(`sampled: ${sample.join(", ")}`);
  if (pct > THRESHOLD) {
    console.error(`GATE FAILED: ${pct.toFixed(2)}% > ${THRESHOLD}%`);
    process.exit(1);
  }
  console.log("GATE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
