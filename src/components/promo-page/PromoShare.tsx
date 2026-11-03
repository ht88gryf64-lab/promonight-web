'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { track, type PromoShareEventProperties } from '@/lib/analytics';
import {
  buildShareUrl,
  facebookShareHref,
  mailtoHref,
  newShareId,
  parseShareLanding,
  shareText,
  smsHref,
  stripShareParams,
  xIntentHref,
  type PromoShareChannel,
  type PromoShareFacts,
} from '@/lib/promo-share';
import { isSelfOpen, recordCreatedShare, setShareSession } from '@/lib/promo-share-session';

// Promo page sharing (2026-11-03). Two controls, one behaviour:
//   - the compact outlined "Share" beside Get tickets (placement cta_row);
//   - the round icon on the promo image's top-right corner (placement image).
// Where navigator.share exists, one tap opens the native sheet. Elsewhere a
// small popover offers Copy link, Text, Email, X and Facebook. No third-party
// script and no dependency: every channel is a plain URL.
//
// COLOUR (ruling 2026-11-03): the outline is the house ink, rd-ink #211d18,
// on white. Not brand red, and no new colour. The 1.5px outline is an inset
// box-shadow, not a border: Chrome floors a 1.5px border width to 1px (seen
// on the Gate A preview), a shadow's spread is drawn as given. Forced-colors
// mode drops shadows, so there the outline is a real border in ButtonText.
//
// Both controls render on the server, at their final size, so nothing shifts
// when the bundle hydrates. Nothing here is sticky or fixed.

export interface PromoShareProps {
  /** The page's canonical URL (already the clean URL). */
  canonical: string;
  facts: PromoShareFacts;
  promoId: string;
  team: string;
  league: string;
  pageSlug: string;
}

type Placement = PromoShareEventProperties['placement'];

type PostHogLike = { get_distinct_id?: () => string; get_session_id?: () => string; register_for_session?: (p: Record<string, unknown>) => void };
const posthog = (): PostHogLike | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { posthog?: PostHogLike }).posthog);
const distinctId = (): string | null => {
  try {
    return posthog()?.get_distinct_id?.() ?? null;
  } catch {
    return null;
  }
};

/** The URL a share carries. Production: the canonical. A preview build: the
 *  same path on the host being viewed, so a test share lands on the preview. */
function shareBase(canonical: string): string {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') return canonical;
  try {
    return `${window.location.origin}${new URL(canonical).pathname}`;
  } catch {
    return canonical;
  }
}

function ShareIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

const OPTIONS: { channel: Exclude<PromoShareChannel, 'native'>; label: string }[] = [
  { channel: 'copy', label: 'Copy link' },
  { channel: 'sms', label: 'Text' },
  { channel: 'email', label: 'Email' },
  { channel: 'x', label: 'X' },
  { channel: 'facebook', label: 'Facebook' },
];

function useShare(props: PromoShareProps, placement: Placement) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // One share id per share: minted on the tap, spent by the first channel
  // that goes out, re-minted for the next one.
  const idRef = useRef<string | null>(null);
  const copiedTimer = useRef<number | null>(null);

  const base = (channel: PromoShareChannel, shareId: string) => ({
    shareId,
    channel,
    promoId: props.promoId,
    team: props.team,
    league: props.league,
    pageSlug: props.pageSlug,
    placement,
  });

  const mint = () => {
    const id = newShareId();
    idRef.current = id;
    // Recorded at mint time so a link opened in this browser is a self-open
    // even when the native sheet never reports back.
    recordCreatedShare(id, distinctId() ?? '');
    return id;
  };
  const currentId = () => idRef.current ?? mint();

  const complete = (channel: PromoShareChannel, shareId: string) => {
    track('share_complete', base(channel, shareId));
    idRef.current = null;
  };

  const onTap = () => {
    // A second tap on an open popover closes it; it is not another share.
    if (open) {
      setOpen(false);
      return;
    }
    const shareId = mint();
    const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    track('share_click', { ...base('native', shareId), channel: canNative ? 'native' : 'menu' });
    if (!canNative) {
      setOpen(true);
      return;
    }
    const url = buildShareUrl(shareBase(props.canonical), 'native', shareId);
    navigator.share({ title: props.facts.promoName, text: shareText(props.facts), url }).then(
      () => complete('native', shareId),
      (err: unknown) => {
        // Dismissing the sheet is not a share. Any other failure (a blocked
        // share, an unsupported payload) falls back to the popover.
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setOpen(true);
      },
    );
  };

  const choose = (channel: Exclude<PromoShareChannel, 'native'>) => {
    const shareId = currentId();
    const url = buildShareUrl(shareBase(props.canonical), channel, shareId);
    if (channel === 'copy') {
      const write = typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'));
      write.then(
        () => {
          complete('copy', shareId);
          setCopied(true);
          if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
          copiedTimer.current = window.setTimeout(() => {
            setCopied(false);
            setOpen(false);
          }, 1500);
        },
        () => {
          // Clipboard refused: nothing went out, so no share_complete.
        },
      );
      return;
    }
    complete(channel, shareId);
    setOpen(false);
    if (channel === 'sms') window.location.href = smsHref(props.facts, url);
    else if (channel === 'email') window.location.href = mailtoHref(props.facts, url);
    else if (channel === 'x') window.open(xIntentHref(props.facts, url), '_blank', 'noopener,noreferrer,width=600,height=520');
    else window.open(facebookShareHref(url), '_blank', 'noopener,noreferrer,width=600,height=520');
  };

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  return { open, setOpen, copied, onTap, choose };
}

/** The popover and its dismissal (outside tap, Escape). */
function SharePopover({ id, copied, onChoose, onClose, anchor }: { id: string; copied: boolean; onChoose: (c: Exclude<PromoShareChannel, 'native'>) => void; onClose: () => void; anchor: React.RefObject<HTMLDivElement | null> }) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (anchor.current && !anchor.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      // Back to the Share button, so a keyboard user keeps their place.
      anchor.current?.querySelector('button')?.focus();
    };
    // Tabbing out of the popover closes it.
    const onFocusIn = (e: FocusEvent) => {
      if (anchor.current && !anchor.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [anchor, onClose]);
  return (
    <div id={id} role="dialog" aria-label="Share via" className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-rd-line-strong bg-white py-1 shadow-lg">
      {OPTIONS.map((o, i) => (
        <button
          key={o.channel}
          ref={i === 0 ? firstRef : undefined}
          type="button"
          onClick={() => onChoose(o.channel)}
          className="block w-full px-3.5 py-2.5 text-left font-rd text-[14px] font-medium text-rd-ink hover:bg-rd-cream focus-visible:bg-rd-cream focus-visible:outline-none"
        >
          {o.channel === 'copy' && copied ? 'Copied' : o.label}
        </button>
      ))}
    </div>
  );
}

function ShareControl({ props, placement, buttonClass, iconClass, label }: { props: PromoShareProps; placement: Placement; buttonClass: string; iconClass: string; label: React.ReactNode }) {
  const { open, setOpen, copied, onTap, choose } = useShare(props, placement);
  const anchor = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), [setOpen]);
  return (
    <div ref={anchor} className={placement === 'image' ? 'absolute right-2.5 top-2.5 z-10' : 'relative shrink-0'}>
      <button type="button" onClick={onTap} aria-label="Share this promo" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined} className={buttonClass}>
        <ShareIcon className={iconClass} />
        {label}
      </button>
      {open ? <SharePopover id={popoverId} copied={copied} onChoose={choose} onClose={close} anchor={anchor} /> : null}
    </div>
  );
}

/** The compact outlined Share beside Get tickets: the same 52px height, the
 *  ink outline on white. Below 340px the label goes visually hidden and the
 *  icon stays, so the row never wraps at 360px. */
export function PromoShareRowButton(props: PromoShareProps) {
  return (
    <ShareControl
      props={props}
      placement="cta_row"
      buttonClass="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-white px-4 font-rd text-[16px] font-semibold text-rd-ink shadow-[inset_0_0_0_1.5px_var(--color-rd-ink)] hover:bg-rd-cream forced-colors:border-[1.5px] forced-colors:border-[color:ButtonText] max-[339px]:px-3.5"
      iconClass="h-[18px] w-[18px]"
      label={<span className="max-[339px]:sr-only">Share</span>}
    />
  );
}

/** The round icon on the promo image's top-right corner. Absolutely placed
 *  inside the figure, so it takes no layout space of its own. */
export function PromoShareImageButton(props: PromoShareProps) {
  return (
    <ShareControl
      props={props}
      placement="image"
      buttonClass="flex h-10 w-10 items-center justify-center rounded-full bg-white text-rd-ink shadow-[inset_0_0_0_1.5px_var(--color-rd-ink),0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-rd-cream forced-colors:border-[1.5px] forced-colors:border-[color:ButtonText]"
      iconClass="h-[18px] w-[18px]"
      label={null}
    />
  );
}

/** On a shared-link landing: the share session (for subId2 and share_id on
 *  affiliate_click), PostHog session properties, one share_landing event,
 *  then the address bar loses `s` and the utm_* so a re-share mints a fresh
 *  id and a copied URL is clean. Renders nothing. */
export function ShareLandingCapture({ promoId, team, league, pageSlug }: { promoId: string; team: string; league: string; pageSlug: string }) {
  useEffect(() => {
    const landing = parseShareLanding(window.location.search);
    if (!landing) return;
    const at = Date.now();
    const sessionId = () => {
      try {
        return posthog()?.get_session_id?.() ?? '';
      } catch {
        return '';
      }
    };
    const session = (selfOpen: boolean, sid: string) => ({ shareId: landing.shareId, channel: landing.channel, promoId, selfOpen, at, sid });
    // At once, so a click in the first second still carries subId2; refined
    // below once PostHog's distinct_id is known.
    setShareSession(session(isSelfOpen(landing.shareId, null), ''));
    let timer: number | undefined;
    let tries = 0;
    const finish = () => {
      const selfOpen = isSelfOpen(landing.shareId, distinctId());
      setShareSession(session(selfOpen, sessionId()));
      const props = { share_id: landing.shareId, share_channel: landing.channel, share_promo_id: promoId, share_self_open: selfOpen };
      try {
        posthog()?.register_for_session?.(props);
      } catch {
        // Analytics is best effort.
      }
      track('share_landing', { ...props, promoId, team, league, pageSlug });
      // After the capture, so PostHog's session entry still saw the UTMs.
      try {
        const { pathname, search, hash } = window.location;
        window.history.replaceState(window.history.state, '', stripShareParams(`${pathname}${search}${hash}`));
      } catch {
        // A browser that refuses replaceState keeps the parameters.
      }
    };
    // PostHog loads lazily (AnalyticsProvider): wait up to 8s for it.
    const tick = () => {
      if (posthog()?.get_distinct_id || ++tries > 80) finish();
      else timer = window.setTimeout(tick, 100);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [promoId, team, league, pageSlug]);
  return null;
}
