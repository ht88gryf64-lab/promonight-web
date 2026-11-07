// Team-color theming and the date tile state (docs/per-promo-pages-v2-spec.md,
// Visuals 1 and 2), the pure halves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AA_TEXT, AA_UI, contrastRatio, HOUSE_INK, HOUSE_RED, inkFor, PAGE_GROUND, promoPageTheme, themeStyle } from '../promo-page-theme';
import { dateTileState, daysBetweenYmd, weekdayName, ymdInZone } from '../promo-date-tile';

test('a team color that clears AA for its ink and 3:1 on the ground is the accent; white ink on a dark green', () => {
  const t = promoPageTheme({ primaryColor: '#154734', secondaryColor: '#a6192e' });
  assert.deepEqual([t.source, t.accent, t.accentInk], ['primary', '#154734', '#ffffff']);
  assert.ok(contrastRatio(t.accent, t.accentInk) >= AA_TEXT);
  assert.ok(contrastRatio(t.accent, PAGE_GROUND) >= AA_UI);
  assert.equal(t.accentText, '#154734', 'dark green reads on cream as text');
});

test('a mid-gray primary fails both inks and a white secondary fails the ground: the house red', () => {
  assert.equal(inkFor('#808080'), null);
  const t = promoPageTheme({ primaryColor: '#808080', secondaryColor: '#ffffff' });
  assert.deepEqual([t.source, t.accent, t.accentInk], ['house', HOUSE_RED, '#ffffff']);
  assert.deepEqual(themeStyle(t), { '--pp-accent': HOUSE_RED, '--pp-accent-ink': '#ffffff', '--pp-accent-text': t.accentText });
});

test('a failing primary falls to a passing secondary before the house red', () => {
  const t = promoPageTheme({ primaryColor: '#ffffff', secondaryColor: '#a6192e' });
  assert.deepEqual([t.source, t.accent, t.accentInk], ['secondary', '#a6192e', '#ffffff']);
});

test('gold fails 3:1 against the cream ground, so it is never the accent even with a readable ink', () => {
  assert.equal(inkFor('#fcb514'), HOUSE_INK);
  assert.ok(contrastRatio('#fcb514', PAGE_GROUND) < AA_UI);
  assert.equal(promoPageTheme({ primaryColor: '#fcb514', secondaryColor: '#fcb514' }).source, 'house');
});

test('an accent that clears 3:1 on the ground but not 4.5:1 is not used as text there: the numeral takes the ink', () => {
  const t = promoPageTheme({ primaryColor: '#e0202a', secondaryColor: '#000000' });
  assert.equal(t.accent, '#e0202a');
  assert.ok(contrastRatio('#e0202a', PAGE_GROUND) >= AA_UI && contrastRatio('#e0202a', PAGE_GROUND) < AA_TEXT);
  assert.equal(t.accentText, HOUSE_INK);
});

test('black is a real brand color (Penguins, Nets): kept, with white ink', () => {
  const t = promoPageTheme({ primaryColor: '#000000', secondaryColor: '#fcb514' });
  assert.deepEqual([t.source, t.accent, t.accentInk], ['primary', '#000000', '#ffffff']);
});

test('a missing or malformed color is skipped, never guessed', () => {
  assert.equal(promoPageTheme({ primaryColor: undefined, secondaryColor: 'blue' }).source, 'house');
  assert.equal(promoPageTheme({}).source, 'house');
});

test('the date tile state: tonight with and without doors, days inside two weeks, the weekday beyond', () => {
  assert.deepEqual(dateTileState('2026-10-29', '2026-10-29', '5:30 PM'), { kind: 'tonight', label: 'Tonight · gates 5:30 PM' });
  assert.deepEqual(dateTileState('2026-10-29', '2026-10-29', null), { kind: 'tonight', label: 'Tonight' });
  assert.deepEqual(dateTileState('2026-10-30', '2026-10-29', '5:30 PM'), { kind: 'soon', label: 'In 1 day' });
  assert.deepEqual(dateTileState('2026-11-05', '2026-10-29', null), { kind: 'soon', label: 'In 7 days' });
  assert.deepEqual(dateTileState('2026-11-12', '2026-10-29', null), { kind: 'soon', label: 'In 14 days' });
  assert.deepEqual(dateTileState('2026-12-05', '2026-10-29', null), { kind: 'later', label: 'Saturday' });
  assert.deepEqual(dateTileState('2026-10-20', '2026-10-29', null), { kind: 'past', label: 'Tuesday' });
  assert.equal(dateTileState('', '2026-10-29', null), null);
  assert.equal(daysBetweenYmd('2026-10-29', '2026-11-05'), 7);
  assert.equal(weekdayName('2026-11-07'), 'Saturday');
});

test('the venue day comes from the instant in the venue zone, the site zone when the zone is unknown', () => {
  const instant = new Date('2026-10-30T02:30:00Z'); // 9:30 PM Chicago on the 29th, 10:30 PM New York on the 29th, 4:30 AM London on the 30th
  assert.equal(ymdInZone(instant, 'America/Chicago'), '2026-10-29');
  assert.equal(ymdInZone(instant, 'Europe/London'), '2026-10-30');
  assert.equal(ymdInZone(instant, null), '2026-10-29');
  assert.equal(ymdInZone(instant, 'Not/AZone'), '2026-10-29');
});
