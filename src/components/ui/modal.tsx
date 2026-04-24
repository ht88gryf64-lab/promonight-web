'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible name for the dialog — screen readers announce this. */
  ariaLabel?: string;
}

// Modal overlay built on the native HTML <dialog> element. The browser provides
// focus trap, focus restore (back to the element that opened the dialog), and
// the implicit role="dialog". We add: body scroll lock + backdrop-click close +
// React-state sync via the dialog's close event.
//
// Content is always in the DOM — when the dialog is closed the UA applies
// display: none, but crawlers still see everything in the HTML source.
export function Modal({ isOpen, onClose, children, ariaLabel }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open / close side effect. Kept separate from event wiring so each effect
  // has one job.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen && !d.open) {
      // showModal() triggers focus trap + focus restore on close per spec.
      try { d.showModal(); } catch { /* already open */ }
      document.body.style.overflow = 'hidden';
    } else if (!isOpen && d.open) {
      d.close();
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Event wiring — sync React state when the dialog closes (Esc key, close
  // button, form method=dialog, etc.) and support backdrop-click dismissal.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onDialogClose = () => onClose();
    const onBackdropClick = (e: MouseEvent) => {
      // A click lands on the dialog element itself only when the user clicks
      // the ::backdrop area outside the content card. We derive that by
      // comparing the click coordinates to the dialog's bounding box.
      const rect = d.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) onClose();
    };
    d.addEventListener('close', onDialogClose);
    d.addEventListener('click', onBackdropClick);
    return () => {
      d.removeEventListener('close', onDialogClose);
      d.removeEventListener('click', onBackdropClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      className="
        m-0 p-0
        w-full h-full sm:w-auto sm:h-auto
        sm:max-w-xl sm:w-[min(540px,calc(100vw-2rem))]
        sm:max-h-[85vh]
        bg-bg-card text-white
        sm:rounded-2xl border-0 sm:border sm:border-border-subtle
        overflow-hidden
        backdrop:bg-black/60 backdrop:backdrop-blur-[2px]
      "
      style={{ position: 'fixed', inset: 0, margin: 'auto' }}
    >
      <div className="relative w-full h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="sticky top-3 float-right mr-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-5 md:p-6 pt-4">
          {children}
        </div>
      </div>
    </dialog>
  );
}
