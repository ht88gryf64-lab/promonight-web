// The recurring-deals section copy and the Food Deals tile count, derived from
// the stored records (discovery-apply, 2026-10-24). Fixtures are the real
// frequency strings stored on 2026-10-24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recurringFoodDealCount, recurringNoteTail, recurringSectionCopy } from '../recurring-deal-copy';
import type { RecurringDeal } from '../recurring-deals';

const deal = (category: RecurringDeal['category'], title: string, frequency: string): RecurringDeal => ({ id: title, title, frequency, category });

test('a single weekday deal is headed by its own frequency, never "Every home game"', () => {
  const c = recurringSectionCopy([deal('food', 'Popcorn TWOsday', 'Every Tuesday home game')], 'Knicks', 'Madison Square Garden');
  assert.equal(c.kicker, 'Every Tuesday home game');
  assert.equal(c.title, 'RECURRING DEALS');
  assert.equal(c.lead, 'A food deal that repeats at Knicks home games at Madison Square Garden. The card below says which games.');
  assert.doesNotMatch(`${c.kicker} ${c.title} ${c.lead}`, /every (home )?game/i);
});

test('mixed frequencies get a kicker that claims no schedule', () => {
  const c = recurringSectionCopy(
    [deal('drink', '$2 Beers', 'Every Saturday home game'), deal('food', 'Dollar-A-Dog Day', 'Every Tuesday home game'), deal('kids', 'Free Kids Ice Cream', 'Every Sunday, 12 & under')],
    'Twins',
    'Target Field',
  );
  assert.equal(c.kicker, 'Repeats at home games');
  assert.equal(c.title, 'RECURRING DEALS');
  assert.equal(c.lead, 'Food, drink and family deals that repeat at Twins home games at Target Field. Each card says which games.');
});

test('"Select home games (3 dates)" is not every game', () => {
  const c = recurringSectionCopy([deal('food', 'Ballpark Deal', 'Select home games (3 dates)')], 'Braves', null);
  assert.equal(c.kicker, 'Select home games (3 dates)');
  assert.equal(c.title, 'RECURRING DEALS');
});

test('only records that all run every home game keep the every-game heading', () => {
  const c = recurringSectionCopy([deal('food', '$1 Hot Dogs', 'Every home game'), deal('drink', 'Happy Hour', 'every home game')], 'Rays', null);
  assert.equal(c.kicker, 'Every home game');
  assert.equal(c.title, 'EVERY GAME DEALS');
});

test('the Food Deals tile counts food and drink records, not kids activities', () => {
  assert.equal(recurringFoodDealCount([deal('food', 'a', 'x'), deal('drink', 'b', 'x'), deal('kids', 'Kids Run the Bases', 'Most Sunday home games')]), 2);
  assert.equal(recurringFoodDealCount([]), 0);
});

test('the note tail names the records the tile adds, and is empty when it adds none', () => {
  assert.equal(recurringNoteTail(0), '');
  assert.equal(recurringNoteTail(1), ', plus 1 recurring food deal');
  assert.equal(recurringNoteTail(3), ', plus 3 recurring food deals');
});

test('a recurring deal already counted as dated food rows is not counted twice', () => {
  // Real pairs stored on 2026-10-24.
  assert.equal(recurringFoodDealCount([deal('food', '$5 Tuesday', 'Every Tuesday home game')], [{ title: '$5 Tuesday' }]), 0);
  assert.equal(
    recurringFoodDealCount([deal('food', "Taco Tuesday presented by Tito's", 'Every Tuesday home game')], [{ title: 'Taco Tuesday' }]),
    0,
  );
  // A different dated food deal does not suppress it.
  assert.equal(recurringFoodDealCount([deal('food', 'Popcorn TWOsday', 'Every Tuesday home game')], [{ title: 'Dollar Dog Night' }]), 1);
});

test('a dated title covers a recurring title holding all of its distinctive words (Twins, PR #29)', () => {
  // The real Twins rows stored on 2026-10-24: one dated row, three recurring records.
  const twinsDated = [{ title: '$2 Beers & Happy Hour' }];
  const twins = [
    deal('drink', '$2 Beers', 'Every Saturday home game'),
    deal('drink', '$2 Happy Hour', 'Every Friday home game'),
    deal('food', 'Dollar-A-Dog Day', 'Every Tuesday home game'),
  ];
  // "$2 Beers" by containment, "$2 Happy Hour" by word cover; only the dog deal adds.
  assert.equal(recurringFoodDealCount(twins, twinsDated), 1);
  // A shared connective or price alone is not cover.
  assert.equal(recurringFoodDealCount([deal('drink', '$2 Margaritas', 'Every Friday home game')], twinsDated), 1);
});
