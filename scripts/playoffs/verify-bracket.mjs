// Browser checks for the playoffs pages: controls, keyboard, deep links with
// and without scripts, the desktop layout, and event firing at both
// analytics sinks.
//
// It drives headless Chrome over the DevTools protocol and needs nothing
// installed beyond Chrome itself. It is not part of `npm test`: it needs a
// running server and live bracket documents.
//
//   npm run build && npx next start -p 3468
//   OUT=/tmp/playoffs-shots node scripts/playoffs/verify-bracket.mjs
//
// BASE defaults to http://localhost:3468. OUT is where screenshots go. SHARE
// is a share link for a protected preview.
//
// NOTHING LEAVES THE MACHINE. Every analytics and ad host is blocked at the
// network layer before the first page loads, so the events are observed at
// the two client sinks (PostHog's capture, GA4's dataLayer) and sent nowhere.
// Do not remove the block list to "see it in the dashboard": the run presses
// every control on three pages, several times.
//
// The checks assume the MLB bracket is being played and has both
// conferences, which is true of the 2026 postseason documents. Several will
// fail, correctly, against a concluded bracket.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3468';
const OUT = process.env.OUT;
if (!OUT) { console.error('Set OUT to a directory for the screenshots.'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const PORT = 9348;
const profile = mkdtempSync(join(tmpdir(), 'pn-verify-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };

async function target() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

// Installed before any page script. Records what reaches each sink.
const RECORDER = `
(() => {
  const calls = (window.__calls = []);
  // GA4: the site's gtag() pushes its arguments onto dataLayer.
  const layer = [];
  const push = layer.push.bind(layer);
  layer.push = function () { for (const a of arguments) { try { const v = Array.from(a); if (v[0] === 'event') calls.push({ sink: 'ga4', name: v[1], props: v[2] }); } catch (e) {} } return push.apply(null, arguments); };
  window.dataLayer = layer;
  // PostHog: wrapped the moment the library puts itself on window.
  let ph;
  Object.defineProperty(window, 'posthog', { configurable: true, get() { return ph; }, set(v) {
    ph = v;
    if (v && typeof v.capture === 'function' && !v.__recorded) { const o = v.capture; v.capture = function (n, p) { calls.push({ sink: 'posthog', name: n, props: p }); return o.apply(this, arguments); }; v.__recorded = true; }
  } });
})();`;

let ws, id = 0; const pending = new Map(); const events = []; const consoleLines = []; const blocked = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (name, ms = 60000) => { const end = Date.now() + ms; for (;;) { const k = events.findIndex((e) => e.method === name); if (k >= 0) { events.splice(k, 1); return; } if (Date.now() > end) throw new Error('timeout ' + name); await sleep(50); } };
async function go(path, { width, js = true, settle = 2500 } = {}) {
  await send('Emulation.setScriptExecutionDisabled', { value: !js });
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 2, mobile: width < 600 });
  events.length = 0;
  await send('Page.navigate', { url: 'about:blank' });
  await waitFor('Page.loadEventFired');
  events.length = 0;
  await send('Page.navigate', { url: BASE + path });
  await waitFor('Page.loadEventFired');
  await sleep(settle);
}
async function shot(name, width, { full = true } = {}) {
  const m = await send('Page.getLayoutMetrics');
  const h = full ? Math.ceil(m.cssContentSize.height) : (width < 600 ? 844 : 900);
  const y = full ? 0 : Math.round(m.cssVisualViewport.pageY);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: h, scale: 1 } });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
  return h;
}
const calls = () => ev('JSON.parse(JSON.stringify(window.__calls || []))');
const clearCalls = () => ev('(window.__calls || []).length = 0');
const sinksFor = (list, name) => [...new Set(list.filter((c) => c.name === name).map((c) => c.sink))].sort().join('+');
const propsFor = (list, name, sink) => list.filter((c) => c.name === name && c.sink === sink).map((c) => c.props);

try {
  ws = new WebSocket(await target());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); return; }
    if (msg.method === 'Runtime.consoleAPICalled') consoleLines.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (msg.method === 'Network.loadingFailed' && msg.params.blockedReason) blocked.push(msg.params.blockedReason);
    else if (msg.method) events.push(msg);
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*posthog.com*', '*google-analytics.com*', '*googletagmanager.com*', '*analytics.google.com*', '*doubleclick.net*', '*adthrive*', '*raptive*', '*cafemedia*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  // A protected preview: the share link is opened first, so the browser
  // holds the access cookie. It is never printed.
  if (process.env.SHARE) { events.length = 0; await send('Page.navigate', { url: process.env.SHARE }); await waitFor('Page.loadEventFired'); await sleep(1500); }

  // ================= 390px, MLB =================
  await go('/playoffs/mlb', { width: 390 });
  let c = await calls();
  check('page view event reaches both sinks', sinksFor(c, 'playoffs_league_view') === 'ga4+posthog', sinksFor(c, 'playoffs_league_view') || 'neither');
  const pv = propsFor(c, 'playoffs_league_view', 'posthog')[0] || {};
  check('page view event carries league, season, phase, round', pv.league === 'mlb' && pv.season === 2026 && pv.phase === 'active' && typeof pv.round_key === 'string' && pv.surface === 'web_playoffs_league', JSON.stringify({ league: pv.league, season: pv.season, phase: pv.phase, round_key: pv.round_key, surface: pv.surface }));
  check('page view event is sent once', c.filter((x) => x.name === 'playoffs_league_view' && x.sink === 'posthog').length === 1);
  check('hydrated flag is set after mount', await ev(`document.querySelector('.po-bracket').hasAttribute('data-hydrated')`));

  const state = () => ev(`(() => { const q = (s) => document.querySelector(s); const b = q('.po-bracket'); const box = q('[data-rounds]');
    const pressed = [...b.querySelectorAll('[data-round-option]')].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.roundOption);
    const conf = [...b.querySelectorAll('[data-conference-option]')].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.conferenceOption);
    const shown = (sel) => [...b.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none').length;
    const pad = parseFloat(getComputedStyle(box).paddingLeft);
    const cols = [...box.querySelectorAll(':scope > section')].map((s) => ({ key: s.dataset.round, gap: Math.round(s.offsetLeft - box.offsetLeft - pad - box.scrollLeft) }));
    return { round: b.dataset.round, conference: b.dataset.conference ?? null, pressed, conf, scrollLeft: Math.round(box.scrollLeft), scrollable: box.scrollWidth > box.clientWidth, cols,
      al: shown('[data-conf="AL"]'), nl: shown('[data-conf="NL"]'), openPanels: [...document.querySelectorAll('.po-panel')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id),
      expanded: [...document.querySelectorAll('[data-series] > a[aria-expanded="true"]')].map((a) => a.getAttribute('href')), hash: location.hash,
      slot: (() => { const s = q('[data-predicted-bracket]'); return s ? { round: s.dataset.round, conference: s.dataset.conference ?? null } : null; })(),
      controls: getComputedStyle(q('.po-controls')).display, controlsTop: Math.round(q('.po-controls').getBoundingClientRect().top), focus: document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute('href') || document.activeElement.tagName) : null }; })()`);

  let s = await state();
  check('390: controls are visible and the rounds row scrolls', s.controls !== 'none' && s.scrollable, `display ${s.controls}`);
  check('390: the round being played is pressed, and only it', s.pressed.length === 1 && s.pressed[0] === s.round, s.pressed.join(','));
  check('390: AL shown, NL not, on load', s.al === 3 && s.nl === 0 && s.conf.join() === 'AL', `AL ${s.al} NL ${s.nl}`);
  check('390: no series detail is open on load', s.openPanels.length === 0);
  await shot('mlb-390-full', 390);
  await shot('mlb-390-top', 390, { full: false });

  // A round pill.
  await clearCalls();
  await ev(`document.querySelector('[data-round-option="division_series"]').click()`);
  await sleep(1200);
  s = await state();
  const ds = s.cols.find((x) => x.key === 'division_series');
  check('pill: Division Series is pressed and the row is scrolled to it', s.pressed.join() === 'division_series' && Math.abs(ds.gap) <= 2 && s.scrollLeft > 0, `gap ${ds.gap}px scrollLeft ${s.scrollLeft}`);
  const next = s.cols.find((x) => x.key === 'championship_series');
  check('pill: the next round peeks in from the right', next.gap > 0 && next.gap < 390, `next column starts ${next.gap}px from the left of a 390px screen`);
  check('pill: the predicted bracket follows the same control', s.slot && s.slot.round === 'division_series', JSON.stringify(s.slot));
  c = await calls();
  check('pill: playoffs_round_select reaches both sinks', sinksFor(c, 'playoffs_round_select') === 'ga4+posthog', sinksFor(c, 'playoffs_round_select') || 'neither');
  const rs = propsFor(c, 'playoffs_round_select', 'posthog')[0] || {};
  check('pill: event names the round, the conference and the control', rs.round_key === 'division_series' && rs.conference === 'AL' && rs.control === 'round_pill', JSON.stringify({ round_key: rs.round_key, conference: rs.conference, control: rs.control }));
  await shot('mlb-390-division-series', 390, { full: false });

  // The conference toggle.
  await clearCalls();
  await ev(`document.querySelector('[data-conference-option="NL"]').click()`);
  await sleep(400);
  s = await state();
  check('toggle: NL shown, AL not', s.nl === 3 && s.al === 0 && s.conf.join() === 'NL', `AL ${s.al} NL ${s.nl}`);
  check('toggle: the predicted bracket follows it', s.slot && s.slot.conference === 'NL', JSON.stringify(s.slot));
  c = await calls();
  const ts = propsFor(c, 'playoffs_round_select', 'posthog')[0] || {};
  check('toggle: playoffs_round_select reaches both sinks, as conference_toggle', sinksFor(c, 'playoffs_round_select') === 'ga4+posthog' && ts.control === 'conference_toggle' && ts.conference === 'NL', `${sinksFor(c, 'playoffs_round_select')} ${ts.control} ${ts.conference}`);

  // The World Series has no conference: the toggle leaves.
  await ev(`document.querySelector('[data-round-option="world_series"]').click()`);
  await sleep(1200);
  check('toggle: gone on the World Series', await ev(`document.querySelector('[data-control="conference"]') === null`));
  await ev(`document.querySelector('[data-round-option="division_series"]').click()`);
  await sleep(1200);
  check('toggle: back on a round that is split', await ev(`document.querySelector('[data-control="conference"]') !== null`));

  // A series.
  await clearCalls();
  await ev(`document.querySelector('[data-series="division_series-3"] > a').click()`);
  await sleep(900);
  s = await state();
  check('series: its detail opens, and only its detail', s.openPanels.join() === 'division_series-3', s.openPanels.join(','));
  check('series: the card says it is expanded', s.expanded.join() === '#division_series-3');
  check('series: the address carries the series', s.hash === '#division_series-3', s.hash);
  check('series: focus moves to the detail', s.focus === 'division_series-3', String(s.focus));
  check('series: the detail is on screen', await ev(`(() => { const r = document.getElementById('division_series-3').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })()`));
  c = await calls();
  check('series: playoffs_series_open reaches both sinks', sinksFor(c, 'playoffs_series_open') === 'ga4+posthog', sinksFor(c, 'playoffs_series_open') || 'neither');
  const so = propsFor(c, 'playoffs_series_open', 'posthog')[0] || {};
  check('series: event names round, series id, status, and how it was opened', so.round_key === 'division_series' && so.series_id === 'division_series-3' && so.opened_by === 'tap' && ['upcoming', 'live', 'final'].includes(so.series_status), JSON.stringify({ round_key: so.round_key, series_id: so.series_id, series_status: so.series_status, opened_by: so.opened_by }));
  check('series: event is sent once', c.filter((x) => x.name === 'playoffs_series_open' && x.sink === 'posthog').length === 1);
  // The exact forms the bracket documents use, and nothing looser.
  check('no event carries a pipeline series key', !/\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b|\b(?:AL|NL)-CS\b|\bR\d-\dv\d\b|\bSF-[A-Z]\b/.test(JSON.stringify(c)));
  await shot('mlb-390-series-open', 390, { full: false });

  await clearCalls();
  await ev(`document.querySelector('[data-panel-close="division_series-3"]').click()`);

  await sleep(400);
  s = await state();
  check('close: the detail closes, the address clears, focus returns to the card', s.openPanels.length === 0 && s.hash === '' && s.focus === '#division_series-3', `${s.openPanels.length} open, hash "${s.hash}", focus ${s.focus}`);
  check('close: closing sends no event', (await calls()).length === 0);

  // Keyboard.
  await ev(`document.querySelector('[data-round-option="wild_card"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(1200);
  s = await state();
  check('keyboard: Enter on a focused pill selects the round', s.pressed.join() === 'wild_card' && s.scrollLeft === 0, `${s.pressed.join()} scrollLeft ${s.scrollLeft}`);
  await ev(`document.querySelector('[data-conference-option="AL"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await sleep(400);
  s = await state();
  check('keyboard: Space on the focused toggle selects the conference', s.conf.join() === 'AL' && s.al === 3 && s.nl === 0);
  await ev(`document.querySelector('[data-series="wild_card-1"] > a').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(900);
  s = await state();
  check('keyboard: Enter on a focused series opens its detail', s.openPanels.join() === 'wild_card-1');
  const order = await ev(`(() => { const f = [...document.querySelectorAll('.po-bracket button, .po-bracket a[href]')].filter((e) => getComputedStyle(e).display !== 'none' && e.offsetParent !== null && e.tabIndex >= 0); return { n: f.length, positive: f.filter((e) => e.tabIndex > 0).length }; })()`);
  check('keyboard: every control is in the natural tab order', order.n > 10 && order.positive === 0, `${order.n} focusable, ${order.positive} with a positive tabindex`);

  // Swipe: the reader scrolls the row; the pills follow and nothing is sent.
  await ev(`document.querySelector('[data-panel-close="wild_card-1"]').click()`);
  await sleep(1000);
  await clearCalls();
  await ev(`(() => { const box = document.querySelector('[data-rounds]'); const col = box.querySelector('[data-round="championship_series"]'); box.scrollTo({ left: col.offsetLeft - box.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft), behavior: 'auto' }); })()`);
  await sleep(900);
  s = await state();
  check('swipe: the pills follow the row the reader scrolled to', s.pressed.join() === 'championship_series', s.pressed.join());
  check('swipe: no event is sent for it', (await calls()).length === 0);

  // Show all.
  const before = await ev(`(() => { const m = document.querySelector('.po-more'); const b = document.querySelector('[data-show-all]'); return { rest: getComputedStyle(m).display, expanded: b.getAttribute('aria-expanded'), tag: b.tagName, type: b.type, label: b.textContent, rows: [...document.querySelectorAll('[data-home-game]')].filter((e) => e.offsetParent !== null).length }; })()`);
  check('show all: a real button, collapsed, with the short list showing', before.tag === 'BUTTON' && before.type === 'button' && before.expanded === 'false' && before.rest === 'none' && before.rows <= 8, `${before.rows} rows, "${before.label}"`);
  await ev(`document.querySelector('[data-show-all]').click()`);
  await sleep(400);
  const after = await ev(`(() => { const m = document.querySelector('.po-more'); const b = document.querySelector('[data-show-all]'); return { rest: getComputedStyle(m).display, expanded: b.getAttribute('aria-expanded'), label: b.textContent, rows: [...document.querySelectorAll('[data-home-game]')].filter((e) => e.offsetParent !== null).length, links: [...document.querySelectorAll('[data-home-game]')].map((r) => r.querySelectorAll('a[rel~="sponsored"]').length) }; })()`);
  check('show all: expands to the rest of the week', after.expanded === 'true' && after.rest !== 'none' && after.rows > before.rows, `${before.rows} rows to ${after.rows}, "${after.label}"`);
  check('show all: one ticket button in every row', after.links.every((n) => n === 1), `${after.links.length} rows`);

  // ================= Deep links =================
  await go('/playoffs/mlb#division_series-3', { width: 390 });
  s = await state();
  c = await calls();
  check('deep link: the named series is open', s.openPanels.join() === 'division_series-3', s.openPanels.join(','));
  check('deep link: its round is pressed and its conference chosen', s.pressed.join() === 'division_series' && s.conf.join() === 'NL' && s.nl === 3 && s.al === 0, `${s.pressed.join()} ${s.conf.join()}`);
  const dl = propsFor(c, 'playoffs_series_open', 'posthog')[0] || {};
  check('deep link: playoffs_series_open reaches both sinks, opened by link', sinksFor(c, 'playoffs_series_open') === 'ga4+posthog' && dl.opened_by === 'link' && dl.series_id === 'division_series-3', `${sinksFor(c, 'playoffs_series_open')} ${dl.opened_by}`);
  check('deep link: the detail is on screen', await ev(`(() => { const r = document.getElementById('division_series-3').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })()`));
  await shot('mlb-390-deeplink', 390, { full: false });

  await go('/playoffs/mlb#no_such_series-9', { width: 390 });
  s = await state();
  c = await calls();
  check('deep link: an unknown id leaves the page at its default', s.openPanels.length === 0 && s.conf.join() === 'AL' && s.pressed.length === 1 && c.filter((x) => x.name === 'playoffs_series_open').length === 0, `${s.pressed.join()} ${s.conf.join()}`);

  // Scripts off. The page is measured through the protocol, not by its own script.
  await go('/playoffs/mlb#division_series-3', { width: 390, js: false, settle: 1200 });
  const nojs = await ev(`(() => { const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none' && e.closest('.po-picks') === null); const p = document.getElementById('division_series-3').getBoundingClientRect();
    return { panels: shown('.po-panel').map((e) => e.id), al: shown('[data-conf="AL"]').length, nl: shown('[data-conf="NL"]').length, controls: shown('.po-controls').length, hydrated: document.querySelector('.po-bracket').hasAttribute('data-hydrated'),
      onScreen: p.top < innerHeight && p.bottom > 0, series: shown('[data-series]').length, more: getComputedStyle(document.querySelector('.po-more')).display, button: getComputedStyle(document.querySelector('[data-show-all]')).display,
      rows: [...document.querySelectorAll('[data-home-game]')].filter((e) => e.offsetParent !== null).length, calls: (window.__calls || []).length }; })()`);
  check('scripts off: the fragment alone opens the named series', nojs.panels.join() === 'division_series-3' && !nojs.hydrated, nojs.panels.join(','));
  check('scripts off: the browser has scrolled to it', nojs.onScreen);
  check('scripts off: both conferences and all 11 series show', nojs.al === 3 && nojs.nl === 3 && nojs.series === 11, `AL ${nojs.al} NL ${nojs.nl} series ${nojs.series}`);
  check('scripts off: the controls that cannot work are gone', nojs.controls === 0);
  check('scripts off: the whole week of home games shows and the button is gone', nojs.more !== 'none' && nojs.button === 'none', `${nojs.rows} rows`);
  await shot('mlb-390-noscript-deeplink', 390, { full: false });
  await go('/playoffs/mlb#no_such_series-9', { width: 390, js: false, settle: 1200 });
  check('scripts off: an unknown id opens nothing', (await ev(`[...document.querySelectorAll('.po-panel')].filter((e) => getComputedStyle(e).display !== 'none').length`)) === 0);
  await go('/playoffs/mlb', { width: 390, js: false, settle: 1200 });
  await ev(`location.hash = ''`).catch(() => {});
  await shot('mlb-390-noscript-full', 390);

  // ================= 1280px =================
  await go('/playoffs/mlb', { width: 1280 });
  const wide = await ev(`(() => { const box = document.querySelector('[data-rounds]'); const cols = [...box.querySelectorAll(':scope > section')].map((s) => { const r = s.getBoundingClientRect(); return { key: s.dataset.round, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }; });
    const shown = (sel) => [...document.querySelectorAll('.po-bracket ' + sel)].filter((e) => getComputedStyle(e).display !== 'none').length;
    return { controls: getComputedStyle(document.querySelector('.po-controls')).display, display: getComputedStyle(box).display, scrollable: box.scrollWidth > box.clientWidth + 1, cols, al: shown('[data-conf="AL"]'), nl: shown('[data-conf="NL"]'), series: shown('[data-series]'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  check('1280: the whole bracket shows at once, four rounds side by side', wide.display === 'grid' && !wide.scrollable && wide.cols.length === 4 && wide.cols.every((x) => x.left >= 0 && x.right <= 1280) && new Set(wide.cols.map((x) => x.top)).size === 1, wide.cols.map((x) => `${x.key} ${x.left}-${x.right}`).join(', '));
  check('1280: both conferences and all 11 series show', wide.al === 3 && wide.nl === 3 && wide.series === 11, `AL ${wide.al} NL ${wide.nl}`);
  check('1280: the controls are hidden, nothing is left to choose', wide.controls === 'none');
  check('1280: the page does not scroll sideways', !wide.overflow);
  await shot('mlb-1280-full', 1280);
  await clearCalls();
  await ev(`document.querySelector('[data-series="championship_series-2"] > a').click()`);
  await sleep(900);
  s = await state();
  check('1280: a series opens its detail', s.openPanels.join() === 'championship_series-2');
  check('1280: playoffs_series_open reaches both sinks', sinksFor(await calls(), 'playoffs_series_open') === 'ga4+posthog');
  await shot('mlb-1280-series-open', 1280, { full: false });

  // ================= WNBA =================
  await go('/playoffs/wnba', { width: 390 });
  c = await calls();
  const wv = propsFor(c, 'playoffs_league_view', 'posthog')[0] || {};
  check('WNBA: page view event reaches both sinks', sinksFor(c, 'playoffs_league_view') === 'ga4+posthog' && wv.league === 'wnba', `${sinksFor(c, 'playoffs_league_view')} ${wv.league}`);
  const w = await ev(`(() => { const shown = (sel) => [...document.querySelectorAll('.po-bracket ' + sel)].filter((e) => getComputedStyle(e).display !== 'none').length; return { toggle: document.querySelector('[data-control="conference"]') !== null, pills: [...document.querySelectorAll('.po-bracket [data-round-option]')].map((b) => b.textContent), series: shown('[data-series]'), conf: document.querySelectorAll('[data-conf]').length }; })()`);
  check('WNBA: three round pills, no conference toggle, all seven series showing', !w.toggle && w.pills.length === 3 && w.series === 7 && w.conf === 0, w.pills.join(' | '));
  await shot('wnba-390-full', 390);
  await shot('wnba-390-top', 390, { full: false });
  await clearCalls();
  await ev(`document.querySelector('[data-round-option="semifinals"]').click()`);
  await sleep(1200);
  const wr = propsFor(await calls(), 'playoffs_round_select', 'posthog')[0] || {};
  check('WNBA: a pill sends the round with no conference', wr.round_key === 'semifinals' && wr.conference === null && wr.control === 'round_pill', JSON.stringify({ round_key: wr.round_key, conference: wr.conference }));
  await ev(`document.querySelector('[data-series="first_round-1"] > a').click()`);
  await sleep(900);
  await shot('wnba-390-series-open', 390, { full: false });
  await go('/playoffs/wnba', { width: 1280 });
  const ww = await ev(`(() => { const box = document.querySelector('[data-rounds]'); return { display: getComputedStyle(box).display, cols: [...box.querySelectorAll(':scope > section')].length, controls: getComputedStyle(document.querySelector('.po-controls')).display, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  check('WNBA 1280: three rounds side by side, controls hidden, no sideways scroll', ww.display === 'grid' && ww.cols === 3 && ww.controls === 'none' && !ww.overflow);
  await shot('wnba-1280-full', 1280);

  // ================= Hub: the predictions card at 390 =================
  // The record stays on one line. The live documents may no longer show "no
  // series decided yet", so the same span is also measured holding that text.
  await go('/playoffs', { width: 390 });
  const rec = await ev(`(() => { const spans = [...document.querySelectorAll('[data-predictions-league] .whitespace-nowrap')];
    const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; };
    const live = spans.map((s) => ({ text: s.textContent, lines: lines(s) }));
    const probe = spans.map((s) => { const was = s.textContent; s.textContent = '· no series decided yet'; const n = lines(s); s.textContent = was; return n; });
    return { live, probe, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  check('hub 390: each predictions record is on one line', rec.live.length > 0 && rec.live.every((x) => x.lines === 1), JSON.stringify(rec.live));
  check('hub 390: "no series decided yet" stays on one line in the same span', rec.probe.length > 0 && rec.probe.every((n) => n === 1) && !rec.wide, JSON.stringify(rec.probe));
  await ev(`document.querySelector('[data-predictions="locked"]').scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await shot('hub-390-predictions-card', 390, { full: false });

  // ================= Hub =================
  await go('/playoffs', { width: 390 });
  await clearCalls();
  const hub = await ev(`(() => { const rows = [...document.querySelectorAll('[data-home-game]')]; const vis = rows.filter((e) => e.offsetParent !== null); const b = document.querySelector('[data-show-all]');
    return { visible: vis.length, total: rows.length, links: vis.map((r) => r.querySelectorAll('a[rel~="sponsored"]').length), button: b ? { expanded: b.getAttribute('aria-expanded'), label: b.textContent } : null,
      deep: [...document.querySelectorAll('[data-league-card] [data-series] a')].map((a) => a.getAttribute('href')), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  check('hub: eight rows at most, one ticket button each, the week behind the button', hub.visible <= 8 && hub.links.every((n) => n === 1) && hub.button && hub.button.expanded === 'false' && hub.total > hub.visible, `${hub.visible} of ${hub.total} rows, "${hub.button && hub.button.label}"`);
  // How many series the cards list is the document's business (a card lists
  // the series of the round being played that are not yet final; the
  // served-HTML verifier checks that count against the document). Here: at
  // least one, and every one a link to a series on a league page.
  check('hub: every series line is a link to that series', hub.deep.length >= 1 && hub.deep.every((h) => /^\/playoffs\/(mlb|wnba)#[a-z_]+-\d+$/.test(h)), `${hub.deep.length} links, ${hub.deep.slice(0, 2).join(' ')}`);
  await shot('hub-390-full', 390);
  await ev(`document.querySelector('[data-league-card="MLB"] [data-series] a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`).catch(() => {});
  await sleep(1500);
  c = await calls().catch(() => []);
  const landed = await ev(`({ path: location.pathname, hash: location.hash, open: [...document.querySelectorAll('.po-panel')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id) })`);
  check('hub to series: the link lands on the league page with that series open', landed.path === '/playoffs/mlb' && landed.open.length === 1 && '#' + landed.open[0] === landed.hash, JSON.stringify(landed));
  await go('/playoffs', { width: 1280 });
  check('hub 1280: no sideways scroll', !(await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth`)));
  await shot('hub-1280-full', 1280);

  // ================= Tagged links =================
  await go('/playoffs/mlb', { width: 390 });
  await ev(`document.querySelector('[data-series="wild_card-1"] > a').click()`);
  await sleep(700);
  await clearCalls();
  // mousedown and click without following the link, so the page stays put.
  await ev(`(() => { const stop = (e) => e.preventDefault(); document.addEventListener('click', stop, true);
    const park = document.querySelector('#wild_card-1 [data-park-link]'); park.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const club = document.querySelector('#wild_card-1 [data-club-link]'); club.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const crumb = document.querySelector('nav[aria-label="Breadcrumb"] a'); crumb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.removeEventListener('click', stop, true); })()`);
  await sleep(300);
  c = await calls();
  const vh = propsFor(c, 'venue_hub_click', 'posthog')[0] || {};
  check('park link: venue_hub_click reaches both sinks from this surface', sinksFor(c, 'venue_hub_click') === 'ga4+posthog' && vh.surface === 'web_playoffs_league' && vh.destination_url === '/venues/' + vh.building_slug && !!vh.team_slug, JSON.stringify({ surface: vh.surface, placement: vh.placement, building_slug: vh.building_slug, team_slug: vh.team_slug }));
  // Keyboard activation raises no mousedown. The Enter key must fire the
  // same event once, and a held key must not fire it again.
  await ev(`(() => { const stop = (e) => e.preventDefault(); document.addEventListener('click', stop, true);
    const park = document.querySelector('#wild_card-1 [data-park-link]'); park.focus();
    park.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    park.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: true }));
    park.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    document.removeEventListener('click', stop, true); })()`);
  await sleep(300);
  const afterKey = await calls();
  const keyed = afterKey.filter((x) => x.name === 'venue_hub_click');
  const mousedOnly = c.filter((x) => x.name === 'venue_hub_click');
  check('park link: the Enter key fires venue_hub_click at both sinks, once', keyed.length === mousedOnly.length + 2 && sinksFor(afterKey, 'venue_hub_click') === 'ga4+posthog', `${keyed.length - mousedOnly.length} more events after Enter, a held Enter and Space`);
  const cc = propsFor(c, 'cta_click', 'posthog');
  check('club link and breadcrumb: cta_click reaches both sinks from this surface', sinksFor(c, 'cta_click') === 'ga4+posthog' && cc.length === 2 && cc.every((p) => p.surface === 'web_playoffs_league') && cc.some((p) => p.cta_id === 'playoffs_series_team' && /^\/mlb\//.test(p.cta_destination)) && cc.some((p) => p.cta_id === 'playoffs_breadcrumb'), cc.map((p) => `${p.cta_id} ${p.cta_destination}`).join(' | '));

  // ================= Width at 390px =================
  // Against clientWidth and against 390 itself. innerWidth alone proves
  // nothing: on a phone a page wider than the screen reports its own width
  // there, so "scrollWidth > innerWidth" can never be true.
  const WIDTH = `(() => ({ doc: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, inner: innerWidth, innerH: innerHeight }))()`;
  const asWide = (w) => w.doc === 390 && w.client === 390 && w.inner === 390 && w.innerH === 844;
  const said = (w) => `document ${w.doc}px, window ${w.inner}x${w.innerH}`;
  for (const path of ['/playoffs/mlb', '/playoffs/wnba', '/playoffs']) {
    await go(path, { width: 390 });
    let w = await ev(WIDTH);
    check(`390 ${path}: the page is as wide as the screen and no wider`, asWide(w), said(w));
    if (path !== '/playoffs') {
      // Every round in turn, then a series open: the rounds row scrolls, and
      // nothing that scrolls with it may widen the page.
      w = await ev(`(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (const b of document.querySelectorAll('[data-round-option]')) { b.click(); await wait(350); }
        const a = [...document.querySelectorAll('.po-bracket [data-series] a')].filter((x) => x.offsetWidth > 0)[0]; if (a) { a.click(); await wait(350); }
        return ${WIDTH}; })()`);
      check(`390 ${path}: still so after every round is selected and a series opened`, asWide(w), said(w));
      await go(path, { width: 390, js: false, settle: 1200 });
      w = await ev(WIDTH);
      check(`390 ${path}: and with scripts off`, asWide(w), said(w));
    }
  }

  // ================= The PromoNight Predicts bracket, 390px, MLB =================
  // Its own pills and toggle, bound to the same state as the real bracket's:
  // pressing either set moves both. It sends its own two events.
  await go('/playoffs/mlb', { width: 390 });
  const both = () => ev(`(() => { const r = document.querySelector('.po-bracket'); const p = document.querySelector('.po-picks');
    const on = (root, sel, key) => [...root.querySelectorAll(sel)].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset[key]);
    const box = p.querySelector('[data-pick-rounds]'); const pad = parseFloat(getComputedStyle(box).paddingLeft);
    const cols = [...box.querySelectorAll(':scope > section')].map((x) => ({ key: x.dataset.pickRound, gap: Math.round(x.offsetLeft - box.offsetLeft - pad - box.scrollLeft) }));
    return { real: { round: r.dataset.round, conference: r.dataset.conference ?? null, pills: on(r, '[data-round-option]', 'roundOption'), conf: on(r, '[data-conference-option]', 'conferenceOption') },
      picks: { round: p.dataset.round, conference: p.dataset.conference ?? null, pills: on(p, '[data-round-option]', 'roundOption'), conf: on(p, '[data-conference-option]', 'conferenceOption'), cols,
        al: [...p.querySelectorAll('[data-conf="AL"]')].filter((e) => getComputedStyle(e).display !== 'none').length, nl: [...p.querySelectorAll('[data-conf="NL"]')].filter((e) => getComputedStyle(e).display !== 'none').length } }; })()`);
  let b = await both();
  check('picks 390: present, on the same round and conference as the real bracket', b.picks.round === b.real.round && b.picks.conference === b.real.conference && b.picks.pills.join() === b.real.round, JSON.stringify(b.picks.pills));
  await ev(`document.getElementById('predictions').scrollIntoView()`);
  await sleep(400);
  await shot('mlb-390-predictions', 390, { full: false });
  await clearCalls();
  await ev(`document.querySelector('.po-picks [data-round-option="division_series"]').click()`);
  await sleep(1200);
  b = await both();
  const pds = b.picks.cols.find((x) => x.key === 'division_series');
  check('picks pill: moves both brackets', b.real.round === 'division_series' && b.picks.round === 'division_series' && b.real.pills.join() === 'division_series' && b.picks.pills.join() === 'division_series', JSON.stringify({ real: b.real.pills, picks: b.picks.pills }));
  check('picks pill: its own row is scrolled to the round', Math.abs(pds.gap) <= 2, `gap ${pds.gap}px`);
  c = await calls();
  check('picks pill: predictions_round_select reaches both sinks', sinksFor(c, 'predictions_round_select') === 'ga4+posthog', sinksFor(c, 'predictions_round_select') || 'neither');
  const prs = propsFor(c, 'predictions_round_select', 'posthog')[0] || {};
  check('picks pill: event names the round, conference and control', prs.round_key === 'division_series' && prs.conference === 'AL' && prs.control === 'round_pill' && prs.league === 'mlb' && prs.season === 2026 && prs.surface === 'web_playoffs_league', JSON.stringify(prs));
  check('picks pill: the real bracket sent no event of its own', !c.some((x) => x.name === 'playoffs_round_select'));
  await clearCalls();
  await ev(`document.querySelector('.po-picks [data-conference-option="NL"]').click()`);
  await sleep(500);
  b = await both();
  check('picks toggle: moves both brackets to NL', b.real.conference === 'NL' && b.picks.conference === 'NL' && b.real.conf.join() === 'NL' && b.picks.conf.join() === 'NL' && b.picks.nl > 0 && b.picks.al === 0, JSON.stringify({ real: b.real.conf, picks: b.picks.conf, al: b.picks.al, nl: b.picks.nl }));
  c = await calls();
  const pts = propsFor(c, 'predictions_round_select', 'posthog')[0] || {};
  check('picks toggle: predictions_round_select reaches both sinks, as conference_toggle', sinksFor(c, 'predictions_round_select') === 'ga4+posthog' && pts.control === 'conference_toggle' && pts.conference === 'NL', `${sinksFor(c, 'predictions_round_select')} ${pts.control} ${pts.conference}`);
  // And the other way: the real bracket's pill moves the predicted bracket.
  await ev(`document.querySelector('.po-bracket [data-round-option="championship_series"]').click()`);
  await sleep(1200);
  b = await both();
  const pcs = b.picks.cols.find((x) => x.key === 'championship_series');
  check('real pill: moves the predicted bracket, pill and row', b.picks.round === 'championship_series' && b.picks.pills.join() === 'championship_series' && Math.abs(pcs.gap) <= 2, `gap ${pcs.gap}px ${b.picks.pills.join()}`);
  // A swipe in the predicted row moves the real bracket: its pills, and its
  // row, which follows to the same round. A middle round: the last column
  // cannot reach the left edge, the row stops at its end.
  await clearCalls();
  await ev(`(() => { const box = document.querySelector('[data-pick-rounds]'); const col = box.querySelector('[data-pick-round="division_series"]'); box.scrollTo({ left: col.offsetLeft - box.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft), behavior: 'auto' }); })()`);
  await sleep(1200);
  b = await both();
  const realRow = await ev(`(() => { const box = document.querySelector('[data-rounds]'); const pad = parseFloat(getComputedStyle(box).paddingLeft); const col = box.querySelector(':scope > section[data-round="division_series"]'); return Math.round(col.offsetLeft - box.offsetLeft - pad - box.scrollLeft); })()`);
  check('picks swipe: the real bracket follows, pills and row', b.real.round === 'division_series' && b.real.pills.join() === 'division_series' && b.picks.pills.join() === 'division_series' && Math.abs(realRow) <= 2, `real ${b.real.pills.join()} gap ${realRow}px`);
  check('picks swipe: no event is sent for it', (await calls()).filter((x) => /round_select/.test(x.name)).length === 0);
  await shot('mlb-390-predictions-nl-cs', 390, { full: false });
  // A pick opens, with no navigation, and sends one event.
  await clearCalls();
  const hashBefore = await ev('location.hash');
  await ev(`document.querySelector('.po-picks [data-pick-round="championship_series"] [data-conf="NL"] details summary').click()`);
  await sleep(600);
  c = await calls();
  check('pick open: predictions_series_open reaches both sinks, once', sinksFor(c, 'predictions_series_open') === 'ga4+posthog' && c.filter((x) => x.name === 'predictions_series_open' && x.sink === 'posthog').length === 1, sinksFor(c, 'predictions_series_open') || 'neither');
  const pso = propsFor(c, 'predictions_series_open', 'posthog')[0] || {};
  check('pick open: event names round, the real series id and the mark', pso.round_key === 'championship_series' && /^championship_series-\d$/.test(pso.series_id) && ['correct', 'busted', 'alive'].includes(pso.pick_outcome), JSON.stringify(pso));
  check('pick open: the address did not change', (await ev('location.hash')) === hashBefore);
  check('no predictions event carries a pipeline series key or a hash', !/\b(?:AL|NL)-(?:WC|DS)-[A-Z]\b|\b(?:AL|NL)-CS\b|\bR\d-\dv\d\b|\bSF-[A-Z]\b|[0-9a-f]{40,}/.test(JSON.stringify(c)));
  await shot('mlb-390-pick-open', 390, { full: false });

  // Scripts off: every pick shows, both conferences, and the controls go.
  await go('/playoffs/mlb', { width: 390, js: false, settle: 1200 });
  const pnojs = await ev(`(() => { const p = document.querySelector('.po-picks'); const shown = (sel) => [...p.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none').length; return { picks: shown('[data-pick]'), al: shown('[data-conf="AL"]'), nl: shown('[data-conf="NL"]'), controls: shown('.po-controls') }; })()`);
  check('picks, scripts off: all 11 picks and both conferences show, the controls are gone', pnojs.picks === 11 && pnojs.al === 3 && pnojs.nl === 3 && pnojs.controls === 0, JSON.stringify(pnojs));

  // ================= Every round pill and every busted mark, both leagues, 390 =================
  for (const path of ['/playoffs/wnba', '/playoffs/mlb']) {
    await go(path, { width: 390 });
    await ev(`document.getElementById('predictions').scrollIntoView()`);
    const keys = await ev(`[...document.querySelectorAll('.po-picks [data-round-option]')].map((b) => b.dataset.roundOption)`);
    const bad = [];
    for (const k of keys) {
      await ev(`document.querySelector('.po-picks [data-round-option="${k}"]').click()`);
      await sleep(900);
      const st = await ev(`(() => { const p = document.querySelector('.po-picks'); const r = document.querySelector('.po-bracket'); const box = p.querySelector('[data-pick-rounds]'); const pad = parseFloat(getComputedStyle(box).paddingLeft); const col = box.querySelector('[data-pick-round="${k}"]');
        return { picks: p.dataset.round, real: r.dataset.round, gap: Math.round(col.offsetLeft - box.offsetLeft - pad - box.scrollLeft), scrollable: box.scrollWidth > box.clientWidth }; })()`);
      if (st.picks !== k || st.real !== k || (st.scrollable && Math.abs(st.gap) > 2 && k !== keys[keys.length - 1])) bad.push(`${k} ${JSON.stringify(st)}`);
      await shot(`${path.split('/').pop()}-390-picks-${k}`, 390, { full: false });
    }
    check(`picks 390 ${path}: every round pill moves both brackets and brings its round in`, bad.length === 0 && keys.length >= 3, bad.join(' | ') || keys.join(','));
    const marks = await ev(`(() => { const p = document.querySelector('.po-picks');
      const busted = [...p.querySelectorAll('[data-pick-outcome="busted"]')];
      return { busted: busted.length, badges: busted.filter((li) => li.querySelector('[data-outcome-badge="busted"]')).length,
        struck: busted.filter((li) => getComputedStyle(li.querySelector('[data-pick-side="pick"] span.truncate')).textDecorationLine.includes('line-through')).length,
        dimmedFaded: [...p.querySelectorAll('[data-dimmed="true"] details')].every((d) => parseFloat(getComputedStyle(d).opacity) < 1),
        others: [...p.querySelectorAll('[data-pick-outcome]:not([data-pick-outcome="busted"])')].filter((li) => getComputedStyle(li.querySelector('[data-pick-side="pick"] span.truncate')).textDecorationLine.includes('line-through')).length }; })()`);
    check(`picks 390 ${path}: every busted pick has its badge and is struck through, dimmed cards are faded, nothing else is struck`, marks.busted > 0 && marks.badges === marks.busted && marks.struck === marks.busted && marks.dimmedFaded && marks.others === 0, JSON.stringify(marks));
  }

  // ================= The PromoNight Predicts bracket, the other views =================
  for (const [path, width] of [['/playoffs/wnba', 390], ['/playoffs/wnba', 1280], ['/playoffs/mlb', 1280]]) {
    await go(path, { width });
    await ev(`document.getElementById('predictions').scrollIntoView()`);
    await sleep(400);
    const name = `${path.split('/').pop()}-${width}`;
    await shot(`${name}-predictions`, width, { full: false });
    if (width === 1280) {
      const all = await ev(`(() => { const p = document.querySelector('.po-picks'); return { controls: getComputedStyle(p.querySelector('.po-controls')).display, shown: [...p.querySelectorAll('[data-pick]')].filter((x) => x.offsetWidth > 0).length, total: p.querySelectorAll('[data-pick]').length }; })()`);
      check(`picks 1280 ${path}: every pick shown at once, controls hidden`, all.controls === 'none' && all.shown === all.total && all.total > 0, JSON.stringify(all));
    }
    await ev(`document.getElementById('how-promonight-predicts-works').scrollIntoView()`);
    await sleep(300);
    await shot(`${name}-methodology`, width, { full: false });
  }

  // ================= The debug log =================
  const logged = [...new Set(consoleLines.filter((l) => l.startsWith('[analytics]')).map((l) => l.split(' ')[1]))].sort();
  // The debug log is switched on by an environment value that a deployed
  // host does not carry. With it off there is nothing to read, and the
  // checks above have already seen each event arrive at both sinks.
  if (logged.length === 0) console.log('NOTE  debug log: off on this host, so not checked');
  else check('debug log: the three bracket events were logged by track()', ['playoffs_league_view', 'playoffs_round_select', 'playoffs_series_open'].every((n) => logged.includes(n)), logged.join(', '));
  check('nothing left this machine: analytics requests were blocked', blocked.length > 0, `${blocked.length} requests blocked`);
  const errors = consoleLines.filter((l) => /Minified React error|Hydration|hydrat/i.test(l));
  check('no hydration error was logged on any page', errors.length === 0, errors.slice(0, 2).join(' | '));

  ws.close();
} catch (e) {
  check('the run completed', false, String(e && e.stack || e));
} finally {
  chrome.kill('SIGKILL');
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
