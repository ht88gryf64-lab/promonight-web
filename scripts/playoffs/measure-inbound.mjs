// Measures what the inbound playoffs modules do to the pages that host them,
// against a baseline build of main, and takes the 390px screenshots.
//
// For each host page, in both builds, at 390px and 1280px:
//   - how many direct children the ad wrapper has. Each one is an anchor for
//     the ad placer, so this number must not change.
//   - the height of the wrapper and of the tallest article, against 1.5
//     viewports, the floor below which the placer creates no unit.
//   - how many aside elements the page holds. An aside receives the sidebar
//     ad stack.
//   - where the module is, and that it is inside the wrapper.
//
// It needs two running servers: this branch and a build of main.
//
//   BRANCH=http://localhost:3468 MAIN=http://localhost:3469 \
//     OUT=/tmp/inbound-shots node scripts/playoffs/measure-inbound.mjs
//
// Analytics and ad hosts are blocked at the network layer. No ad loads, so
// this measures the anchors and the heights the placer reads, and NOT the
// units it places: that needs a deployed preview with the ad script live.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = process.env.OUT;
const BRANCH = process.env.BRANCH || 'http://localhost:3468', MAIN = process.env.MAIN || 'http://localhost:3469';
if (!OUT) { console.error('Set OUT to a directory for the screenshots.'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const PORT = 9350; const profile = mkdtempSync(join(tmpdir(), 'pn-measure-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const events = []; const consoleLines = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const waitFor = async (name, ms = 60000) => { const end = Date.now() + ms; for (;;) { const k = events.findIndex((e) => e.method === name); if (k >= 0) { events.splice(k, 1); return; } if (Date.now() > end) throw new Error('timeout ' + name); await sleep(50); } };
async function go(url, width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 2, mobile: width < 600 });
  events.length = 0; await send('Page.navigate', { url: 'about:blank' }); await waitFor('Page.loadEventFired');
  events.length = 0; await send('Page.navigate', { url }); await waitFor('Page.loadEventFired'); await sleep(2200);
}
async function shot(name, width, clip) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, width, scale: 1, ...clip } });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
}
const MEASURE = (wrapper) => `(() => {
  const w = document.querySelector(${JSON.stringify(wrapper)});
  if (!w) return null;
  const kids = [...w.children];
  const m = document.querySelector('[data-playoffs-module]');
  const r = m ? m.getBoundingClientRect() : null;
  return {
    wrapperHeight: w.offsetHeight, viewport: innerHeight, children: kids.length,
    kids: kids.map((k) => k.tagName.toLowerCase() + ':' + k.offsetHeight),
    article: (() => { const a = [...document.querySelectorAll('article')].sort((x, y) => y.offsetHeight - x.offsetHeight)[0]; return a ? a.offsetHeight : null; })(),
    asides: document.querySelectorAll('aside').length,
    module: m ? { kind: m.dataset.playoffsModule, state: m.dataset.playoffsState, top: Math.round(r.top + scrollY), height: Math.round(r.height), inWrapper: w.contains(m), directChild: m.parentElement === w, width: Math.round(r.width) } : null,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
  }; })()`;
const PAGES = [
  ['team', '/mlb/houston-astros', 'article.rd-weave > div.rd-weave-shell'],
  ['team-wnba', '/wnba/new-york-liberty', 'article.rd-weave > div.rd-weave-shell'],
  ['team-inprogress', '/mlb/atlanta-braves', 'article.rd-weave > div.rd-weave-shell'],
  ['hub-mlb', '/mlb', '.page-content'],
  ['hub-wnba', '/wnba', '.page-content'],
  ['home', '/', '.page-content'],
  ['venue', '/venues/daikin-park', '.page-content'],
  ['venue-shared', '/venues/barclays-center', '.page-content'],
];
try {
  let url; for (let i = 0; i < 50 && !url; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = l.find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} await sleep(200); }
  ws = new WebSocket(url); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } else if (d.method === 'Runtime.consoleAPICalled') consoleLines.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ')); else if (d.method) events.push(d); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*posthog.com*', '*google-analytics.com*', '*googletagmanager.com*', '*analytics.google.com*', '*doubleclick.net*', '*adthrive*', '*raptive*', '*cafemedia*'] });
  const rows = [];
  for (const [name, path, wrapper] of PAGES) {
    for (const width of [390, 1280]) {
      await go(MAIN + path, width); const a = await ev(MEASURE(wrapper));
      await go(BRANCH + path, width); const b = await ev(MEASURE(wrapper));
      rows.push({ name, path, width, main: a, branch: b });
      if (width === 390) {
        const top = Math.max(0, b.module.top - 330);
        await shot(`${name}-390-module`, 390, { y: top, height: Math.min(1500, b.module.height + 560) });
        await shot(`${name}-390-top`, 390, { y: 0, height: Math.min(b.pageHeight, 2400) });
      }
    }
  }
  for (const r of rows) {
    const { main: a, branch: b } = r;
    console.log(`\n${r.path} @ ${r.width}px`);
    console.log(`  anchors (direct children of the ad wrapper): main ${a.children}  branch ${b.children}  ${a.children === b.children ? 'SAME' : 'CHANGED by ' + (b.children - a.children)}`);
    console.log(`  wrapper height: main ${a.wrapperHeight}px  branch ${b.wrapperHeight}px  (+${b.wrapperHeight - a.wrapperHeight})  viewport ${b.viewport}px, 1.5 viewports = ${Math.round(b.viewport * 1.5)}px`);
    console.log(`  tallest article: main ${a.article}  branch ${b.article}  | asides: main ${a.asides} branch ${b.asides} | sideways scroll: ${b.overflow}`);
    console.log(`  module: ${b.module.kind}/${b.module.state} top ${b.module.top}px height ${b.module.height}px width ${b.module.width}px inside wrapper ${b.module.inWrapper} direct child ${b.module.directChild}`);
    console.log(`  first children, main:   ${a.kids.slice(0, 5).join('  ')}`);
    console.log(`  first children, branch: ${b.kids.slice(0, 5).join('  ')}`);
  }
  const errors = consoleLines.filter((l) => /Minified React error|Hydration|hydrat/i.test(l));
  console.log(`\nhydration errors logged: ${errors.length}${errors.length ? '  ' + errors.slice(0, 3).join(' | ') : ''}`);
  ws.close();
} finally { chrome.kill('SIGKILL'); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
