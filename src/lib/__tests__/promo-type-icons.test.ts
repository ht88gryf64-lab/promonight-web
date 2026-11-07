// The type icon set: every spec key has a glyph, every promo maps to one,
// and the standalone SVG and the sprite carry the same paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMO_ICONS, promoIcon, promoIconKey, promoTypeIconSvg, promoTypeSpriteSvg } from '../promo-type-icons';

test('the set covers every promo type in the spec, plus the generic giveaway', () => {
  const keys = PROMO_ICONS.map((i) => i.key);
  assert.deepEqual(keys, ['bobblehead', 'jersey', 'hat', 'fireworks', 'food-deal', 'kids', 'heritage', 'fan-appreciation', 'ticket-package', 'theme-night', 'giveaway']);
  for (const i of PROMO_ICONS) {
    assert.ok(i.paths.length > 0 && i.paths.every((d) => /^M/.test(d)), `${i.key}: stroke paths`);
    assert.ok(i.title, `${i.key}: title`);
  }
});

test('every promo maps to one icon: package, theme, fireworks, the item, the kind of night', () => {
  assert.equal(promoIconKey({ type: 'theme', title: 'Star Wars Night', ticketPackage: true }), 'ticket-package');
  assert.equal(promoIconKey({ type: 'theme', title: 'Fan Appreciation Night', themeKey: 'fan-appreciation' }), 'fan-appreciation');
  assert.equal(promoIconKey({ type: 'theme', title: 'Hispanic Heritage Night', themeKey: 'hispanic-heritage' }), 'heritage');
  assert.equal(promoIconKey({ type: 'theme', title: 'Lunar New Year', themeKey: 'lunar-new-year' }), 'heritage');
  assert.equal(promoIconKey({ type: 'theme', title: 'Fireworks Night' }), 'fireworks');
  assert.equal(promoIconKey({ type: 'giveaway', title: 'Esa Lindell Bobblehead' }), 'bobblehead');
  assert.equal(promoIconKey({ type: 'giveaway', title: 'Replica Jersey' }), 'jersey');
  assert.equal(promoIconKey({ type: 'giveaway', title: 'Winter Beanie' }), 'hat');
  assert.equal(promoIconKey({ type: 'giveaway', title: 'Lapel Pin Set' }), 'giveaway');
  assert.equal(promoIconKey({ type: 'theme', title: 'Pride Night', themeKey: 'pride' }), 'theme-night');
  assert.equal(promoIconKey({ type: 'food', title: 'Dollar Dogs' }), 'food-deal');
  assert.equal(promoIconKey({ type: 'kids', title: 'Kids Run the Bases' }), 'kids');
  assert.equal(promoIcon('giveaway').source, 'tabler');
});

test('the standalone SVG is single-colour stroke art; the sprite holds one symbol per key with the same paths', () => {
  const svg = promoTypeIconSvg('hat', { size: 16, color: '#da2d20' });
  assert.match(svg, /^<svg [^>]*width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#da2d20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">/);
  assert.equal((svg.match(/<path /g) ?? []).length, promoIcon('hat').paths.length);
  assert.ok(!/fill="#/.test(svg), 'no fills');
  const sprite = promoTypeSpriteSvg();
  for (const i of PROMO_ICONS) {
    assert.ok(sprite.includes(`<symbol id="pn-icon-${i.key}"`), i.key);
    for (const d of i.paths) assert.ok(sprite.includes(`<path d="${d}"/>`), `${i.key}: ${d.slice(0, 20)}`);
  }
  assert.ok(sprite.includes('stroke="currentColor"') && !sprite.includes('fill="#'), 'currentColor, no fills');
});
