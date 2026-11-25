// WHAT A TICKET BUTTON SAYS (ruling 2026-11-25, audit item 7; src/lib/ticket-labels.ts).
// Every TicketNetwork button reads "Resale tickets" with one line under it;
// Ticketmaster keeps "Get Tickets". Accessible names contain the visible text.
// Analytics is untouched: partner, surface and placement are what they were.
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

async function render(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TicketmasterCTA } = await import('../TicketmasterCTA');
  return renderToStaticMarkup(<TicketmasterCTA team={WILD} surface="web_team_page" placement="team_page_sidebar" {...(props as object)} />);
}
const anchors = (h: string) => [...h.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
  attrs: m[1],
  href: /href="([^"]+)"/.exec(m[1])?.[1] ?? '',
  aria: /aria-label="([^"]+)"/.exec(m[1])?.[1] ?? '',
  // What a sighted fan reads: text nodes plus image alts, minus aria-hidden decoration.
  visible: m[2].replace(/<span aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<img [^>]*alt="([^"]*)"[^>]*>/g, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
}));

test('the constants: one label, one note, and an aria-label that begins with the visible text', async () => {
  const l = await import('@/lib/ticket-labels');
  assert.equal(l.TICKETNETWORK_CTA_LABEL, 'Resale tickets');
  assert.equal(l.TICKETMASTER_CTA_LABEL, 'Get Tickets');
  assert.equal(l.TICKETNETWORK_RESALE_NOTE, NOTE);
  assert.equal(l.ticketNetworkAriaLabel(), 'Resale tickets on TicketNetwork');
  assert.equal(l.ticketNetworkAriaLabel('for Wild vs Blues'), 'Resale tickets for Wild vs Blues on TicketNetwork');
  assert.doesNotMatch(NOTE, /—|–/);
});

test('stacked card: Ticketmaster says Get Tickets, TicketNetwork says Resale tickets, one note under it, names match the text', async () => {
  const h = await render({ size: 'full' });
  const [tm, tn] = anchors(h);
  assert.match(tm.href, /ticketmaster/);
  assert.match(tn.href, /ticketnetwork/);
  assert.equal(tm.visible, 'ticketmaster Get Tickets');
  assert.equal(tn.visible, 'TicketNetwork Resale tickets');
  // WCAG 2.5.3, label in name: the accessible name contains the visible text (case-insensitive).
  for (const a of [tm, tn]) assert.ok(a.aria.toLowerCase().includes(a.visible.toLowerCase()), `${a.aria} / ${a.visible}`);
  assert.doesNotMatch(tn.visible + tn.aria, /Get Tickets/i);
  assert.doesNotMatch(tm.visible + tm.aria, /Resale/i);
  // The note: once, after the TicketNetwork button, and not inside either link.
  assert.equal(h.split(NOTE).length - 1, 1);
  assert.ok(h.indexOf(NOTE) > h.lastIndexOf('</a>'), 'under the TicketNetwork button');
  assert.match(h, /<p data-resale-note=""[^>]*>TicketNetwork is a resale marketplace\. Prices may differ from face value\.<\/p>/);
});

test('Ticketmaster alone (a club TicketNetwork lists no events for): no Resale label and no note', async () => {
  const h = await render({ ticketNetwork: false });
  assert.equal(anchors(h).length, 1);
  assert.doesNotMatch(h, /Resale|resale marketplace/);
  assert.match(h, />Get Tickets</);
});

test('primaryOnly: Ticketmaster leads and carries no note; a TicketNetwork-only button carries it', async () => {
  const lead = await render({ primaryOnly: true });
  assert.equal(anchors(lead).length, 1);
  assert.match(anchors(lead)[0].href, /ticketmaster/);
  assert.doesNotMatch(lead, /resale marketplace/);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TicketmasterCTA } = await import('../TicketmasterCTA');
  const noTm = { ...WILD, ticketmasterSlug: undefined, ticketmasterAttractionId: undefined, id: 'no-such-club' } as unknown as Team;
  const only = renderToStaticMarkup(<TicketmasterCTA team={noTm} surface="web_team_page" placement="team_page_sidebar" primaryOnly />);
  const a = anchors(only);
  if (a.length === 1 && /ticketnetwork/.test(a[0].href)) {
    assert.equal(a[0].visible, 'TicketNetwork Resale tickets');
    assert.equal(only.split(NOTE).length - 1, 1);
  } else {
    // Ticketmaster still resolved for this fixture: then it leads, and there is no note.
    assert.doesNotMatch(only, /resale marketplace/);
  }
});

test('inline row (the today board): the TicketNetwork tile always reads Resale tickets, and the note is the parent row\'s', async () => {
  const h = await render({ layout: 'inline', size: 'compact', placement: 'today_card' });
  const [tm, tn] = anchors(h);
  assert.equal(tn.visible, 'TicketNetwork Resale tickets');
  // Not container-gated: no `hidden` on the caption, unlike the Ticketmaster descriptor.
  assert.match(h, /<span class="whitespace-nowrap font-outfit text-\[11px\] font-bold leading-none text-\[#0a0a0a\]">Resale tickets<\/span>/);
  assert.match(tm.attrs + h, /hidden font-outfit font-bold text-\[#0a0a0a\] @\[26rem\]\/cta:inline/);
  assert.doesNotMatch(h, /data-resale-note/, 'no note inside the row');
  const card = readFileSync(new URL('../../promos-today/TodayPromoCard.tsx', import.meta.url), 'utf-8');
  assert.match(card, /\{tnHref \? <ResaleNote className="mt-1\.5" \/> : null\}/);
  assert.match(card, /const tnHref = ticketNetworkForGame\(null, p\.team\) \? buildTicketNetworkLink\(\{ team: p\.team, surface \}\) : null;/);
});

test('analytics is unchanged: partner, surface and placement on the links are what they were', async () => {
  const src = readFileSync(new URL('../TicketmasterCTA.tsx', import.meta.url), 'utf-8');
  assert.equal(src.match(/partner="ticketmaster"/g)?.length, 1);
  assert.equal(src.match(/partner="ticketnetwork"/g)?.length, 1);
  assert.equal(src.match(/surface=\{surface\}/g)?.length, 2);
  assert.equal(src.match(/placement=\{placement\}/g)?.length, 2);
  const analytics = readFileSync(new URL('../../../lib/analytics.ts', import.meta.url), 'utf-8');
  assert.doesNotMatch(analytics, /Resale tickets|resale_tickets|ticket-labels/, 'no new event, surface or property for the label');
});

test('every component that renders a TicketNetwork link takes its words from ticket-labels', () => {
  const root = new URL('../../../', import.meta.url).pathname; // src/
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== '__tests__' && n !== 'dev') walk(p); }
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) files.push(p);
    }
  };
  walk(join(root, 'components'));
  walk(join(root, 'app'));
  // A file that emits a TicketNetwork link itself (not through TicketmasterCTA).
  const emitters = files.filter((f) => /partner="ticketnetwork"|partner: 'ticketnetwork'|partner=\{ticketsPartner\}/.test(readFileSync(f, 'utf-8'))).map((f) => f.slice(root.length)).sort();
  assert.deepEqual(emitters, [
    'components/affiliates/TicketmasterCTA.tsx',
    'components/cfb/rivalry/RivalryMatchupPage.tsx',
    'components/events/EventStopView.tsx',
    'components/promo-page/PromoPageView.tsx',
  ], 'a new TicketNetwork emitter must be added here and must use ticket-labels');
  for (const f of emitters) {
    const s = readFileSync(join(root, f), 'utf-8');
    assert.match(s, /from '@\/lib\/ticket-labels'/, f);
    assert.match(s, /TICKETNETWORK_CTA_LABEL/, f);
    assert.match(s, /ResaleNote|TICKETNETWORK_RESALE_NOTE/, `${f}: the note`);
  }
  // No TicketNetwork link is labelled with the Ticketmaster words anywhere.
  for (const f of files) {
    const s = readFileSync(f, 'utf-8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(s, /Get tickets on TicketNetwork|Find tickets/, f.slice(root.length));
  }
  // The email button too.
  const email = readFileSync(join(root, 'lib', 'digest-email.ts'), 'utf-8');
  assert.match(email, /solidButton\(ticketUrl, TICKETNETWORK_CTA_LABEL\)/);
  assert.match(email, /esc\(TICKETNETWORK_RESALE_NOTE\)/);
});
