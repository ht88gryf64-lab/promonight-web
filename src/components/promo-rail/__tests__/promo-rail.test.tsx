/* The promo rail and the season timeline (docs/per-promo-pages-v2-spec.md,
 * Visuals 3 and 4): the rail renders nothing below two cards and never more
 * than five, every card is one Link with no handler of its own (a click is a
 * navigation, nothing else fires); the timeline renders nothing below three
 * home games, puts a dot per promo on the bar in one muted ink tone, rings
 * this game in the accent, and hover, focus or a click names the promo.
 * Same real-DOM harness as promo-row-click.test.tsx. */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { promoRailItems, promoRailEmailHtml, type PromoRailSource } from '@/lib/promo-rail';

GlobalRegistrator.register({ url: 'https://www.getpromonight.com/nhl/minnesota-wild/promos/blaze-orange-hat', width: 390, height: 844 });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const navigations: string[] = [];
const handlers: string[] = [];
function StubLink({ href, onClick, children, ...rest }: { href: string; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) {
  if (onClick) handlers.push(href);
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
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

const src = (n: number, date: string, title: string, type: PromoRailSource['type'] = 'giveaway', over: Partial<PromoRailSource> = {}): PromoRailSource => ({ href: `/nhl/minnesota-wild/promos/p${n}`, title, date, type, ...over });
const FIVE = [src(1, '2026-11-20', 'Hockey Fights Cancer Night', 'theme'), src(2, '2026-12-05', 'Winter Beanie'), src(3, '2026-12-18', 'Holiday Scarf'), src(4, '2026-12-20', 'Twin Night', 'theme'), src(5, '2027-01-05', 'Esa Lindell Bobblehead'), src(6, '2027-01-20', 'Sixth Promo')];

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
beforeEach(() => {
  navigations.length = 0;
  handlers.length = 0;
});
after(async () => {
  const { act } = await import('react');
  await act(async () => roots.forEach((r) => r.unmount()));
  await GlobalRegistrator.unregister();
});

test('the shaper: nothing below two cards, at most five, unlinkable sources skipped, the icon from the title and theme', () => {
  assert.deepEqual(promoRailItems([]), []);
  assert.deepEqual(promoRailItems(FIVE.slice(0, 1)), []);
  assert.deepEqual(promoRailItems([FIVE[0], { ...FIVE[1], href: null }]), [], 'an unlinkable source is not a card, so one card: nothing');
  const items = promoRailItems(FIVE);
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((i) => i.icon), ['theme-night', 'hat', 'giveaway', 'theme-night', 'bobblehead']);
  assert.deepEqual([items[1].weekday, items[1].day, items[1].month], ['SAT', '5', 'DEC']);
  assert.equal(promoRailItems([src(1, '2026-11-20', 'Pride Night', 'theme', { themeKey: 'fan-appreciation' }), FIVE[1]])[0].icon, 'fan-appreciation');
});

test('the web rail: nothing below two cards; each card is one Link to the promo page with no handler; a click is a navigation and nothing else', async () => {
  const { PromoRail } = await import('../PromoRail');
  assert.equal(renderToStaticMarkup(<PromoRail items={promoRailItems(FIVE.slice(0, 1))} label="x" />), '');
  const container = await mount(<PromoRail items={promoRailItems(FIVE)} label="More Minnesota Wild promos" />);
  const cards = [...container.querySelectorAll('a')];
  assert.equal(cards.length, 5);
  assert.deepEqual(cards.map((a) => a.getAttribute('href')), FIVE.slice(0, 5).map((s) => s.href));
  assert.deepEqual(handlers, [], 'no card passes an onClick to its Link');
  for (const a of cards) {
    assert.equal(a.querySelector('button, a'), null, 'nothing interactive inside a card');
    assert.ok(a.querySelector('svg use'), 'the type icon through the sprite');
  }
  // A click anywhere on a card navigates; the title, the date, the icon.
  await click(cards[1].querySelector('svg')!);
  await click(cards[1].lastElementChild!);
  assert.deepEqual(navigations, [FIVE[1].href, FIVE[1].href]);
  assert.equal(container.querySelector('[role="button"]'), null);
});

test('the email rail: inline-styled table, one cell per card, the icon inline, nothing below two cards', () => {
  const toUrl = (h: string) => `https://www.getpromonight.com${h}?utm_source=digest`;
  assert.equal(promoRailEmailHtml(promoRailItems(FIVE.slice(0, 1)), { toUrl }), '');
  const html = promoRailEmailHtml(promoRailItems(FIVE), { toUrl });
  assert.equal((html.match(/<td valign="top"/g) ?? []).length, 5);
  assert.ok(html.includes('href="https://www.getpromonight.com/nhl/minnesota-wild/promos/p2?utm_source=digest"'));
  assert.ok(html.includes('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"'), 'inline SVG icon');
  assert.ok(!/class=/.test(html), 'no classes, inline styles only');
});

test('the season timeline: nothing below three home games; a dot per promo in one ink tone, this game ringed in the accent, hover or focus or a click names the promo', async () => {
  const { SeasonTimeline } = await import('@/components/promo-page/SeasonTimeline');
  const games = [{ date: '2026-10-20' }, { date: '2026-10-29' }, { date: '2026-12-28' }];
  const promos = [
    { date: '2026-10-29', title: 'Blaze Orange Hat', href: '/nhl/minnesota-wild/promos/blaze-orange-hat', type: 'giveaway' as const },
    { date: '2026-10-29', title: 'Pride Night', href: '/nhl/minnesota-wild/promos/pride-night', type: 'theme' as const },
    { date: '2026-12-28', title: 'Holiday Scarf', href: '/nhl/minnesota-wild/promos/holiday-scarf', type: 'giveaway' as const },
  ];
  assert.equal(renderToStaticMarkup(<SeasonTimeline games={games.slice(0, 2)} promos={promos} thisDate="2026-10-29" teamName="Minnesota Wild" />), '', 'two home games: nothing');
  const container = await mount(<SeasonTimeline games={games} promos={promos} thisDate="2026-10-29" thisHref="/nhl/minnesota-wild/promos/blaze-orange-hat" teamName="Minnesota Wild" />);
  const dots = [...container.querySelectorAll('g[role="button"]')];
  assert.equal(dots.length, 3, 'a dot per promo');
  // A promo on a date with no home game is not on the bar.
  const stray = await mount(<SeasonTimeline games={games} promos={[...promos, { date: '2026-11-11', title: 'Stray', href: '/x', type: 'kids' }]} thisDate="2026-10-29" teamName="Minnesota Wild" />);
  assert.equal(stray.querySelectorAll('g[role="button"]').length, 3);
  // Every dot is the same muted ink, no category colour; this game is ringed in the accent and named by default.
  for (const c of container.querySelectorAll('g[role="button"] circle')) {
    assert.equal(c.getAttribute('fill'), 'var(--color-rd-ink)');
    assert.ok(['0.4', '0.7'].includes(c.getAttribute('fill-opacity') ?? ''), c.getAttribute('fill-opacity') ?? 'none');
  }
  assert.ok(!/#(f97316|7c3aed|16a34a|2563eb)/i.test(container.innerHTML), 'no category hex on the bar');
  assert.equal(container.querySelectorAll('circle[stroke="var(--pp-accent)"]').length, 1, 'one accent ring');
  assert.match(container.textContent ?? '', /Oct 29 · Blaze Orange Hat · home game 2 of 3/);
  // Focus names a dot's promo; so does a click.
  const { act } = await import('react');
  await act(async () => { (dots[2] as HTMLElement).dispatchEvent(new FocusEvent('focus', { bubbles: false })); });
  await click(dots[2].querySelector('circle')!);
  assert.match(container.textContent ?? '', /Dec 28 · Holiday Scarf · home game 3 of 3/);
  assert.equal(container.querySelector('p a')?.getAttribute('href'), '/nhl/minnesota-wild/promos/holiday-scarf');
  assert.deepEqual(navigations, [], 'a click on a dot navigates nowhere');
});
