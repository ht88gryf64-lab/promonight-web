// The ticket-stub card's title size (src/lib/stub-title.ts): a long title
// steps down until it fits, so the item word is never lost to the clamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STUB_TITLE_TIERS, stubTitleTier, wrappedLines } from '../stub-title';

const size = (t: string) => stubTitleTier(t).className.match(/text-\[(\d+)px\]/)![1];

test('wrappedLines: greedy word wrap by characters, and a word wider than a line never fits', () => {
  assert.equal(wrappedLines('Bobblehead', 12), 1);
  assert.equal(wrappedLines('Fred VanVleet Bobblehead', 12), 3);
  assert.equal(wrappedLines('Evgeni Malkin Talking Bobblehead', 12), 4);
  assert.equal(wrappedLines('Evgeni Malkin Talking Bobblehead', 14), 3);
  assert.equal(wrappedLines('Supercalifragilistic Night', 12), Infinity);
  assert.equal(wrappedLines('   ', 12), 0);
});

test('titles that fit at 27px keep 27px, exactly as before', () => {
  for (const t of ['Bobblehead', 'Fred VanVleet Bobblehead', "Ryan O'Reilly Bobblehead", 'Jalen Johnson Bobblehead', 'Dunkstronaut Bobblehead', 'Neemias Queta Bobblehead', 'Bug Keeper Hats', '76ers Cup Games']) {
    assert.equal(size(t), '27', t);
  }
  assert.equal(STUB_TITLE_TIERS[0].className, 'text-[27px] leading-none line-clamp-3', 'the default tier is the card as it was');
});

test('the two titles the clamp cut on 2026-11-25 now fit whole', () => {
  // "Evgeni Malkin Talking..." lost "Bobblehead"; "Cutter Gauthier Bobblehea..." was cut mid-word.
  const malkin = stubTitleTier('Evgeni Malkin Talking Bobblehead');
  assert.equal(size('Evgeni Malkin Talking Bobblehead'), '22');
  assert.ok(wrappedLines('Evgeni Malkin Talking Bobblehead', malkin.perLine) <= malkin.maxLines);
  const gauthier = stubTitleTier('Cutter Gauthier Bobblehead Giveaway');
  assert.equal(size('Cutter Gauthier Bobblehead Giveaway'), '19');
  assert.ok(wrappedLines('Cutter Gauthier Bobblehead Giveaway', gauthier.perLine) <= gauthier.maxLines);
  assert.equal(size('Stephen Curry Mini Bobblehead Blind Box'), '19');
  assert.equal(size('Music City Billy Strings Bobblehead'), '22');
});

test('every tier fits the 81px title block, and a title no tier fits takes the smallest', () => {
  for (const t of STUB_TITLE_TIERS) {
    const px = Number(t.className.match(/text-\[(\d+)px\]/)![1]);
    const leading = t.className.includes('leading-none') ? 1 : Number(t.className.match(/leading-\[([\d.]+)\]/)![1]);
    assert.ok(px * leading * t.maxLines <= 81.5, t.className);
    assert.match(t.className, new RegExp(`line-clamp-${t.maxLines}`));
  }
  const huge = 'An Extraordinarily Long Promotional Giveaway Title That Goes On And On Past Any Reasonable Card';
  assert.equal(stubTitleTier(huge), STUB_TITLE_TIERS[STUB_TITLE_TIERS.length - 1]);
  const card = readFileSync(new URL('../../components/redesign/TicketStubCard.tsx', import.meta.url), 'utf-8');
  assert.match(card, /\$\{stubTitleTier\(promo\.title\)\.className\} min-h-\[81px\]/);
});
