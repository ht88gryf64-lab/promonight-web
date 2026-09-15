#!/usr/bin/env python3
"""Core Web Vitals lab capture, the protocol pinned in audit/pre-ad-cwv-baseline.md.

WHY THIS FILE EXISTS. Baseline A and Baseline B were captured on 2026-09-05 by a
harness that was never committed. The protocol was written down in unusual
detail; the code that ran it was not. This is a REBUILD from that written
protocol, added 2026-09-06 so the next capture is a command rather than an
archaeology exercise.

It follows every detail the doc pins: Chrome 152.0.7977.76 --headless=new with
the listed flags and a fresh user-data-dir, one browser process for the whole
run, CDP 1.3 over a raw websocket, production only, HTTP cache disabled for
every navigation including warmup, the two emulation profiles, all twelve
measurements warmed before any is captured in the same order they are captured,
LCP/CLS from a buffered PerformanceObserver read after a 4s settle, CLS by the
session-window algorithm excluding hadRecentInput, and INP from CDP-dispatched
trusted input with durationThreshold 16 reported as the maximum.

WHERE IT NECESSARILY DIVERGES, because the doc does not specify it:
  - the interleaving of the 4 Tab pairs and 3 clicks (here: 4 Tab pairs first,
    then 3 clicks, uniformly 350ms apart)
  - the elementFromPoint viewport walk's start point, step and order (here: a
    top-left to bottom-right raster at 40px steps inside a 5% inset)
  - CDP call ordering and per-call timeouts
  - how FCP was obtained (here: the first-contentful-paint entry from
    performance.getEntriesByType('paint'))

2026-09-15: the desktop UA is now set explicitly to Browser.getVersion's
userAgent. It previously sent the empty string, which is a distinct header
value rather than the protocol's "cleared", and the file it feeds names that
as the cause of the unusable desktop half of the 2026-09-06 Baseline C.
Those four are why a run from this file is a RECONSTRUCTION. LCP, CLS, FCP and
TTFB are insensitive to all four. INP is not, and the doc already rules INP
directional only.

Usage:
  python3 scripts/capture-cwv-baseline.py [--out results.json]
"""
import argparse, json, os, shutil, socket, subprocess, sys, tempfile, time
from urllib.request import urlopen

from websockets.sync.client import connect

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ORIGIN = "https://www.getpromonight.com"
PATHS = [
    "/mlb/minnesota-twins",
    "/nhl/dallas-stars",
    "/venues/td-garden",
    "/venues/fenway-park",
    "/cfb/alabama",
    "/promos/this-week",
]
PROFILES = {
    "mobile": {
        "metrics": {"width": 412, "height": 823, "deviceScaleFactor": 1.75, "mobile": True},
        "ua": ("Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36"),
        "net": {"offline": False, "downloadThroughput": 209715,
                "uploadThroughput": 96000, "latency": 150},
        "cpu": 4,
    },
    "desktop": {
        "metrics": {"width": 1350, "height": 940, "deviceScaleFactor": 1.0, "mobile": False},
        "ua": None,
        "net": {"offline": False, "downloadThroughput": 1342177280,
                "uploadThroughput": 1342177280, "latency": 40},
        "cpu": 1,
    },
}
# 6 mobile first, then 6 desktop. Fixed, and part of the protocol.
ORDER = [(s, p) for s in ("mobile", "desktop") for p in PATHS]

METRICS_JS = r"""
(() => new Promise((resolve) => {
  const out = { lcp: null, cls: 0, fcp: null };
  try {
    new PerformanceObserver((l) => {
      const es = l.getEntries();
      if (es.length) out.lcp = es[es.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  // Session-window CLS: 5s window, 1s gap, hadRecentInput excluded.
  try {
    let cur = 0, first = 0, last = 0, max = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        if (cur && (e.startTime - last > 1000 || e.startTime - first > 5000)) {
          max = Math.max(max, cur); cur = 0;
        }
        if (!cur) first = e.startTime;
        last = e.startTime; cur += e.value;
      }
      out.cls = Math.max(max, cur);
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    const p = performance.getEntriesByType('paint')
      .find((e) => e.name === 'first-contentful-paint');
    if (p) out.fcp = p.startTime;
  } catch (e) {}
  // INP collector, armed before any input is dispatched.
  window.__inp = { max: 0, n: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (typeof e.interactionId === 'number' && e.interactionId > 0) {
          window.__inp.n += 1;
          window.__inp.max = Math.max(window.__inp.max, e.duration);
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) {}
  setTimeout(() => resolve(out), 4000);
}))()
"""

# Raster the viewport for the first point whose element has no interactive
# ancestor, so the dispatched clicks cannot navigate or activate a control.
POINT_JS = r"""
(() => {
  const SEL = 'a,button,input,select,textarea,[role=button],[onclick],summary,dialog';
  const W = innerWidth, H = innerHeight;
  const x0 = Math.round(W * 0.05), x1 = Math.round(W * 0.95);
  const y0 = Math.round(H * 0.05), y1 = Math.round(H * 0.95);
  for (let y = y0; y <= y1; y += 40) {
    for (let x = x0; x <= x1; x += 40) {
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest(SEL)) return { x, y };
    }
  }
  return { x: Math.round(W / 2), y: Math.round(H / 2) };
})()
"""


class CDP:
    def __init__(self, ws_url):
        self.ws = connect(ws_url, max_size=None, open_timeout=30)
        self.i = 0

    def send(self, method, params=None, timeout=120):
        self.i += 1
        mid = self.i
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.ws.recv(timeout=max(1, deadline - time.time())))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
        raise TimeoutError(method)

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def launch():
    profile = tempfile.mkdtemp(prefix="cwv-chrome-")
    port = free_port()
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={port}",
         f"--user-data-dir={profile}", "--no-first-run",
         "--no-default-browser-check", "--disable-extensions",
         "--hide-scrollbars", "--mute-audio", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        try:
            urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1).read()
            break
        except Exception:
            time.sleep(0.5)
    else:
        raise RuntimeError("chrome did not expose the devtools endpoint")
    tabs = json.loads(urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5).read())
    page = next(t for t in tabs if t.get("type") == "page")
    return proc, profile, port, CDP(page["webSocketDebuggerUrl"])


def native_ua(cdp):
    """The browser's own UA string, via Browser.getVersion.

    The protocol says the desktop profile runs with the UA "cleared (native
    desktop UA)". There is no clearUserAgentOverride in CDP, and one Chrome
    process serves the whole run with mobile captured first, so the Pixel 5
    override persists into desktop unless something puts it back. This reads
    what Chrome would send on its own and sets that.
    """
    return cdp.send("Browser.getVersion")["userAgent"]


def apply_profile(cdp, strategy, desktop_ua):
    p = PROFILES[strategy]
    cdp.send("Emulation.setDeviceMetricsOverride", p["metrics"])
    # p["ua"] None means the protocol's "cleared": restore the native desktop
    # UA. Sending "" here is NOT the same call - an empty UA is its own header
    # value, and it is what made the 2026-09-06 desktop half unusable.
    cdp.send("Emulation.setUserAgentOverride",
             {"userAgent": p["ua"] or desktop_ua})
    cdp.send("Network.emulateNetworkConditions", p["net"])
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": p["cpu"]})
    # Disabled for EVERY navigation, warmup included.
    cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})


def ttfb(cdp):
    r = cdp.send("Runtime.evaluate", {
        "expression": "(()=>{const n=performance.getEntriesByType('navigation')[0];"
                      "return n?n.responseStart-n.requestStart:null})()",
        "returnByValue": True})
    return r.get("result", {}).get("value")


def wait_for_load(cdp, url, timeout=180):
    """Block until the NEW document has committed and finished loading.

    Page.navigate returns as soon as navigation starts. Evaluating before the
    commit runs the expression in the OUTGOING document, which silently yields
    that document's timings and leaves any window state on a context about to
    be destroyed. That is a wrong-number bug, not a crash, so it is waited out
    explicitly rather than slept past.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = cdp.send("Runtime.evaluate", {
                "expression": "[location.href, document.readyState]",
                "returnByValue": True}, timeout=30)
            href, state = r["result"]["value"]
            if href.split("#")[0].split("?")[0] == url and state == "complete":
                return
        except Exception:
            pass
        time.sleep(0.25)
    raise TimeoutError(f"load never completed: {url}")


def navigate(cdp, url, settle):
    cdp.send("Page.navigate", {"url": url})
    wait_for_load(cdp, url)
    time.sleep(settle)


def capture(cdp, url):
    cdp.send("Page.navigate", {"url": url})
    wait_for_load(cdp, url)
    r = cdp.send("Runtime.evaluate", {
        "expression": METRICS_JS, "awaitPromise": True, "returnByValue": True},
        timeout=180)
    m = r["result"].get("value")
    if not isinstance(m, dict) or "lcp" not in m:
        raise RuntimeError(f"metrics probe returned {r['result']!r} for {url}")
    warm = ttfb(cdp)
    pt = cdp.send("Runtime.evaluate", {"expression": POINT_JS, "returnByValue": True})
    pt = pt["result"]["value"]
    # 4 Tab keydown/keyup pairs, then 3 clicks, 350ms apart. Trusted input.
    for _ in range(4):
        for t in ("keyDown", "keyUp"):
            cdp.send("Input.dispatchKeyEvent", {
                "type": t, "windowsVirtualKeyCode": 9, "nativeVirtualKeyCode": 9,
                "key": "Tab", "code": "Tab"})
        time.sleep(0.35)
    for _ in range(3):
        for t in ("mousePressed", "mouseReleased"):
            cdp.send("Input.dispatchMouseEvent", {
                "type": t, "x": pt["x"], "y": pt["y"], "button": "left",
                "clickCount": 1})
        time.sleep(0.35)
    inp = cdp.send("Runtime.evaluate", {
        "expression": "new Promise(r=>setTimeout(()=>r(window.__inp||{max:0,n:0}),1000))",
        "awaitPromise": True, "returnByValue": True})["result"].get(
            "value", {"max": 0, "n": 0})
    return {"lcp": m["lcp"], "cls": m["cls"], "fcp": m["fcp"],
            "inp": inp["max"], "interactions": inp["n"], "warm_ttfb": warm}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="cwv-capture.json")
    args = ap.parse_args()

    proc, profile, port, cdp = launch()
    try:
        cdp.send("Page.enable"); cdp.send("Network.enable"); cdp.send("Runtime.enable")
        desktop_ua = native_ua(cdp)
        print(f"native desktop UA: {desktop_ua}", flush=True)
        cold = {}
        print("warmup: all twelve, in capture order", flush=True)
        for strategy, path in ORDER:
            apply_profile(cdp, strategy, desktop_ua)
            navigate(cdp, ORIGIN + path, 2.5)
            cold[(strategy, path)] = ttfb(cdp)
            print(f"  warmed {strategy:7s} {path:26s} cold_ttfb={cold[(strategy,path)]}", flush=True)

        rows = []
        print("\ncapture", flush=True)
        for strategy, path in ORDER:
            apply_profile(cdp, strategy, desktop_ua)
            r = capture(cdp, ORIGIN + path)
            r.update({"strategy": strategy, "url": path,
                      "cold_ttfb": cold[(strategy, path)]})
            rows.append(r)
            print(f"  {strategy:7s} {path:26s} LCP={r['lcp']:.0f} CLS={r['cls']:.4f} "
                  f"INP={r['inp']:.0f} FCP={r['fcp']:.0f} n={r['interactions']}", flush=True)

        json.dump({"origin": ORIGIN, "rows": rows}, open(args.out, "w"), indent=2)
        print(f"\nwrote {args.out}")
    finally:
        cdp.close()
        proc.terminate()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
