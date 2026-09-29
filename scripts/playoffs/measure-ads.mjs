// Counts the ad units the ad placer puts on the playoffs pages, on a deployed
// host with the ad script live, at 390px and at 1280px.
//
// For each route and width, after full load and a slow scroll to the bottom:
//   - the ad containers on the page, by kind, and how many hold a creative
//   - the in-content containers inside the article. None at 390px is a
//     blocking failure.
//   - the article's height against 1.5 viewports
//   - the ad containers inside the interactive bracket. There must be none.
//   - the same containers before and after every round and series is
//     selected. None may be removed, added or re-created.
//   - at 390px, the sticky round controls against the placer's sticky footer
//
//   BASE=https://<host> OUT=/tmp/ads node scripts/playoffs/measure-ads.mjs
//
//   SHARE    a share link for a protected preview. Opened first, so the
//            browser holds the access cookie. Never printed.
//   CONTROL  a page that is live in production, measured the same way on the
//            same host, to show what the placer does there. Default /mlb.
//
// Analytics hosts are blocked, so no pageview or event is recorded. Ad hosts
// are NOT blocked: this is the one script here that lets the ad code run.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const OUT = process.env.OUT;
const SHARE = process.env.SHARE || '';
const CONTROL = process.env.CONTROL || '/mlb';
if (!BASE || !OUT) { console.error('Set BASE to the deployed origin and OUT to a directory.'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const PORT = 9352;
const profile = mkdtempSync(join(tmpdir(), 'pn-ads-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };
const note = (line) => console.log(`      ${line}`);

async function target() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}
let ws, id = 0; const pending = new Map(); const events = []; const consoleLines = []; const requests = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (name, ms = 90000) => { const end = Date.now() + ms; for (;;) { const k = events.findIndex((e) => e.method === name); if (k >= 0) { events.splice(k, 1); return; } if (Date.now() > end) throw new Error('timeout ' + name); await sleep(50); } };

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function go(path, width) {
  const mobile = width < 600;
  await send('Emulation.setDeviceMetricsOverride', { width, height: mobile ? 844 : 900, deviceScaleFactor: 2, mobile });
  await send('Emulation.setUserAgentOverride', { userAgent: mobile ? MOBILE_UA : DESKTOP_UA });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  events.length = 0; await send('Page.navigate', { url: 'about:blank' }); await waitFor('Page.loadEventFired');
  events.length = 0; requests.length = 0; consoleLines.length = 0;
  await send('Page.navigate', { url: `${BASE}${path}` }); await waitFor('Page.loadEventFired');
  await sleep(4000);
}

// A slow scroll to the bottom and back, the way a reader gets there. The
// placer adds containers as the page is read, so the count is taken after.
const SCROLL = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let y = 0, turns = 0;
  while (y < document.documentElement.scrollHeight - innerHeight && turns < 400) {
    y += Math.round(innerHeight * 0.6); scrollTo(0, y); turns += 1; await wait(350);
  }
  await wait(2500);
  scrollTo(0, document.documentElement.scrollHeight); await wait(1500);
  return { turns, height: document.documentElement.scrollHeight };
})()`;

const ADS = `(() => {
  const all = [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]')].filter((el, i, a) => a.indexOf(el) === i);
  const outer = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
  const kind = (el) => {
    const c = [...el.classList].filter((x) => x.startsWith('adthrive-') && x !== 'adthrive-ad');
    const base = c.map((x) => x.replace(/-\\d+$/, '')).find((x) => /^adthrive-(content|header|footer|sidebar|below-post|recipe|sticky|collapse|interstitial|outstream|player)/.test(x));
    return base || c[0] || (el.id || 'unclassed');
  };
  const article = document.querySelector('[data-playoffs-article]') || document.querySelector('.page-content');
  const bracket = document.querySelector('.po-bracket');
  const panels = document.querySelector('[data-series-panels]');
  const units = outer.map((el) => {
    const r = el.getBoundingClientRect();
    const frame = [...el.querySelectorAll('iframe')].find((f) => f.offsetWidth > 1 && f.offsetHeight > 1);
    const style = getComputedStyle(el);
    return {
      kind: kind(el), id: el.id || null, cls: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 120) : '',
      top: Math.round(r.top + scrollY), height: Math.round(r.height), width: Math.round(r.width),
      filled: !!frame, position: style.position,
      inArticle: !!(article && article.contains(el)),
      inBracket: !!(bracket && bracket.contains(el)),
      inPanels: !!(panels && panels.contains(el)),
      parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + (el.parentElement.dataset.playoffsArticle ? '[article]' : '') : null,
    };
  });
  const a = document.querySelector('article[data-playoffs-article]') || [...document.querySelectorAll('article')].sort((x, y) => y.offsetHeight - x.offsetHeight)[0] || null;
  return {
    adthrive: typeof window.adthrive === 'object' && window.adthrive ? Object.keys(window.adthrive).slice(0, 30) : null,
    script: !!document.querySelector('script[src*="ads.min.js"]'),
    units,
    articleHeight: a ? a.offsetHeight : null,
    articleChildren: a ? [...a.children].map((k) => k.tagName.toLowerCase() + ':' + k.offsetHeight + (String(k.className).includes('adthrive') ? ':ad' : '')) : [],
    wrapperHeight: (document.querySelector('.page-content') || {}).offsetHeight || null,
    viewport: innerHeight, width: innerWidth,
    asides: document.querySelectorAll('aside').length,
    // Against clientWidth, which does not grow. innerWidth does: on a phone a
    // page wider than the screen reports its own width there, and a
    // comparison against it can never fail.
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    docWidth: document.documentElement.scrollWidth,
    // What sticks out past the screen, and whether it is the page's own or
    // something the ad code put there. Elements clipped by a scroller of
    // their own are left out: they do not widen the document.
    sticksOut: (() => {
      const edge = document.documentElement.clientWidth + 1;
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= edge) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= edge) { clipped = true; break; }
        }
        if (clipped) continue;
        const ad = el.closest('.adthrive-ad, [id^="AdThrive_"], [class*="adthrive"], [id^="google_ads_iframe"]');
        out.push({ what: el.tagName.toLowerCase() + (el.id ? '#' + el.id.slice(0, 40) : '') + '.' + String(el.className.baseVal ?? el.className).split(' ').slice(0, 3).join('.'), right: Math.round(r.right), width: Math.round(r.width), ad: !!ad || el.tagName === 'IFRAME' });
      }
      return out;
    })(),
    pageHeight: document.documentElement.scrollHeight,
    bodyClass: document.body.className,
  };
})()`;

// Marks every ad container, watches the document, and reports what the
// selections did to them.
const WATCH = `(() => {
  const ads = [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]')];
  ads.forEach((el, i) => { el.__pnProbe = i + 1; });
  window.__pnAds = ads;
  window.__pnMoves = { added: 0, removed: 0, names: [] };
  const isAd = (n) => n.nodeType === 1 && ((n.matches && n.matches('.adthrive-ad, [id^="AdThrive_"]')) || (n.querySelector && n.querySelector('.adthrive-ad, [id^="AdThrive_"]')));
  window.__pnObserver = new MutationObserver((list) => {
    for (const m of list) {
      const root = document.querySelector('.po-bracket');
      const inside = root && (root === m.target || root.contains(m.target));
      for (const n of m.addedNodes) if (isAd(n)) { window.__pnMoves.added += 1; window.__pnMoves.names.push('+' + (n.id || n.className) + (inside ? ' in bracket' : '')); }
      for (const n of m.removedNodes) if (isAd(n)) { window.__pnMoves.removed += 1; window.__pnMoves.names.push('-' + (n.id || n.className) + (inside ? ' in bracket' : '')); }
    }
  });
  window.__pnObserver.observe(document.body, { childList: true, subtree: true });
  return ads.length;
})()`;
const SELECT_ALL = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let rounds = 0, series = 0, conferences = 0;
  const visible = (el) => el.offsetWidth > 0 && el.offsetHeight > 0;
  const tapSeries = async () => { for (const a of [...document.querySelectorAll('.po-bracket [data-series] a[href^="#"]')].filter(visible)) { a.click(); series += 1; await wait(200); } };
  const pills = [...document.querySelectorAll('[data-round-option]')].filter(visible);
  for (const b of pills) { b.click(); rounds += 1; await wait(200);
    for (const c of [...document.querySelectorAll('[data-conference-option]')].filter(visible)) { c.click(); conferences += 1; await wait(150); }
    await tapSeries();
  }
  // At desktop width every round is on screen and there are no pills.
  if (pills.length === 0) await tapSeries();
  const close = [...document.querySelectorAll('[data-panel-close]')].find(visible); if (close) { close.click(); await wait(200); }
  await wait(1500);
  const before = window.__pnAds;
  const now = [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]')];
  window.__pnObserver.disconnect();
  return {
    rounds, series, conferences,
    before: before.length, after: now.length,
    kept: before.filter((el) => el.isConnected).length,
    same: now.filter((el) => el.__pnProbe).length,
    moves: window.__pnMoves,
    inBracket: now.filter((el) => { const r = document.querySelector('.po-bracket'); return r && r.contains(el); }).length,
  };
})()`;

// The sticky round controls against anything the placer fixes to the screen.
const STICKY = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const controls = document.querySelector('.po-controls');
  const fixedAds = () => [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"], [class*="adthrive-sticky"], [class*="adthrive-footer"]')].filter((el) => { const p = getComputedStyle(el).position; return (p === 'fixed' || p === 'sticky') && el.offsetHeight > 0; });
  const out = { controls: !!controls, samples: [], overlaps: 0, fixed: [] };
  if (!controls) return out;
  const bracket = document.querySelector('.po-bracket');
  const top = bracket.getBoundingClientRect().top + scrollY;
  const end = top + bracket.offsetHeight;
  for (let y = Math.max(0, top - 200); y < end; y += 300) {
    scrollTo(0, y); await wait(250);
    const c = controls.getBoundingClientRect();
    for (const ad of fixedAds()) {
      const r = ad.getBoundingClientRect();
      const hit = c.bottom > r.top && c.top < r.bottom && c.right > r.left && c.left < r.right;
      if (hit) out.overlaps += 1;
      if (out.samples.length < 6) out.samples.push({ y, controls: [Math.round(c.top), Math.round(c.bottom)], ad: [Math.round(r.top), Math.round(r.bottom)], kind: String(ad.className).slice(0, 60), hit });
    }
  }
  out.fixed = fixedAds().map((el) => ({ cls: String(el.className).slice(0, 80), id: el.id, position: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top), height: el.offsetHeight }));
  // What covers the last row of the page when it is scrolled to the end.
  scrollTo(0, document.documentElement.scrollHeight); await wait(400);
  return out;
})()`;

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
}

const tally = (units) => { const t = {}; for (const u of units) t[u.kind] = (t[u.kind] || 0) + 1; return Object.entries(t).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'; };
const report = {};

async function measure(path, width, { playoffs }) {
  const label = `${path} @${width}`;
  await go(path, width);
  const scrolled = await ev(SCROLL);
  const m = await ev(ADS);
  report[label] = m;
  const adRequests = requests.filter((u) => /adthrive|raptive|cafemedia|doubleclick|googlesyndication|amazon-adsystem/.test(u));
  note(`${label}: ad script ${m.script ? 'in the document' : 'ABSENT'}, ${adRequests.length} requests to ad hosts, page ${m.pageHeight}px, ${scrolled.turns} scroll steps`);
  note(`${label}: containers ${m.units.length} (${tally(m.units)}), holding a creative ${m.units.filter((u) => u.filled).length}`);
  await shot(`${path.replace(/^\//, '').replace(/\//g, '_') || 'home'}-${width}-end`);
  if (!playoffs) {
    const a = m.sticksOut.filter((x) => x.ad);
    note(`${label} (control, a page already in production): document ${m.docWidth}px${a.length ? `, WIDENED BY AN AD: ${a.slice(0, 2).map((x) => `${x.what} ${x.width}px wide`).join('; ')}` : ''}`);
    return m;
  }
  const inContent = m.units.filter((u) => u.inArticle && u.position !== 'fixed');
  check(`${label}: ad script loaded`, m.script && adRequests.length > 0, `${adRequests.length} ad requests`);
  check(`${label}: in-content units inside the article${width < 600 ? ' (none is blocking)' : ''}`, inContent.length > 0, `${inContent.length} in the article, ${m.units.length} on the page`);
  const screen = width < 600 ? 844 : 900;
  check(`${label}: article taller than 1.5 viewports`, m.articleHeight > 1.5 * screen, `${m.articleHeight}px against ${Math.round(1.5 * screen)}px`);
  check(`${label}: no ad container inside the interactive bracket`, m.units.filter((u) => u.inBracket || u.inPanels).length === 0, `${m.units.filter((u) => u.inBracket || u.inPanels).length}`);
  const own = m.sticksOut.filter((x) => !x.ad);
  const fromAds = m.sticksOut.filter((x) => x.ad);
  check(`${label}: no aside, and nothing of the page's own is wider than the screen`, m.asides === 0 && own.length === 0, `asides ${m.asides}, document ${m.docWidth}px${own.length ? ', ' + own.slice(0, 3).map((x) => `${x.what} to ${x.right}px`).join('; ') : ''}`);
  if (fromAds.length) note(`${label}: WIDENED BY AN AD to ${m.docWidth}px: ${fromAds.slice(0, 2).map((x) => `${x.what} ${x.width}px wide, to ${x.right}px`).join('; ')}`);
  note(`${label}: article children ${m.articleChildren.join(' ')}`);
  if (path !== '/playoffs') {
    await ev('scrollTo(0, 0)'); await sleep(300);
    const marked = await ev(WATCH);
    const s = await ev(SELECT_ALL);
    check(`${label}: selecting every round and series leaves every ad container in place`, s.series > 0 && s.kept === s.before && s.after === s.before && s.same === s.after && s.moves.added === 0 && s.moves.removed === 0 && s.inBracket === 0,
      `${s.rounds} rounds, ${s.conferences} conference taps, ${s.series} series; containers ${s.before} before, ${s.after} after, ${s.kept} still attached; added ${s.moves.added}, removed ${s.moves.removed}${s.moves.names.length ? ' ' + s.moves.names.slice(0, 4).join(' ') : ''}`);
    if (marked === 0) note(`${label}: there was no ad container to watch, so the check above proves nothing about re-rendering`);
    if (width < 600) {
      const st = await ev(STICKY);
      check(`${label}: sticky round controls do not overlap a fixed ad`, st.controls && st.overlaps === 0, `${st.fixed.length} fixed ad elements, ${st.overlaps} overlaps`);
      for (const f of st.fixed) note(`${label}: fixed ${f.cls || f.id} top ${f.top} height ${f.height}`);
      for (const x of st.samples.slice(0, 3)) note(`${label}: at scroll ${x.y} controls ${x.controls.join('-')} ad ${x.ad.join('-')}`);
      await shot(`${path.replace(/^\//, '').replace(/\//g, '_')}-${width}-bracket`);
    }
  }
  const errors = consoleLines.filter((l) => /Minified React error|Hydration|hydrat/i.test(l));
  check(`${label}: no hydration error in the console`, errors.length === 0, errors[0] ? errors[0].slice(0, 120) : '');
  return m;
}

try {
  ws = new WebSocket(await target());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); return; }
    if (msg.method === 'Runtime.consoleAPICalled') consoleLines.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (msg.method === 'Runtime.exceptionThrown') consoleLines.push(String(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || ''));
    else if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
    else if (msg.method) events.push(msg);
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  // Analytics only. The ad hosts are left alone.
  await send('Network.setBlockedURLs', { urls: ['*posthog.com*', '*google-analytics.com*', '*analytics.google.com*', '*googletagmanager.com/gtag/*'] });
  if (SHARE) {
    events.length = 0; await send('Page.navigate', { url: SHARE }); await waitFor('Page.loadEventFired'); await sleep(1500);
    console.log('Opened the share link; the browser holds the access cookie.');
  }
  console.log(`BASE ${BASE}`);
  for (const width of [390, 1280]) {
    await measure(CONTROL, width, { playoffs: false });
    for (const path of ['/playoffs', '/playoffs/mlb', '/playoffs/wnba']) await measure(path, width, { playoffs: true });
  }
  writeFileSync(join(OUT, 'ads.json'), JSON.stringify(report, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks pass`);
  for (const f of failed) console.log(`FAILED  ${f.name}  [${f.detail}]`);
  process.exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('ERROR', e.message);
  process.exitCode = 2;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
