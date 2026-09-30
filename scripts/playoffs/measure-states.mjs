// Measures the playoffs article in every bracket state, at phone width,
// BEFORE any ad is placed. Reads what render-states.tsx wrote.
//
//   OUT=/tmp/states node scripts/playoffs/measure-states.mjs
//
// The pages are served from a static server on localhost and loaded in
// headless Chrome at 390x844 with every host but localhost refused, so no
// ad, analytics or font request leaves the machine and nothing can add to
// the article. Each gated state must measure at least its floor; a state
// below it fails the run.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const OUT = process.env.OUT;
if (!OUT) { console.error('Set OUT to the directory render-states.tsx wrote.'); process.exit(2); }
const index = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf-8'));
// The static assets (stylesheet, scripts) are the build's own, proxied from
// the server the shell came from, so the page is styled exactly as served.
const ASSETS = (process.env.BASE || 'http://localhost:3468').replace(/\/$/, '');

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = join(OUT, path.replace(/^\//, ''));
  if (path.endsWith('.html') && existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(file));
    return;
  }
  try {
    const up = await fetch(`${ASSETS}${path}`);
    const body = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || (extname(path) === '.css' ? 'text/css' : 'application/octet-stream') });
    res.end(body);
  } catch {
    res.writeHead(502); res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT_HTTP = server.address().port;

const PORT = 9356;
const profile = mkdtempSync(join(tmpdir(), 'pn-states-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const events = []; let blocked = 0;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const waitFor = async (name, ms = 60000) => { const end = Date.now() + ms; for (;;) { const k = events.findIndex((e) => e.method === name); if (k >= 0) { events.splice(k, 1); return; } if (Date.now() > end) throw new Error('timeout ' + name); await sleep(50); } };
async function target() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}
const MEASURE = `(() => {
  const a = document.querySelector('article[data-playoffs-article]');
  if (!a) return null;
  const kids = [...a.children].map((k) => k.tagName.toLowerCase() + (k.dataset.playoffsArticle ? '' : '') + ':' + k.offsetHeight + (String(k.className).includes('adthrive') ? ':AD' : ''));
  return { height: a.offsetHeight, kids, ads: document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]').length, hydrated: !!document.querySelector('[data-hydrated]'), width: innerWidth, docWidth: document.documentElement.scrollWidth, docClient: document.documentElement.clientWidth };
})()`;

const rows = [];
try {
  ws = new WebSocket(await target());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); return; }
    if (msg.method === 'Network.loadingFailed' && msg.params.blockedReason) blocked += 1;
    else if (msg.method) events.push(msg);
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  // Everything but this machine is refused at the request stage. A blocked
  // URL pattern cannot carve out an exception, so this is interception.
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method !== 'Fetch.requestPaused') return;
    const url = msg.params.request.url;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith('about:') || url.startsWith('data:')) send('Fetch.continueRequest', { requestId: msg.params.requestId }).catch(() => {});
    else { blocked += 1; send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {}); }
  });
  // Scripts stay ENABLED although the pages carry none: with them disabled
  // the browser applies the pages' noscript styles, which show both
  // conferences and every home game, and that is not the layout the ad
  // placer measures. See render-states.tsx for why the pages carry none.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });

  for (const s of index) {
    events.length = 0; await send('Page.navigate', { url: 'about:blank' }); await waitFor('Page.loadEventFired');
    events.length = 0; await send('Page.navigate', { url: `http://127.0.0.1:${PORT_HTTP}/${s.file}` }); await waitFor('Page.loadEventFired');
    await sleep(1500);
    const m = await ev(MEASURE);
    if (!m) { rows.push({ ...s, height: null, ok: false, detail: 'no article' }); console.log(`FAIL  ${s.name}: no article`); continue; }
    const ok = m.height >= s.floor;
    rows.push({ ...s, height: m.height, ok, kids: m.kids, ads: m.ads, docWidth: m.docWidth });
    console.log(`${s.gated ? (ok ? 'PASS' : 'FAIL') : 'INFO'}  ${s.name}: article ${m.height}px against ${s.floor}px  [${s.what}]${m.ads ? '  ADS PRESENT: ' + m.ads : ''}${m.docWidth !== 390 ? '  WIDTH ' + m.docWidth : ''}`);
    console.log(`      children ${m.kids.join(' ')}`);
  }
  const failed = rows.filter((r) => r.gated && !r.ok);
  console.log(`\n${rows.filter((r) => r.gated && r.ok).length} of ${rows.filter((r) => r.gated).length} gated states at or above the floor; ${blocked} requests to other hosts refused`);
  for (const f of failed) console.log(`FAILED  ${f.name}  ${f.height}px`);
  process.exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('ERROR', e.message);
  process.exitCode = 2;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
