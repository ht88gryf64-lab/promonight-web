/* Row click navigates; the ticket modal opens only from the Tickets button
 * (docs/per-promo-pages-v2-spec.md, Prerequisite, 2026-11-07).
 *
 * The team-page promo row and the two homepage cards carried the promo page
 * href in their markup, so the existing promoPageHref test saw a link. A human
 * never did: the whole card was a role=button whose onClick opened the shared
 * ticket modal, and only the title text itself was an anchor. Crawlers got a
 * link, humans got a modal, and team page to promo page produced no pageviews.
 *
 * This test renders each card in a real DOM and clicks it where a thumb lands:
 * the title, the date block, the body. Each click must navigate to the promo
 * page and must NOT open the modal. The Tickets button is the one control that
 * opens the modal, and it must not navigate. The share and star controls open
 * neither.
 *
 * Harness: happy-dom registered as the global DOM, React's own act(), and two
 * module mocks. next/link is a stub anchor that records a navigation when a
 * click reaches it without preventDefault (what a browser does with an <a>).
 * The modal hook is a spy that records every open() call. The analytics sink
 * is a fake window.posthog, so promo_link_click can be asserted by surface
 * (the spec's measurement). Run on its own with
 *   TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx \
 *     --experimental-test-module-mocks --test <this file>
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react';
import type { GameContext } from '@/lib/data';
import type { Promo, PromoWithTeam, Team } from '@/lib/types';
import { promoPageHref } from '@/lib/promo-page-href';

GlobalRegistrator.register({ url: 'https://www.getpromonight.com/nhl/minnesota-wild', width: 390, height: 844 });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── mocks ─────────────────────────────────────────────────────────────────────

const navigations: string[] = [];
function StubLink({
  href,
  onClick,
  children,
  ...rest
}: { href: string; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        // A browser follows an <a> whose click was not prevented.
        if (!e.defaultPrevented) {
          e.preventDefault();
          navigations.push(href);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
mock.module('next/link', { defaultExport: StubLink });

const opens: Array<{ promo: Promo; contexts: GameContext[] | null; surface: string }> = [];
mock.module(new URL('../UpcomingPromoModal.tsx', import.meta.url).href, {
  namedExports: { useUpcomingPromoModal: () => (item: (typeof opens)[number]) => void opens.push(item) },
});

const events: Array<[string, Record<string, unknown>]> = [];
(window as unknown as { posthog: unknown }).posthog = { capture: (n: string, p: Record<string, unknown>) => void events.push([n, p]) };

// ── fixtures ──────────────────────────────────────────────────────────────────

const WILD = {
  id: 'minnesota-wild', name: 'Wild', city: 'Minnesota', league: 'NHL', sportSlug: 'nhl', abbreviation: 'MIN',
  primaryColor: '#154734', secondaryColor: '#A6192E', division: 'Central',
} as unknown as Team;
const promo: PromoWithTeam = {
  team: WILD, date: '2026-11-30', time: '', opponent: '', type: 'giveaway', title: 'Blaze Orange Hat',
  description: 'All fans receive a blaze orange hat.', highlight: false, icon: '', recurring: false,
  pageSlug: 'blaze-orange-hat', pageSeason: '2026-27', displayTime: '7:00 PM', displayOpponent: 'Islanders',
};
const share = { teamName: 'Minnesota Wild', teamSlug: WILD.id, sport: 'nhl' };
const HREF = promoPageHref(promo)!;
assert.equal(HREF, '/nhl/minnesota-wild/promos/blaze-orange-hat');

// ── harness ───────────────────────────────────────────────────────────────────

const roots: Array<{ unmount: () => void }> = [];
async function mount(ui: ReactElement): Promise<HTMLElement> {
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  roots.push(root);
  return container;
}
async function click(el: Element) {
  const { act } = await import('react');
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
/** The innermost element whose own text is exactly `text`. */
function byText(container: Element, text: string): Element {
  const hits = [...container.querySelectorAll('*')].filter((el) => el.textContent?.trim() === text);
  const el = hits[hits.length - 1];
  assert.ok(el, `no element with text "${text}"`);
  return el;
}
function button(container: Element, label: RegExp): Element {
  const el = [...container.querySelectorAll('button')].find((b) => label.test(b.textContent ?? '') || label.test(b.getAttribute('aria-label') ?? ''));
  assert.ok(el, `no button matching ${label}`);
  return el;
}
function reset() {
  navigations.length = 0;
  opens.length = 0;
  events.length = 0;
}
beforeEach(reset);
after(async () => {
  const { act } = await import('react');
  await act(async () => roots.forEach((r) => r.unmount()));
  await GlobalRegistrator.unregister();
});

const promoLinkClicks = () => events.filter(([n]) => n === 'promo_link_click').map(([, p]) => p);

/** The contract every card shares. `targets` are the places a thumb lands. */
async function assertRowContract(name: string, container: HTMLElement, surface: string, targets: Array<[string, () => Element]>) {
  for (const [where, find] of targets) {
    reset();
    await click(find());
    assert.deepEqual(navigations, [HREF], `${name}: a click on the ${where} navigates to the promo page`);
    assert.equal(opens.length, 0, `${name}: a click on the ${where} does not open the ticket modal`);
    assert.equal(promoLinkClicks().length, 1, `${name}: the ${where} click fires one promo_link_click`);
    assert.equal(promoLinkClicks()[0].surface, surface, `${name}: promo_link_click carries the surface`);
    assert.equal(promoLinkClicks()[0].destination_url, HREF, `${name}: promo_link_click carries the destination`);
  }

  reset();
  await click(button(container, /^Tickets$/));
  assert.equal(opens.length, 1, `${name}: the Tickets button opens the ticket modal`);
  assert.equal(opens[0].surface, surface, `${name}: the modal opens with the card's surface`);
  assert.equal(opens[0].promo.title, promo.title, `${name}: the modal opens on this promo`);
  assert.deepEqual(navigations, [], `${name}: the Tickets button does not navigate`);

  // Exactly one anchor to the page, so the inbound-link count per row is one.
  const anchors = [...container.querySelectorAll(`a[href="${HREF}"]`)];
  assert.equal(anchors.length, 1, `${name}: one anchor to the promo page`);
  // Nothing interactive nests in it: a button inside an <a> is invalid HTML
  // and a click on it would follow the link.
  assert.equal(anchors[0].querySelector('button, a'), null, `${name}: no button or anchor inside the page link`);
  // The page link is a plain link: the card no longer pretends to be a button.
  assert.equal(container.querySelector('[role="button"]'), null, `${name}: no role=button wrapper`);
}

// ── team-page row ─────────────────────────────────────────────────────────────

test('team-page row: body, title and date block navigate; only the Tickets button opens the modal', async () => {
  const { RedesignPromoRow } = await import('../RedesignPromoRow');
  const container = await mount(<RedesignPromoRow promo={promo} share={share} team={WILD} contexts={null} interactive />);
  await assertRowContract('team-page row', container, 'web_team_page_promolist', [
    ['title', () => byText(container, promo.title)],
    ['date block', () => byText(container, '30')],
    ['description', () => byText(container, promo.description)],
  ]);

  // The Share control opens neither.
  reset();
  await click(button(container, /^Share /));
  assert.deepEqual(navigations, [], 'share does not navigate');
  assert.equal(opens.length, 0, 'share does not open the modal');
});

test('team-page row: a completed row links the same way and offers no Tickets button', async () => {
  const { RedesignPromoRow } = await import('../RedesignPromoRow');
  const container = await mount(<RedesignPromoRow promo={promo} share={share} completed />);
  await click(byText(container, promo.title));
  assert.deepEqual(navigations, [HREF]);
  assert.equal(opens.length, 0);
  assert.equal([...container.querySelectorAll('button')].filter((b) => /^Tickets$/.test(b.textContent ?? '')).length, 0, 'no Tickets on a completed row');
});

test('team-page row: without a page href the body is inert and the Tickets button still opens the modal', async () => {
  const { RedesignPromoRow } = await import('../RedesignPromoRow');
  const unlinkable: PromoWithTeam = { ...promo, pageSlug: undefined };
  assert.equal(promoPageHref(unlinkable), null);
  const container = await mount(<RedesignPromoRow promo={unlinkable} share={share} team={WILD} contexts={null} interactive />);
  await click(byText(container, promo.title));
  assert.deepEqual(navigations, []);
  assert.equal(opens.length, 0, 'a body tap never opens the modal, even with nowhere to go');
  await click(button(container, /^Tickets$/));
  assert.equal(opens.length, 1);
});

// ── homepage cards ────────────────────────────────────────────────────────────

test('homepage This Week card: body, title and date block navigate; only the Tickets button opens the modal', async () => {
  const { LightHomePromoCard } = await import('../LightHomePromoCard');
  const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
  const container = await mount(
    <StarredTeamsProvider>
      <LightHomePromoCard promo={promo} contexts={null} surface="web_home_this_week" starPlacement="homepage_this_week_inline" />
    </StarredTeamsProvider>,
  );
  await assertRowContract('This Week card', container, 'web_home_this_week', [
    ['title', () => byText(container, promo.title)],
    ['date block', () => byText(container, '30')],
    ['team line', () => byText(container, 'Minnesota Wild vs Islanders')],
  ]);
});

test('homepage ticket stub (Tonight, Best Promos): body, title and date spine navigate; only the Tickets button opens the modal', async () => {
  const { TicketStubCard } = await import('../TicketStubCard');
  const { StarredTeamsProvider } = await import('@/hooks/use-starred-teams');
  const container = await mount(
    <StarredTeamsProvider>
      <TicketStubCard promo={promo} contexts={null} surface="web_home_tonight" starPlacement="homepage_this_week_inline" rank={1} />
    </StarredTeamsProvider>,
  );
  await assertRowContract('ticket stub', container, 'web_home_tonight', [
    ['title', () => byText(container, promo.title)],
    ['date spine', () => byText(container, 'Nov 30')],
    ['team line', () => byText(container, 'Minnesota Wild vs Islanders')],
  ]);
});
