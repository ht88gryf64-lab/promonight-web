// THE TITLE A PROMO CARD PRINTS (src/lib/promo-display-title.ts, ruling
// 2026-11-25). A bare item title is displayed with the club's short name in
// front; every other title prints as stored. Nothing is written anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isBareItemTitle, promoDisplayTitle } from '../promo-display-title';
import { STUB_TITLE_COLUMN_PX, stubTextWidth, stubTitleTier, wrappedLines } from '../stub-title';

const T = (name: string) => ({ name });

// The nine upcoming NBA and NHL giveaways at 65 or higher whose title named no
// player or theme on 2026-11-25 (read from Firestore that day).
const ROWS: Array<[club: string, stored: string, shown: string]> = [
  ['Kraken', 'Bobblehead', 'Kraken Bobblehead'], // 2027-01-31
  ['Kraken', 'Bobblehead', 'Kraken Bobblehead'], // 2027-03-21
  ['Canadiens', 'Bobblehead Night', 'Canadiens Bobblehead Night'], // 2026-12-10
  ['Canadiens', 'Bobblehead Night', 'Canadiens Bobblehead Night'], // 2027-01-21
  ['Canadiens', 'Bobblehead Night', 'Canadiens Bobblehead Night'], // 2027-03-16
  ['Canadiens', 'Bobblehead Night', 'Canadiens Bobblehead Night'], // 2027-03-24
  ['Kings', 'Rally Towel', 'Kings Rally Towel'], // 2027-01-02
  ['Ducks', 'T-Shirt Giveaway', 'Ducks T-Shirt Giveaway'], // 2027-04-03
  ['Wizards', 'Wizards T-shirt', 'Wizards T-shirt'], // 2027-04-11: already names the club
];

test('the nine rows: a bare item title gets the club in front; one that already names the club is left alone', () => {
  for (const [club, stored, shown] of ROWS) assert.equal(promoDisplayTitle(stored, T(club)), shown, `${club}: ${stored}`);
  assert.equal(ROWS.filter(([c, s, d]) => s !== d).length, 8, 'eight change, the Wizards row does not');
});

test('a named title never changes, whatever item words it also carries', () => {
  for (const [club, title] of [
    ['Rockets', 'Fred VanVleet Bobblehead'],
    ['Penguins', 'Evgeni Malkin Talking Bobblehead'],
    ['Ducks', 'Cutter Gauthier Bobblehead Giveaway'],
    ['Kraken', 'Brandon Montour DJ Bobblehead Night'],
    ['Wild', 'Opening Night LED Rally Towel'],
    ['Kings', 'Pride Rally Towel'],
    ['Warriors', 'Nellie Night Commemorative Pin'],
    ['Twins', 'Fan Appreciation Hat'],
    ['Sabres', 'Hockey Rink Butter Dish'],
    ['Blues', 'Class of 2027 Blues Hall of Fame Banner'],
    ['Galaxy', 'Brazilian Heritage Scarf'],
    ['Twins', 'Theme Night'], // generic to the SCORER, but not an item title: not this rule's business
    ['Braves', 'Friday Night Fireworks'],
  ] as const) {
    assert.equal(promoDisplayTitle(title, T(club)), title, title);
    assert.equal(isBareItemTitle(title), false, title);
  }
});

test('a title that already contains the club name is returned as stored, bare or not', () => {
  assert.equal(promoDisplayTitle('Wizards T-shirt', T('Wizards')), 'Wizards T-shirt');
  assert.equal(promoDisplayTitle('Kraken Bobblehead', T('Kraken')), 'Kraken Bobblehead', 'never "Kraken Kraken Bobblehead"');
  assert.equal(promoDisplayTitle('KRAKEN bobblehead', T('Kraken')), 'KRAKEN bobblehead', 'case does not matter');
  assert.equal(promoDisplayTitle('Red Wings Hat', T('Red Wings')), 'Red Wings Hat', 'a two-word club name');
  assert.equal(promoDisplayTitle('Hat', T('Red Wings')), 'Red Wings Hat');
  assert.equal(promoDisplayTitle('Trail Blazers Rally Towel', T('Trail Blazers')), 'Trail Blazers Rally Towel');
  // Another club's name in the title is a named title, not a bare one.
  assert.equal(promoDisplayTitle('Kings Bobblehead', T('Ducks')), 'Kings Bobblehead');
});

test('edges: no team, no title, punctuation and plurals', () => {
  assert.equal(promoDisplayTitle('Bobblehead', null), 'Bobblehead', 'no team: the stored title');
  assert.equal(promoDisplayTitle('Bobblehead', {}), 'Bobblehead');
  assert.equal(promoDisplayTitle('Bobblehead', T('  ')), 'Bobblehead');
  assert.equal(promoDisplayTitle('', T('Kraken')), '', 'an empty title is missing, not bare');
  assert.equal(isBareItemTitle(''), false);
  assert.equal(isBareItemTitle(null), false);
  assert.equal(promoDisplayTitle('  Bobblehead  ', T('Kraken')), 'Kraken Bobblehead');
  assert.equal(promoDisplayTitle('T-Shirt', T('Ducks')), 'Ducks T-Shirt');
  assert.equal(promoDisplayTitle('Mini Bobbleheads', T('Bruins')), 'Bruins Mini Bobbleheads');
  assert.equal(promoDisplayTitle('Magnet Schedule Giveaway', T('Braves')), 'Braves Magnet Schedule Giveaway');
  // A number is not a generic word: "2027 Calendar" names a year and stays.
  assert.equal(promoDisplayTitle('2027 Calendar', T('Cubs')), '2027 Calendar');
});

test('the longest result fits the ticket-stub card without a mid-word cut', () => {
  for (const shown of ['Canadiens Bobblehead Night', 'Kraken Bobblehead', 'Kings Rally Towel', 'Ducks T-Shirt Giveaway', 'Trail Blazers Rally Towel', 'Timberwolves Bobblehead Night']) {
    const tier = stubTitleTier(shown);
    const lines = wrappedLines(shown, tier.px);
    assert.ok(Number.isFinite(lines), `${shown}: no single word is wider than the column at ${tier.px}px`);
    assert.ok(lines <= tier.maxLines, `${shown}: ${lines} line(s) at ${tier.px}px, the tier allows ${tier.maxLines}`);
    for (const w of shown.split(' ')) assert.ok(stubTextWidth(w, tier.px) <= STUB_TITLE_COLUMN_PX, `${shown}: "${w}" fits the ${STUB_TITLE_COLUMN_PX}px column`);
  }
  // The card sizes the title it PRINTS, not the stored one.
  const card = readFileSync(new URL('../../components/redesign/TicketStubCard.tsx', import.meta.url), 'utf-8');
  assert.match(card, /const displayTitle = promoDisplayTitle\(promo\.title, promo\.team\);/);
  assert.match(card, /\$\{stubTitleTier\(displayTitle\)\.className\}/);
  assert.match(card, /\{displayTitle\}\s*<\/p>/);
});

test('every promo card and the promo page H1 print the display title; the head and the structured data do not', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf-8');
  const uses: Array<[string, RegExp]> = [
    ['../../components/redesign/TicketStubCard.tsx', /promoDisplayTitle\(promo\.title, promo\.team\)/], // homepage rails
    ['../../components/redesign/LightHomePromoCard.tsx', /\{promoDisplayTitle\(promo\.title, promo\.team\)\}/], // homepage This Week
    ['../../components/scoring/scored-promo-card.tsx', /\{promoDisplayTitle\(promo\.title, team\)\}/], // /best-promos, bobbleheads
    ['../../components/hub/HubThisWeek.tsx', /\{promoDisplayTitle\(p\.title, team\)\}/], // hub cards
    ['../../components/hub/HubTodayPromos.tsx', /\{promoDisplayTitle\(p\.title, p\.team\)\}/],
    ['../../components/redesign/RedesignPromoRow.tsx', /\{promoDisplayTitle\(promo\.title, \(promo as \{ team\?: \{ name\?: string \} \}\)\.team \?\? team, \{ ownTeamPage: !\(promo as \{ team\?: unknown \}\)\.team \}\)\}/], // daily board prefixed; the club's own team page not
    ['../../components/redesign/RedesignAggregatorList.tsx', /\{promoDisplayTitle\(p\.title, p\.team\)\}/], // /promos/* lists
    ['../../components/promo-page/PromoPageView.tsx', /<h1 [^>]*>\{shownName\}<\/h1>/],
  ];
  for (const [rel, re] of uses) assert.match(read(rel), re, rel);
  assert.equal(read('../../components/scoring/scored-promo-card.tsx').match(/promoDisplayTitle\(promo\.title, team\)/g)?.length, 2, 'light and dark');
  // Not the page <title>, og:title or JSON-LD: none of those files imports the helper.
  for (const rel of ['../promo-page-copy.ts', '../../app/[sport]/[team]/promos/[slug]/page.tsx', '../../components/json-ld.tsx', '../../components/scoring/scored-jsonld.tsx']) {
    assert.doesNotMatch(read(rel), /promo-display-title/, rel);
  }
  // Pure: no clock, no Firestore, no env.
  assert.doesNotMatch(read('../promo-display-title.ts').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'), /new Date|process\.env|firebase|server-only/);
});

test('the one context flag: on the club\'s own team page every title prints as stored', () => {
  for (const [club, stored] of [['Kraken', 'Bobblehead'], ['Canadiens', 'Bobblehead Night'], ['Kings', 'Rally Towel'], ['Kings', 'Mini Tote Bag'], ['Ducks', 'T-Shirt Giveaway']] as const) {
    assert.equal(promoDisplayTitle(stored, T(club), { ownTeamPage: true }), stored, `${club} team page: ${stored}`);
    assert.notEqual(promoDisplayTitle(stored, T(club)), stored, `${club} elsewhere: prefixed`);
    assert.equal(promoDisplayTitle(stored, T(club), { ownTeamPage: false }), `${club} ${stored}`);
  }
  assert.equal(promoDisplayTitle('Fred VanVleet Bobblehead', T('Rockets'), { ownTeamPage: true }), 'Fred VanVleet Bobblehead');
  // The flag is the helper's, not the components': no component decides the prefix by itself.
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf-8');
  const comps = ['../../components/redesign/TicketStubCard.tsx', '../../components/redesign/LightHomePromoCard.tsx', '../../components/scoring/scored-promo-card.tsx', '../../components/hub/HubThisWeek.tsx', '../../components/hub/HubTodayPromos.tsx', '../../components/redesign/RedesignAggregatorList.tsx'];
  for (const c of comps) assert.doesNotMatch(read(c), /ownTeamPage/, `${c}: a cross-team surface, always the display title`);
  assert.equal(read('../../components/redesign/RedesignPromoRow.tsx').match(/ownTeamPage/g)?.length, 2, 'the shared row passes the flag (once in code, once in its comment)');
  // The team page's own prose, FAQ and game detail never call the helper: they print the stored title.
  for (const c of ['../../components/team-content-sections.tsx', '../promo-helpers.ts', '../../components/redesign/GameExpand.tsx', '../../components/promo-list.tsx']) assert.doesNotMatch(read(c), /promo-display-title/, c);
});

