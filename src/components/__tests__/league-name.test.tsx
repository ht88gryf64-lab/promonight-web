// MiLB Phase 1 (ux-review 2026-11-27): a league name inside uppercase CSS.
// "MiLB" must keep its case through text-transform; every other league must
// render exactly what `{leagueLabel(x)}` rendered before, as plain text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeagueName } from '../LeagueName';
import { leagueLabelIsCaps } from '@/lib/league-label';

test('every existing league renders as plain text, byte-identical to the label', () => {
  for (const lg of ['MLB', 'NBA', 'NFL', 'NHL', 'MLS', 'WNBA']) {
    assert.equal(renderToStaticMarkup(<LeagueName league={lg} />), lg);
    assert.equal(renderToStaticMarkup(<p className="uppercase">{lg} · X</p>), renderToStaticMarkup(<p className="uppercase"><LeagueName league={lg} /> · X</p>));
    assert.equal(leagueLabelIsCaps(lg), true);
  }
});

test('MILB renders MiLB in a span that opts out of uppercase', () => {
  assert.equal(renderToStaticMarkup(<LeagueName league="MILB" />), '<span class="normal-case">MiLB</span>');
  assert.equal(leagueLabelIsCaps('MILB'), false);
});
