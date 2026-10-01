// Reading the RSC payload of a served page, with React's own flight client.
// Used by verify-served.ts; tested in src/lib/postseason/__tests__/
// flight.test.ts against a page a preview served and against payloads built
// to break each rule.
//
// WHY REACT'S CLIENT. A hand-written reader of the flight format has to
// match React's grammar exactly (reference forms, maps, sets, binary rows,
// lazy and path references, element shapes) or it can be shown a payload
// that it reads one way and the browser reads another. So the payload is
// decoded by the client the browser runs (Next's compiled
// react-server-dom-webpack, edge build, production), and only the decoded
// tree is judged. Every client component reference resolves to a marked
// sentinel function, so the walk knows exactly where client components are.
//
// THE BYTES. Every <script> that calls self.__next_f.push must hold one
// JSON array: [0] bootstrap and [2] form state are skipped, [1, string] is
// UTF-8 payload, [3, base64] is binary payload, both in order. Anything else
// fails closed.
//
// THE RULE for a fingerprint F. The payload bytes hold it exactly once; the
// decoded tree holds exactly one host <section id="how-the-computer-picked">;
// the walk from the root meets F exactly once; and there F is the whole
// `children` string of a host <code> inside that section. Anything
// unresolved, rejected or not understood fails closed, and so does any value
// the walk cannot inspect fully and repeatably: a stream, an async iterable,
// an iterator other than a Map or a Set, a function that is not a client
// reference (a server action and its bound arguments). The app emits none.
//
// Production payloads only: development rows (D, W, J, N) throw in the
// production client, so every check fails closed against `next dev`. An E
// row (a server component error) also fails the operator-text check.
//
// "No client component above it" is read precisely, because the app's
// layouts wrap every page in client providers through `children`, which is
// server output passed through and is expected. What fails: the fingerprint
// anywhere inside a non-children prop of a client component (that is data
// handed to the client, served whether rendered or not), any client
// component between the methodology section and the <code>, and any prop
// other than `children` between the section and the <code>.

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

type Decoded = { root: unknown; bytes: Buffer; error: string | null };

const CLIENT = new Set<unknown>();
const sentinels = new Map<string, unknown>();
function sentinel(id: string, name: string): unknown {
  const key = `${id}#${name}`;
  let fn = sentinels.get(key);
  if (!fn) {
    fn = { [`Client(${key})`]: function () {} }[`Client(${key})`];
    CLIENT.add(fn);
    sentinels.set(key, fn);
  }
  return fn;
}
function installModuleStubs() {
  const g = globalThis as Record<string, unknown>;
  // A module answers every export name with that export's sentinel. A
  // default import ("" in the reference) reads `default`; a whole-module
  // import ("*") gets the module itself, which is marked client too.
  const modules = new Map<string, object>();
  g.__next_require__ = g.__webpack_require__ = (id: string) => {
    const known = modules.get(String(id));
    if (known) return known;
    const mod = new Proxy(
      {},
      {
        get: (_t, k) => (typeof k === 'symbol' || k === 'then' ? undefined : k === '__esModule' ? true : sentinel(String(id), k)),
        has: (_t, k) => typeof k === 'string',
        getOwnPropertyDescriptor: (_t, k) =>
          typeof k === 'string' ? { value: sentinel(String(id), k), configurable: true, enumerable: true, writable: false } : undefined,
      },
    );
    CLIENT.add(mod);
    modules.set(String(id), mod);
    return mod;
  };
  g.__next_chunk_load__ = g.__webpack_chunk_load__ = () => Promise.resolve();
}

/** The payload bytes, in push order. */
export function payloadBytes(html: string): { bytes: Buffer; error: string | null } {
  const parts: Buffer[] = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const body = m[1];
    // Any script that touches __next_f, in any spelling, must be one of the
    // two push shapes Next writes; anything else could add rows the browser
    // runs and this reader does not see.
    if (!/__next_f/.test(body)) continue;
    const call = /^\s*\(self\.__next_f\s*=\s*self\.__next_f\s*\|\|\s*\[\]\)\.push\(([\s\S]*)\)\s*;?\s*$/.exec(body) ?? /^\s*self\.__next_f\.push\(([\s\S]*)\)\s*;?\s*$/.exec(body);
    if (!call) return { bytes: Buffer.concat(parts), error: 'a script touches self.__next_f in a shape this reader does not know' };
    let arr: unknown;
    try {
      arr = JSON.parse(call[1]);
    } catch {
      return { bytes: Buffer.concat(parts), error: 'a push that is not JSON' };
    }
    if (!Array.isArray(arr)) return { bytes: Buffer.concat(parts), error: 'a push that is not an array' };
    if (arr[0] === 0 || arr[0] === 2) continue;
    if (arr[0] === 1 && typeof arr[1] === 'string') parts.push(Buffer.from(arr[1], 'utf-8'));
    else if (arr[0] === 3 && typeof arr[1] === 'string') parts.push(Buffer.from(arr[1], 'base64'));
    else return { bytes: Buffer.concat(parts), error: `a push of kind ${JSON.stringify(arr[0])}` };
  }
  return { bytes: Buffer.concat(parts), error: null };
}

export async function decodePayload(html: string): Promise<Decoded> {
  const { bytes, error } = payloadBytes(html);
  if (error) return { root: null, bytes, error };
  if (bytes.length === 0) return { root: null, bytes, error: 'no payload' };
  installModuleStubs();
  const client = req('next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.edge.production.js') as {
    createFromReadableStream: (s: ReadableStream<Uint8Array>, o: unknown) => Promise<unknown>;
  };
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(bytes));
      c.close();
    },
  });
  try {
    const root = await client.createFromReadableStream(stream, { serverConsumerManifest: { moduleMap: null, serverModuleMap: null, moduleLoading: null } });
    return { root, bytes, error: null };
  } catch (e) {
    return { root: null, bytes, error: `decode: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const ELEMENT = Symbol.for('react.transitional.element');
const LEGACY_ELEMENT = Symbol.for('react.element');
const LAZY = Symbol.for('react.lazy');
const TRANSPARENT = new Set(['react.fragment', 'react.suspense', 'react.activity', 'react.profiler', 'react.strict_mode', 'react.view_transition'].map((n) => Symbol.for(n)));

/** A value, with every lazy and promise resolved. Rejection or a value that
 *  never resolves is an error. */
async function settle(v: unknown): Promise<{ v: unknown; error: string | null }> {
  for (let n = 0; n < 20; n++) {
    if (v && typeof v === 'object' && (v as { $$typeof?: unknown }).$$typeof === LAZY) {
      const lazy = v as { _init: (p: unknown) => unknown; _payload: unknown };
      try {
        v = lazy._init(lazy._payload);
      } catch (p) {
        if (p && typeof (p as { then?: unknown }).then === 'function') {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const r = await Promise.race([Promise.resolve(p).then(() => 'ok', () => 'rejected'), new Promise((res) => (timer = setTimeout(() => res('timeout'), 2000)))]);
          clearTimeout(timer);
          if (r !== 'ok') return { v: null, error: `lazy ${r}` };
          continue;
        }
        return { v: null, error: `lazy threw: ${p instanceof Error ? p.message : String(p)}` };
      }
      continue;
    }
    if (v && typeof (v as { then?: unknown }).then === 'function') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const r = await Promise.race([
        Promise.resolve(v as Promise<unknown>).then((x) => ({ ok: true as const, x }), (e) => ({ ok: false as const, e })),
        new Promise<{ ok: false; e: string }>((res) => (timer = setTimeout(() => res({ ok: false, e: 'timeout' }), 2000))),
      ]);
      clearTimeout(timer);
      if (!r.ok) return { v: null, error: `promise ${String((r as { e: unknown }).e)}` };
      v = r.x;
      continue;
    }
    return { v, error: null };
  }
  return { v: null, error: 'too many lazy layers' };
}

/** About the value being visited: it is the whole `children` of a host
 *  <code>, and the prop key it was reached by, when it is a prop's value. */
interface Direct {
  code: boolean;
  propKey?: string;
}

interface Ctx {
  inSection: boolean;
  /** Inside a non-children prop of a client component. Sticky. */
  clientData: boolean;
  /** A client component between the section and here. Sticky. */
  clientInSection: boolean;
  /** A prop other than `children` between the section and here. Sticky. */
  propInSection: boolean;
  depth: number;
}

export interface Walk {
  /** Every place the needle was met. */
  hits: { ok: boolean; why: string }[];
  sections: number;
  errors: string[];
  strings: string[];
  keys: string[];
}

/** Walk the decoded tree, recording every string containing `needle`. */
export async function walkTree(root: unknown, needle: string | null): Promise<Walk> {
  const out: Walk = { hits: [], sections: 0, errors: [], strings: [], keys: [] };
  let nodes = 0;
  const record = (s: string, ctx: Ctx, direct: Direct) => {
    if (direct.propKey !== 'className') out.strings.push(s);
    if (!needle || !s.includes(needle)) return;
    const ok = s === needle && direct.code && ctx.inSection && !ctx.clientData && !ctx.clientInSection && !ctx.propInSection;
    out.hits.push({
      ok,
      why: ok
        ? 'code text in the methodology'
        : [
            ctx.clientData && 'in data handed to a client component',
            ctx.clientInSection && 'a client component between the section and it',
            ctx.propInSection && 'a non-children prop between the section and it',
            !ctx.inSection && 'outside the methodology',
            !direct.code && 'not the whole text of a <code>',
            s !== needle && 'not the whole string',
          ]
            .filter(Boolean)
            .join('; '),
    });
  };
  const visit = async (raw: unknown, ctx: Ctx, direct: Direct): Promise<void> => {
    if (++nodes > 200000 || ctx.depth > 300) {
      out.errors.push('tree too large or too deep');
      return;
    }
    const s = await settle(raw);
    if (s.error) {
      out.errors.push(s.error);
      return;
    }
    const v = s.v;
    const next = { ...ctx, depth: ctx.depth + 1 };
    if (typeof v === 'string') {
      record(v, ctx, direct);
      return;
    }
    if (typeof v === 'function') {
      if (!CLIENT.has(v)) out.errors.push('a function that is not a client reference (a server action?)');
      return;
    }
    if (v === null || typeof v !== 'object') return;
    const tag = (v as { $$typeof?: unknown }).$$typeof;
    if (tag === ELEMENT || tag === LEGACY_ELEMENT) {
      const el = v as { type: unknown; props: unknown };
      const t = await settle(el.type);
      if (t.error) {
        out.errors.push(`element type: ${t.error}`);
        return;
      }
      const type = t.v;
      const host = typeof type === 'string';
      const transparent = typeof type === 'symbol' && TRANSPARENT.has(type);
      const client = !host && !transparent;
      if (client && !CLIENT.has(type)) out.errors.push('an element type that is neither a tag, a known wrapper, nor a client reference');
      const props = el.props && typeof el.props === 'object' ? (el.props as Record<string, unknown>) : null;
      if (!props) {
        out.errors.push('element props that are not an object');
        return;
      }
      const isSection = host && type === 'section' && props.id === 'how-the-computer-picked';
      if (isSection) out.sections++;
      const inSection = ctx.inSection || isSection;
      for (const [k, pv] of Object.entries(props)) {
        out.keys.push(k);
        const children = k === 'children';
        const code = children && host && type === 'code';
        await visit(
          pv,
          {
            inSection,
            clientData: ctx.clientData || (client && !children),
            clientInSection: ctx.clientInSection || (inSection && client),
            // Any prop other than `children` on or below the section,
            // the section's own included, is a crossing.
            propInSection: ctx.propInSection || (inSection && !children),
            depth: next.depth,
          },
          { code, propKey: k },
        );
      }
      return;
    }
    // Anything else that holds values: arrays keep the context (children
    // lists); every other container is a prop-like crossing.
    if (Array.isArray(v)) {
      for (const x of v) await visit(x, next, { code: false });
      return;
    }
    // Inside the section, any container is a crossing that is not `children`.
    const cross = { ...next, propInSection: next.propInSection || next.inSection };
    if (v instanceof Map) {
      for (const [k, x] of v) {
        await visit(k, cross, { code: false });
        await visit(x, cross, { code: false });
      }
      return;
    }
    if (v instanceof Set) {
      for (const x of v) await visit(x, cross, { code: false });
      return;
    }
    if (typeof FormData !== 'undefined' && v instanceof FormData) {
      for (const [k, x] of v) {
        out.keys.push(k);
        await visit(x, cross, { code: false });
      }
      return;
    }
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      await visit(await v.text(), cross, { code: false });
      return;
    }
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      const b = v instanceof ArrayBuffer ? Buffer.from(v) : Buffer.from(v.buffer, v.byteOffset, v.byteLength);
      await visit(b.toString('utf-8'), cross, { code: false });
      await visit(b.toString('latin1'), cross, { code: false });
      return;
    }
    // Values the walk cannot read fully without consuming them, or cannot
    // read at all: fail closed.
    if (typeof ReadableStream !== 'undefined' && v instanceof ReadableStream) {
      out.errors.push('a stream');
      return;
    }
    if (typeof (v as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
      out.errors.push('an async iterable');
      return;
    }
    if (typeof (v as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
      out.errors.push('an iterator');
      return;
    }
    if (typeof v === 'function') {
      if (!CLIENT.has(v)) out.errors.push('a function that is not a client reference (a server action?)');
      return;
    }
    for (const [k, x] of Object.entries(v)) {
      out.keys.push(k);
      await visit(x, cross, { code: false });
    }
  };
  await visit(root, { inSection: false, clientData: false, clientInSection: false, propInSection: false, depth: 0 }, { code: false });
  return out;
}

/** The fingerprint rule for one served page. Decodes once. */
export async function fingerprintPlacement(html: string): Promise<(f: string) => Promise<{ ok: boolean; detail: string }>> {
  const d = await decodePayload(html);
  return async (f) => {
    if (d.error) return { ok: false, detail: `payload: ${d.error}` };
    const inBytes = d.bytes.toString('latin1').split(f).length - 1;
    if (inBytes !== 1) return { ok: false, detail: `${inBytes} times in the payload bytes` };
    const w = await walkTree(d.root, f);
    if (w.errors.length) return { ok: false, detail: `walk: ${w.errors[0]}` };
    if (w.sections !== 1) return { ok: false, detail: `${w.sections} methodology sections` };
    if (w.hits.length !== 1) return { ok: false, detail: `met ${w.hits.length} times` };
    return { ok: w.hits[0].ok, detail: w.hits[0].why };
  };
}

// ---- Operator text on a page whose predictions failed ----
//
// Nothing about a failure may reach a served page. Tokens (the tag, the
// switch, the collection, the reason categories) are looked for
// case-insensitively, with a hyphen, underscore or space between words, in
// the raw HTML, the entity-decoded HTML and the decoded payload's strings
// and keys. The plain words are looked for where a reader or a crawler
// meets words: entity-decoded visible text (noscript included), JSON-LD,
// every attribute but class, style, href, src, srcset and data-*, and every
// string and key of the decoded payload except class names.

// Optional, so camelCase spellings ("predictionsUnavailable") match too.
const SEP = '[-_ ]?';
const TOKENS = new RegExp(
  [
    `predictions${SEP}unavailable`,
    `predictions${SEP}disabled`,
    'predictedbrackets',
    `read${SEP}failed`,
    `fingerprint${SEP}mismatch`,
    `content${SEP}mismatch`,
    `no${SEP}join`,
    `no${SEP}team${SEP}record`,
    `build${SEP}failed`,
    '\\breason\\b',
  ].join('|'),
  'i',
);
const WORDS = /\b(unavailable|disabled|errors?|fail(s|ed|ing|ure)?|mismatch|missing|refused|unable|timed out|went wrong|try again)\b|\bcould ?n[o']t\b|\bnot available\b/i;

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<\/?noscript\b[^>]*>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');
}

// `value` is read: on a button input it is text the reader sees.
const SKIP_ATTR = /^(class|style|href|src|srcset|data-[\w-]+|id|for|type|rel|as|crossorigin|integrity|nonce|charset|lang|dir|xmlns(:\w+)?|viewbox|d|fill|stroke(-[\w-]+)?|width|height|sizes|media|loading|decoding|fetchpriority|tabindex|role|target|method|action|name)$/i;

/** The first operator-facing word or token on the page, or null. */
export async function operatorText(html: string): Promise<string | null> {
  const t = TOKENS.exec(html) ?? TOKENS.exec(decodeEntities(html));
  if (t) return `token "${t[0]}" in the HTML`;
  const v = WORDS.exec(visibleText(html));
  if (v) return `visible text "${v[0]}"`;
  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const w = WORDS.exec(decodeEntities(m[1]));
    if (w) return `JSON-LD "${w[0]}"`;
  }
  for (const m of html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
    for (const a of m[1].matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (SKIP_ATTR.test(a[1])) continue;
      const w = WORDS.exec(decodeEntities(a[2] ?? a[3] ?? ''));
      if (w) return `${a[1]} attribute "${w[0]}"`;
    }
  }
  const d = await decodePayload(html);
  if (d.error) return `payload: ${d.error}`;
  const walked = await walkTree(d.root, null);
  if (walked.errors.length) return `payload walk: ${walked.errors[0]}`;
  // Keys are names, not copy: "error" and "disabled" are ordinary prop
  // names. Only the failure's own vocabulary is looked for, inside names too
  // ("predictionsReason").
  for (const k of walked.keys) {
    if (TOKENS.exec(k) || /reason|unavailable|mismatch|failed|failure|refused|predictions_?disabled/i.test(k)) return `payload key "${k}"`;
  }
  // Class names were left out of the strings by their prop key.
  for (const s of walked.strings) {
    const tok = TOKENS.exec(s);
    if (tok) return `payload token "${tok[0]}"`;
    const w = WORDS.exec(s);
    if (w) return `payload string "${s.slice(0, 60)}"`;
  }
  return null;
}
