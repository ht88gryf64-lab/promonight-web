// The per-page matchup description: both shapes, the budget, and the degenerate
// cases. What matters most here is that the TBA shape SAYS the kickoff is not
// set, rather than quietly omitting it, and that nothing claims a time or a
// place the page does not show.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchupDescription, prettySchoolId, DESC_MAX } from '@/lib/cfb/matchup-description';

const base = {
  displayName: 'Iron Bowl',
  schoolA: 'Alabama',
  schoolB: 'Auburn',
  date: '2026-11-28',
  kickoff: '3:30 PM CT',
  venueName: 'Bryant-Denny Stadium',
  venueCity: 'Tuscaloosa',
};

test('the announced shape names the date, the kickoff and the venue', () => {
  const d = buildMatchupDescription(base);
  assert.match(d, /Alabama vs Auburn in the Iron Bowl/);
  assert.match(d, /Saturday, November 28, 2026/);
  assert.match(d, /3:30 PM CT/);
  assert.match(d, /Bryant-Denny Stadium in Tuscaloosa/);
  assert.ok(d.length <= DESC_MAX, `${d.length} > ${DESC_MAX}`);
});

// The kickoff clause has several phrasings ("not announced yet", "Kickoff time
// TBA", "Kickoff TBA") so a long pairing can stay inside the window without
// dropping the value tail. The INVARIANT is that some form of the statement
// always survives: a TBA page must never read as though we simply failed to
// list a time. Asserting one exact phrasing would pin the tier, not the rule.
const SAYS_TBA = /not announced yet|Kickoff (time )?TBA/;

test('the TBA shape SAYS the kickoff is not set rather than omitting it', () => {
  const d = buildMatchupDescription({ ...base, kickoff: null });
  assert.match(d, SAYS_TBA);
  assert.match(d, /Saturday, November 28, 2026/);
  assert.match(d, /Bryant-Denny Stadium/);
  assert.ok(d.length <= DESC_MAX);
});

test('every TBA tier states the kickoff status, at every input length', () => {
  // Walk the pairing from short to absurd so the chain is forced down each tier.
  for (let n = 1; n <= 60; n++) {
    const pad = 'a'.repeat(n);
    const d = buildMatchupDescription({
      ...base,
      kickoff: null,
      schoolA: `North ${pad}`,
      schoolB: `South ${pad}`,
      venueName: `${pad} Memorial Stadium`,
      venueCity: `${pad}ville`,
    });
    assert.match(d, SAYS_TBA, `tier for n=${n} dropped the kickoff statement: "${d}"`);
    assert.ok(d.length <= DESC_MAX, `n=${n} produced ${d.length} chars`);
  }
});

test('a TBA description never implies a time', () => {
  const d = buildMatchupDescription({ ...base, kickoff: null });
  assert.doesNotMatch(d, /\d{1,2}:\d{2}/, 'no clock time may appear');
});

test('a display name that is already a pairing is not doubled', () => {
  const d = buildMatchupDescription({
    ...base, displayName: 'Florida vs Georgia', schoolA: 'Florida', schoolB: 'Georgia',
  });
  assert.match(d, /^Florida vs Georgia is /);
  assert.doesNotMatch(d, /Florida vs Georgia in the Florida vs Georgia/);
});

test('a display name carrying its own article does not get a second one', () => {
  const d = buildMatchupDescription({
    ...base, displayName: 'The Game', schoolA: 'Michigan', schoolB: 'Ohio State',
  });
  assert.match(d, /in The Game/);
  assert.doesNotMatch(d, /in the The Game/);
});

test('a name without an article gets one', () => {
  const d = buildMatchupDescription({ ...base, displayName: 'Egg Bowl' });
  assert.match(d, /in the Egg Bowl/);
});

test('an untracked school still renders a name, never an empty fragment', () => {
  const d = buildMatchupDescription({
    ...base,
    displayName: 'Apple Cup',
    schoolA: 'Washington',
    schoolB: prettySchoolId('washington-state'),
  });
  assert.match(d, /Washington vs Washington State in the Apple Cup/);
  assert.doesNotMatch(d, /\s{2,}/, 'no collapsed gap where a name should be');
  assert.doesNotMatch(d, /vs\s+in/, 'no missing side');
});

test('a missing venue drops the place clause without leaving a dangling preposition', () => {
  const d = buildMatchupDescription({ ...base, venueName: null, venueCity: null });
  assert.doesNotMatch(d, / at \./);
  assert.doesNotMatch(d, / at $/);
  assert.doesNotMatch(d, /\sin\s\./);
  assert.ok(d.length <= DESC_MAX);
});

test('a venue with no known city renders the name alone, never a junk city', () => {
  const d = buildMatchupDescription({ ...base, venueCity: null });
  assert.match(d, /at Bryant-Denny Stadium\./);
  assert.doesNotMatch(d, /Bryant-Denny Stadium in /);
});

test('a dormant rivalry claims no date and no venue', () => {
  const d = buildMatchupDescription({ ...base, date: null, kickoff: null });
  assert.match(d, /no scheduled 2026 meeting|No 2026 meeting is scheduled/i);
  assert.doesNotMatch(d, /2026\.\s*Kickoff/);
  assert.doesNotMatch(d, /November/);
  assert.ok(d.length <= DESC_MAX);
});

test('the date does not slip a day, which noon anchoring exists to prevent', () => {
  // A UTC-midnight parse renders Nov 27 for this date anywhere west of GMT.
  const d = buildMatchupDescription({ ...base, date: '2026-11-28' });
  assert.match(d, /Saturday, November 28, 2026/);
});

test('the longest fitting candidate is chosen, not the shortest', () => {
  const d = buildMatchupDescription(base);
  assert.match(d, /Tickets, parking/, 'the value clause survives when it fits');
  assert.ok(d.length > 100, `expected a full description, got ${d.length}`);
});

test('an absurdly long name still lands within the budget', () => {
  const d = buildMatchupDescription({
    ...base,
    displayName: 'A Very Long Ceremonial Trophy Rivalry Name That Will Not Fit',
    schoolA: 'Some Extremely Long University Name',
    schoolB: 'Another Extremely Long University Name',
    venueName: 'A Very Long Memorial Stadium Name Indeed',
    venueCity: 'Someplace With A Long Name',
  });
  assert.ok(d.length <= DESC_MAX, `${d.length} > ${DESC_MAX}: "${d}"`);
});

test('no em dashes in generated copy', () => {
  for (const k of [base, { ...base, kickoff: null }, { ...base, date: null, kickoff: null }]) {
    assert.doesNotMatch(buildMatchupDescription(k), /—/);
  }
});

test('prettySchoolId title-cases a hyphenated id', () => {
  assert.equal(prettySchoolId('washington-state'), 'Washington State');
  assert.equal(prettySchoolId('texas'), 'Texas');
});
