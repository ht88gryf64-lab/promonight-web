'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CaptureDismissMethod } from '@/lib/analytics';

// The sheet SHELL: where it sits, how it arrives, how it goes away. It knows
// nothing about email, teams or the funnel; CaptureCard owns all of that.
//
// NOT BUILT ON components/ui/modal.tsx, AND IT MUST NOT BE. That component calls
// showModal(), which puts the dialog in the top layer and marks the rest of the
// document inert. All five of its callers want exactly that. This sheet wants
// the opposite: the page behind stays readable, scrollable and clickable while
// it is up, because a prompt that arrives unasked after 45 seconds of reading
// has no business seizing the page someone is in the middle of. Nothing about
// modal.tsx survives that inversion, so this is a separate primitive rather than
// a fifth variant prop on it.
//
// ONE COMPONENT, TWO PLACEMENTS. Below 640px it is a bottom sheet across the
// full width, capped near a third of the viewport. From 640px it is a 330px card
// in the bottom-right corner with margin on the two edges it touches. That is a
// class list, not a second implementation: two components would be two things to
// keep in sync for one behavior.
//
// NO SCROLL LOCK, ANYWHERE. Note that modal.tsx:48 writes document.body.overflow
// = '' on cleanup without ever having captured what was there before, so opening
// it from inside another locked surface releases that surface's lock on close.
// ShareSheet works around it by saving prevOverflow. This component sidesteps the
// whole question by never touching body.overflow: the requirement is that the
// page keeps scrolling, so there is nothing to save and nothing to restore.
//
// NO OVERLAY ELEMENT AT ALL. The panel is the only thing rendered. A full-bleed
// scrim would either swallow pointer events, which breaks the scrollability the
// sheet is built around, or be pointer-events-none, which dims content the
// visitor can still reach and reads as broken. So "backdrop tap" on mobile is
// implemented as an outside tap on the document instead: same gesture, same
// dismissal, nothing between the visitor and the page.
//
// TWO VISIBLE DISMISSALS, AND THE HANDLE IS THE ONE THAT SURVIVES A SCALED PAGE.
// This panel is position:fixed sized by left:0/right:0, so its width is the
// LAYOUT viewport. iOS implements page zoom as a transform of the VISUAL
// viewport with no relayout, so at any page scale above 1 the panel keeps its
// full layout width while only width/scale of it is on screen, anchored at the
// left. Anything near the RIGHT edge leaves the display first. That is not
// hypothetical: it shipped, and the X — then 6px from the edge — was completely
// gone on a real iPhone 15 Pro. See docs/known-issues.md entry 10.
//
// THE SCALE WAS ALREADY THERE WHEN THE SHEET ARRIVED, which is the detail that
// decides the design. The reporter had not touched the sheet: iOS zooms on focus
// for any text control under 16px and does NOT zoom back out on blur, and page
// scale survives same-document App Router navigation. So a visitor taps a search
// box on one page, carries 1.14 with them, and meets this sheet already scaled.
// Raising this sheet's own email field to 16px therefore does nothing for the
// case that was actually reported — only the other inputs and a dismissal that
// survives scale do. Do not let the 16px change read as the fix.
//
// A control whose far edge sits at x stays visible while x <= W/scale, with the
// window pinned to the left edge, which is where iOS leaves it after a focus
// zoom. Centre is the position that degrades symmetrically: panned fully right
// instead, a centred control needs W - W/scale <= centre - halfWidth, which
// yields the same bound. An edge control has no such symmetry — it is the first
// thing to go one way and the last the other.
//
// THESE NUMBERS ARE MEASURED ON REAL WEBKIT, NOT DERIVED. iPhone 15 Pro
// simulator, iOS 26.5, driven through initial-scale. They are not constants;
// recompute for another width.
//
// PORTRAIT, layout viewport 393:
//   handle  56px box centred at 196.5 -> far edge 224.5 -> holds to 1.75
//   X       right-3, 44px box         -> far edge 380   -> holds to 1.03
// Measured: at scale 1.75 visualViewport.width is 225 and the handle is visible;
// at 1.80 it is 218 and the handle is gone. The X is already gone at 1.14.
//
// LANDSCAPE corner card. The layout viewport is 734, NOT the 852 the device is
// wide: with no viewport-fit=cover iOS lays the page out INSIDE the 59pt
// landscape safe areas, and 852 - 2*59 = 734. Panel [380, 710].
//   handle  far edge 573 -> holds to 1.28
//   X       far edge 697 -> holds to 1.05
// Measured: visible at 1.23, gone at 1.30.
//
// Both branches clear the 1.14 that a 14px input forces, and in both it is the
// handle that clears it and not the X.
//
// The handle is the dismissal. The X is the familiar affordance kept for
// pointers and for anyone who looks for it in the corner.
//
// WHAT WAS DELIBERATELY NOT DONE: no visualViewport resize/scroll subscription.
// It would size the panel correctly at every scale, but it puts two live
// listeners on a component whose whole premise is staying out of the visitor's
// way, to buy scales above 1.75 that a reader does not reach. And NOT
// maximum-scale/user-scalable=no, which is a WCAG 2.1 SC 1.4.4 failure and does
// nothing for a visitor who arrives already zoomed.

/** Kept in sync with the .capture-panel-out durations in globals.css. */
const EXIT_MS = 180;

/** The Tailwind `sm` breakpoint, where the sheet becomes a corner card. */
const DESKTOP_QUERY = '(min-width: 640px)';

/**
 * Anything a tap on the page behind could plausibly have been aimed at. Used to
 * tell "the visitor tapped past the sheet to dismiss it" apart from "the visitor
 * carried on using the page", which the sheet is explicitly built to allow.
 */
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, dialog, [role="button"], [role="link"], [role="tab"], [contenteditable="true"]';

/**
 * Whether a native modal dialog currently owns the screen.
 *
 * Both Modal and ShareSheet open with showModal(), which puts them in the top
 * layer and makes the rest of the document inert. This sheet can be up when one
 * of those opens: it arrives after 45 seconds of reading, and tapping a promo
 * row a moment later opens the upcoming-promo modal over it.
 *
 * Without this check, the Escape that closes the modal would ALSO be read here
 * as a dismissal, and a tap inside the modal would be read as a tap outside this
 * panel. Both would record a rejection the visitor never made and open a 30-day
 * suppression window off the back of it. When something modal is up, it owns the
 * interaction and this sheet stays out of the way.
 */
function modalDialogIsOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

interface CaptureSheetProps {
  open: boolean;
  /**
   * Fired the instant a dismissal is requested, BEFORE the exit animation, so
   * the event and the dismissal timestamp are never lost to a visitor who
   * navigates during the 180ms.
   */
  onDismiss: (method: CaptureDismissMethod) => void;
  /** id of the heading inside `children`, for the dialog's accessible name. */
  labelledBy: string;
  children: ReactNode;
}

export function CaptureSheet({ open, onDismiss, labelledBy, children }: CaptureSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latched so a double tap on the X, or an Escape landing during the exit,
  // cannot emit a second dismissal for the same sheet.
  const dismissing = useRef(false);

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  // `open` going false plays the exit and THEN removes the panel, so the parent
  // gets to own one boolean instead of an animation state machine.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      dismissing.current = false;
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  const requestDismiss = useCallback(
    (method: CaptureDismissMethod) => {
      if (dismissing.current) return;
      dismissing.current = true;
      onDismiss(method);
    },
    [onDismiss],
  );

  // Escape everywhere, including desktop where there is no outside-tap path.
  // On the document rather than the panel because nothing here takes focus, so
  // a keypress will not be aimed at the panel to begin with.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modalDialogIsOpen()) return;
      requestDismiss('escape');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, requestDismiss]);

  // Outside tap, PHONES ONLY. Desktop deliberately has no equivalent: the card
  // sits in a corner out of the way, and dismissing it because someone clicked
  // the page they were already reading would be a trap rather than an
  // affordance. That is also why the X is a full 44px target.
  //
  // 'click' and not 'pointerdown', because a scroll begins with a pointerdown
  // and scrolling the page is exactly what this sheet is supposed to allow. A
  // scroll produces no click, so the page stays scrollable and a genuine tap
  // outside still closes.
  //
  // ATTACHED ON A TIMEOUT, WHICH IS LOAD-BEARING. The trigger fires from inside
  // analytics events, and those are emitted from the calendar's own click
  // handlers, so the sheet can mount while the very click that opened it is
  // still propagating. A listener added during that propagation still runs when
  // it reaches the document, which would dismiss the sheet in the same gesture
  // that showed it. Deferring to the next task lets the click finish first.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      // Evaluated per click rather than once at attach time. A phone rotated
      // into landscape is usually wider than 640px, so the sheet can become a
      // corner card while it is open; asking the media query now means the rule
      // always matches the layout the visitor is actually looking at.
      if (typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches) {
        return;
      }
      if (modalDialogIsOpen()) return;
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      // A TAP ON A CONTROL IS NOT A DISMISSAL, AND THIS LINE IS WHY THE NUMBERS
      // CAN BE BELIEVED.
      //
      // Without it, the first thing an engaged visitor does after the sheet
      // arrives, opening the next game cell to carry on browsing, closes it,
      // emits capture_prompt_dismissed, and writes a 30-day suppression marker.
      // Continued engagement would be recorded as rejection.
      //
      // The damage is not a dented dismiss rate, it is a biased sample. The
      // visitors who keep tapping after 45 seconds are the most interested ones
      // on the page, which is to say the ones most likely to convert. They would
      // be dismissed fastest and suppressed for a month, so the population still
      // reachable by the sheet would decay toward the people least likely to
      // sign up. The sheet would be understated by an unknown amount and the
      // result would arrive as a clean, plausible null with nothing anywhere to
      // indicate it was wrong. Dropping the A/B did not retire this argument: it
      // is about who remains eligible over time, not about comparing two arms.
      //
      // A backdrop tap therefore means a tap on the page's dead space, which is
      // what is left once controls are excluded. It is also the only one of the
      // four dismissal paths that can fire by accident, so it is the only one
      // that needs a rule about intent at all.
      if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return;
      requestDismiss('backdrop');
    };
    const id = window.setTimeout(() => {
      document.addEventListener('click', onClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', onClick);
    };
  }, [open, requestDismiss]);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      // Explicitly NOT modal: the rest of the page stays reachable, and saying
      // otherwise would tell a screen reader the opposite of what is true.
      aria-modal="false"
      aria-labelledby={labelledBy}
      // The panel itself never scrolls; the inner wrapper does. That is what
      // keeps the X pinned: an absolutely positioned child of a scrolling box
      // scrolls away with the content, and "always visible" has to survive a
      // 320px screen in landscape as well as a tall one.
      //
      // NO HORIZONTAL PADDING HERE. It lives on the scroller instead, which is
      // not a cosmetic choice: see the note on that element.
      //
      // max(34vh,240px) AND NOT A BARE 34vh. The handle costs 36px of flow, and
      // 34vh of a 568px iPhone SE is 193px, which is not enough to hold the
      // prompt: the submit button lost 41% of its height below the internal fold
      // and the always-rendered error row went to zero visible pixels, so the
      // copy that row exists to reserve space for became unreadable on exactly
      // the devices with the least room. 240px fits the 239px natural height at
      // both 568 and 667 viewport heights. Tall phones are untouched — 34vh of
      // an 852px iPhone 15 Pro is 290px and already wins the max().
      //
      // THE TRADEOFF IS REAL AND IS THE POINT: 240px is 42% of a 568px viewport
      // where 34vh was 34%. A taller sheet on the smallest phones is worse than
      // a shorter one, and it is still better than a sheet whose submit button
      // is cut in half. If this needs to come back down, the honest lever is
      // less content, not a smaller dismissal.
      className={`${closing ? 'capture-panel-out' : 'capture-panel'} fixed bottom-0 left-0 right-0 z-[90] flex max-h-[max(34vh,240px)] flex-col overflow-hidden rounded-t-3xl border border-rd-line bg-rd-card pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2 text-left shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-h-[70vh] sm:w-[330px] sm:rounded-2xl sm:pb-5`}
    >
      {/* THE GRAB HANDLE, WHICH IS A DISMISS BUTTON AND NOT DECORATION.
          Centred, because centre is the only horizontal position that survives
          a scaled visual viewport in both pan directions (see the header).
          Rendered at every width rather than sm:hidden: a phone in landscape is
          wider than 640px and gets the corner-card branch, whose X fails at
          scale 1.05, so hiding the handle there would leave exactly the case
          that needs it uncovered.
          aria-hidden + tabIndex -1 because it is the SAME action as the X, which
          is already labelled: a screen reader announcing "Close, Close" is worse
          than announcing it once, and keyboard users have both the X and Escape.
          This is a touch affordance, and only a touch affordance. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => requestDismiss('handle')}
        className="mx-auto mb-1 flex h-8 w-14 shrink-0 items-center justify-center rounded-full"
      >
        {/* rd-ink-faint, NOT rd-line-strong. rd-line-strong is
            rgba(33,29,24,0.16), which composites to #dbdbda on the card and
            gives 1.39:1 — it fails WCAG 2.1 SC 1.4.11 (3:1 for the visual
            information identifying a control) by more than a factor of two, and
            it would make the dismissal this whole change designates as THE
            dismissal the least visible control in the sheet. That is the bug we
            are fixing, relocated. rd-ink-faint is #9a9081 = 3.14:1, the same
            ratio as the X glyph below, so both dismissals are equally findable.
            The population browsing at page scale > 1 skews low-vision, which is
            exactly the population a 1.39:1 bar does not exist for. */}
        <span className="h-1 w-9 rounded-full bg-rd-ink-faint" />
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => requestDismiss('x')}
        // 44x44, always rendered, never hover-revealed. right-3 rather than
        // right-1.5: 6px was the least forgiving position on the panel for any
        // viewport-narrowing effect. Moving it to 12px is cheap and buys a
        // little (scale 1.03 instead of 1.02); it is NOT the fix, the handle is.
        className="absolute right-3 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-rd-ink-faint transition-colors hover:bg-rd-ink/[0.06] hover:text-rd-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-rd-card"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* THE PADDING BELONGS TO THE SCROLLER, NOT THE PANEL, AND IT IS A FOCUS
          RING THAT DECIDES IT.
          overflow-y: auto forces overflow-x to compute to auto as well, so this
          element clips on BOTH axes. Tailwind's focus ring is a box-shadow,
          which an ancestor's clip box cuts. With the padding on the panel this
          wrapper's content edges sat exactly on the controls' edges, so the
          submit button, flush right in a full-width form, lost all 4px of its
          ring on the visible side, and the first and last chip lost one edge
          each. That is the only focus indicator those controls have, since both
          set focus-visible:outline-none and the stylesheet defines no fallback.
          Moving the inset inside the clip box gives every ring 20px of room.
          This is also how ui/modal.tsx does it; putting the padding on the
          panel inverted that and is what introduced the clipping.
          pb-1 covers the fourth edge: the chip row is the last child, and the
          content height is pinned to within a couple of pixels of this box. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">{children}</div>
    </div>
  );
}
