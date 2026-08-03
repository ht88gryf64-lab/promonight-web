'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureCard } from '@/components/capture/CaptureCard';
import { EMPTY_CHIP_POOL } from '@/lib/capture/chips';

// DEV-ONLY INSTRUMENT for docs/known-issues.md entry 10.
//
// Entry 10's whole point is that width measurements taken in the layout
// coordinate system read identically under the healthy and the broken state, so
// this page reports the ONLY instruments that distinguish them:
// visualViewport.scale / .width / .offsetLeft, alongside the panel's
// getBoundingClientRect(). Healthy is visualViewport.width === rect.width.
//
// It renders the REAL CaptureCard, not a mock, because a mock would re-measure
// the mock. The trigger engine is bypassed deliberately: 45 seconds of engaged
// time plus gesture bursts is the wrong gate for a geometry pass.
//
// The font-size ladder is how this reaches high page scales without a pinch
// gesture, which is not scriptable in the simulator. iOS zooms a focused text
// control under 16px by roughly 16/font-size, so tapping the 9px field forces
// ~1.78 and the 13px field forces ~1.23. That sweeps the derived bounds using
// only a real WebKit behaviour.
//
// Measurements POST to a logger outside the repo rather than rendering to
// screen, because a readout inside a clipped viewport is exactly as unreadable
// as the bug under test.

const LOGGER = 'http://localhost:4555/log';

const LADDER = [16, 14, 13, 11, 9] as const;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

function box(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: +r.left.toFixed(2),
    right: +r.right.toFixed(2),
    top: +r.top.toFixed(2),
    bottom: +r.bottom.toFixed(2),
    width: +r.width.toFixed(2),
    height: +r.height.toFixed(2),
  };
}

export function CaptureProbeClient({ autofocusId }: { autofocusId?: string }) {
  const [label, setLabel] = useState('rest');
  const labelRef = useRef(label);
  labelRef.current = label;

  const report = useCallback((why: string) => {
    const vv = window.visualViewport;
    const panel = document.querySelector('[role="dialog"]');
    const handle = panel?.querySelector('button[aria-hidden="true"]') ?? null;
    const x = panel?.querySelector('button[aria-label="Close"]') ?? null;

    const p = box(panel);
    const vvBox = vv
      ? {
          scale: +vv.scale.toFixed(4),
          width: +vv.width.toFixed(2),
          height: +vv.height.toFixed(2),
          offsetLeft: +vv.offsetLeft.toFixed(2),
          offsetTop: +vv.offsetTop.toFixed(2),
        }
      : null;

    // A control is visible when its far edge is inside the visual viewport's
    // window into the layout viewport. Both are already in layout CSS px.
    const visible = (b: Box | null) =>
      b && vvBox
        ? {
            horizontally: b.right <= vvBox.offsetLeft + vvBox.width && b.left >= vvBox.offsetLeft,
            vertically: b.top < vvBox.offsetTop + vvBox.height && b.bottom > vvBox.offsetTop,
            pxPastRightEdge: +(b.right - (vvBox.offsetLeft + vvBox.width)).toFixed(2),
            pxBelowBottomEdge: +(b.top - (vvBox.offsetTop + vvBox.height)).toFixed(2),
          }
        : null;

    const payload = {
      label: labelRef.current,
      why,
      ua: navigator.userAgent,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
      vv: vvBox,
      panel: p,
      handle: box(handle),
      x: box(x),
      // THE entry-10 verdict, computed rather than eyeballed.
      healthy: vvBox && p ? Math.abs(vvBox.width - p.width) < 0.5 : null,
      panelVisible: visible(p),
      handleVisible: visible(box(handle)),
      xVisible: visible(box(x)),
      // The submit button and the always-rendered error row, for the 240px
      // floor check on short viewports.
      submit: box(panel?.querySelector('button[type="submit"]') ?? null),
      errorRow: box(panel?.querySelector('[role="alert"]') ?? null),
      scroller: box(panel?.querySelector('.overflow-y-auto') ?? null),
      emailInput: box(document.getElementById('capture-sheet-email')),
      ladder: Object.fromEntries(
        LADDER.map((n) => [n, box(document.getElementById(`ladder-${n}`))]),
      ),
      activeElement: document.activeElement?.id || document.activeElement?.tagName || null,
    };

    void fetch(LOGGER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => report('visualviewport');
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    const t = window.setTimeout(() => report('initial'), 600);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
      window.clearTimeout(t);
    };
  }, [report]);

  // Does a PROGRAMMATIC focus produce a zoom on real WebKit? iOS is documented
  // as ignoring focus() outside a user gesture for keyboard purposes; this is
  // the cheap way to find out rather than assuming. If it does nothing, the
  // scale sweep falls back to initial-scale, which reaches the same
  // layout-vs-visual split without needing a gesture at all.
  useEffect(() => {
    if (!autofocusId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(autofocusId) as HTMLInputElement | null;
      el?.focus();
      setLabel(`programmatic-focus-${autofocusId}`);
      window.setTimeout(() => report(`after-programmatic-focus-${autofocusId}`), 1200);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [autofocusId, report]);

  // Calibration channel. The host drives taps by screen coordinate and has no
  // way to know where that lands in page coordinates; this closes the loop so
  // the mapping is solved from two observations instead of assumed.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      void fetch(LOGGER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'tap',
          why: 'pointerdown',
          tap: { clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY },
          target: (e.target as Element)?.id || (e.target as Element)?.tagName,
          vv: window.visualViewport
            ? { scale: window.visualViewport.scale, width: window.visualViewport.width }
            : null,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <main style={{ minHeight: '200vh', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>capture probe</h1>
      <p style={{ fontSize: 16 }}>
        Tap a field to force a focus zoom, then tap REPORT. Measurements go to :4555.
      </p>

      {/* The ladder. Each field is a real text input at a declared size, so
          tapping it produces a genuine WebKit focus zoom of ~16/size. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {LADDER.map((size) => (
          <input
            key={size}
            id={`ladder-${size}`}
            type="text"
            placeholder={`${size}px -> scale ~${(16 / size).toFixed(2)}`}
            style={{
              fontSize: `${size}px`,
              padding: 10,
              border: '1px solid #999',
              borderRadius: 8,
              width: '100%',
            }}
            onFocus={() => {
              setLabel(`focus-${size}px`);
              window.setTimeout(() => report(`focused-${size}px`), 700);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => report('manual')}
        style={{
          marginTop: 16,
          padding: '14px 20px',
          fontSize: 17,
          fontWeight: 700,
          borderRadius: 10,
          background: '#111',
          color: '#fff',
        }}
      >
        REPORT
      </button>

      <p style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
        Scroll room below so the page is pannable at scale.
      </p>

      <CaptureCard
        context={{
          surface: 'web_engagement_capture',
          page_type: 'team_page',
          team_id: 'detroit-tigers',
          variant: 'variant_a',
        }}
        team={{
          id: 'detroit-tigers',
          name: 'Tigers',
          displayName: 'Detroit Tigers',
          league: 'MLB',
          sportSlug: 'mlb',
        }}
        pool={EMPTY_CHIP_POOL}
        expandedOpponentIds={[]}
      />
    </main>
  );
}
