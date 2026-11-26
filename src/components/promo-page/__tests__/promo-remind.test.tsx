// The promo page's "Remind me" form in a real DOM (PromoRemind): the two
// analytics events and their props, the request it makes, and the success
// line following the API's answer.
//
// Harness: happy-dom as the global DOM (the promo-row-click harness), React's
// act(). analytics.track and fetch are stood in. Run on its own with
//   TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx \
//     --experimental-test-module-mocks --test <this file>
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { ReactElement } from 'react';

GlobalRegistrator.register({ url: 'https://www.getpromonight.com/nhl/minnesota-wild/promos/winter-beanie', width: 390, height: 844 });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let events: Array<{ name: string; props: Record<string, unknown> }> = [];
mock.module(new URL('../../../lib/analytics.ts', import.meta.url).href, {
  namedExports: { track: (name: string, props: Record<string, unknown>) => void events.push({ name, props }) },
});
mock.module(new URL('../../../lib/capture/variant.ts', import.meta.url).href, {
  namedExports: { resolveBrowserVariant: () => 'unassigned' },
});

let requests: Array<Record<string, unknown>> = [];
let answer: { status: number; body: Record<string, unknown> } = { status: 200, body: { ok: true, status: 'pending', created: true, team_count: 1, confirmation: 'sent', reminder: 'scheduled' } };

beforeEach(() => {
  events = [];
  requests = [];
  answer = { status: 200, body: { ok: true, status: 'pending', created: true, team_count: 1, confirmation: 'sent', reminder: 'scheduled' } };
  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    assert.equal(String(url), '/api/subscribe');
    requests.push(JSON.parse(init?.body ?? '{}'));
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
});

const roots: Array<{ unmount: () => void }> = [];
async function mount(mode: 'reminder' | 'weekly'): Promise<HTMLElement> {
  const { PromoRemind } = await import('../PromoRemind');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const ui: ReactElement = <PromoRemind mode={mode} teamId="minnesota-wild" teamName="Minnesota Wild" league="NHL" promoId="c7057219198efd77" consent="consent line" />;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  roots.push(root);
  return container;
}
async function type(el: HTMLElement, value: string) {
  const { act } = await import('react');
  const input = el.querySelector('input[type="email"]') as HTMLInputElement;
  await act(async () => {
    input.focus();
    // React tracks the value through the native setter.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit(el: HTMLElement) {
  const { act } = await import('react');
  await act(async () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
after(async () => {
  const { act } = await import('react');
  await act(async () => roots.forEach((r) => r.unmount()));
  await GlobalRegistrator.unregister();
});

const PROPS = { surface: 'web_promo_page', promo_id: 'c7057219198efd77', team_id: 'minnesota-wild', league: 'NHL' };

test('email_cta_click fires once per page view, on the first focus, with the promo, team and league', async () => {
  const el = await mount('reminder');
  const { act } = await import('react');
  const input = el.querySelector('input[type="email"]') as HTMLInputElement;
  assert.equal(events.length, 0, 'nothing on render');
  await act(async () => input.focus());
  await act(async () => input.blur());
  await act(async () => input.focus());
  const clicks = events.filter((e) => e.name === 'email_cta_click');
  assert.equal(clicks.length, 1, 'once, however many times the input is focused');
  assert.deepEqual(clicks[0].props, { ...PROPS, team_slug: 'minnesota-wild', variant: 'unassigned' });
});

test('submit: the request carries the team, the surface and the reminder; newsletter_signup carries the same props; the success line follows the API', async () => {
  const el = await mount('reminder');
  await type(el, ' Fan@Example.com ');
  await submit(el);
  assert.deepEqual(requests, [{ email: 'Fan@Example.com', teams: ['minnesota-wild'], source: 'web_promo_page', reminder: { teamId: 'minnesota-wild', promoId: 'c7057219198efd77' } }]);
  const signups = events.filter((e) => e.name === 'newsletter_signup');
  assert.equal(signups.length, 1);
  assert.deepEqual(signups[0].props, { ...PROPS, team_count: 1, variant: 'unassigned', reminder: 'scheduled' });
  const result = el.querySelector('[data-remind-result]');
  assert.ok(result, 'the form is replaced by the result');
  assert.equal(result.parentElement?.getAttribute('aria-live'), 'polite', 'inside the live region that was there before the swap');
  assert.equal(result.textContent, 'Check your inbox for a confirmation link. Once you confirm, we’ll email you the day before, and you’ll get the weekly Minnesota Wild promo email.');
  assert.equal(el.querySelector('form'), null);
  // The address is never echoed into the page or onto an event.
  assert.ok(!el.textContent?.toLowerCase().includes('fan@example.com'));
  assert.ok(!JSON.stringify(events).toLowerCase().includes('fan@example.com'));
});

test('too late from a stale page: the page offered a reminder, the API said too_late, and the success line says so', async () => {
  answer.body = { ...answer.body, reminder: 'too_late' };
  const el = await mount('reminder');
  await type(el, 'fan@example.com');
  await submit(el);
  const line = el.querySelector('[data-remind-result]')?.textContent ?? '';
  assert.ok(line.startsWith('It is too late for a day-before email for this game.'), line);
  assert.ok(!line.includes('email you the day before'));
  assert.equal(events.find((e) => e.name === 'newsletter_signup')?.props.reminder, 'too_late');
});

test('the weekly variant asks for no reminder and promises none', async () => {
  answer.body = { ...answer.body, reminder: 'none' };
  const el = await mount('weekly');
  assert.equal(el.querySelector('button[type="submit"]')?.textContent, 'Sign up');
  await type(el, 'fan@example.com');
  await submit(el);
  assert.deepEqual(requests, [{ email: 'fan@example.com', teams: ['minnesota-wild'], source: 'web_promo_page' }]);
  assert.equal(el.querySelector('[data-remind-result]')?.textContent, 'Check your inbox for a confirmation link. Once you confirm, you’ll get the weekly Minnesota Wild promo email.');
  assert.deepEqual(events.find((e) => e.name === 'newsletter_signup')?.props, { ...PROPS, team_count: 1, variant: 'unassigned', reminder: 'none' });
});

test('a bad address makes no request and fires no signup; a 429 and a server error keep the form and say what happened', async () => {
  const el = await mount('reminder');
  await type(el, 'not-an-address');
  await submit(el);
  assert.equal(requests.length, 0);
  assert.equal(el.querySelector('[role="alert"]')?.textContent, 'Enter a valid email address.');
  // The field is marked, described by the message, and has the focus back.
  const field = el.querySelector('input[type="email"]') as HTMLInputElement;
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.ok(field.getAttribute('aria-describedby')?.split(' ').includes(el.querySelector('[role="alert"]')?.id ?? 'none'));
  assert.equal(document.activeElement, field);
  // The error colour holds while the field has focus (re-check R1): no ink focus border on an invalid field.
  assert.ok(/\bborder-rd-link\b/.test(field.className) && /focus:border-rd-link/.test(field.className) && !/focus:border-rd-ink/.test(field.className));
  assert.equal(field.getAttribute('name'), null, 'unnamed: a native submit cannot put the address in a URL');
  answer = { status: 429, body: { ok: false, error: 'rate_limited' } };
  await type(el, 'fan@example.com');
  assert.equal(el.querySelector('[role="alert"]'), null, 'typing clears the error');
  await submit(el);
  assert.equal(el.querySelector('[role="alert"]')?.textContent, 'Too many tries from this connection. Wait a few minutes and try again.');
  answer = { status: 500, body: { ok: false, error: 'server_error' } };
  await submit(el);
  assert.equal(el.querySelector('[role="alert"]')?.textContent, 'That did not go through. Try again.');
  assert.ok(el.querySelector('form'), 'the form stays');
  assert.equal(events.filter((e) => e.name === 'newsletter_signup').length, 0);
});
