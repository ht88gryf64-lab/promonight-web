// The served-HTML fingerprint check (scripts/playoffs/flight.ts), against a
// page the preview of 2c85650 actually served, and against small payloads
// built to break each rule. React outlines parts of the tree into rows of
// their own, so a fingerprint can sit in a row far from the methodology
// section's id; the check follows the row references, not text distance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enclosingType, fingerprintPlacement, flightRows } from '../../../../scripts/playoffs/flight';
import { PREDICTED, rawText } from './helpers';

const served = rawText('served.playoffs-mlb-2c85650.html');
const mlb = JSON.parse(rawText(PREDICTED.mlb)) as Record<string, Record<string, string>>;
const FP = [mlb.provenance.corpusSha256, mlb.provenance.paramsSha256, mlb.provenance.descriptorSha256, mlb.provenance.slugMapSha256, mlb.reviewedSha256 as unknown as string];

test('FLIGHT: on the served /playoffs/mlb, every fingerprint is <code> text under the methodology section, through host elements only', () => {
  const at = fingerprintPlacement(served);
  for (const f of FP) {
    const r = at(f);
    assert.ok(r.ok, `${f.slice(0, 8)}: ${r.detail}`);
  }
  // At least one of them is in an outlined row, so the check really follows
  // references: a text-distance check would not have reached it.
  assert.ok(FP.some((f) => !/0 hops/.test(at(f).detail)), FP.map((f) => at(f).detail).join(' | '));
});

/** A page whose payload is these rows, pushed the way Next pushes them. */
function page(rows: string[]): string {
  return `<html><body><script>self.__next_f.push(${JSON.stringify([1, rows.join('\n') + '\n'])})</script></body></html>`;
}
const H = 'a'.repeat(64);
const SECTION = (kids: string) => `["$","section",null,{"id":"how-the-computer-picked","children":${kids}}]`;

test('FLIGHT: a fingerprint inline in the section, and one in an outlined row the section refers to, both pass', () => {
  assert.ok(fingerprintPlacement(page([`0:${SECTION(`["$","code",null,{"children":"${H}"}]`)}`]))(H).ok);
  assert.ok(fingerprintPlacement(page([`0:${SECTION('["$","dl",null,{"children":["$4"]}]')}`, `4:["$","dd",null,{"children":["$","code",null,{"children":"${H}"}]}]`]))(H).ok);
  // The lazy form, "$L4", for a row streamed later.
  assert.ok(fingerprintPlacement(page([`0:${SECTION('["$","dl",null,{"children":["$L4"]}]')}`, `4:["$","dd",null,{"children":["$","code",null,{"children":"${H}"}]}]`]))(H).ok);
});

test('FLIGHT: each way a fingerprint can be out of place fails', () => {
  const cases: [string, string[]][] = [
    ['a prop of a client component', [`7:I["chunk.js","PredictedBracket"]`, `0:${SECTION('"x"')}`, `1:["$","$L7",null,{"leak":"${H}"}]`]],
    ['a client component between it and the section', [`7:I["chunk.js","PredictedBracket"]`, `0:${SECTION('["$","$L7",null,{"children":"$L4"}]')}`, `4:["$","code",null,{"children":"${H}"}]`]],
    ['under an element type that is not a known row', [`0:${SECTION('["$","$L9",null,{"children":"$4"}]')}`, `4:["$","code",null,{"children":"${H}"}]`]],
    ['not under the methodology at all', [`0:["$","div",null,{"children":"$4"}]`, `4:["$","code",null,{"children":"${H}"}]`]],
    ['text of something other than <code>', [`0:${SECTION(`["$","p",null,{"children":"${H}"}]`)}`]],
    ['twice', [`0:${SECTION(`["$","code",null,{"children":"${H}"}]`)}`, `1:["$","code",null,{"children":"${H}"}]`]],
    ['the id on something other than the section', [`0:["$","div",null,{"id":"how-the-computer-picked","children":["$","code",null,{"children":"${H}"}]}]`]],
  ];
  for (const [why, rows] of cases) assert.equal(fingerprintPlacement(page(rows))(H).ok, false, why);
});

test('FLIGHT: rows and element types are read from the payload as served', () => {
  const rows = flightRows(served);
  assert.ok(rows.size > 20);
  assert.equal(enclosingType('["$","code",null,{"className":"text-[12px]","children":"x"}]', 52), 'code');
});
