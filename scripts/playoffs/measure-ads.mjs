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
// DEPLOYED HOSTS ONLY. This script lets the ad code run, which is the point
// of it; every local run of every other script refuses the ad and analytics
// hosts at the network layer, and this one must not be pointed at a local
// server by mistake.
if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(BASE)) { console.error('measure-ads.mjs runs against a deployed host only; a local run would let the ad code load. Use measure-states.mjs or verify-bracket.mjs locally.'); process.exit(2); }
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
let ws, id = 0; const pending = new Map(); const events = []; const consoleLines = []; const requests = []; const responses = []; const requestUrls = new Map(); const blockedUrls = [];
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
  // The PromoNight Predicts section (scorecard, predicted bracket, title
  // odds) and the methodology: no unit may sit inside either.
  const picks = document.querySelector('[data-predictions="bracket"]');
  const method = document.querySelector('[data-predictions-methodology]');
  const hubCard = document.querySelector('[data-predictions="locked"]');
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
      inPicks: !!((picks && picks.contains(el)) || (method && method.contains(el))),
      inHubCard: !!(hubCard && hubCard.contains(el)),
      inPanels: !!(panels && panels.contains(el)),
      // The amended contract (Matt, 2026-10-02): no unit inside a <details>,
      // a bracket, the "where things stand" line, or any game row.
      inForbidden: !!el.closest('details, .po-bracket, .po-picks, [data-league-card], [data-standing], [data-home-game], [data-game], [data-result], [data-result-game]'),
      parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + (el.parentElement.dataset.playoffsArticle ? '[article]' : '') : null,
    };
  });
  const a = document.querySelector('article[data-playoffs-article]') || [...document.querySelectorAll('article')].sort((x, y) => y.offsetHeight - x.offsetHeight)[0] || null;
  return {
    hasPicks: !!picks, hasMethod: !!method, hasHubCard: !!hubCard,
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
  const pills = [...document.querySelectorAll('.po-bracket [data-round-option]')].filter(visible);
  for (const b of pills) { b.click(); rounds += 1; await wait(200);
    for (const c of [...document.querySelectorAll('.po-bracket [data-conference-option]')].filter(visible)) { c.click(); conferences += 1; await wait(150); }
    await tapSeries();
  }
  // At desktop width every round is on screen and there are no pills.
  if (pills.length === 0) await tapSeries();
  const close = [...document.querySelectorAll('[data-panel-close]')].find(visible); if (close) { close.click(); await wait(200); }
  // The predicted bracket: its pills, its toggle, and every pick opened.
  // Every pick opened: after each round and each conference, every summary
  // then visible that has not been opened yet. At desktop width there are no
  // controls and every pick is visible at once.
  let picksRounds = 0, picksConferences = 0;
  const opened = new Set();
  const openVisible = async () => { for (const d of [...document.querySelectorAll('.po-picks details')].filter(visible)) { if (opened.has(d.id)) continue; d.querySelector('summary').click(); opened.add(d.id); await wait(100); } };
  const pickPills = [...document.querySelectorAll('.po-picks [data-round-option]')].filter(visible);
  for (const b of pickPills) { b.click(); picksRounds += 1; await wait(200);
    const toggles = [...document.querySelectorAll('.po-picks [data-conference-option]')].filter(visible);
    if (toggles.length === 0) await openVisible();
    for (const c of toggles) { c.click(); picksConferences += 1; await wait(150); await openVisible(); }
  }
  if (pickPills.length === 0) await openVisible();
  const picksOpened = [...document.querySelectorAll('.po-picks details')].filter((d) => d.open).length;
  const picksTotal = document.querySelectorAll('.po-picks details').length;
  // The methodology's detail: collapsed as served, then opened like a reader.
  const md = document.querySelector('[data-methodology-detail]');
  const methodCollapsed = md ? !md.open : null;
  if (md && !md.open) { md.querySelector('summary').click(); await wait(300); }
  const methodOpened = md ? md.open : null;
  await wait(1500);
  const before = window.__pnAds;
  const now = [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]')];
  window.__pnObserver.disconnect();
  return {
    rounds, series, conferences, picksRounds, picksConferences, picksOpened, picksTotal, methodCollapsed, methodOpened,
    inMethodDetail: md ? now.filter((el) => md.contains(el)).length : null,
    inPicks: now.filter((el) => { const r = document.querySelector('[data-predictions="bracket"]'); const m = document.querySelector('[data-predictions-methodology]'); return (r && r.contains(el)) || (m && m.contains(el)); }).length,
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
  if (path !== '/playoffs') check(`${label}: the predictions section and the methodology are on the page, and no ad container is inside either`, m.hasPicks && m.hasMethod && m.units.filter((u) => u.inPicks).length === 0, `section ${m.hasPicks}, methodology ${m.hasMethod}, ${m.units.filter((u) => u.inPicks).length} inside`);
  else check(`${label}: the predictions card is on the hub, and no ad container is inside it`, m.hasHubCard && m.units.filter((u) => u.inHubCard).length === 0, `card ${m.hasHubCard}, ${m.units.filter((u) => u.inHubCard).length} inside`);
  check(`${label}: AD CONTRACT: no ad container inside a <details>, a bracket, the standing line or a game row`, m.units.filter((u) => u.inForbidden).length === 0, `${m.units.filter((u) => u.inForbidden).length} inside`);
  const own = m.sticksOut.filter((x) => !x.ad);
  const fromAds = m.sticksOut.filter((x) => x.ad);
  check(`${label}: no aside, and nothing of the page's own is wider than the screen`, m.asides === 0 && own.length === 0, `asides ${m.asides}, document ${m.docWidth}px${own.length ? ', ' + own.slice(0, 3).map((x) => `${x.what} to ${x.right}px`).join('; ') : ''}`);
  if (fromAds.length) note(`${label}: WIDENED BY AN AD to ${m.docWidth}px: ${fromAds.slice(0, 2).map((x) => `${x.what} ${x.width}px wide, to ${x.right}px`).join('; ')}`);
  note(`${label}: article children ${m.articleChildren.join(' ')}`);
  if (path !== '/playoffs') {
    await ev('scrollTo(0, 0)'); await sleep(300);
    const marked = await ev(WATCH);
    const s = await ev(SELECT_ALL);
    check(`${label}: selecting every round and series, in both brackets, and opening every pick leaves every ad container in place`, s.series > 0 && s.picksTotal > 0 && s.picksOpened === s.picksTotal && s.kept === s.before && s.after === s.before && s.same === s.after && s.moves.added === 0 && s.moves.removed === 0 && s.inBracket === 0 && s.inPicks === 0,
      `${s.rounds} rounds, ${s.conferences} conference taps, ${s.series} series; predicted: ${s.picksRounds} rounds, ${s.picksConferences} conference taps, ${s.picksOpened} of ${s.picksTotal} picks opened; containers ${s.before} before, ${s.after} after, ${s.kept} still attached; added ${s.moves.added}, removed ${s.moves.removed}${s.moves.names.length ? ' ' + s.moves.names.slice(0, 4).join(' ') : ''}`);
    check(`${label}: the methodology detail is collapsed as served, opens, and no ad container is inside it once open`, s.methodCollapsed === true && s.methodOpened === true && s.inMethodDetail === 0, `collapsed ${s.methodCollapsed}, opened ${s.methodOpened}, ${s.inMethodDetail} inside`);
    if (marked === 0) note(`${label}: there was no ad container to watch, so the check above proves nothing about re-rendering`);
    if (width < 600) {
      const st = await ev(STICKY);
      check(`${label}: sticky round controls do not overlap a fixed ad`, st.controls && st.overlaps === 0, `${st.fixed.length} fixed ad elements, ${st.overlaps} overlaps`);
      for (const f of st.fixed) note(`${label}: fixed ${f.cls || f.id} top ${f.top} height ${f.height}`);
      for (const x of st.samples.slice(0, 3)) note(`${label}: at scroll ${x.y} controls ${x.controls.join('-')} ad ${x.ad.join('-')}`);
      await shot(`${path.replace(/^\//, '').replace(/\//g, '_')}-${width}-bracket`);
    }
  }
  // The amended contract again, with everything that opens opened and left
  // open: every <details>, every "Show N more" button, a series panel on a
  // league page. Nothing may have landed inside what opened.
  const opened = await ev(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let n = 0;
    for (const d of document.querySelectorAll('details')) if (!d.open) { d.open = true; n++; }
    for (const b of document.querySelectorAll('[data-show-all]')) if (b.offsetWidth > 0) { b.click(); n++; await wait(150); }
    const a = [...document.querySelectorAll('.po-bracket [data-series] a[href^="#"]')].find((x) => x.offsetWidth > 0);
    if (a) { a.click(); n++; }
    // Read the page again with everything open, the way the placer fills it.
    let y = 0;
    while (y < document.documentElement.scrollHeight - innerHeight) { y += Math.round(innerHeight * 0.6); scrollTo(0, y); await wait(300); }
    await wait(2500);
    const sel = 'details, .po-bracket, .po-picks, [data-league-card], [data-standing], [data-home-game], [data-game], [data-result], [data-result-game]';
    const openable = document.querySelectorAll('details').length + document.querySelectorAll('[data-show-all]').length + (a ? 1 : 0);
    return { opened: n, openable, inside: [...document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"]')].filter((el) => el.closest(sel)).length };
  })()`);
  check(`${label}: AD CONTRACT: no ad container inside a <details>, a bracket, the standing line or a game row, with everything opened`, (opened.openable === 0 || opened.opened > 0) && opened.inside === 0, `${opened.opened} opened of ${opened.openable} openable${opened.openable === 0 ? ' (nothing to open)' : ''}, ${opened.inside} inside`);
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
    else if (msg.method === 'Network.requestWillBeSent') { requests.push(msg.params.request.url); requestUrls.set(msg.params.requestId, msg.params.request.url); }
    else if (msg.method === 'Network.loadingFailed' && msg.params.blockedReason) blockedUrls.push(requestUrls.get(msg.params.requestId) || '');
    else if (msg.method === 'Network.responseReceived') responses.push(msg.params.response.url);
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
  // PRE-AD. The ad placer sizes what it places from the article's height
  // before any unit is in it. With the ad hosts blocked as well, nothing can
  // add to the article: the height measured is the one the placer reads.
  const ANALYTICS = ['*posthog.com*', '*google-analytics.com*', '*analytics.google.com*', '*googletagmanager.com/gtag/*'];
  const ADS_HOSTS = ['*adthrive*', '*raptive*', '*cafemedia*', '*doubleclick*', '*googlesyndication*', '*amazon-adsystem*', '*securepubads*'];
  await send('Network.setBlockedURLs', { urls: [...ANALYTICS, ...ADS_HOSTS] });
  for (const path of ['/playoffs', '/playoffs/mlb', '/playoffs/wnba']) {
    const from = responses.length;
    const blockedFrom = blockedUrls.length;
    await go(path, 390);
    const answered = responses.slice(from).filter((u) => /adthrive|raptive|cafemedia|doubleclick|googlesyndication|amazon-adsystem|securepubads/.test(u));
    const blocked = blockedUrls.slice(blockedFrom).filter((u) => /adthrive/.test(u));
    const pre = await ev(`(() => { const a = document.querySelector('article[data-playoffs-article]'); return { height: a ? Math.round(a.getBoundingClientRect().height) : 0, ads: document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"], [class*="adthrive"]').length, runtime: typeof window.adthrive !== 'undefined' && !!window.adthrive && !!window.adthrive.siteAds, region: a ? a.getAttribute('data-ad-region') : null, pageContent: a ? a.classList.contains('page-content') : false }; })()`);
    // The page asked for the ad script and Chrome refused it, no ad host
    // answered, the ad runtime never started and no ad container exists: so
    // the height below is the one the placer reads before it places a unit.
    check(`${path} @390 PRE-AD: the ad script was requested and blocked; no ad host answered; no ad container`, blocked.length > 0 && answered.length === 0 && pre.ads === 0, `${blocked.length} blocked ad-script requests, ${answered.length} ad-host responses, ${pre.ads} containers`);
    // Information only: which field Raptive's runtime sets is not verified.
    note(`${path} @390 PRE-AD: window.adthrive.siteAds present: ${pre.runtime}`);
    check(`${path} @390 PRE-AD: article data-ad-region="content" intact and at least 1000px`, pre.region === 'content' && pre.pageContent && pre.height >= 1000, `${pre.height}px`);
  }
  await send('Network.setBlockedURLs', { urls: ANALYTICS });
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
