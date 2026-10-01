// Browser checks for the team-page PromoNight Predicts line, the hub hero
// line and the playoffs back link, on a deployed host.
//
//   BASE=https://<preview> PROD=https://www.getpromonight.com OUT=<dir> \
//     SHARE=<share link> node scripts/playoffs/measure-team-picks.mjs
//
// Two passes.
//   CLIPS  ad and analytics hosts blocked. Element-clipped screenshots at 390
//          and 1280 of the module on one team page per state, the hub hero,
//          and the back link; and the layout facts the ad placer reads: the
//          direct children of the team page's weave shell and of the hubs'
//          page-content wrapper, on BASE and on PROD.
//   ADS    analytics blocked, ad hosts NOT blocked, at 390, on BASE and PROD:
//          where the first in-content unit lands on the Braves and the
//          Valkyries pages, which child it follows, and how far it moved.
//
// DEPLOYED HOSTS ONLY: the ADS pass lets the ad code run.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const PROD = (process.env.PROD || 'https://www.getpromonight.com').replace(/\/$/, '');
const OUT = process.env.OUT;
const SHARE = process.env.SHARE || '';
if (!BASE || !OUT) { console.error('Set BASE and OUT.'); process.exit(2); }
if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE) && !process.env.NO_ADS) { console.error('Deployed hosts only, or set NO_ADS=1 to skip the ads pass.'); process.exit(2); }
mkdirSync(join(OUT, 'clips'), { recursive: true });

const PORT = 9372;
const profile = mkdtempSync(join(tmpdir(), 'pn-teampicks-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };
const note = (s) => console.log(`      ${s}`);

let ws, id = 0; const pending = new Map(); const events = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const waitFor = async (name, ms = 60000) => { const end = Date.now() + ms; for (;;) { const k = events.findIndex((e) => e.method === name); if (k >= 0) { events.splice(k, 1); return; } if (Date.now() > end) throw new Error('timeout ' + name); await sleep(50); } };

const ANALYTICS = ['*posthog*', '*google-analytics*', '*googletagmanager*', '*vercel-insights*', '*/_vercel/insights*', '*/_vercel/speed-insights*', '*clarity.ms*', '*facebook*'];
const ADS = ['*adthrive*', '*raptive*', '*cafemedia*', '*doubleclick*', '*googlesyndication*', '*amazon-adsystem*', '*securepubads*'];

async function go(origin, path, width, blockAds) {
  await send('Network.setBlockedURLs', { urls: blockAds ? [...ANALYTICS, ...ADS] : ANALYTICS });
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 2, mobile: width < 600 });
  events.length = 0; await send('Page.navigate', { url: 'about:blank' }); await waitFor('Page.loadEventFired');
  events.length = 0; await send('Page.navigate', { url: `${origin}${path}` }); await waitFor('Page.loadEventFired'); await sleep(2500);
}

async function clip(selector, file) {
  const box = await ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
  if (!box) return null;
  // A sticky bar painted over the element would be in the clip: hide every
  // fixed or sticky element for the shot.
  await ev(`(() => { for (const e of document.querySelectorAll('body *')) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') e.style.visibility = 'hidden'; } })()`);
  await sleep(400);
  const pad = 12;
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + 2 * pad, height: box.h + 2 * pad, scale: 1 } });
  writeFileSync(join(OUT, 'clips', file), Buffer.from(shot.data, 'base64'));
  return box;
}

const LAYOUT = `(() => {
  const y = (e) => Math.round(e.getBoundingClientRect().top + scrollY);
  const shell = document.querySelector('.rd-weave-shell');
  const pc = document.querySelector('.page-content');
  const mod = document.querySelector('[data-playoffs-module="team"]');
  const pick = document.querySelector('[data-team-pick]');
  return {
    shellChildren: shell ? [...shell.children].map((c) => String(c.className).split(' ').filter((k) => /^rd-weave-item|^order-/.test(k)).join(' ')) : null,
    pageContentChildren: pc ? pc.children.length : null,
    module: mod ? { y: y(mod), h: Math.round(mod.getBoundingClientRect().height) } : null,
    pick: pick ? { kind: pick.getAttribute('data-team-pick'), h: Math.round(pick.getBoundingClientRect().height) } : null,
    ads: document.querySelectorAll('.adthrive-ad, [id^="AdThrive_"], [class*="adthrive"]').length,
    asides: document.querySelectorAll('aside').length,
  };
})()`;

const FIRST_UNIT = `(() => {
  const y = (e) => Math.round(e.getBoundingClientRect().top + scrollY);
  const e = [...document.querySelectorAll('.adthrive-ad')].find((x) => x.classList.contains('adthrive-content-1'));
  const mod = document.querySelector('[data-playoffs-module="team"]');
  const pick = document.querySelector('[data-team-pick]');
  const units = [...document.querySelectorAll('.adthrive-ad')].filter((x) => /adthrive-content-\\d/.test(x.className)).length;
  if (!e) return { found: false, units };
  const p = e.parentElement;
  return { found: true, y: y(e), units, parentCls: String(p.className).slice(0, 60), idx: [...p.children].indexOf(e), moduleIdx: mod ? [...p.children].findIndex((c) => c.contains(mod)) : -1, prevCls: e.previousElementSibling ? String(e.previousElementSibling.className).split(' ').filter((k) => /^order-/.test(k)).join(' ') : null, moduleH: mod ? Math.round(mod.getBoundingClientRect().height) : null, pickH: pick ? Math.round(pick.getBoundingClientRect().height) : 0 };
})()`;

const STATES = [
  ['alive', '/mlb/atlanta-braves'], ['decides', '/mlb/philadelphia-phillies'], ['correct', '/mlb/boston-red-sox'],
  ['busted-earlier', '/mlb/houston-astros'], ['busted-further', '/mlb/chicago-white-sox'],
  ['alive', '/wnba/golden-state-valkyries'], ['decides', '/wnba/atlanta-dream'], ['correct', '/wnba/washington-mystics'],
  ['busted-earlier', '/wnba/minnesota-lynx'], ['busted-further', '/wnba/new-york-liberty'],
];

async function main() {
  let url;
  for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find((t) => t.type === 'page'); if (p) { url = p.webSocketDebuggerUrl; break; } } catch {} await sleep(200); }
  ws = new WebSocket(url); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); } else events.push(msg); };
  await send('Page.enable'); await send('Network.enable');
  if (SHARE) { events.length = 0; await send('Page.navigate', { url: SHARE }); await waitFor('Page.loadEventFired'); await sleep(1500); check('share link opened', true); }

  // ---- CLIPS ----
  for (const width of [390, 1280]) {
    for (const [state, path] of STATES) {
      await go(BASE, path, width, true);
      const lay = await ev(LAYOUT);
      // busted-earlier and busted-further are both kind "busted".
      const want = state.startsWith('busted') ? 'busted' : state;
      check(`${path} @${width}: the line is there, kind ${want} (${state})`, lay.pick !== null && lay.pick.kind === want, lay.pick ? `${lay.pick.kind}, ${lay.pick.h}px` : 'none');
      check(`${path} @${width}: no ad container, no aside with ads blocked`, lay.ads === 0);
      const box = await clip('[data-playoffs-module="team"]', `team-${width}-${state}-${path.split('/')[2]}.png`);
      check(`${path} @${width}: module clipped`, !!box);
      if (width === 390 && (path === '/mlb/atlanta-braves' || path === '/wnba/golden-state-valkyries')) {
        await go(PROD, path, width, true);
        const prod = await ev(LAYOUT);
        check(`${path} @390: the weave shell's children are production's`, JSON.stringify(prod.shellChildren) === JSON.stringify(lay.shellChildren), `${lay.shellChildren?.length} vs ${prod.shellChildren?.length}`);
        note(`${path} @390: module ${lay.module?.h}px here, ${prod.module?.h}px in production; line ${lay.pick?.h}px`);
      }
    }
    for (const lg of ['mlb', 'wnba']) {
      await go(BASE, `/${lg}`, width, true);
      const hero = await ev(`(() => { const p = document.querySelector('[data-playoffs-hero]'); const pc = document.querySelector('.page-content'); if (!p) return null; const r = p.getBoundingClientRect(); return { text: p.innerText.trim(), href: p.querySelector('a')?.getAttribute('href'), y: Math.round(r.top + scrollY), inPageContent: !!(pc && pc.contains(p)), pcChildren: pc ? pc.children.length : null }; })()`);
      check(`/${lg} @${width}: hero line`, !!hero && /^2026 (MLB|WNBA) Playoffs: .+\. Open the bracket$/.test(hero.text) && hero.href === `/playoffs/${lg}`, hero ? `${hero.text} @ ${hero.y}px` : 'none');
      check(`/${lg} @${width}: hero line outside page-content`, !!hero && !hero.inPageContent);
      if (width === 390 && hero) check(`/${lg} @390: hero line on the first screen`, hero.y < 844, `${hero.y}px`);
      await go(PROD, `/${lg}`, width, true);
      const prodPc = await ev(`document.querySelector('.page-content')?.children.length ?? null`);
      check(`/${lg} @${width}: page-content children are production's`, hero && prodPc === hero.pcChildren, `${hero?.pcChildren} vs ${prodPc}`);
      await go(BASE, `/${lg}`, width, true);
      await clip('section.relative.overflow-hidden', `hub-hero-${width}-${lg}.png`);
      await go(BASE, `/playoffs/${lg}`, width, true);
      const back = await ev(`(() => { const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/${lg}' && x.innerText.trim().toUpperCase() === 'ALL ${lg.toUpperCase()} PROMOTIONS'); const art = document.querySelector('article'); return a ? { inArticle: !!(art && art.contains(a)) } : null; })()`);
      check(`/playoffs/${lg} @${width}: back link to /${lg}, outside the article`, !!back && !back.inArticle);
      await ev(`(() => { const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/${lg}' && /promotions/i.test(x.innerText)); if (a) a.closest('p').setAttribute('data-backlink-clip', ''); })()`);
      await clip('[data-backlink-clip]', `backlink-${width}-${lg}.png`);
    }
  }

  // ---- ADS ----
  if (!process.env.NO_ADS) {
    for (const path of ['/mlb/atlanta-braves', '/wnba/golden-state-valkyries']) {
      const got = {};
      for (const [name, origin] of [['preview', BASE], ['production', PROD]]) {
        await go(origin, path, 390, false);
        const H = await ev('document.documentElement.scrollHeight');
        for (let s = 0; s < H; s += 600) { await ev(`scrollTo(0, ${s})`); await sleep(250); }
        await ev('scrollTo(0, 0)'); await sleep(2500);
        got[name] = await ev(FIRST_UNIT);
        note(`${path} @390 ${name}: ${JSON.stringify(got[name])}`);
      }
      const a = got.preview, b = got.production;
      check(`${path} @390: a first in-content unit on both`, a.found && b.found);
      if (a.found && b.found) {
        check(`${path} @390: the first unit follows the same child of the same parent`, a.idx === b.idx && a.prevCls === b.prevCls && a.parentCls === b.parentCls, `${a.idx}/${a.prevCls} vs ${b.idx}/${b.prevCls}`);
        check(`${path} @390: the module is the same child`, a.moduleIdx === b.moduleIdx, `${a.moduleIdx} vs ${b.moduleIdx}`);
        note(`${path} @390: first in-content unit at ${a.y}px on the preview, ${b.y}px in production: moved ${a.y - b.y}px; the line is ${a.pickH}px, the module ${a.moduleH}px vs ${b.moduleH}px`);
      }
    }
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  ws.close(); chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
