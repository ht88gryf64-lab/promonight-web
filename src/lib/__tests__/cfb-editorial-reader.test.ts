import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flattenEditorial, deriveEditorialStatus, SECTION_MAP,
  RENDERABLE_SECTIONS, HELD_SECTIONS,
} from '../cfb/editorial';

const section = (text: string, contributor = 'Andrew') => ({
  text, contributor, approvedAt: '2026-09-20T18:00:00.000Z', contributionId: 'xjbIK9nfmh4zP7AotIJz',
});

test('an unapproved school renders nothing and stays "auto"', () => {
  const v = flattenEditorial(undefined);
  assert.deepEqual(v, {
    signatureGameId: null, traditions: [], gamedayCulture: null,
    whyYouGo: null, venueInTheirWords: null, contributor: null,
  });
  assert.equal(deriveEditorialStatus(v), 'auto');
});

test('an approved whyYouGo publishes the text and flips the derived status', () => {
  const v = flattenEditorial({ whyYouGo: section('A football Saturday at Beaver Stadium.') });
  assert.equal(v.whyYouGo, 'A football Saturday at Beaver Stadium.');
  assert.equal(deriveEditorialStatus(v), 'destination');
});

test('venueInTheirWords alone does NOT make a school a destination', () => {
  // the status tracks the section that carries the page's argument for going.
  const v = flattenEditorial({ venueInTheirWords: section('The sound booms.') });
  assert.equal(v.venueInTheirWords, 'The sound booms.');
  assert.equal(deriveEditorialStatus(v), 'auto');
});

test('the byline names the contributor once both sections publish', () => {
  const v = flattenEditorial({
    whyYouGo: section('Why you go.'), venueInTheirWords: section('The venue.'),
  });
  assert.deepEqual(v.contributor, { name: 'Andrew', credit: 'Andrew' });
});

test('the byline falls through to whichever section actually published', () => {
  const v = flattenEditorial({ venueInTheirWords: section('The venue.', 'Dana') });
  assert.deepEqual(v.contributor, { name: 'Dana', credit: 'Dana' });
});

test('an empty or whitespace section publishes nothing and earns no byline', () => {
  const v = flattenEditorial({ whyYouGo: section('   ') });
  assert.equal(v.whyYouGo, null);
  assert.equal(v.contributor, null, 'a blank section must not credit anyone');
  assert.equal(deriveEditorialStatus(v), 'auto');
});

test('section text is trimmed, not reflowed', () => {
  const v = flattenEditorial({ whyYouGo: section('  Show up Friday night.\n\nIt is worth it.  ') });
  assert.equal(v.whyYouGo, 'Show up Friday night.\n\nIt is worth it.');
});

test('a free-text signatureGame NEVER becomes signatureGameId', () => {
  // the template does games.find(g => g.id === signatureGameId). A phrase can
  // never match a game id, and mapping it would silently blank the panel.
  const v = flattenEditorial({ signatureGame: section('The Whiteout') });
  assert.equal(v.signatureGameId, null);
  assert.equal(deriveEditorialStatus(v), 'auto');
});

test('gamedayCulture has no approved source and stays null', () => {
  assert.equal(flattenEditorial({ whyYouGo: section('x') }).gamedayCulture, null);
});

test('traditions passes through as an array and never crashes on a bad value', () => {
  assert.deepEqual(flattenEditorial({ traditions: ['White Out'] }).traditions, ['White Out']);
  assert.deepEqual(
    flattenEditorial({ traditions: 'White Out' } as unknown as Parameters<typeof flattenEditorial>[0]).traditions,
    [], 'a non-array must degrade to empty, not reach the template',
  );
});

test('only the words and the first name cross into the view', () => {
  const v = flattenEditorial({ whyYouGo: section('Why you go.') }) as unknown as Record<string, unknown>;
  const serialized = JSON.stringify(v);
  assert.equal(serialized.includes('2026-09-20T18:00:00.000Z'), false, 'approvedAt is audit trail, not page content');
  assert.equal(serialized.includes('xjbIK9nfmh4zP7AotIJz'), false, 'contributionId is audit trail, not page content');
});

test('the form-to-template name translation is complete and explicit', () => {
  assert.deepEqual(SECTION_MAP, {
    whyYouGo: 'whyYouGo',
    venueInWords: 'venueInTheirWords',
    traditions: 'traditions',
    signatureGame: 'signatureGame',
  });
  // `gameday` is absent on purpose: no approved destination exists for it.
  assert.equal('gameday' in SECTION_MAP, false);
});

test('the held sections are exactly the two that cannot render', () => {
  assert.deepEqual([...RENDERABLE_SECTIONS], ['whyYouGo', 'venueInTheirWords']);
  assert.deepEqual([...HELD_SECTIONS], ['traditions', 'signatureGame']);
});
