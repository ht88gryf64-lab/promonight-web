'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ShareItem } from './types';
import {
  buildEmailBody,
  buildEmailSubject,
  buildSmsText,
  buildTweetText,
  fireShareInitiated,
  shareUrlFor,
} from './share-channels';

interface ShareSheetProps {
  /** Non-null while the sheet should be open. */
  item: ShareItem | null;
  /** Placement tag forwarded to share_initiated. */
  placement: string;
  /** Clears the share state (sets item back to null). */
  onClose: () => void;
}

// How long the exit animation runs before we actually close the dialog.
// Kept in sync with the .share-panel-out animation duration in globals.css.
const EXIT_MS = 200;

// Convert a #rrggbb / #rgb string to an rgba() string. Returns null for
// missing / malformed input so the caller can fall back to a neutral tint.
function hexToRgba(hex: string | null | undefined, alpha: number): string | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ShareSheet renders on top of everything (including the team-calendar's own
// <dialog> modal) by using a native <dialog> + showModal(): top-layer
// stacking, focus trap, focus restore, and Esc handling come from the
// platform. Animation + backdrop-click come from us.
export function ShareSheet({ item, placement, onClose }: ShareSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Body overflow value captured at open time. Restoring this exact value
  // (rather than '') keeps the calendar modal's scroll-lock intact when the
  // share sheet is opened from inside it and then dismissed.
  const prevOverflow = useRef<string>('');
  const copyTimer = useRef<number | null>(null);

  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [closing, setClosing] = useState(false);

  const isOpen = item != null;

  // Feature-detect native share after mount so SSR and first client render
  // agree (server has no `navigator`) — avoids a hydration mismatch.
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
  }, []);

  // Open the dialog when an item arrives.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen && !d.open) {
      prevOverflow.current = document.body.style.overflow;
      try {
        d.showModal();
      } catch {
        /* already open */
      }
      document.body.style.overflow = 'hidden';
      setCopied(false);
      setClosing(false);
    }
  }, [isOpen]);

  const finalizeClose = useCallback(() => {
    const d = dialogRef.current;
    try {
      d?.close();
    } catch {
      /* already closed */
    }
    document.body.style.overflow = prevOverflow.current;
    if (copyTimer.current) {
      window.clearTimeout(copyTimer.current);
      copyTimer.current = null;
    }
    setClosing(false);
    setCopied(false);
    onClose();
  }, [onClose]);

  // Animate the panel out, then close. Idempotent so rapid taps don't stack
  // timers.
  const requestClose = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(finalizeClose, EXIT_MS);
      return true;
    });
  }, [finalizeClose]);

  // Esc fires the dialog 'cancel' event — intercept it so we run the same
  // animated close path instead of the instant native close.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      requestClose();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [requestClose]);

  // Restore body scroll + clear timers if we unmount mid-open.
  useEffect(
    () => () => {
      document.body.style.overflow = prevOverflow.current || '';
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(item));
      setCopied(true);
      fireShareInitiated(item, 'copy_link', placement);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — no
      // confirmation state, and we don't fire an event for a failed copy.
    }
  }, [item, placement]);

  const handleSms = useCallback(() => {
    if (!item) return;
    window.open('sms:?&body=' + encodeURIComponent(buildSmsText(item)), '_self');
    fireShareInitiated(item, 'sms', placement);
    requestClose();
  }, [item, placement, requestClose]);

  const handleX = useCallback(() => {
    if (!item) return;
    window.open(
      'https://x.com/intent/tweet?text=' +
        encodeURIComponent(buildTweetText(item)),
    );
    fireShareInitiated(item, 'x', placement);
    requestClose();
  }, [item, placement, requestClose]);

  const handleEmail = useCallback(() => {
    if (!item) return;
    window.open(
      'mailto:?subject=' +
        encodeURIComponent(buildEmailSubject(item)) +
        '&body=' +
        encodeURIComponent(buildEmailBody(item)),
    );
    fireShareInitiated(item, 'email', placement);
    requestClose();
  }, [item, placement, requestClose]);

  const handleNative = useCallback(() => {
    if (!item || typeof navigator === 'undefined' || !navigator.share) return;
    navigator
      .share({
        title: buildEmailSubject(item),
        text: buildSmsText(item),
        url: shareUrlFor(item),
      })
      .then(() => {
        fireShareInitiated(item, 'native', placement);
        requestClose();
      })
      .catch(() => {
        // User cancelled the native picker — leave the sheet open.
      });
  }, [item, placement, requestClose]);

  const previewStyle = (() => {
    const tint = hexToRgba(item?.primaryColor, 0.22);
    const border = hexToRgba(item?.primaryColor, 0.5);
    if (tint && border) {
      return {
        background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.02))`,
        borderColor: border,
      };
    }
    return { background: '#15171f', borderColor: 'rgba(255,255,255,0.08)' };
  })();

  type Option = { key: string; label: string; icon: ReactNode; onClick: () => void };
  const options: Option[] = item
    ? [
        {
          key: 'copy',
          label: copied ? 'Copied!' : 'Copy Link',
          icon: copied ? <CheckIcon /> : <LinkIcon />,
          onClick: handleCopy,
        },
        { key: 'sms', label: 'Text', icon: <span aria-hidden="true">💬</span>, onClick: handleSms },
        { key: 'x', label: 'X', icon: <XIcon />, onClick: handleX },
        { key: 'email', label: 'Email', icon: <span aria-hidden="true">✉️</span>, onClick: handleEmail },
        ...(canNativeShare
          ? [{ key: 'native', label: 'More', icon: <MoreIcon />, onClick: handleNative }]
          : []),
      ]
    : [];

  return (
    <dialog
      ref={dialogRef}
      aria-label="Share options"
      className="z-[100] backdrop:bg-transparent"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        margin: 0,
        padding: 0,
        background: 'transparent',
        border: 'none',
        overflow: 'hidden',
      }}
    >
      {item && (
        <>
          <div
            className="share-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={requestClose}
          />
          {/* pointer-events-none lets clicks in the empty gutter fall through
              to the backdrop; the panel re-enables them for itself. */}
          <div className="absolute inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
            <div
              className={`${
                closing ? 'share-panel-out' : 'share-panel'
              } pointer-events-auto w-full sm:w-[min(420px,calc(100vw-2rem))] bg-bg-card border border-border-subtle rounded-t-3xl sm:rounded-2xl shadow-2xl px-5 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:pb-5`}
            >
              {/* Mobile grab handle */}
              <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl tracking-[1px] leading-none">SHARE</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={requestClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Read-only preview, tinted with the team's primary color. */}
              <div className="rounded-xl border p-4 mb-5" style={previewStyle}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none flex-shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm leading-snug">
                      {item.promoTitle}
                    </div>
                    <div className="text-text-secondary text-xs mt-1">
                      {item.teamName} · {item.date}
                    </div>
                    {item.venue && (
                      <div className="text-text-muted text-xs mt-0.5 truncate">{item.venue}</div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
              >
                {options.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={opt.onClick}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <span className="w-12 h-12 flex items-center justify-center rounded-full bg-white/[0.06] border border-border-subtle text-white text-xl group-hover:bg-white/[0.1] group-hover:border-border-hover group-active:scale-95 transition-all">
                      {opt.icon}
                    </span>
                    <span className="text-[11px] text-text-secondary group-hover:text-white transition-colors text-center leading-tight">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}

function LinkIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5a4 4 0 0 1 0 5.66l-2.5 2.5a4 4 0 0 1-5.66-5.66l1.5-1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 13.5a4 4 0 0 1 0-5.66l2.5-2.5a4 4 0 0 1 5.66 5.66l-1.5 1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-promo-giveaway" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
