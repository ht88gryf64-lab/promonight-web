/* eslint-disable no-console */
// Firecrawl fetch module (TS port of promo-pipeline/lib/extract/firecrawl-fetch.js).
// Markdown-only scrape of a URL with the proven safeguards from the scanner rework:
//   1. Render wait (waitFor default 8000ms).
//   2. Thin-page detection + one longer-wait retry (15000ms), capped at one.
//   3. No-error-page-clobber: reject non-200 before the body is read; signature-
//      match a 200 body that is actually a 404 / "page not found".
//   4. Rate-limit / transient retry with exponential backoff (default 3 attempts).
//   5. Concurrency cap: batch runner pools at a configurable limit (default 5 for
//      the CFB run; the sweep proved schools-sequential keeps peak in-flight <= 5).
//
// Dependency-injectable (opts.client, opts.sleep) so tests spend ZERO credits.
// Requiring this module is side-effect-free; the API key is read lazily.

export const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
export const FIRECRAWL_MAP_ENDPOINT = 'https://api.firecrawl.dev/v2/map';

const DEFAULT_WAIT_MS = 8000;
const THIN_RETRY_WAIT_MS = 15000;
const THIN_CHAR_THRESHOLD = 2000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
const DEFAULT_CONCURRENCY = 5;

const ERROR_PAGE_SIGNATURES = [
  /we dropped the ball/i,
  /reached this page in error/i,
  /\b404 not found\b/i,
  /\bpage not found\b/i,
];

export type ClientResponse =
  | { kind: 'response'; statusCode: number | null; markdown: string }
  | { kind: 'rate-limited'; detail: string }
  | { kind: 'error'; detail: string };

export type FirecrawlClient = (url: string, opts: { waitFor?: number }) => Promise<ClientResponse>;

export type FetchFailure = { ok: false; reason: 'non-200' | 'error-page' | 'thin-after-retry' | 'rate-limited' | 'fetch-error'; detail?: unknown };
export type FetchSuccess = { ok: true; markdown: string; statusCode: number | null; charCount: number; attempts: number };
export type FetchResult = FetchSuccess | FetchFailure;

export interface FetchOpts {
  client?: FirecrawlClient;
  apiKey?: string;
  waitFor?: number;
  thinRetryWaitFor?: number;
  thinThreshold?: number;
  maxAttempts?: number;
  backoffBaseMs?: number;
  concurrency?: number;
  sleep?: (ms: number) => Promise<void>;
}

function errMsg(err: unknown): string {
  return err && (err as Error).message ? (err as Error).message : String(err);
}
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function makeFirecrawlClient(apiKey: string): FirecrawlClient {
  return async function firecrawlClient(url, { waitFor } = {}) {
    let res: Response;
    try {
      res = await fetch(FIRECRAWL_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false, waitFor }),
      });
    } catch (err) {
      return { kind: 'error', detail: 'fetch-threw: ' + errMsg(err) };
    }
    if (res.status === 429) return { kind: 'rate-limited', detail: 'http 429' };
    let json: any = {};
    try { json = await res.json(); } catch { json = {}; }
    if (!res.ok) return { kind: 'error', detail: 'http ' + res.status + (json && json.error ? ': ' + json.error : '') };
    if (json.success !== true) return { kind: 'error', detail: (json && json.error) || 'firecrawl success=false' };
    const data = json.data || {};
    const statusCode = data.metadata && typeof data.metadata.statusCode === 'number' ? data.metadata.statusCode : null;
    return { kind: 'response', statusCode, markdown: typeof data.markdown === 'string' ? data.markdown : '' };
  };
}

function resolveClient(opts: FetchOpts): FirecrawlClient {
  if (opts.client) return opts.client;
  const apiKey = opts.apiKey || process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('firecrawl-fetch: FIRECRAWL_API_KEY is required (or inject opts.client)');
  return makeFirecrawlClient(apiKey);
}
function resolveConcurrency(opts: FetchOpts): number {
  if (opts.concurrency != null) return opts.concurrency;
  const env = Number(process.env.FIRECRAWL_CONCURRENCY);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_CONCURRENCY;
}
function matchErrorPage(markdown: string): string | null {
  const md = String(markdown || '');
  for (const re of ERROR_PAGE_SIGNATURES) if (re.test(md)) return re.source;
  return null;
}

type Guard = { verdict: 'non-200' | 'error-page' | 'thin' | 'ok'; matched?: string };
function guardResponse(resp: { statusCode: number | null; markdown: string }, thinThreshold: number): Guard {
  if (resp.statusCode !== 200) return { verdict: 'non-200' };
  const matched = matchErrorPage(resp.markdown);
  if (matched) return { verdict: 'error-page', matched };
  if (resp.markdown.length < thinThreshold) return { verdict: 'thin' };
  return { verdict: 'ok' };
}

async function attemptScrape(client: FirecrawlClient, url: string, waitFor: number, maxAttempts: number, sleep: (ms: number) => Promise<void>, backoffBase: number) {
  let attempts = 0;
  let lastKind: 'rate-limited' | 'error' = 'error';
  let lastDetail: string | null = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    attempts += 1;
    let r: ClientResponse;
    try { r = await client(url, { waitFor }); } catch (err) { r = { kind: 'error', detail: 'client-threw: ' + errMsg(err) }; }
    if (r && r.kind === 'response') return { kind: 'response' as const, statusCode: r.statusCode, markdown: typeof r.markdown === 'string' ? r.markdown : '', attempts };
    lastKind = r && r.kind === 'rate-limited' ? 'rate-limited' : 'error';
    lastDetail = (r && (r as any).detail) || lastKind;
    if (i < maxAttempts - 1) await sleep(backoffBase * Math.pow(2, i));
  }
  return { kind: lastKind, detail: lastDetail, attempts };
}

const success = (markdown: string, statusCode: number | null, attempts: number): FetchSuccess => ({ ok: true, markdown, statusCode, charCount: markdown.length, attempts });
const fail = (reason: FetchFailure['reason'], detail?: unknown): FetchFailure => ({ ok: false, reason, detail });

/** Fetch one URL to clean markdown or a clean failure (discriminated result). */
export async function fetchMarkdown(url: string, opts: FetchOpts = {}): Promise<FetchResult> {
  const client = resolveClient(opts);
  const waitFor = opts.waitFor != null ? opts.waitFor : DEFAULT_WAIT_MS;
  const thinRetryWaitFor = opts.thinRetryWaitFor != null ? opts.thinRetryWaitFor : THIN_RETRY_WAIT_MS;
  const thinThreshold = opts.thinThreshold != null ? opts.thinThreshold : THIN_CHAR_THRESHOLD;
  const maxAttempts = opts.maxAttempts != null ? opts.maxAttempts : DEFAULT_MAX_ATTEMPTS;
  const backoffBase = opts.backoffBaseMs != null ? opts.backoffBaseMs : BACKOFF_BASE_MS;
  const sleep = opts.sleep || realSleep;

  let totalAttempts = 0;
  const a = await attemptScrape(client, url, waitFor, maxAttempts, sleep, backoffBase);
  totalAttempts += a.attempts;
  if (a.kind === 'rate-limited') return fail('rate-limited', { attempts: totalAttempts, lastDetail: (a as any).detail });
  if (a.kind === 'error') return fail('fetch-error', { attempts: totalAttempts, lastDetail: (a as any).detail });

  const g1 = guardResponse(a as any, thinThreshold);
  if (g1.verdict === 'non-200') return fail('non-200', { statusCode: (a as any).statusCode });
  if (g1.verdict === 'error-page') return fail('error-page', { matched: g1.matched, charCount: (a as any).markdown.length });
  if (g1.verdict === 'ok') return success((a as any).markdown, (a as any).statusCode, totalAttempts);

  const b = await attemptScrape(client, url, thinRetryWaitFor, maxAttempts, sleep, backoffBase);
  totalAttempts += b.attempts;
  if (b.kind === 'rate-limited') return fail('rate-limited', { attempts: totalAttempts, lastDetail: (b as any).detail });
  if (b.kind === 'error') return fail('fetch-error', { attempts: totalAttempts, lastDetail: (b as any).detail });

  const g2 = guardResponse(b as any, thinThreshold);
  if (g2.verdict === 'non-200') return fail('non-200', { statusCode: (b as any).statusCode });
  if (g2.verdict === 'error-page') return fail('error-page', { matched: g2.matched, charCount: (b as any).markdown.length });
  if (g2.verdict === 'ok') return success((b as any).markdown, (b as any).statusCode, totalAttempts);

  return fail('thin-after-retry', { firstCharCount: (a as any).markdown.length, retryCharCount: (b as any).markdown.length, threshold: thinThreshold });
}

/** Batch runner: scrape many URLs through a pool that never exceeds the cap. */
export async function fetchMarkdownBatch(urls: string[], opts: FetchOpts = {}): Promise<{ url: string; result: FetchResult }[]> {
  const list = Array.isArray(urls) ? urls : [];
  const results = new Array<{ url: string; result: FetchResult }>(list.length);
  if (list.length === 0) return results;
  const concurrency = Math.max(1, resolveConcurrency(opts));
  let next = 0;
  async function worker() {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= list.length) return;
      results[idx] = { url: list[idx], result: await fetchMarkdown(list[idx], opts) };
    }
  }
  const poolSize = Math.min(concurrency, list.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

export const __consts = { DEFAULT_WAIT_MS, THIN_RETRY_WAIT_MS, THIN_CHAR_THRESHOLD, DEFAULT_CONCURRENCY, ERROR_PAGE_SIGNATURES };
