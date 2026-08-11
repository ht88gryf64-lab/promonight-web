import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCHUP_REGISTRY, matchupEntryForRivalryId, matchupHrefForRivalryId, matchupEntryForSlug,
} from '../cfb/matchup-registry';
import { resolveMatchupDisplayName } from '../cfb/display-name';

// Inbound linking resolves rivalry -> page through the REGISTRY, never by
// slugifying the name. Three rivalries are named "Victory Bell" and three more
// "Florida Cup", so a derived slug would point several school pages at one
// wrong page.

test('a rivalry id in the registry resolves its entry and href', () => {
  assert.equal(matchupEntryForRivalryId('alabama--auburn')?.slug, 'iron-bowl');
  assert.equal(matchupHrefForRivalryId('alabama--auburn'), '/cfb/rivalries/iron-bowl');
});

test('a rivalry id NOT in the registry resolves null, so the Wikipedia link stays', () => {
  // alabama--mississippi-state ("Battle for Highway 82") is a real tagged
  // rivalry with no matchup page. Its external link must survive.
  assert.equal(matchupEntryForRivalryId('alabama--mississippi-state'), null);
  assert.equal(matchupHrefForRivalryId('alabama--mississippi-state'), null);
});

test('null and undefined rivalry ids are safe', () => {
  assert.equal(matchupEntryForRivalryId(null), null);
  assert.equal(matchupEntryForRivalryId(undefined), null);
  assert.equal(matchupHrefForRivalryId(null), null);
});

test('every registry rivalryId round-trips to its own slug', () => {
  for (const e of MATCHUP_REGISTRY) {
    assert.equal(matchupEntryForRivalryId(e.rivalryId)?.slug, e.slug, e.rivalryId);
    assert.equal(matchupEntryForSlug(e.slug)?.rivalryId, e.rivalryId, e.slug);
  }
});

test('rivalryIds are unique, so no two school pages can link the same page for different rivalries', () => {
  const ids = MATCHUP_REGISTRY.map((e) => e.rivalryId);
  assert.equal(new Set(ids).size, ids.length);
});

test('the two Victory Bell rivalries resolve to DIFFERENT pages', () => {
  const a = matchupHrefForRivalryId('ucla--usc');
  const b = matchupHrefForRivalryId('duke--north-carolina');
  assert.equal(a, '/cfb/rivalries/victory-bell-ucla-usc');
  assert.equal(b, '/cfb/rivalries/victory-bell-duke-unc');
  assert.notEqual(a, b);
});

test('a school page and its matchup page agree on the rivalry name', () => {
  // Both surfaces call the same resolver, so this is the contract that keeps
  // "Okefenokee Oar" off the school page too.
  const e = matchupEntryForRivalryId('florida--georgia');
  assert.equal(resolveMatchupDisplayName(e, 'Okefenokee Oar'), 'Florida vs Georgia');
});

test('the four hub-curated blocks all resolve a registry slug', () => {
  for (const slug of ['the-game', 'iron-bowl', 'red-river-rivalry', 'florida-georgia']) {
    assert.ok(matchupEntryForSlug(slug), slug);
  }
});
