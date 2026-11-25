// The ticket-stub card's title size (src/lib/stub-title.ts): a long title
// steps down until it fits, so the item word is never lost to the clamp.
// The widths are Archivo 700's own, measured in Chrome on 2026-11-25.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STUB_TITLE_COLUMN_PX, STUB_TITLE_TIERS, stubTextWidth, stubTitleTier, wrappedLines } from '../stub-title';

const px = (t: string) => stubTitleTier(t).px;

test('the width table reproduces what Chrome measured, a little wide and never narrow', () => {
  // Rendered widths at 27px in the card's own style (kerning on), 2026-11-25.
  const MEASURED: Array<[string, number]> = [
    ['James Harden', 187.8], ['Championship', 188.4], ['Evgeni Malkin', 180.8], ['Bobblehead', 157],
    ['Cutter Gauthier', 199.2], ['Fred VanVleet', 181.6], ['Hometown Remix', 229], ['Thanksgiving Salt', 230.9],
  ];
  for (const [text, real] of MEASURED) {
    const est = stubTextWidth(text, 27);
    assert.ok(est >= real - 0.5, `${text}: estimate ${est.toFixed(1)} must not be narrower than the rendered ${real}`);
    assert.ok(est <= real * 1.03, `${text}: estimate ${est.toFixed(1)} is within 3% of the rendered ${real}`);
  }
  assert.equal(STUB_TITLE_COLUMN_PX, 180);
});

test('wrappedLines: wraps the way the browser does, and an unbreakable word wider than the column never fits', () => {
  assert.equal(wrappedLines('Bobblehead', 27), 1);
  assert.equal(wrappedLines('Fred VanVleet Bobblehead', 27), 3, '"Fred VanVleet" is 181.6px: one word per line');
  assert.equal(wrappedLines('James Harden Special Bobblehead', 27), 4, '"James Harden" is 187.8px at 27px, so four lines, not three');
  assert.equal(wrappedLines('2020 Championship Replica Ring', 27), Infinity, '"Championship" alone is wider than the column at 27px');
  assert.ok(Number.isFinite(wrappedLines('2020 Championship Replica Ring', 24)));
  // A hyphen is a break opportunity.
  assert.ok(Number.isFinite(wrappedLines('Alex Tuch-Designed Hat', 27)));
  assert.equal(wrappedLines('   ', 27), 0);
});

test('titles that fit at 27px keep 27px, including ones a character count stepped down', () => {
  for (const t of [
    'Bobblehead', 'Fred VanVleet Bobblehead', "Ryan O'Reilly Bobblehead", 'Jalen Johnson Bobblehead', 'Dunkstronaut Bobblehead',
    'Neemias Queta Bobblehead', 'Bug Keeper Hats', '76ers Cup Games',
    // Stepped down for nothing by the first, character-count version (review, 2026-11-25).
    'Artist Collaboration Hat', 'Alex Tuch-Designed Hat',
  ]) {
    assert.equal(px(t), 27, t);
    assert.ok(wrappedLines(t, 27) <= 3, t);
  }
  assert.equal(STUB_TITLE_TIERS[0].className, 'text-[27px] leading-none line-clamp-3', 'the default tier is the card as it was');
});

test('titles the clamp cut now fit whole at the tier they are given', () => {
  const cases = [
    // The two on the Best Promos rail on 2026-11-25.
    'Evgeni Malkin Talking Bobblehead', 'Cutter Gauthier Bobblehead Giveaway',
    // Real rows the first version still clipped (review, 2026-11-25).
    'James Harden Special Bobblehead', 'Mini Goalie Mask Blind Box Giveaway', 'Alex Ovechkin Hometown Remix Bobblehead',
    '2020 Championship Replica Ring', 'WWE Night Championship Belt',
    'Stephen Curry Mini Bobblehead Blind Box', 'Music City Billy Strings Bobblehead', 'Thanksgiving Salt & Pepper Shakers',
    'Native American Heritage Night Hat', 'Class of 2027 Blues Hall of Fame Banner',
  ];
  for (const t of cases) {
    const tier = stubTitleTier(t);
    const lines = wrappedLines(t, tier.px);
    assert.ok(lines <= tier.maxLines, `${t}: ${lines} lines at ${tier.px}px, ${tier.maxLines} allowed`);
    assert.ok(tier.px >= 18, `${t}: ${tier.px}px is still a readable size`);
    // And it is the LARGEST tier that fits: every larger one does not.
    for (const bigger of STUB_TITLE_TIERS.filter((x) => x.px > tier.px)) assert.ok(wrappedLines(t, bigger.px) > bigger.maxLines, `${t} would fit ${bigger.px}px`);
  }
  assert.ok(px('Evgeni Malkin Talking Bobblehead') < 27);
  assert.ok(px('James Harden Special Bobblehead') < 27);
});

test('every tier fits the 81px title block, and a title no tier fits takes the smallest', () => {
  for (const t of STUB_TITLE_TIERS) {
    assert.match(t.className, new RegExp(`^text-\\[${t.px}px\\] `));
    const leading = t.className.includes('leading-none') ? 1 : Number(t.className.match(/leading-\[([\d.]+)\]/)![1]);
    assert.ok(t.px * leading * t.maxLines <= 81.5, t.className);
    assert.match(t.className, new RegExp(`line-clamp-${t.maxLines}$`));
  }
  assert.deepEqual(STUB_TITLE_TIERS.map((t) => t.px), [27, 24, 22, 20, 18, 16], 'largest first');
  const huge = 'An Extraordinarily Long Promotional Giveaway Title That Goes On And On Past Any Reasonable Card Anyone Ever Printed';
  assert.equal(stubTitleTier(huge), STUB_TITLE_TIERS[STUB_TITLE_TIERS.length - 1]);
  assert.equal(stubTitleTier('Supercalifragilisticexpialidocious'), STUB_TITLE_TIERS[STUB_TITLE_TIERS.length - 1], 'one word wider than the column at every size');
  const card = readFileSync(new URL('../../components/redesign/TicketStubCard.tsx', import.meta.url), 'utf-8');
  assert.match(card, /\$\{stubTitleTier\(displayTitle\)\.className\} min-h-\[81px\]/);
});
