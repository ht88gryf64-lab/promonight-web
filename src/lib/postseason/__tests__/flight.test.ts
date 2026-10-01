// The served-HTML checks in scripts/playoffs/flight.ts, which decode the RSC
// payload with React's own flight client. Checked against a page the
// preview of 2c85650 served, and against payloads built to break each rule,
// including every shape two reviewers found an earlier hand-written reader
// let through (the first of them emitted by React 19.2 itself).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintPlacement, operatorText, payloadBytes } from '../../../../scripts/playoffs/flight';
import { PREDICTED, rawText } from './helpers';

const served = rawText('served.playoffs-mlb-2c85650.html');
const mlb = JSON.parse(rawText(PREDICTED.mlb)) as Record<string, Record<string, string>>;
const FP = [mlb.provenance.corpusSha256, mlb.provenance.paramsSha256, mlb.provenance.descriptorSha256, mlb.provenance.slugMapSha256, mlb.reviewedSha256 as unknown as string];

test('FLIGHT: on the served /playoffs/mlb, every fingerprint is <code> text in the methodology, by React\'s own decoder', async () => {
  const at = await fingerprintPlacement(served);
  for (const f of FP) assert.deepEqual(await at(f), { ok: true, detail: 'code text in the methodology' }, f.slice(0, 8));
});

/** A page whose payload is these rows, pushed as Next pushes them. */
function page(rows: string[], extra = ''): string {
  return `<html><body>${extra}<script>self.__next_f.push(${JSON.stringify([1, rows.join('\n') + '\n'])})</script></body></html>`;
}
const H = 'a'.repeat(64);
const CODE = `["$","code",null,{"children":"${H}"}]`;
const SECTION = (kids: string) => `["$","section",null,{"id":"how-the-computer-picked","children":${kids}}]`;
const IMPORT = '7:I["7",[],"Collapsible"]';
const place = async (html: string) => (await fingerprintPlacement(html))(H);

test('FLIGHT: in place: inline, outlined, lazy, under a keyed Fragment, under Suspense, under a client layout wrapper above the section', async () => {
  const cases: [string, string[]][] = [
    ['inline', [`0:${SECTION(CODE)}`]],
    ['outlined row', [`0:${SECTION('["$","dl",null,{"children":["$4"]}]')}`, `4:["$","dd",null,{"children":${CODE}}]`]],
    ['lazy row', [`0:${SECTION('["$","dl",null,{"children":["$L4"]}]')}`, `4:["$","dd",null,{"children":${CODE}}]`]],
    ['keyed Fragment', ['1:"$Sreact.fragment"', `0:${SECTION(`["$","$1","k",{"children":${CODE}}]`)}`]],
    ['Suspense', ['d:"$Sreact.suspense"', `0:${SECTION(`["$","$d",null,{"children":"$L4"}]`)}`, `4:${CODE}`]],
    ['a client provider above the section, through children', [IMPORT, `0:["$","$L7",null,{"children":${SECTION(CODE)}}]`]],
    ['an id-less hint row', [':HL["/x.css","style"]', `0:${SECTION(CODE)}`]],
  ];
  for (const [why, rows] of cases) {
    const r = await place(page(rows));
    assert.ok(r.ok, `${why}: ${r.detail}`);
  }
});

test('FLIGHT: out of place, each way, fails', async () => {
  const cases: [string, string[]][] = [
    // React 19.2's own output for one element in the methodology and in a Map prop of a client component.
    ['React-emitted: a Map prop of a client component', ['1:I["mod1",[],"Collapsible"]', '2:[["fp","$0:props:children:0:props:children:props:children"]]', `0:["$","div",null,{"children":[["$","section",null,{"id":"how-the-computer-picked","children":["$","dl",null,{"children":${CODE}}]}],["$","$L1",null,{"m":"$Q2"}]]}]`]],
    ['a Set prop of a client component', [IMPORT, '2:["$0:props:children:0:props:children"]', `0:["$","div",null,{"children":[${SECTION(CODE)},["$","$L7",null,{"s":"$W2"}]]}]`]],
    ['a client component inside the section, wrapping the code', [IMPORT, `0:${SECTION(`["$","$L7",null,{"children":${CODE}}]`)}`]],
    ['the code as a non-children prop of a client component', [IMPORT, `0:${SECTION(`["$","$L7",null,{"data":${CODE}}]`)}`]],
    ['a client component two levels above an outlined reference', [IMPORT, `0:${SECTION('["$","$L7",null,{"children":["$","dl",null,{"children":"$L4"}]}]')}`, `4:${CODE}`]],
    ['props given by reference to a client component', [IMPORT, `0:${SECTION('["$","$L7",null,"$6"]')}`, `6:{"children":${CODE}}`]],
    ['a $L reference with a path, to a client wrapper', [IMPORT, `0:${SECTION('"$L4:props:children"')}`, `4:["$","$L7",null,{"children":${CODE}}]`]],
    ['one row referenced by the section and by a client prop', [IMPORT, `0:[${SECTION('["$","dl",null,{"children":"$L4"}]')},["$","$L7",null,{"pick":"$L4"}]]`, `4:${CODE}`]],
    ['a client reaching the row by a path reference', [IMPORT, `0:[${SECTION('["$","dl",null,{"children":"$L4"}]')},["$","$L7",null,{"pick":"$4:props:children"}]]`, `4:${CODE}`]],
    ['the code a sibling of the section', [`0:[${SECTION('"x"')},${CODE}]`]],
    ['a non-children prop of a host element inside the section', [`0:${SECTION(`["$","div",null,{"data-x":${CODE}}]`)}`]],
    ['code children that hold more than the fingerprint', [`0:${SECTION(`["$","code",null,{"children":["leaked: ","${H}"]}]`)}`]],
    ['two methodology sections', [`0:[${SECTION(CODE)},${SECTION('"x"')}]`]],
    ['the id on something other than a section', [`0:["$","div",null,{"id":"how-the-computer-picked","children":${CODE}}]`]],
    ['twice', [`0:${SECTION(`[${CODE},${CODE}]`)}`]],
    ['a reference to a row that is not there', [`0:${SECTION('["$","dl",null,{"children":"$L9"}]')}`, `4:${CODE}`]],
    ['in a row the root never reaches', [`0:${SECTION('"x"')}`, `5:${CODE}`]],
  ];
  for (const [why, rows] of cases) {
    const r = await place(page(rows));
    assert.equal(r.ok, false, `${why}: ${r.detail}`);
    if (process.env.FLIGHT_DEBUG) console.log(`${why} -> ${r.detail}`);
  }
});

test('FLIGHT: the bytes: [3] base64 pushes are read in order; an unknown push fails closed', async () => {
  const rowA = `0:${SECTION('["$","dl",null,{"children":"$L4"}]')}\n`;
  const rowB = `4:${CODE}\n`;
  const html = `<html><body><script>self.__next_f.push(${JSON.stringify([1, rowA])})</script><script>self.__next_f.push(${JSON.stringify([3, Buffer.from(rowB).toString('base64')])})</script></body></html>`;
  assert.equal(payloadBytes(html).bytes.toString('utf-8'), rowA + rowB);
  assert.ok((await place(html)).ok);
  // A client wrapper delivered only in a [3] push is still seen.
  const leak = `<html><body><script>self.__next_f.push(${JSON.stringify([1, `${IMPORT}\n${rowA}`])})</script><script>self.__next_f.push(${JSON.stringify([3, Buffer.from(`4:["$","$L7",null,{"x":${CODE}}]\n`).toString('base64')])})</script></body></html>`;
  assert.equal((await place(leak)).ok, false);
  assert.match(payloadBytes(`<script>self.__next_f.push([9,"x"])</script>`).error ?? '', /kind/);
  assert.match(payloadBytes(`<script>self.__next_f.push([1,'x'])</script>`).error ?? '', /not JSON/);
});

// ---- Operator text on a forced-failure page ----

test('OPERATOR TEXT: none on the page the preview served', async () => {
  assert.equal(await operatorText(served), null);
});

test('OPERATOR TEXT: every way failure text could reach a page is seen; class names, router prop names and chunk paths are not', async () => {
  const ok0 = ['0:["$","div",null,{"children":"ok"}]'];
  const caught: [string, string][] = [
    ['the read object in the payload', page(['0:{"state":"unavailable","reason":"disabled"}'])],
    ['a reason-only object', page(['0:{"reason":"refused"}'])],
    ['a client prop named for the reason', page([IMPORT, '0:["$","$L7",null,{"predictionsReason":"x"}]'])],
    ['a payload string', page(['0:["$","p",null,{"children":"Predictions unavailable"}]'])],
    ['a reason category in a payload string', page(['0:["$","p",null,{"children":"read-failed"}]'])],
    ['visible text', page(ok0, '<p>Predictions are unavailable right now</p>')],
    ['an entity-encoded token', page(ok0, '<p>build&#x2d;failed</p>')],
    ['noscript text', page(ok0, '<noscript>Predictions missing</noscript>')],
    ['JSON-LD', page(ok0, '<script type="application/ld+json">{"description":"predictions failed"}</script>')],
    ['an aria-label', page(ok0, '<div aria-label="Predictions unavailable"></div>')],
    ['an aria-description', page(ok0, '<div aria-description="fingerprint mismatch"></div>')],
    ['a placeholder', page(ok0, '<input placeholder="refused">')],
    ['a title', page(ok0, '<span title="feature disabled"></span>')],
    ['a meta content', page(ok0, '<meta name="x" content="Predictions disabled">')],
    ['the switch name in lower case', page(ok0, '<!-- predictions_disabled -->')],
    ['the tag in another case', page(ok0, '<script>console.log("[Predictions-Unavailable]")</script>')],
    ['a [3] push', `<html><body><script>self.__next_f.push(${JSON.stringify([3, Buffer.from('0:["$","p",null,{"children":"Predictions unavailable"}]\n').toString('base64')])})</script></body></html>`],
  ];
  for (const [why, html] of caught) assert.notEqual(await operatorText(html), null, why);
  const clean: [string, string][] = [
    ['a disabled: class variant', page(['0:["$","button",null,{"className":"disabled:opacity-50 disabled:pointer-events-none","children":"Go"}]'], '<button class="disabled:opacity-50">Go</button>')],
    ['a router prop named error', page([IMPORT, '0:["$","$L7",null,{"error":"$undefined","children":"ok"}]'])],
    ['a chunk path in an import row', page(['7:I["static/chunks/app/global-error-abc.js",[],"default"]', ...ok0])],
  ];
  for (const [why, html] of clean) assert.equal(await operatorText(html), null, `${why}: ${await operatorText(html)}`);
});
