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
      // three dismissal paths that can fire by accident, so it is the only one
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
      className={`${closing ? 'capture-panel-out' : 'capture-panel'} fixed bottom-0 left-0 right-0 z-[90] flex max-h-[34vh] flex-col overflow-hidden rounded-t-3xl border border-rd-line bg-rd-card pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 text-left shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-h-[70vh] sm:w-[330px] sm:rounded-2xl sm:pb-5`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => requestDismiss('x')}
        // 44x44, always rendered, never hover-revealed. On desktop it is the
        // only dismissal a pointer user has.
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-rd-ink-faint transition-colors hover:bg-rd-ink/[0.06] hover:text-rd-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-red focus-visible:ring-offset-2 focus-visible:ring-offset-rd-card"
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
