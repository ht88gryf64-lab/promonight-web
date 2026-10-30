// The pure half of the per-promo pages (Phase 3b): every rule a crawler sees,
// without a database. Run with: node --import tsx --test <this file>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeLabel,
  baseSlugOf,
  canonicalGroups,
  canonicalSlugFor,
  canonicalTitleKey,
  canonicalWinner,
  cardImagePath,
  categoryAggregatorFor,
  factTiles,
  formatLongDate,
  pageImage,
  previousSeasonLabel,
  promoFaqs,
  promoPageDescription,
  promoPageIndexable,
  promoPageJsonLd,
  promoPagePath,
  promoPageTitle,
  quantityLine,
  renderedTitleLength,
  seasonLabelFor,
  seriesLine,
  storageImageUrl,
  themeLabel,
  titlesNest,
  truncateAtSentence,
  truncateAtWord,
  typeNoun,
  typePlural,
  type PromoPageRow,
} from '../promo-page-copy';

const row = (over: Partial<PromoPageRow> = {}): PromoPageRow => ({
  promoId: 'c7057219198efd77',
  date: '2026-10-29',
  title: 'Blaze Orange Hat',
  description: 'All fans receive a blaze orange hat. Presented by Federal Ammunition.',
  type: 'giveaway',
  displayTime: '7:00 PM',
  displayOpponent: 'Islanders',
  highlight: false,
  attendanceCap: null,
  presentedBy: 'Federal Ammunition',
  whileSuppliesLast: null,
  gateOpenTime: null,
  ageRestriction: null,
  redemptionLocation: null,
  ticketPackageRequired: null,
  ticketPackageName: null,
  sourceUrl: 'https://www.nhl.com/wild/fans/giveaway-schedule',
  pageSlug: 'blaze-orange-hat',
  pageSeason: '2026-27',
  themeKey: 'none',
  imageTier: 1,
  imageRef: 'promo-images/c7057219198efd77.png',
  imageSourceUrl: 'https://www.nhl.com/wild/fans/giveaway-schedule',
  imageCredit: 'Image: Minnesota Wild',
  updatedAt: '2026-10-29T17:29:54.000Z',
  tombstoned: false,
  tombstonedAt: null,
  ...over,
});

test('seasonLabelFor mirrors the pipeline: calendar year, or the July-bounded two-year label for NHL and NBA', () => {
  assert.equal(seasonLabelFor('MLB', '2026-10-29'), '2026');
  assert.equal(seasonLabelFor('NHL', '2026-10-29'), '2026-27');
  assert.equal(seasonLabelFor('NBA', '2027-04-10'), '2026-27');
  assert.equal(seasonLabelFor('nhl', '2026-06-30'), '2025-26');
  assert.equal(seasonLabelFor('NHL', 'bad'), null);
  assert.equal(previousSeasonLabel('2026-27'), '2025-26');
  assert.equal(previousSeasonLabel('2026'), '2025');
  assert.equal(baseSlugOf('star-wars-night-2025-26', '2025-26'), 'star-wars-night');
  assert.equal(baseSlugOf('star-wars-night', '2026-27'), 'star-wars-night');
  assert.equal(promoPagePath('nhl', 'detroit-red-wings', 'star-wars-night'), '/nhl/detroit-red-wings/promos/star-wars-night');
});

test('title: {Promo} | {Team} {Mon D, YYYY}, the year dropped past 60 rendered, the season on a multi-date slug', () => {
  const short = promoPageTitle('Blaze Orange Hat', 'Minnesota Wild', ['2026-10-29'], '2026-27');
  assert.equal(short, 'Blaze Orange Hat | Minnesota Wild Oct 29, 2026');
  assert.ok(renderedTitleLength(short) <= 60, String(renderedTitleLength(short)));
  const long = promoPageTitle('Hall of Fame Mystery Bag Charms', 'Pittsburgh Penguins', ['2026-11-14'], '2026-27');
  assert.equal(long, 'Hall of Fame Mystery Bag Charms | Pittsburgh Penguins Nov 14');
  assert.equal(promoPageTitle('Original Six Matchup', 'Detroit Red Wings', ['2026-10-29', '2026-11-18'], '2026-27'), 'Original Six Matchup | Detroit Red Wings 2026-27');
  assert.equal(promoPageTitle('No Date', 'Minnesota Wild', [], '2026-27'), 'No Date | Minnesota Wild');
});

test('description: the source text, then the game line, cut at the last sentence boundary under 155', () => {
  const d = promoPageDescription({ description: 'All fans receive a blaze orange hat. Presented by Federal Ammunition.', title: 'Blaze Orange Hat', teamName: 'Minnesota Wild', opponentName: 'Islanders', date: '2026-10-29', venueName: 'Grand Casino Arena' });
  assert.equal(d, 'All fans receive a blaze orange hat. Presented by Federal Ammunition. Minnesota Wild vs Islanders, Oct 29, 2026 at Grand Casino Arena.');
  assert.ok(d.length <= 155);
  const long = promoPageDescription({ description: 'x'.repeat(40) + ' ' + 'y'.repeat(200), title: 'T', teamName: 'Team', opponentName: '', date: null, venueName: null });
  assert.ok(long.length <= 155);
  assert.equal(long, 'x'.repeat(40));
  assert.equal(promoPageDescription({ description: '', title: 'Blaze Orange Hat', teamName: 'Minnesota Wild', opponentName: '', date: '2026-10-29', venueName: null }), 'Blaze Orange Hat. Minnesota Wild, Oct 29, 2026.');
  assert.match(promoPageDescription({ description: 'First 10,000 fans.', title: 'Mystery Bobblehead', teamName: 'Anaheim Ducks', opponentName: 'Wild', date: '2027-01-05', venueName: null, removed: true }), /^Removed from the Anaheim Ducks schedule\. First 10,000 fans\./);
  assert.equal(truncateAtWord('alpha beta, gamma', 12), 'alpha beta');
  // The Stars row as stored: the second sentence does not fit, so the cut is
  // after the first, never "handed out as fans".
  const stars = promoPageDescription({ description: 'Early arriving fans have the opportunity to grab a one-of-a-kind Esa Lindell bobblehead, courtesy of Ticketmaster. Bobbleheads will be handed out as fans enter the arena.', title: 'Esa Lindell Bobblehead', teamName: 'Dallas Stars', opponentName: 'Panthers', date: '2026-11-15', venueName: 'American Airlines Center' });
  assert.equal(stars, 'Early arriving fans have the opportunity to grab a one-of-a-kind Esa Lindell bobblehead, courtesy of Ticketmaster.');
  // Sentence boundaries: abbreviations and initials are not ends.
  assert.equal(truncateAtSentence('Doors at 5 p.m. sharp. Lines form at St. Paul gates. Arrive early.', 40), 'Doors at 5 p.m. sharp.');
  assert.equal(truncateAtSentence('Meet J. Smith at the gate. Then go in.', 30), 'Meet J. Smith at the gate.');
  assert.equal(truncateAtSentence('Short one! Second one? Third.', 22), 'Short one! Second one?');
  assert.equal(truncateAtSentence('No boundary here at all for a very long first sentence that runs on', 30), 'No boundary here at all for a');
  assert.equal(truncateAtSentence('Fits.', 155), 'Fits.');
});

test('image: the stored object through the Firebase download endpoint for tier 1, else the card keyed on promo id and updatedAt', () => {
  assert.equal(storageImageUrl('promo-images/c7057219198efd77.png'), 'https://firebasestorage.googleapis.com/v0/b/promonight.firebasestorage.app/o/promo-images%2Fc7057219198efd77.png?alt=media');
  const photo = pageImage(row(), 'minnesota-wild', 'Minnesota Wild', '2026-10-29');
  assert.equal(photo.kind, 'photo');
  assert.equal(photo.credit, 'Image: Minnesota Wild');
  assert.equal(photo.sourceUrl, 'https://www.nhl.com/wild/fans/giveaway-schedule');
  const card = pageImage(row({ imageTier: 3, imageRef: null }), 'minnesota-wild', 'Minnesota Wild', '2026-10-29');
  assert.equal(card.kind, 'card');
  assert.equal(card.url, '/api/promo-card/c7057219198efd77?team=minnesota-wild&v=1793294994000');
  assert.deepEqual([card.width, card.height], [1200, 630]);
  // Absent tier: the card. A tombstoned tier 1 row: the card, never the item photo.
  assert.equal(pageImage(row({ imageTier: null }), 't', 'T', null).kind, 'card');
  assert.equal(pageImage(row({ tombstoned: true }), 't', 'T', null).kind, 'card');
  assert.equal(cardImagePath('t', 'p', null), '/api/promo-card/p?team=t&v=0');
});

test('badge, quantity line and tiles exist only for the fields that exist', () => {
  assert.equal(badgeLabel(row()), 'Giveaway');
  assert.equal(badgeLabel(row({ type: 'theme' })), 'Theme Night');
  assert.equal(badgeLabel(row({ ticketPackageRequired: true })), 'Ticket package');
  assert.equal(badgeLabel(row({ tombstoned: true })), 'Removed');
  assert.equal(quantityLine(row()), null);
  assert.equal(quantityLine(row({ attendanceCap: 10000 })), 'First 10,000 fans');
  assert.equal(quantityLine(row({ whileSuppliesLast: true })), 'While supplies last');
  assert.deepEqual(factTiles(row()).map((t) => t.label), ['Presented by']);
  assert.deepEqual(
    factTiles(row({ gateOpenTime: '5:30 PM', attendanceCap: 7500 })).map((t) => [t.label, t.value, t.numeral]),
    [['Doors', '5:30 PM', true], ['Quantity', '7,500', true], ['Presented by', 'Federal Ammunition', false]],
  );
  assert.deepEqual(factTiles(row({ presentedBy: null, attendanceCap: 0 })), []);
});

test('FAQs come only from stored fields, two at most, in pool order', () => {
  const none = promoFaqs({ row: row({ presentedBy: null, displayTime: '' }), teamName: 'Minnesota Wild', dates: ['2026-10-29'], removed: false, removedOn: null });
  assert.deepEqual(none, []);
  // A game time alone is not an arrival answer (ruling 2026-10-29): the FAQ needs a door time.
  const timeOnly = promoFaqs({ row: row({ presentedBy: null }), teamName: 'Minnesota Wild', dates: ['2026-10-29'], removed: false, removedOn: null });
  assert.deepEqual(timeOnly, []);
  const capped = promoFaqs({ row: row({ attendanceCap: 10000, gateOpenTime: '5:30 PM' }), teamName: 'Minnesota Wild', dates: ['2026-10-29'], removed: false, removedOn: null });
  assert.deepEqual(capped.map((f) => f.question), ['Do I need a special ticket for the Blaze Orange Hat?', 'What time should I arrive?']);
  assert.equal(capped[0].answer, 'The Minnesota Wild listing names no special ticket, so any game ticket should count. The first 10,000 fans through the gates receive one.');
  assert.equal(capped[1].answer, 'Doors open at 5:30 PM. Game time is 7:00 PM. Only the first 10,000 fans receive one, so arrive early.');
  const pkg = promoFaqs({ row: row({ ticketPackageRequired: true, ticketPackageName: 'Scout Pack', displayTime: '' }), teamName: 'T', dates: ['2026-10-29'], removed: false, removedOn: null });
  assert.equal(pkg[0].answer, 'Yes. Scout Pack is required; a standard game ticket does not include it.');
  const removed = promoFaqs({ row: row({ attendanceCap: 10000 }), teamName: 'Anaheim Ducks', dates: [], removed: true, removedOn: 'Oct 5, 2026' });
  assert.equal(removed[0].question, 'Is Blaze Orange Hat still happening?');
  assert.match(removed[0].answer, /removed it from their schedule on Oct 5, 2026/);
  const multi = promoFaqs({ row: row({ type: 'theme', presentedBy: null, displayTime: '' }), teamName: 'Detroit Red Wings', dates: ['2026-10-29', '2026-11-18'], removed: false, removedOn: null });
  assert.equal(multi[0].question, 'Which games is Blaze Orange Hat on?');
  assert.equal(multi[0].answer, '2 Detroit Red Wings home games this season: Oct 29, 2026, Nov 18, 2026.');
});

test('indexability: noindex without a name or a date, and on a removed page once its last date has passed', () => {
  const today = '2026-10-29';
  assert.equal(promoPageIndexable({ title: 'X', dates: ['2026-11-01'], removed: false, today }), true);
  assert.equal(promoPageIndexable({ title: 'X', dates: ['2026-01-01'], removed: false, today }), true);
  assert.equal(promoPageIndexable({ title: ' ', dates: ['2026-11-01'], removed: false, today }), false);
  assert.equal(promoPageIndexable({ title: 'X', dates: [], removed: false, today }), false);
  assert.equal(promoPageIndexable({ title: 'X', dates: ['nope'], removed: false, today }), false);
  assert.equal(promoPageIndexable({ title: 'X', dates: ['2026-11-01'], removed: true, today }), true);
  assert.equal(promoPageIndexable({ title: 'X', dates: ['2026-10-28'], removed: true, today }), false);
  assert.equal(promoPageIndexable({ title: 'X', dates: ['2026-10-29'], removed: true, today }), true);
});

test('category aggregator by type and title; theme labels', () => {
  assert.equal(categoryAggregatorFor(row({ title: 'Esa Lindell Bobblehead' }), 'NHL').href, '/promos/bobbleheads');
  assert.equal(categoryAggregatorFor(row({ title: 'Blaze Orange Hat' }), 'NHL').href, '/promos/jersey-giveaways');
  assert.equal(categoryAggregatorFor(row({ title: 'Replica Jersey' }), 'MLS').href, '/promos/soccer-jersey-nights');
  assert.equal(categoryAggregatorFor(row({ title: 'Rally Towel' }), 'NHL').href, '/best-promos');
  assert.equal(categoryAggregatorFor(row({ type: 'theme' }), 'NHL').href, '/promos/theme-nights');
  assert.equal(categoryAggregatorFor(row({ type: 'food' }), 'MLB').href, '/promos/food-deals');
  assert.equal(categoryAggregatorFor(row({ type: 'kids' }), 'MLB').href, '/promos/this-week');
  assert.equal(themeLabel('hispanic-heritage'), 'Hispanic Heritage');
  assert.equal(themeLabel('aapi-heritage'), 'AAPI Heritage');
  assert.equal(themeLabel('dia-de-los-muertos'), 'Día de los Muertos');
  assert.equal(themeLabel('none'), null);
  assert.deepEqual((['giveaway', 'theme', 'food', 'kids'] as const).map(typePlural), ['giveaways', 'theme nights', 'food deals', 'kids promos']);
  assert.deepEqual((['giveaway', 'theme', 'food', 'kids'] as const).map(typeNoun), ['giveaway', 'theme night', 'food deal', 'promotion']);
  assert.equal(formatLongDate('2026-10-29'), 'Thursday, Oct 29, 2026');
  assert.equal(seriesLine(['2026-10-29', '2026-11-18', '2027-03-20', '2026-10-29']), '3 home games \u00b7 Oct 29, 2026 to Mar 20, 2027');
  assert.equal(seriesLine(['2026-11-01', '2026-11-08']), '2 home games \u00b7 Nov 1 to Nov 8, 2026');
  assert.equal(seriesLine(['2026-11-15']), 'Sunday, Nov 15, 2026');
  assert.equal(seriesLine(['bad']), '');
});

test('JSON-LD: WebPage with dateModified = updatedAt, one Event per date with image, location, offers and status, FAQPage, BreadcrumbList', () => {
  const rows = [row(), row({ promoId: 'b', date: '2026-11-18', displayOpponent: 'Bruins' })];
  const out = promoPageJsonLd({
    canonical: 'https://www.getpromonight.com/nhl/minnesota-wild/promos/blaze-orange-hat',
    title: 'Blaze Orange Hat | Minnesota Wild 2026-27',
    description: 'desc',
    promoName: 'Blaze Orange Hat',
    teamName: 'Minnesota Wild',
    rows,
    removed: false,
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/promonight.firebasestorage.app/o/promo-images%2Fc7057219198efd77.png?alt=media',
    location: { name: 'Grand Casino Arena', streetAddress: '199 W Kellogg Blvd, St Paul, MN 55102', locality: 'St Paul', region: 'Minnesota' },
    ticketUrl: 'https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974',
    dateModified: '2026-10-29T17:29:54.000Z',
    faqs: [{ question: 'Q?', answer: 'A.' }],
    breadcrumbs: [{ name: 'NHL', url: 'https://www.getpromonight.com/nhl' }, { name: 'Minnesota Wild', url: 'https://www.getpromonight.com/nhl/minnesota-wild' }],
  });
  const types = out.map((s) => s['@type']);
  assert.deepEqual(types, ['WebPage', 'Event', 'Event', 'FAQPage', 'BreadcrumbList']);
  assert.equal(out[0].dateModified, '2026-10-29T17:29:54.000Z');
  const ev = out[1] as Record<string, any>;
  assert.equal(ev.startDate, '2026-10-29');
  assert.deepEqual(ev.image, ['https://firebasestorage.googleapis.com/v0/b/promonight.firebasestorage.app/o/promo-images%2Fc7057219198efd77.png?alt=media']);
  assert.equal(ev.location.address.addressLocality, 'St Paul');
  assert.equal(ev.offers.url, 'https://www.ticketmaster.com/minnesota-wild-tickets/artist/805974');
  assert.equal(ev.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal((out[2] as Record<string, any>).startDate, '2026-11-18');
  assert.equal((out[4] as Record<string, any>).itemListElement.length, 2);
  // Removed: cancelled, no offer. No stamp: no dateModified.
  const gone = promoPageJsonLd({ canonical: 'c', title: 't', description: 'd', promoName: 'p', teamName: 'T', rows: [row({ tombstoned: true })], removed: true, imageUrl: 'i', location: null, ticketUrl: 'x', dateModified: null, faqs: [], breadcrumbs: [] });
  assert.equal((gone[1] as Record<string, any>).eventStatus, 'https://schema.org/EventCancelled');
  assert.equal((gone[1] as Record<string, any>).offers, undefined);
  assert.equal('dateModified' in gone[0], false);
  assert.deepEqual(gone.map((s) => s['@type']), ['WebPage', 'Event', 'BreadcrumbList']);
});

// ── the canonical rule (ruling 2026-10-29) ───────────────────────────────────
test('canonical rule: the title key folds diacritics; titles nest by substring or token subset', () => {
  assert.equal(canonicalTitleKey('Día de los Muertos Night!'), 'dia de los muertos night');
  assert.equal(canonicalTitleKey('  Hometown Remix & Catfish Gravy Boat '), 'hometown remix catfish gravy boat');
  assert.ok(titlesNest('Star Wars Night', 'Star Wars Night Layered Hoodie'), 'substring');
  assert.ok(titlesNest('Catfish Gravy Boat', 'Hometown Remix & Catfish Gravy Boat'), 'substring inside');
  assert.ok(titlesNest('Pride Night', 'Night of Pride'), 'token subset');
  assert.ok(titlesNest('Dia de los Muertos', 'Día de los Muertos Night'), 'folded');
  assert.ok(titlesNest('Twin Night', 'Twin Night'), 'equal');
  assert.ok(!titlesNest('Lapel Pin Set', 'Community Night'));
  assert.ok(!titlesNest('', 'Community Night'), 'empty nests with nothing');
});

test('canonical rule: the three ruled examples (2026-10-29), the tie-breaks and the slug lookup', () => {
  const c = (pageSlug: string, title: string, type: PromoPageRow['type'] = 'giveaway', imageTier: 1 | 3 | null = null) => ({ pageSlug, title, type, imageTier });
  // Suns Nov 7: tier 1 giveaway wins when the group has one; the most specific of two.
  const suns7 = [c('originativ-night', 'ORIGINATIV Night', 'theme'), c('originativ', 'ORIGINATIV', 'giveaway', 1), c('artist-collaboration-originativ-replica-jersey', 'Artist Collaboration Originativ Replica Jersey', 'giveaway', 1)];
  const g7 = canonicalGroups(suns7);
  assert.equal(g7.length, 1);
  assert.equal(g7[0].winner.pageSlug, 'artist-collaboration-originativ-replica-jersey');
  assert.deepEqual(g7[0].members.map((m) => m.pageSlug).sort(), ['artist-collaboration-originativ-replica-jersey', 'originativ', 'originativ-night']);
  // Suns Nov 4: no tier 1 giveaway; most tokens wins.
  const suns4 = [c('dia-de-los-muertos-night', 'Día de los Muertos Night', 'theme'), c('dia-de-los-muertos', 'Día de los Muertos', 'giveaway', 3)];
  assert.equal(canonicalWinner(suns4).pageSlug, 'dia-de-los-muertos-night');
  assert.equal(canonicalSlugFor('dia-de-los-muertos', suns4), 'dia-de-los-muertos-night');
  assert.equal(canonicalSlugFor('dia-de-los-muertos-night', suns4), null, 'the winner is its own canonical');
  // Predators Nov 7: the tier 1 giveaway beats the longer theme title.
  const preds = [c('hometown-remix-catfish-gravy-boat', 'Hometown Remix & Catfish Gravy Boat', 'theme'), c('catfish-gravy-boat', 'Catfish Gravy Boat', 'giveaway', 1)];
  assert.equal(canonicalWinner(preds).pageSlug, 'catfish-gravy-boat');
  assert.equal(canonicalSlugFor('hometown-remix-catfish-gravy-boat', preds), 'catfish-gravy-boat');
  // Ties: equal tokens, the longer key; equal keys, the lower slug.
  assert.equal(canonicalWinner([c('a-b', 'Pride Night'), c('a-c', 'Pride Nights')]).pageSlug, 'a-c');
  assert.equal(canonicalWinner([c('twin-night-b', 'Twin Night'), c('twin-night-a', 'Twin Night')]).pageSlug, 'twin-night-a');
  // Two tier 1 giveaways: the most specific of the two (Predators Feb 18).
  assert.equal(canonicalWinner([c('billy-strings-bobblehead', 'Billy Strings Bobblehead', 'giveaway', 1), c('music-city-billy-strings-bobblehead', 'Music City Billy Strings Bobblehead', 'giveaway', 1)]).pageSlug, 'music-city-billy-strings-bobblehead');
  // No group: unrelated titles, a lone page, a slug not in the set.
  assert.deepEqual(canonicalGroups([c('lapel-pin-set', 'Lapel Pin Set'), c('community-night', 'Community Night', 'theme')]), []);
  assert.equal(canonicalSlugFor('lapel-pin-set', [c('lapel-pin-set', 'Lapel Pin Set'), c('community-night', 'Community Night', 'theme')]), null);
  assert.equal(canonicalSlugFor('elsewhere', suns7), null);
  // One candidate per slug: a second row under a slug (a same-date twin) is ignored.
  assert.equal(canonicalGroups([c('twin-night', 'Twin Night', 'theme'), c('twin-night', 'Twin Night', 'theme')]).length, 0);
  // Components join through a shared member: A nests B, B nests C, A and C do not nest.
  const chain = [c('pride', 'Pride', 'theme'), c('pride-night-tank-top', 'Pride Night Tank Top'), c('night-tank-top', 'Night Tank Top')];
  assert.equal(canonicalGroups(chain).length, 1);
  assert.equal(canonicalGroups(chain)[0].members.length, 3);
});
