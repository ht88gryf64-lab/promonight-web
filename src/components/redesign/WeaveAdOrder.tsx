'use client';

import { useEffect } from 'react';

import {
  WEAVE_MOBILE_QUERY,
  assignedOrderFor,
  isRaptiveContainer,
} from '@/lib/weave-ad-order';

/**
 * Gives injected ad containers the order of the authored section they were
 * anchored to, so the order floor does not stack them all at order:900.
 *
 * Renders nothing. Everything happens in an effect, after hydration, and only
 * ever writes `style.order` on elements React does not own - the authored
 * `rd-weave-item` children are never touched, so there is nothing for React to
 * reconcile against and no hydration mismatch is possible.
 *
 * NO LAYOUT SHIFT, by timing rather than by hope. MutationObserver callbacks
 * run at the microtask checkpoint, before the next paint, so a container is
 * ordered in the same frame it is inserted. It never paints at 900 and then
 * moves, which is what would produce a shift. The rAF coalescer keeps that
 * property: rAF also runs before paint.
 *
 * Desktop is a complete no-op. Above the floor's breakpoint `order` is inert
 * (the shells become `lg:block`), so writing values there would be dead style
 * that shows up in any audit of the page. Crossing the breakpoint clears every
 * value this module wrote.
 */
export default function WeaveAdOrder() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
    const weave = document.querySelector<HTMLElement>('.rd-weave');
    if (!weave) return;

    const mq = window.matchMedia(WEAVE_MOBILE_QUERY);
    /** Only elements WE ordered, so cleanup never clears Raptive's own value. */
    const ordered = new Set<HTMLElement>();
    let frame = 0;

    /** The floor's own scope: direct children, plus children of the shells. */
    const gridChildren = (): HTMLElement[] => {
      const out: HTMLElement[] = [];
      for (const child of Array.from(weave.children)) {
        if (child.classList.contains('rd-weave-shell')) {
          for (const g of Array.from(child.children)) out.push(g as HTMLElement);
        } else {
          out.push(child as HTMLElement);
        }
      }
      return out;
    };

    /** Nearest preceding sibling that is an authored section. */
    const anchorOrderFor = (el: HTMLElement): number | null => {
      let sib = el.previousElementSibling;
      while (sib) {
        if (sib.classList.contains('rd-weave-item')) {
          const n = Number.parseInt(window.getComputedStyle(sib).order, 10);
          return Number.isFinite(n) ? n : null;
        }
        sib = sib.previousElementSibling;
      }
      return null;
    };

    const sweep = () => {
      if (!mq.matches) return;
      for (const el of gridChildren()) {
        if (el.classList.contains('rd-weave-item')) continue;   // authored
        if (ordered.has(el)) continue;
        if (el.style.order !== '') continue;                    // Raptive set its own
        if (!isRaptiveContainer(el)) continue;
        const anchor = anchorOrderFor(el);
        // No authored predecessor: leave it to the floor at 900. Failing safe
        // beats guessing a position for something we cannot place.
        if (anchor === null) continue;
        el.style.order = String(assignedOrderFor(anchor));
        ordered.add(el);
      }
    };

    /** Coalesce a burst of insertions into one pre-paint sweep. */
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sweep();
      });
    };

    const clearOrders = () => {
      for (const el of ordered) el.style.order = '';
      ordered.clear();
    };

    const observer = new MutationObserver(schedule);
    // subtree, because two of the containers observed in production are
    // wrappers that are inserted EMPTY and filled a moment later; the
    // descendant check only identifies them once their contents arrive.
    observer.observe(weave, { childList: true, subtree: true });

    const onBreakpoint = () => {
      if (mq.matches) sweep();
      else clearOrders();
    };
    mq.addEventListener('change', onBreakpoint);
    sweep();

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', onBreakpoint);
      if (frame) window.cancelAnimationFrame(frame);
      clearOrders();
    };
  }, []);

  return null;
}
