// The served-HTML fingerprint check (scripts/playoffs/flight.ts): the RSC
// payload read as rows and walked as a tree from the root. Checked against a
// page the preview of 2c85650 actually served, and against payloads built to
// break each rule, including every shape a reviewer found the first reader
// let through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintPlacement, operatorText, readPayload } from '../../../../scripts/playoffs/flight';
import { PREDICTED, rawText } from './helpers';

const served = rawText('served.playoffs-mlb-2c85650.html');
const mlb = JSON.parse(rawText(PREDICTED.mlb)) as Record<string, Record<string, string>>;
const FP = [mlb.provenance.corpusSha256, mlb.provenance.paramsSha256, mlb.provenance.descriptorSha256, mlb.provenance.slugMapSha256, mlb.reviewedSha256 as unknown as string];

test('FLIGHT: on the served /playoffs/mlb, every fingerprint is <code> text under the methodology section, through host elements only', () => {
  const p = readPayload(served);
  assert.equal(p.error, null);
  assert.ok(p.rows.size > 20 && p.rows.has('0'));
  const at = fingerprintPlacement(served);
  for (const f of FP) assert.deepEqual(at(f), { ok: true, detail: 'code text in the methodology' }, f.slice(0, 8));
});

/** A page whose payload is these rows, pushed the way Next pushes them. */
function page(rows: string[]): string {
  return `<html><body><script>self.__next_f.push(${JSON.stringify([1, rows.join('\n') + '\n'])})</script></body></html>`;
}
const H = 'a'.repeat(64);
const CODE = `["$","code",null,{"children":"${H}"}]`;
const SECTION = (kids: string) => `["$","section",null,{"id":"how-the-computer-picked","children":${kids}}]`;
const IMPORT = '7:I["chunk.js","Collapsible"]';
const ok = (rows: string[]) => fingerprintPlacement(page(rows))(H);

test('FLIGHT: in place: inline, in an outlined row, by lazy reference, under a keyed Fragment, under Suspense', () => {
  const cases: [string, string[]][] = [
    ['inline', [`0:${SECTION(CODE)}`]],
    ['outlined row', [`0:${SECTION('["$","dl",null,{"children":["$4"]}]')}`, `4:["$","dd",null,{"children":${CODE}}]`]],
    ['lazy reference', [`0:${SECTION('["$","dl",null,{"children":["$L4"]}]')}`, `4:["$","dd",null,{"children":${CODE}}]`]],
    ['keyed Fragment', ['1:"$Sreact.fragment"', `0:${SECTION(`["$","$1","k",{"children":${CODE}}]`)}`]],
    ['Suspense', ['d:"$Sreact.suspense"', `0:${SECTION(`["$","$d",null,{"fallback":null,"children":"$L4"}]`)}`, `4:${CODE}`]],
    ['an id-less hint row first', [':HL["/x.css","style"]', `0:${SECTION(CODE)}`]],
    ['unbalanced brackets in a sibling string', [`0:${SECTION(`[["$","span",null,{"children":"["}],${CODE}]`)}`]],
  ];
  for (const [why, rows] of cases) assert.ok(ok(rows).ok, `${why}: ${ok(rows).detail}`);
});

test('FLIGHT: out of place, each way, fails', () => {
  const cases: [string, string[]][] = [
    ['A: a client component inline in the section row, wrapping the code', [IMPORT, `0:${SECTION(`["$","$L7",null,{"children":${CODE}}]`)}`]],
    ['A2: the code as a non-children prop of a client component', [IMPORT, `0:${SECTION(`["$","$L7",null,{"data":${CODE}}]`)}`]],
    ['B: a client component two levels above an outlined reference', [IMPORT, `0:${SECTION('["$","$L7",null,{"children":["$","dl",null,{"children":"$L4"}]}]')}`, `4:${CODE}`]],
    ['C: the code a sibling of the section, in the same row', [`0:[${SECTION('"x"')},${CODE}]`]],
    ['C2: the code a client prop beside the section', [IMPORT, `0:[${SECTION('"x"')},["$","$L7",null,{"pick":"${H}"}]]`]],
    ['D: one row referenced twice, once by the section, once by a client', [IMPORT, `0:[${SECTION('["$","dl",null,{"children":"$L4"}]')},["$","$L7",null,{"pick":"$L4"}]]`, `4:${CODE}`]],
    ['E: a client reaching the row through a path reference', [IMPORT, `0:[${SECTION('["$","dl",null,{"children":"$L4"}]')},["$","$L7",null,{"pick":"$4:props:children"}]]`, `4:${CODE}`]],
    ['a prop of a client component, unreferenced elsewhere', [IMPORT, `0:${SECTION('"x"')}`, `1:["$","$L7",null,{"leak":"${H}"}]`]],
    ['not under the methodology at all', [`0:["$","div",null,{"children":"$4"}]`, `4:${CODE}`]],
    ['text of something other than <code>', [`0:${SECTION(`["$","p",null,{"children":"${H}"}]`)}`]],
    ['an attribute of a host element', [`0:${SECTION(`["$","code",null,{"title":"${H}","children":"x"}]`)}`]],
    ['twice', [`0:${SECTION(`[${CODE},${CODE}]`)}`]],
    ['the id on something other than a section', [`0:["$","div",null,{"id":"how-the-computer-picked","children":${CODE}}]`]],
    ['under an element type that is not a known row', [`0:${SECTION('["$","$L9",null,{"children":"$4"}]')}`, `4:${CODE}`]],
    ['unbalanced brackets in a client prop beside it', [IMPORT, `0:${SECTION(`["$","code",null,{"children":["$","$L7",null,{"hint":"1]]","value":"${H}"}]}]`)}`]],
    ['in a row the root never reaches', [`0:${SECTION('"x"')}`, `5:${CODE}`]],
  ];
  for (const [why, rows] of cases) assert.equal(ok(rows).ok, false, `${why}: ${ok(rows).detail}`);
});

test('FLIGHT: a text row is consumed by its declared length, so a newline inside it starts no row', () => {
  const inner = 'line one\n7:["not","a row"]\nline three';
  const len = Buffer.byteLength(inner, 'utf-8').toString(16);
  const html = page([IMPORT, `5:T${len},${inner}`, `0:${SECTION('["$","$L7",null,{"children":"$L4"}]')}`, `4:${CODE}`]);
  const p = readPayload(html);
  assert.equal(p.error, null);
  const row7 = p.rows.get('7');
  assert.ok(row7 && row7.kind === 'tagged' && row7.tag === 'I', 'row 7 is still the import row');
  assert.equal(fingerprintPlacement(html)(H).ok, false, 'so $L7 is still a client component');
  // A row id given twice is refused outright.
  assert.match(readPayload(page([`0:${SECTION(CODE)}`, `0:${SECTION(CODE)}`])).error ?? '', /twice/);
});

// ---- Operator text on a forced-failure page ----

test('OPERATOR TEXT: none on the page the preview served', () => {
  assert.equal(operatorText(served), null);
});

test('OPERATOR TEXT: every way failure text could reach a page is seen; class names and chunk paths are not', () => {
  const body = (inner: string, rows: string[] = ['0:["$","div",null,{"children":"ok"}]']) => `<html><body>${inner}${page(rows).replace('<html><body>', '').replace('</body></html>', '')}</body></html>`;
  const caught: [string, string][] = [
    ['the read object in the payload', body('', ['0:{"state":"unavailable","reason":"disabled"}'])],
    ['a payload string', body('', ['0:["$","p",null,{"children":"Predictions unavailable"}]'])],
    ['visible text', body('<p>Predictions are unavailable right now</p>')],
    ['an aria-label', body('<div aria-label="Predictions unavailable"></div>')],
    ['a title', body('<span title="feature disabled"></span>')],
    ['an alt', body('<img alt="error loading">')],
    ['a meta content', body('<meta name="x" content="Predictions disabled">')],
    ['the switch name in lower case', body('<!-- predictions_disabled -->')],
    ['the tag in another case', body('<script>console.log("[Predictions-Unavailable]")</script>')],
    ['a reason category', body('<div data-x="fingerprint-mismatch"></div>')],
    ['a log-style reason', body('<pre>league=MLB reason=read-failed</pre>')],
  ];
  for (const [why, html] of caught) assert.notEqual(operatorText(html), null, why);
  const clean: [string, string][] = [
    ['a disabled: class variant', body('<button class="disabled:opacity-50 disabled:pointer-events-none">Go</button>', ['0:["$","button",null,{"className":"disabled:opacity-50","children":"Go"}]'])],
    ['a chunk path in an import row', body('', ['7:I["static/chunks/app/global-error-abc.js","default"]', '0:["$","div",null,{"children":"ok"}]'])],
  ];
  for (const [why, html] of clean) assert.equal(operatorText(html), null, why);
});
