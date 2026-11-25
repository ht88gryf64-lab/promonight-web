// ONE NAME PER PAGE for a bare item title (ruling 2026-11-25,
// src/lib/promo-display-title.ts).
//  - The PROMO PAGE prints the display title ("Kraken Bobblehead") in every
//    place it names the promo: H1, breadcrumb, FAQ questions and answers, the
//    timeline's Next game line and dot tooltips, the share text and the
//    JSON-LD name. Its stored title still feeds the ids.
//  - A named title is unchanged in every one of those slots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromoPageView } from '../PromoPageView';
import type { PromoPage, PromoPageContext } from '../../../lib/promo-pages';
import type { PromoPageRow } from '../../../lib/promo-page-copy';
import type { Team } from '../../../lib/types';

const KRAKEN = { id: 'seattle-kraken', name: 'Kraken', city: 'Seattle', league: 'NHL', sportSlug: 'nhl', abbreviation: 'SEA', primaryColor: '#001628', secondaryColor: '#99d9d9', division: 'Pacific' } as unknown as Team;

const row = (over: Partial<PromoPageRow>): PromoPageRow => ({
  promoId: 'ceebf421128d2511', date: '2027-01-31', title: 'Bobblehead', description: 'First 5,000 fans receive a bobblehead. Presented by Symetra.', type: 'giveaway',
  displayTime: '1:00 PM', displayOpponent: 'Devils', highlight: true, attendanceCap: 5000, presentedBy: 'Symetra',
  whileSuppliesLast: true, gateOpenTime: null, ageRestriction: null, redemptionLocation: null, ticketPackageRequired: null,
  ticketPackageName: null, sourceUrl: 'https://www.nhl.com/kraken/tickets/giveaways', pageSlug: 'bobblehead', pageSeason: '2026-27', themeKey: 'none',
  imageTier: null, imageRef: null, imageSourceUrl: null, imageCredit: null, updatedAt: '2026-10-29T00:00:00.000Z',
  tombstoned: false, tombstonedAt: null, tnEventUrl: null, ...over,
});
function page(rows: PromoPageRow[], today: string): PromoPage {
  const primary = rows.find((r) => r.date >= today) ?? rows[rows.length - 1];
  return { team: KRAKEN, slug: rows[0].pageSlug, season: '2026-27', rows, removedRows: [], removedDates: [], state: 'live', primary, dates: rows.map((r) => r.date), updatedAt: null, removedAt: null, canonicalSlug: null };
}
const CTX: PromoPageContext = { game: null, timeline: null, venueGiveaways: null, venue: null, hub: null, beforeYouGo: [], quickFacts: [], location: null, coords: null, roof: null, forecast: null, formerNames: [], observedAt: null, alsoAtGame: [], nextTeamPromos: [], crossTeam: null, previousEditions: [], previousEdition: null, nextEdition: null, short: null, ebayListings: [] };
const GAMES = ['2026-12-05', '2026-12-20', '2027-01-10', '2027-01-31', '2027-03-21'].map((date) => ({ date }));
const withTimeline = (title: string, slug: string): PromoPageContext => ({
  ...CTX,
  timeline: { games: GAMES, promos: [{ date: '2026-12-20', title: 'Brandon Montour DJ Bobblehead Night', href: '/nhl/seattle-kraken/promos/montour', type: 'giveaway' }, { date: '2027-01-31', title, href: `/nhl/seattle-kraken/promos/${slug}`, type: 'giveaway' }, { date: '2027-03-21', title, href: `/nhl/seattle-kraken/promos/${slug}`, type: 'giveaway' }] },
  alsoAtGame: [{ href: '/nhl/seattle-kraken/promos/rally-towel', title: 'Rally Towel', date: '2027-01-31', type: 'giveaway' }] as never,
});
const render = (rows: PromoPageRow[], ctx: PromoPageContext, today = '2026-11-25') => renderToStaticMarkup(<PromoPageView page={page(rows, today)} ctx={ctx} today={today} />).replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
const text = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const ld = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('KRAKEN, a bare title: one name, "Kraken Bobblehead", in every slot where the page names the promo', () => {
  const rows = [row({}), row({ promoId: '8c6a5ddbc073ccc3', date: '2027-03-21', displayTime: '5:00 PM', displayOpponent: 'Kings', presentedBy: 'Toyota', description: 'First 5,000 fans receive a bobblehead. Presented by Toyota.' })];
  const h = render(rows, withTimeline('Bobblehead', 'bobblehead'));
  const t = text(h);
  // H1 and the breadcrumb's own crumb.
  assert.match(h, /<h1 [^>]*>Kraken Bobblehead<\/h1>/);
  assert.match(h, /<span aria-current="page"[^>]*>Kraken Bobblehead<\/span>/);
  // FAQ: questions and answers, visible and in the FAQPage schema.
  const faq = ld(h).find((x) => x['@type'] === 'FAQPage');
  assert.ok(faq && faq.mainEntity.length > 0, 'the page has stored FAQs');
  const faqText = faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => `${q.name} ${q.acceptedAnswer.text}`).join(' ');
  assert.match(faqText, /Kraken Bobblehead/);
  assert.doesNotMatch(faqText.replace(/Kraken Bobblehead/g, ''), /\bBobblehead\b/, 'no FAQ sentence uses the bare name');
  for (const q of faq.mainEntity) assert.ok(t.includes(q.name), `visible FAQ carries the same question: ${q.name}`);
  // The timeline: the Next game line and the dot tooltips.
  assert.match(t, /Jan 31 · Kraken Bobblehead · home game 4 of 5/);
  assert.match(h, /<title>Jan 31: Kraken Bobblehead<\/title>/);
  assert.match(h, /<title>Mar 21: Kraken Bobblehead<\/title>/);
  assert.match(h, /<title>Dec 20: Brandon Montour DJ Bobblehead Night<\/title>/, 'a named promo on the same bar is unchanged');
  // Another bare-titled promo of the same club named on this page reads the same way.
  assert.match(h, /href="\/nhl\/seattle-kraken\/promos\/rally-towel"[^>]*>Kraken Rally Towel<\/a>/);
  // JSON-LD: the Event names.
  const events = ld(h).filter((x) => x['@type'] === 'Event' || x['@type'] === 'SportsEvent');
  assert.ok(events.length >= 1);
  for (const e of events) assert.equal(e.name, 'Kraken Bobblehead');
  const crumbs = ld(h).find((x) => x['@type'] === 'BreadcrumbList');
  assert.equal(crumbs.itemListElement.at(-1).name, 'Kraken Bobblehead');
  // NOWHERE the bare name as a name of the promo: every "Bobblehead" left in the visible text is inside "Kraken Bobblehead",
  // the description's own sentence ("receive a bobblehead") or a named promo.
  // The fan guide and the aggregator link speak of bobblehead nights in general ("Bobblehead nights are..."); that is not this promo's name.
  const leftovers = t.replace(/Kraken Bobblehead/g, '').replace(/Brandon Montour DJ Bobblehead Night/g, '').replace(/Bobblehead nights/g, '').match(/\bBobblehead\b/g) ?? [];
  assert.deepEqual(leftovers, [], 'no bare "Bobblehead" names the promo anywhere in the visible page');
  // The stored title still feeds the ids: the sub-ID, slug and promo id are what they were.
  assert.match(h, /subId3=bobblehead/);
});

test('KRAKEN share text: the client share control is handed the display name', () => {
  const src = require('node:fs').readFileSync(new URL('../PromoPageView.tsx', import.meta.url), 'utf-8') as string;
  assert.match(src, /facts: \{ promoName: shownName, teamName,/);
  assert.match(src, /const shownName = promoDisplayTitle\(cleanText\(primary\.title\), team\) \|\| 'Untitled promotion';/);
  assert.match(src, /promoName: promoDisplayTitle\(cleanText\(primary\.title\), team\),\n    teamName,/, 'JSON-LD name');
  assert.match(src, /promoFaqs\(\{ row: shown\(primary\),/, 'FAQ');
  assert.match(src, /promos=\{ctx\.timeline\.promos\.map\(shown\)\}/, 'timeline');
  // The head is built from the stored title: <title> and og:title already carry the team.
  assert.match(src, /promoPageTitle\(name, teamName, titleDates, page\.season, team\.name\)/);
  assert.match(src, /const name = packagePageName\(primary\.title, \{/);
});

test('a NAMED title is unchanged in every slot', () => {
  const named = 'Brandon Montour DJ Bobblehead Night';
  const h = render([row({ title: named, pageSlug: 'montour', description: 'First 10,000 fans receive a Brandon Montour bobblehead.' })], withTimeline(named, 'montour'));
  const t = text(h);
  assert.match(h, new RegExp(`<h1 [^>]*>${named}</h1>`));
  assert.match(h, new RegExp(`<span aria-current="page"[^>]*>${named}</span>`));
  assert.match(h, new RegExp(`<title>Jan 31: ${named}</title>`));
  for (const e of ld(h).filter((x) => x['@type'] === 'Event' || x['@type'] === 'SportsEvent')) assert.equal(e.name, named);
  assert.doesNotMatch(t, /Kraken Brandon|Kraken Kraken/);
});
