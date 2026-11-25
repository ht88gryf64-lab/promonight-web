// WHAT A TICKET BUTTON SAYS (ruling 2026-11-25, audit item 7; src/lib/ticket-labels.ts).
// Every ticket button reads "Get Tickets", TicketNetwork and Ticketmaster
// alike. Under each TicketNetwork button or button group, one line says it is
// a resale marketplace; Ticketmaster carries none. Accessible names contain the
// visible text. Analytics is untouched.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Team } from '@/lib/types';

mock.module('server-only', { namedExports: {} });

const NOTE = 'TicketNetwork is a resale marketplace. Prices may differ from face value.';
const WILD = { id: 'minnesota-wild', league: 'NHL', city: 'Minnesota', name: 'Wild', abbreviation: 'MIN', primaryColor: '#154734', secondaryColor: '#A6192E', sportSlug: 'nhl', division: 'Central', ticketmasterSlug: 'minnesota-wild', ticketNetworkSlug: 'minnesota-wild' } as unknown as Team;

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TicketmasterCTA } = await import('../TicketmasterCTA');
  return renderToStaticMarkup(<TicketmasterCTA team={WILD} surface="web_team_page" placement="team_page_sidebar" {...(props as object)} />);
}
const anchors = (h: string) => [...h.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  href: /href="([^"]+)"/.exec(m[1])?.[1] ?? '',
  aria: /aria-label="([^"]+)"/.exec(m[1])?.[1] ?? '',
  // What a sighted fan reads: text nodes plus image alts, minus aria-hidden decoration.
  visible: m[2].replace(/<span aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<img [^>]*alt="([^"]*)"[^>]*>/g, ' $1 ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
}));
const count = (h: string, s: string) => h.split(s).length - 1;

test('the constants: one label for every ticket button, one resale line, an aria-label that begins with the label', async () => {
  const l = await import('@/lib/ticket-labels');
  assert.equal(l.TICKET_CTA_LABEL, 'Get Tickets');
  assert.equal(l.TICKETNETWORK_RESALE_NOTE, NOTE);
  assert.equal(l.ticketAriaLabel('for Wild vs Blues', 'TicketNetwork'), 'Get Tickets for Wild vs Blues on TicketNetwork');
  assert.equal(l.ticketAriaLabel('for Wild', 'Ticketmaster'), 'Get Tickets for Wild on Ticketmaster');
  assert.deepEqual(Object.keys(l).sort(), ['TICKETNETWORK_RESALE_NOTE', 'TICKET_CTA_LABEL', 'ticketAriaLabel'], 'no partner-specific button label exists');
  assert.doesNotMatch(NOTE, /—|–/);
});

test('stacked card: both buttons read Get Tickets; one resale line under the group; names match the text', async () => {
  const h = await render({ size: 'full' });
  const [tm, tn] = anchors(h);
  assert.match(tm.href, /ticketmaster/);
  assert.match(tn.href, /ticketnetwork/);
  // The DOM text itself has the space between the brand and the label (no "ticketmasterGet").
  assert.equal(tm.visible, 'ticketmaster Get Tickets');
  assert.equal(tn.visible, 'TicketNetwork Get Tickets');
  assert.doesNotMatch(h, /Resale tickets/);
  // WCAG 2.5.3, label in name.
  for (const a of [tm, tn]) assert.ok(a.aria.toLowerCase().includes(a.visible.toLowerCase()), `${a.aria} / ${a.visible}`);
  // ONE line for the group, after the last button, in no link.
  assert.equal(count(h, NOTE), 1);
  assert.ok(h.indexOf(NOTE) > h.lastIndexOf('</a>'));
  assert.match(h, /<p data-resale-note="" class="m-0 font-rd text-\[12px\] leading-\[1\.4\] opacity-75 px-1">/, 'inherits the surface colour: readable on the dark CFB pages too');
});

test('Ticketmaster alone (a club TicketNetwork lists no events for): Get Tickets and no resale line', async () => {
  const h = await render({ ticketNetwork: false });
  const a = anchors(h);
  assert.equal(a.length, 1);
  assert.equal(a[0].visible, 'ticketmaster Get Tickets');
  assert.doesNotMatch(h, /resale marketplace|data-resale-note/);
});

test('primaryOnly: one button, Ticketmaster, no resale line; the code prints the line only when the one button is TicketNetwork', async () => {
  const lead = await render({ primaryOnly: true });
  assert.equal(anchors(lead).length, 1);
  assert.match(anchors(lead)[0].href, /ticketmaster/);
  assert.doesNotMatch(lead, /resale marketplace/);
  // buildTicketmasterUrl always resolves (it falls back to the team slug), so a
  // TicketNetwork-only primary cannot be rendered from a fixture. The branch is
  // pinned in source instead: the line rides on the lead being the TicketNetwork button.
  const src = readFileSync(new URL('../TicketmasterCTA.tsx', import.meta.url), 'utf-8');
  assert.match(src, /\{lead === ticketNetworkButton && ticketNetworkButton && !inline \? <ResaleNote className="px-1" \/> : null\}/);
});

test('inline row (the daily boards): no line inside the row; the league group prints it once', async () => {
  const h = await render({ layout: 'inline', size: 'compact', placement: 'today_card' });
  assert.equal(anchors(h).length, 2);
  assert.doesNotMatch(h, /data-resale-note/);
  assert.equal(count(h, '>Get Tickets<'), 2);
  const section = readFileSync(new URL('../../promos-today/TodayLeagueSection.tsx', import.meta.url), 'utf-8');
  assert.match(section, /\{promos\.some\(\(p\) => ticketNetworkForGame\(null, p\.team\) && buildTicketNetworkLink\(\{ team: p\.team, surface \}\)\) \? \(\s*<ResaleNote tone="light" className="mt-3" \/>\s*\) : null\}/);
  assert.equal(count(section, '<ResaleNote'), 1);
  assert.doesNotMatch(readFileSync(new URL('../../promos-today/TodayPromoCard.tsx', import.meta.url), 'utf-8'), /ResaleNote/, 'never one per card');
});

test('one line per group on a page with several buttons: the event stop and the promo page', () => {
  const stop = readFileSync(new URL('../../events/EventStopView.tsx', import.meta.url), 'utf-8');
  assert.equal(count(stop, '<ResaleNote'), 1, 'once for all showtimes');
  assert.ok(stop.indexOf('<ResaleNote') > stop.indexOf('{TICKET_CTA_LABEL}'), 'under the buttons');
  assert.doesNotMatch(stop.split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n'), />\s*Tickets\s*</, 'no bare "Tickets" button');
  const promo = readFileSync(new URL('../../promo-page/PromoPageView.tsx', import.meta.url), 'utf-8');
  assert.equal(count(promo, '<ResaleNote'), 1, 'under the primary row; the per-date links share it');
  assert.match(promo, /\{ticketNetwork \? <ResaleNote tone="light" className="text-center" \/> : null\}/, 'only when the primary is TicketNetwork');
  assert.equal(count(promo, '{TICKET_CTA_LABEL}'), 2, 'the primary and the per-date link');
});

test('the disclosure says it in its own words', async () => {
  const { AFFILIATE_DISCLOSURE_TEXT } = await import('../AffiliateDisclosure');
  assert.match(AFFILIATE_DISCLOSURE_TEXT, /Tickets on TicketNetwork are resold by other sellers, so a price there can be above or below face value\.$/);
  assert.ok(!AFFILIATE_DISCLOSURE_TEXT.includes(NOTE), 'its own wording, not the line repeated');
  assert.match(AFFILIATE_DISCLOSURE_TEXT, /^PromoNight may earn a commission on purchases made through links on this page\./);
});

test('analytics is unchanged: partner, surface and placement on the links are what they were', () => {
  const src = readFileSync(new URL('../TicketmasterCTA.tsx', import.meta.url), 'utf-8');
  assert.equal(count(src, 'partner="ticketmaster"'), 1);
  assert.equal(count(src, 'partner="ticketnetwork"'), 1);
  assert.equal(count(src, 'surface={surface}'), 2);
  assert.equal(count(src, 'placement={placement}'), 2);
  assert.doesNotMatch(readFileSync(new URL('../../../lib/analytics.ts', import.meta.url), 'utf-8'), /ticket-labels|resale_note|ResaleNote/);
});

test('every emitter of a TicketNetwork link takes its words from ticket-labels, and none says "Resale tickets"', () => {
  const root = new URL('../../../', import.meta.url).pathname; // src/
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== '__tests__' && n !== 'dev') walk(p); }
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) files.push(p);
    }
  };
  walk(root);
  const body = (f: string) => readFileSync(f, 'utf-8');
  // A file that emits a TicketNetwork link itself (not through the shared card), by any spelling of the partner.
  const emitters = files.filter((f) => /partner=["{]'?ticketnetwork|partner: 'ticketnetwork'|partner=\{ticketsPartner\}|solidButton\(ticketUrl/.test(body(f))).map((f) => f.slice(root.length)).sort();
  assert.deepEqual(emitters, [
    'components/affiliates/TicketmasterCTA.tsx',
    'components/cfb/rivalry/RivalryMatchupPage.tsx',
    'components/events/EventStopView.tsx',
    'components/promo-page/PromoPageView.tsx',
    'lib/digest-email.ts',
  ], 'a new TicketNetwork emitter must be added here and must use ticket-labels');
  for (const f of emitters) {
    const s = body(join(root, f));
    assert.match(s, /from '(@\/lib|\.)\/ticket-labels'/, f);
    assert.match(s, /TICKET_CTA_LABEL/, f);
    assert.match(s, /ResaleNote|TICKETNETWORK_RESALE_NOTE/, `${f}: the resale line`);
  }
  for (const f of files) {
    const s = body(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(s, /Resale tickets|Find tickets/, f.slice(root.length));
  }
});
