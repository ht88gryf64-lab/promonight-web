/* eslint-disable no-console */
// Minimal raw-fetch Anthropic client (no SDK install — zero footprint on the
// web app). Mirrors the promo-pipeline infra pattern: Haiku + server-side
// web_search tool + a forced "return" tool for validated structured output,
// with a Sonnet fallback. ANTHROPIC_API_KEY comes from promo-pipeline/.env.local
// (loaded via --env-file), so promo-pipeline itself is untouched.

export const HAIKU = 'claude-haiku-4-5';
export const SONNET = 'claude-sonnet-4-6';
export const MAX_WEB_SEARCHES = 5;

const PRICING = { input: 1 / 1e6, output: 5 / 1e6, cacheWrite: 1.25 / 1e6, cacheRead: 0.1 / 1e6, webSearch: 10 / 1000 };

function cost(res: any): number {
  const u = res?.usage ?? {};
  let ws = 0;
  for (const b of res?.content ?? []) if (b.type === 'server_tool_use' && b.name === 'web_search') ws++;
  return (u.input_tokens ?? 0) * PRICING.input + (u.output_tokens ?? 0) * PRICING.output +
    (u.cache_creation_input_tokens ?? 0) * PRICING.cacheWrite + (u.cache_read_input_tokens ?? 0) * PRICING.cacheRead +
    ws * PRICING.webSearch;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function call(body: any): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not loaded (need --env-file=promo-pipeline/.env.local)');
  let lastErr: unknown;
  // Retry transient network failures ("fetch failed") + 429/5xx with backoff.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1000 * attempt);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.status === 429 || r.status >= 500) { lastErr = new Error(`anthropic ${r.status}`); continue; }
      const json = await r.json();
      if (!r.ok) throw new Error(`anthropic ${r.status}: ${JSON.stringify(json).slice(0, 300)}`);
      return json;
    } catch (e) {
      lastErr = e; // network error (e.g. "fetch failed") — retry
    }
  }
  throw lastErr;
}

export interface ExtractOpts {
  system: string;
  user: string;
  returnTool: { name: string; description: string; input_schema: any };
  model?: string;
  maxTokens?: number;
  maxTurns?: number;
  /** default true. When false, no web_search tool is offered — the model parses
   *  ONLY the text given in `user` (Phase 2 parser: parse the Firecrawl'd official
   *  markdown, source is fixed by code = the official URL, no wandering the web). */
  webSearch?: boolean;
}

/** Run an extraction that ends in a forced structured-tool call. With
 *  webSearch:true (default) the model may web_search first; with webSearch:false
 *  it parses only the provided text. Returns the tool input + total USD cost. */
export async function extract(opts: ExtractOpts): Promise<{ data: any | null; usd: number; stop: string }> {
  const model = opts.model ?? HAIKU;
  const useWebSearch = opts.webSearch !== false;
  const tools = useWebSearch
    ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: MAX_WEB_SEARCHES }, opts.returnTool]
    : [opts.returnTool];
  const messages: any[] = [{ role: 'user', content: opts.user }];
  let usd = 0;
  const maxTurns = opts.maxTurns ?? (useWebSearch ? 6 : 2);
  for (let turn = 0; turn < maxTurns; turn++) {
    const lastTurn = turn === maxTurns - 1;
    const body: any = { model, system: opts.system, messages, tools, max_tokens: opts.maxTokens ?? 4096 };
    // On the final turn, force the return tool so we always get structured output.
    if (lastTurn) body.tool_choice = { type: 'tool', name: opts.returnTool.name };
    const res = await call(body);
    usd += cost(res);
    const ret = (res.content ?? []).find((b: any) => b.type === 'tool_use' && b.name === opts.returnTool.name);
    if (ret) return { data: ret.input, usd, stop: 'tool' };
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason === 'pause_turn' || res.stop_reason === 'tool_use') continue;
    // end_turn without the tool — nudge once toward the structured return.
    messages.push({ role: 'user', content: `Now call ${opts.returnTool.name} exactly once with what you found.` });
  }
  return { data: null, usd, stop: 'no_tool' };
}
