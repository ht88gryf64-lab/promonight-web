'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { StarIcon } from './star-icon';
import { track } from '@/lib/analytics';
import {
  SHOW_STAR_TOAST_EVENT,
  type ShowStarToastDetail,
} from '@/hooks/use-starred-teams';

type ActiveToast = {
  teamName: string;
  placement: string;
};

const VISIBLE_MS = 4000;
const LEAVE_MS = 200;

// Lives in the layout. Listens for the show-star-toast custom event the
// hook dispatches the first time a user ever stars a team. Single-instance
// host so multiple star actions don't stack toasts on top of each other.
export function PostStarToastHost() {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    function onShow(e: Event) {
      const detail = (e as CustomEvent<ShowStarToastDetail>).detail;
      if (!detail) return;
      setLeaving(false);
      setToast({ teamName: detail.teamName, placement: detail.placement });
      track('post_star_toast_shown', { placement: detail.placement });
    }
    window.addEventListener(SHOW_STAR_TOAST_EVENT, onShow);
    return () => window.removeEventListener(SHOW_STAR_TOAST_EVENT, onShow);
  }, []);

  useEffect(() => {
    if (!toast || leaving) return;
    const visibleTimer = window.setTimeout(() => {
      setLeaving(true);
    }, VISIBLE_MS);
    return () => window.clearTimeout(visibleTimer);
  }, [toast, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const removeTimer = window.setTimeout(() => {
      setToast(null);
      setLeaving(false);
    }, LEAVE_MS);
    return () => window.clearTimeout(removeTimer);
  }, [leaving]);

  if (!toast) return null;

  const handleDismiss = (e: MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that bubbled from the inner CTA link.
    if ((e.target as HTMLElement).closest('[data-toast-cta]')) return;
    track('post_star_toast_dismissed', { placement: toast.placement });
    setLeaving(true);
  };

  const handleCtaClick = () => {
    track('post_star_toast_clicked', { placement: toast.placement });
    setLeaving(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={handleDismiss}
      className={`fixed bottom-5 left-1/2 z-[100] flex items-center gap-3 px-5 rounded-full bg-bg-card border border-accent-red-border text-white text-sm shadow-2xl cursor-pointer ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
      style={{ height: 56 }}
    >
      <span style={{ lineHeight: 0 }} aria-hidden="true">
        <StarIcon filled size={16} surface="dark" />
      </span>
      <span className="font-body">
        <span className="text-white">{toast.teamName} starred. </span>
        <Link
          href="/my-teams"
          data-toast-cta
          onClick={handleCtaClick}
          className="font-medium text-accent-red hover:text-white transition-colors"
        >
          Build your set on My Teams →
        </Link>
      </span>
    </div>
  );
}
