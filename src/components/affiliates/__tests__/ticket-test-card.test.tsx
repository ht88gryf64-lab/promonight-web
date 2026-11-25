// TICKET PARTNER TEST on the ticket card (src/lib/ticket-test.ts, Gate 0
// rulings 1, 3 and 4): on a test team's page the two-card stack becomes ONE
// card in the same style, the partner the test picked, with the test's line
// under it; without the test prop the card renders exactly as before.
//
// Run with: TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --experimental-test-module-mocks --test <this file>
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Team } from '@/lib/types';
import type { TicketTestResolution } from '@/lib/ticket-test-link';

mock.module('server-only', { namedExports: {} });

const WILD = { id: 'minnesota-wild', league: 'NHL', city: 'Minnesota', name: 'Wild', abbreviation: 'MIN', primaryColor: '#154734', secondaryColor: '#A6192E', sportSlug: 'nhl', division: 'Central', ticketmasterSlug: 'minnesota-wild', ticketNetworkSlug: 'minnesota-wild' } as unknown as Team;
const SH_URL = 'https://www.stubhub.com/minnesota-wild-saint-paul-tickets-11-25-2026/event/161350087/';
const TEST_NOTE = 'PromoNight may earn a commission on ticket purchases made through these links. Resale prices may differ from face value.';
const RESALE_NOTE = 'TicketNetwork is a resale marketplace. Prices may differ from face value.';
const SH_DAY: TicketTestResolution = { partner: 'stubhub', phase: 'a', pairId: 'nhl-01', arm: 'stubhub_first', league: 'nhl', pubref: 'web-nhl-a' };
const TN_DAY: TicketTestResolution = { partner: 'ticketnetwork', phase: 'b', pairId: 'nhl-01', arm: 'stubhub_first', league: 'nhl', pubref: 'web-nhl-b' };

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TicketmasterCTA } = await import('../TicketmasterCTA');
  return renderToStaticMarkup(<TicketmasterCTA team={WILD} surface="web_team_page" placement="team_page_sidebar" {...(props as object)} />);
}
const hrefs = (h: string) => [...h.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const cardClass = (h: string) => /<a [^>]*class="([^"]+)"/.exec(h)?.[1] ?? '';

test('no test prop: the two-card stack and the resale line, byte for byte as with an explicit null', async () => {
  const plain = await render();
  assert.equal(plain, await render({ ticketTest: null, stubHubEventUrl: SH_URL }));
  assert.equal(hrefs(plain).length, 2);
  assert.ok(plain.includes(RESALE_NOTE) && !plain.includes(TEST_NOTE) && !/stubhub/i.test(plain));
});

test('StubHub day with a matched event: one card, StubHub by name, the Partnerize link, no other marketplace', async () => {
  const h = await render({ ticketTest: SH_DAY, stubHubEventUrl: SH_URL });
  assert.deepEqual(hrefs(h), [`https://stubhub.prf.hn/click/camref:1101l6zbdB/pubref:web-nhl-a/destination:${encodeURIComponent(SH_URL)}`]);
  assert.match(h, /aria-label="StubHub Get Tickets"/);
  assert.match(h, />StubHub<\/span>/);
  assert.match(h, />Get Tickets<\/span>/);
  assert.doesNotMatch(h, /ticketmaster|ticketnetwork|lusg\.net|<img/i, 'a StubHub card shows no other marketplace and no logo asset');
  assert.doesNotMatch(h, /\$\d/);
  assert.ok(h.includes(TEST_NOTE) && !h.includes(RESALE_NOTE));
  // The same card chrome as the stack's cards.
  assert.equal(cardClass(h), cardClass(await render()));
});

test('TicketNetwork day: the TicketNetwork card as it is, alone, with the same line', async () => {
  const stack = await render();
  const h = await render({ ticketTest: TN_DAY, stubHubEventUrl: SH_URL });
  const tn = hrefs(stack).find((u) => u.includes('ticketnetwork.lusg.net'))!;
  assert.deepEqual(hrefs(h), [tn], 'the same TicketNetwork link the stack carries');
  assert.match(h, /alt="TicketNetwork"/);
  assert.doesNotMatch(h, /ticketmaster\.com|stubhub/i);
  assert.ok(h.includes(TEST_NOTE) && !h.includes(RESALE_NOTE));
});

test('StubHub day without a matched event: the TicketNetwork card (fallback); Ticketmaster for a club TicketNetwork does not list', async () => {
  const noEvent = await render({ ticketTest: SH_DAY, stubHubEventUrl: null });
  assert.equal(hrefs(noEvent).length, 1);
  assert.match(hrefs(noEvent)[0], /^https:\/\/ticketnetwork\.lusg\.net\//);
  const badUrl = await render({ ticketTest: SH_DAY, stubHubEventUrl: `${SH_URL}?quantity=2` });
  assert.match(hrefs(badUrl)[0], /^https:\/\/ticketnetwork\.lusg\.net\//, 'a URL that is not a clean event page is never linked');
  const ontario = await render({ ticketTest: { ...SH_DAY, pairId: 'fixed', arm: 'fixed_stubhub' }, stubHubEventUrl: null, ticketNetwork: false });
  assert.equal(hrefs(ontario).length, 1);
  assert.match(hrefs(ontario)[0], /ticketmaster\.com/);
  assert.ok(ontario.includes(TEST_NOTE));
});

test('both arms: one card, the same line, the same label, the same card class', async () => {
  const sh = await render({ ticketTest: SH_DAY, stubHubEventUrl: SH_URL });
  const tn = await render({ ticketTest: TN_DAY, stubHubEventUrl: SH_URL });
  for (const h of [sh, tn]) {
    assert.equal(hrefs(h).length, 1);
    assert.equal(h.split(TEST_NOTE).length - 1, 1);
    assert.equal(h.split('>Get Tickets</span>').length - 1, 1);
  }
  assert.equal(cardClass(sh), cardClass(tn));
});

test('game rows: a StubHub link only for an upcoming scheduled game that is not half of a doubleheader', async () => {
  const { gameStubHubLinkUrl } = await import('@/lib/promo-game-join');
  const g = { date: '2026-12-03', status: 'scheduled' as const, shEventUrl: SH_URL };
  assert.equal(gameStubHubLinkUrl(g, '2026-12-01'), SH_URL);
  assert.equal(gameStubHubLinkUrl(g, '2026-12-03'), SH_URL);
  assert.equal(gameStubHubLinkUrl(g, '2026-12-04'), null);
  assert.equal(gameStubHubLinkUrl(g, null), null);
  assert.equal(gameStubHubLinkUrl({ ...g, status: 'postponed' as const }, '2026-12-01'), null);
  assert.equal(gameStubHubLinkUrl({ ...g, doubleheaderGame: 1 }, '2026-12-01'), null);
  assert.equal(gameStubHubLinkUrl({ ...g, shEventUrl: undefined }, '2026-12-01'), null);
});
