import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApproval, creditName, flattenEditorial } from '../cfb/editorial';

// The real submission, byte for byte as stored, including the contact.
const CONTACT = 'Dorgan.andrew@gmail.com';
const doc = {
  schoolId: 'penn-state',
  name: 'Andrew',
  contact: CONTACT,
  content: {
    whyYouGo: 'A football Saturday at Beaver Stadium is a truly unique experience. You have to fight traffic to get there, but once you do the tailgate scene is world class, the upgraded stadium is beautiful, and a there is no experience like a night game in Happy Valley.',
    traditions: 'White outs, the lion walk',
    gameday: '',
    venueInWords: 'The sound booms in the stadium, it’s an unrivaled level of noise on third down.',
    signatureGame: 'The Whiteout',
  },
  status: 'pending-review',
};

const APPROVED_AT = '2026-09-20T18:00:00.000Z';
const ID = 'xjbIK9nfmh4zP7AotIJz';

const run = (approve: Parameters<typeof buildApproval>[0]['approve'], edits = {}) =>
  buildApproval({ contributionId: ID, doc, approve, edits, approvedAt: APPROVED_AT });

// ── THE ONE THAT MATTERS ────────────────────────────────────────────────────

test('the contact NEVER leaves the contribution doc', () => {
  // every section approved, including the held ones, is still contact-free.
  const r = run(['whyYouGo', 'venueInWords', 'traditions', 'signatureGame']);
  const serialized = JSON.stringify(r.editorial);
  assert.equal(serialized.includes(CONTACT), false, 'the contact must not reach cfbSchools');
  assert.equal(serialized.includes('@'), false, 'nothing address-shaped may reach cfbSchools');
  assert.equal(serialized.toLowerCase().includes('dorgan'), false, 'no surname either');
  // and it cannot survive the trip to the rendered view
  assert.equal(JSON.stringify(flattenEditorial(r.editorial)).includes(CONTACT), false);
});

test('a contact typed into the NAME box is refused as a byline, not published', () => {
  const bad = { ...doc, name: CONTACT };
  const r = buildApproval({ contributionId: ID, doc: bad, approve: ['whyYouGo'], approvedAt: APPROVED_AT });
  assert.equal(r.editorial.whyYouGo, undefined, 'nothing publishes without a safe byline');
  assert.equal(r.verdicts.whyYouGo.verdict, 'held');
  assert.match(r.verdicts.whyYouGo.reason ?? '', /first name/);
  assert.equal(JSON.stringify(r.editorial).includes('@'), false);
});

test('creditName keeps a first name and refuses anything contact-shaped', () => {
  assert.equal(creditName('Andrew'), 'Andrew');
  assert.equal(creditName('  Andrew Dorgan '), 'Andrew', 'a surname is never published');
  assert.equal(creditName('Andrew Dorgan Jr.'), 'Andrew');
  assert.equal(creditName('andrew@example.com'), '');
  assert.equal(creditName('https://linkedin.com/in/x'), '');
  assert.equal(creditName('example.com'), '');
  assert.equal(creditName(''), '');
  assert.equal(creditName(undefined), '');
  assert.equal(creditName(42), '');
});

// ── the allowlist ───────────────────────────────────────────────────────────

test('only the approved sections are written; held sections are ABSENT', () => {
  const r = run(['whyYouGo', 'venueInWords']);
  assert.deepEqual(Object.keys(r.editorial).sort(), ['venueInTheirWords', 'whyYouGo']);
  assert.equal('traditions' in r.editorial, false);
  assert.equal('signatureGame' in r.editorial, false);
  assert.equal(r.verdicts.traditions.verdict, 'held');
  assert.equal(r.verdicts.signatureGame.verdict, 'held');
});

test('approving nothing writes nothing', () => {
  const r = run([]);
  assert.deepEqual(r.editorial, {});
  assert.equal(Object.values(r.verdicts).every((v) => v.verdict === 'held'), true);
});

test('traditions is held even when explicitly approved, with the reason', () => {
  const r = run(['traditions']);
  assert.equal('traditions' in r.editorial, false);
  assert.match(r.verdicts.traditions.reason ?? '', /no renderable shape/);
});

test('an approved signatureGame is recorded but flagged as rendering nowhere', () => {
  const r = run(['signatureGame']);
  assert.equal(r.editorial.signatureGame?.text, 'The Whiteout');
  assert.equal(r.verdicts.signatureGame.verdict, 'approved');
  assert.equal(r.verdicts.signatureGame.renders, false);
  assert.deepEqual(r.approvedButNotRendered, ['signatureGame']);
  // and it still cannot reach the template
  assert.equal(flattenEditorial(r.editorial).signatureGameId, null);
});

test('an unanswered section cannot be approved into a blank panel', () => {
  // `gameday` is not even in the map; the empty answer has no route at all.
  const r = run(['whyYouGo']);
  assert.equal('gamedayCulture' in r.editorial, false);
  assert.equal(flattenEditorial(r.editorial).gamedayCulture, null);
});

// ── the recorded edit ───────────────────────────────────────────────────────

test('an edit replaces the submitted text for exactly that section', () => {
  const fixed = doc.content.whyYouGo.replace('and a there is no experience', 'and there is no experience');
  const r = run(['whyYouGo', 'venueInWords'], { whyYouGo: fixed });
  assert.equal(r.editorial.whyYouGo?.text, fixed);
  assert.equal(r.editorial.whyYouGo?.text.includes('a there is no experience'), false);
  assert.equal(
    r.editorial.venueInTheirWords?.text, doc.content.venueInWords,
    'an edit to one section must not touch another',
  );
});

test('every written section carries its full provenance', () => {
  const r = run(['whyYouGo']);
  assert.deepEqual(r.editorial.whyYouGo, {
    text: doc.content.whyYouGo,
    contributor: 'Andrew',
    approvedAt: APPROVED_AT,
    contributionId: ID,
  });
});

test('a malformed contribution degrades to held, never throws', () => {
  for (const bad of [{}, { content: null }, { content: 'nope' }, { name: 'Andrew' }]) {
    const r = buildApproval({
      contributionId: ID, doc: bad as Parameters<typeof buildApproval>[0]['doc'],
      approve: ['whyYouGo', 'venueInWords'], approvedAt: APPROVED_AT,
    });
    assert.deepEqual(r.editorial, {});
  }
});

test('the approval round-trips into exactly what the page will render', () => {
  const fixed = doc.content.whyYouGo.replace('and a there is no experience', 'and there is no experience');
  const r = run(['whyYouGo', 'venueInWords'], { whyYouGo: fixed });
  const view = flattenEditorial(r.editorial);
  assert.equal(view.whyYouGo, fixed);
  assert.equal(view.venueInTheirWords, doc.content.venueInWords);
  assert.deepEqual(view.contributor, { name: 'Andrew', credit: 'Andrew' });
  assert.equal(view.signatureGameId, null);
  assert.equal(view.gamedayCulture, null);
  assert.deepEqual(view.traditions, []);
});
