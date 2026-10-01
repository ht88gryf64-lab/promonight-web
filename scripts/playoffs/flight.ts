// Reading the RSC payload of a served page. Used by verify-served.ts; tested
// in src/lib/postseason/__tests__/flight.test.ts against a served page.

// ---- The RSC payload, read as rows ----
//
// The payload is the strings pushed to self.__next_f, joined: rows of the
// form "<id>:<json>\n". React outlines parts of the tree into rows of their
// own and refers to them as "$<id>", or "$L<id>" for a row streamed later.
// An element whose type is "$L<id>" is a client component when row <id> is
// an import row ("I[...]"). A fingerprint is in place when its one occurrence is the
// text of a host <code> element, and the chain of rows that refer to it
// reaches the element with id="how-the-computer-picked" through host
// elements only, never through a client component.
export function flightRows(html: string): Map<string, string> {
  let text = '';
  for (const m of html.matchAll(/<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    try {
      const arr = JSON.parse(m[1]) as unknown[];
      if (arr[0] === 1 && typeof arr[1] === 'string') text += arr[1];
    } catch {
      /* not a data push */
    }
  }
  const rows = new Map<string, string>();
  const re = /(?:^|\n)([0-9a-f]+):/g;
  const starts: { id: string; at: number; body: number }[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push({ id: m[1], at: m.index, body: m.index + m[0].length });
  starts.forEach((r, i) => rows.set(r.id, text.slice(r.body, i + 1 < starts.length ? starts[i + 1].at : text.length)));
  return rows;
}

/** The type of the element whose props contain position `at` of `json`:
 *  the nearest unclosed ["$","<type>",... before it. */
export function enclosingType(json: string, at: number): string | null {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const c = json[i];
    if (c === ']' || c === '}') depth++;
    else if (c === '[' || c === '{') {
      if (depth > 0) depth--;
      else if (c === '[' && json.startsWith('["$","', i)) {
        const m = /^\["\$","([^"]*)"/.exec(json.slice(i));
        if (m) return m[1];
      }
    }
  }
  return null;
}

/** Is an element type a client component? A host type is a plain tag
 *  name; a client type is "$L<id>" where row <id> is an import row. An
 *  unknown "$" type counts as client, so the check fails closed. */
export function isClientType(t: string, rows: Map<string, string>): boolean {
  if (!t.startsWith('$')) return false;
  const m = /^\$L([0-9a-f]+)$/.exec(t);
  if (!m) return true;
  const row = rows.get(m[1]);
  return row === undefined || row.startsWith('I[') || row.startsWith('I{');
}

export function fingerprintPlacement(html: string): (f: string) => { ok: boolean; detail: string } {
  const rows = flightRows(html);
  return (f) => {
    const holders = [...rows].filter(([, body]) => body.includes(f));
    if (holders.length !== 1 || holders[0][1].split(f).length !== 2) return { ok: false, detail: `${holders.length} rows` };
    let [id, body] = holders[0];
    if (enclosingType(body, body.indexOf(f)) !== 'code') return { ok: false, detail: `not a <code> text (${enclosingType(body, body.indexOf(f))})` };
    for (let hop = 0; hop < 12; hop++) {
      const own = body.indexOf('"id":"how-the-computer-picked"');
      if (own >= 0) {
        const t = enclosingType(body, own);
        return t === 'section' ? { ok: true, detail: `row ${id}, ${hop} hops` } : { ok: false, detail: `id on a ${t}` };
      }
      const refs = [`"$${id}"`, `"$L${id}"`];
      const up = [...rows].filter(([, b]) => refs.some((r) => b.includes(r)));
      if (up.length !== 1) return { ok: false, detail: `row ${id} referred to ${up.length} times` };
      const [upId, upBody] = up[0];
      const ref = refs.find((r) => upBody.includes(r)) as string;
      const t = enclosingType(upBody, upBody.indexOf(ref));
      if (!t) return { ok: false, detail: `row ${id} is in no element` };
      if (isClientType(t, rows)) return { ok: false, detail: `row ${id} sits in a client component (${t})` };
      id = upId;
      body = upBody;
    }
    return { ok: false, detail: 'no methodology section above it' };
  };
}
