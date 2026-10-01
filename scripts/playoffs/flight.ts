// Reading the RSC payload of a served page. Used by verify-served.ts; tested
// in src/lib/postseason/__tests__/flight.test.ts against a served page and
// against payloads built to break each rule.
//
// THE PAYLOAD. The strings pushed to self.__next_f, joined, are a stream of
// rows, "<id>:<row>". Most rows are one line of JSON. A text row is
// "<id>:T<hex byte length>,<text>" and its text may hold raw newlines, so it
// is consumed by its declared length, never by line. Other tagged rows
// ("I" imports, debug and error rows) are one line, a tag and JSON. A hint
// row (":HL[...]") has an empty id and is one line; it holds no tree.
//
// THE TREE. An element is ["$", type, key, props]. Its type is a tag name
// (a host element), or a reference: "$L<id>" or "$<id>" to an import row
// (a client component), or to a row whose value is "$Sreact.fragment" /
// "$Sreact.suspense" (transparent wrappers). A string value "$<id>",
// "$L<id>", "$@<id>" or "$F<id>" refers to row <id>, and "$<id>:a:b" to a
// path inside it. "$$..." is a literal string starting with "$".
//
// THE RULE. Walk the whole tree down from the root row, resolving every
// reference where it is used. A fingerprint is in place when the payload
// holds it exactly once, the walk meets it exactly once, and there it is the
// whole `children` string of a host <code> element, inside the host
// <section id="how-the-computer-picked">, with no client component anywhere
// above it and no non-children prop on the way. Anything the reader does
// not understand fails closed.

type Row = { kind: 'json'; value: unknown } | { kind: 'text'; value: string } | { kind: 'tagged'; tag: string; value: unknown };

export interface Payload {
  rows: Map<string, Row>;
  /** The joined payload text, for counting. */
  text: string;
  /** Why the payload could not be read, or null. */
  error: string | null;
}

/** The payload strings, in order. Pushes of another shape (bootstrap, form
 *  state) are skipped. */
function pushedStrings(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b[^>]*>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    try {
      const arr = JSON.parse(m[1]) as unknown[];
      if (arr[0] === 1 && typeof arr[1] === 'string') out.push(arr[1]);
    } catch {
      /* not a data push */
    }
  }
  return out;
}

export function readPayload(html: string): Payload {
  const text = pushedStrings(html).join('');
  const buf = Buffer.from(text, 'utf-8');
  const rows = new Map<string, Row>();
  let i = 0;
  const fail = (why: string): Payload => ({ rows, text, error: why });
  while (i < buf.length) {
    if (buf[i] === 0x0a) {
      i++;
      continue;
    }
    const colon = buf.indexOf(0x3a, i);
    if (colon < 0) return fail(`no colon after byte ${i}`);
    const id = buf.subarray(i, colon).toString('utf-8');
    if (id === '') {
      // A hint row (":HL[...]" preloads) has no id and holds no tree. One line.
      const end = buf.indexOf(0x0a, colon);
      if (!/^[A-Z]/.test(String.fromCharCode(buf[colon + 1]))) return fail('a row with no id that is not a hint');
      i = end < 0 ? buf.length : end + 1;
      continue;
    }
    if (!/^[0-9a-f]+$/.test(id)) return fail(`row id ${JSON.stringify(id.slice(0, 12))}`);
    if (rows.has(id)) return fail(`row ${id} twice`);
    i = colon + 1;
    if (buf[i] === 0x54) {
      // "T<hex length>,<text>"
      const comma = buf.indexOf(0x2c, i);
      const len = comma > 0 ? parseInt(buf.subarray(i + 1, comma).toString('utf-8'), 16) : NaN;
      if (!Number.isFinite(len) || comma + 1 + len > buf.length) return fail(`text row ${id} length`);
      rows.set(id, { kind: 'text', value: buf.subarray(comma + 1, comma + 1 + len).toString('utf-8') });
      i = comma + 1 + len;
      continue;
    }
    const end = buf.indexOf(0x0a, i);
    const line = buf.subarray(i, end < 0 ? buf.length : end).toString('utf-8');
    i = end < 0 ? buf.length : end + 1;
    if (/^[A-Z]/.test(line)) {
      let value: unknown = null;
      try {
        value = JSON.parse(line.slice(1));
      } catch {
        value = line.slice(1);
      }
      rows.set(id, { kind: 'tagged', tag: line[0], value });
      continue;
    }
    try {
      rows.set(id, { kind: 'json', value: JSON.parse(line) });
    } catch {
      return fail(`row ${id} is not JSON`);
    }
  }
  return { rows, text, error: null };
}

const ELEMENT_FIELDS: Record<string, number> = { type: 1, key: 2, props: 3 };
const REF = /^\$(?:L|@|F)?([0-9a-f]+)((?::[^:]+)*)$/;

/** What a reference string points to: undefined when it is not a reference,
 *  null when it points nowhere. */
function deref(p: Payload, s: string): { value: unknown } | null | undefined {
  if (!s.startsWith('$') || s.startsWith('$$')) return undefined;
  const m = REF.exec(s);
  if (!m) return undefined;
  const row = p.rows.get(m[1]);
  if (!row) return null;
  let value: unknown = row.value;
  for (const seg of m[2].split(':').filter(Boolean)) {
    if (value === null || typeof value !== 'object') return null;
    // An element is ["$", type, key, props] on the wire and {type, key,
    // props} to the reader that resolves the path.
    if (Array.isArray(value) && value[0] === '$' && value.length === 4 && ELEMENT_FIELDS[seg] !== undefined) value = value[ELEMENT_FIELDS[seg]];
    else value = (value as Record<string, unknown>)[seg];
  }
  return { value };
}

type TypeKind = { kind: 'host'; tag: string } | { kind: 'transparent' } | { kind: 'client' };

export function typeOf(p: Payload, t: unknown): TypeKind {
  if (typeof t !== 'string') return { kind: 'client' };
  if (!t.startsWith('$')) return { kind: 'host', tag: t };
  if (/^\$Sreact\.(fragment|suspense)$/.test(t)) return { kind: 'transparent' };
  const m = /^\$L?([0-9a-f]+)$/.exec(t);
  const row = m ? p.rows.get(m[1]) : undefined;
  if (row && row.kind === 'json' && typeof row.value === 'string' && /^\$Sreact\.(fragment|suspense)$/.test(row.value)) return { kind: 'transparent' };
  // An import row, an unknown row, anything else: a client component, so
  // the rule fails closed.
  return { kind: 'client' };
}

interface Ctx {
  inSection: boolean;
  client: boolean;
  /** The value is (inside) the `children` of this host tag, or null. */
  childOf: string | null;
  depth: number;
}

export interface Occurrence {
  ok: boolean;
  why: string;
}

/** Every place the walk from the root meets `needle`, with whether it is in place. */
export function walkFor(p: Payload, needle: string, root = '0'): Occurrence[] {
  const out: Occurrence[] = [];
  const rootRow = p.rows.get(root);
  if (!rootRow) return out;
  const visit = (v: unknown, ctx: Ctx): void => {
    if (ctx.depth > 400) {
      out.push({ ok: false, why: 'too deep' });
      return;
    }
    const next = { ...ctx, depth: ctx.depth + 1 };
    if (typeof v === 'string') {
      const r = deref(p, v);
      if (r === null) return;
      if (r !== undefined) {
        visit(r.value, next);
        return;
      }
      if (!v.includes(needle)) return;
      const ok = v === needle && ctx.childOf === 'code' && ctx.inSection && !ctx.client;
      const why = ok
        ? 'code text in the methodology'
        : [ctx.client && 'under a client component', !ctx.inSection && 'outside the methodology', ctx.childOf !== 'code' && `not code text (${ctx.childOf ?? 'a prop'})`, v !== needle && 'not the whole text']
            .filter(Boolean)
            .join('; ');
      out.push({ ok, why });
      return;
    }
    if (Array.isArray(v)) {
      if (v[0] === '$' && v.length === 4 && (v[3] === null || typeof v[3] === 'object')) {
        const t = typeOf(p, v[1]);
        const props = (v[3] ?? {}) as Record<string, unknown>;
        const isSection = t.kind === 'host' && t.tag === 'section' && props.id === 'how-the-computer-picked';
        const inSection = ctx.inSection || isSection;
        const client = ctx.client || t.kind === 'client';
        for (const [k, pv] of Object.entries(props)) {
          const childOf = k !== 'children' ? null : t.kind === 'host' ? t.tag : t.kind === 'transparent' ? ctx.childOf : null;
          visit(pv, { inSection, client, childOf, depth: next.depth });
        }
        return;
      }
      for (const x of v) visit(x, next);
      return;
    }
    if (v && typeof v === 'object') for (const x of Object.values(v)) visit(x, { ...next, childOf: null });
  };
  visit(rootRow.value, { inSection: false, client: false, childOf: null, depth: 0 });
  return out;
}

/** The fingerprint rule for one served page. */
export function fingerprintPlacement(html: string): (f: string) => { ok: boolean; detail: string } {
  const p = readPayload(html);
  return (f) => {
    if (p.error) return { ok: false, detail: `payload unreadable: ${p.error}` };
    const inText = p.text.split(f).length - 1;
    if (inText !== 1) return { ok: false, detail: `${inText} times in the payload` };
    const met = walkFor(p, f);
    if (met.length !== 1) return { ok: false, detail: `met ${met.length} times from the root` };
    return { ok: met[0].ok, detail: met[0].why };
  };
}

// ---- Operator text on a page whose predictions failed ----
//
// Nothing about a failure may reach a served page. The operator's tokens and
// the reason categories are looked for in every byte, case-insensitively.
// The plain words are looked for where a reader or a crawler meets words:
// the visible text, the aria-label, title, alt and content attributes, and
// every string in the RSC payload except class names and import rows (a
// class such as "disabled:opacity-50" is not copy; a chunk path is not copy).

const TOKENS = /predictions-unavailable|predictions_disabled|predictedbrackets|read-failed|fingerprint-mismatch|content-mismatch|no-join|no-team-record|build-failed|"reason"\s*:|\breason=/i;
const WORDS = /\b(unavailable|disabled|error)\b/i;

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

function payloadStrings(p: Payload): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key: string | null): void => {
    if (typeof v === 'string') {
      if (key !== 'className') out.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => walk(x, null));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const row of p.rows.values()) {
    if (row.kind === 'tagged') continue;
    walk(row.value, null);
  }
  return out;
}

/** The first operator-facing word or token on the page, or null. */
export function operatorText(html: string): string | null {
  const t = TOKENS.exec(html);
  if (t) return `token ${t[0]}`;
  const v = WORDS.exec(visibleText(html));
  if (v) return `visible text "${v[0]}"`;
  for (const m of html.matchAll(/\s(aria-label|title|alt|content)="([^"]*)"/gi)) {
    const w = WORDS.exec(m[2]);
    if (w) return `${m[1]} attribute "${w[0]}"`;
  }
  const p = readPayload(html);
  if (p.error) return `payload unreadable: ${p.error}`;
  for (const s of payloadStrings(p)) {
    const w = WORDS.exec(s);
    if (w) return `payload string "${s.slice(0, 60)}"`;
  }
  return null;
}
