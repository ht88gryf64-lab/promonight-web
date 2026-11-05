'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUTMs } from '@/lib/utm-capture';

/**
 * Carries the session's first-touch UTMs onto /download (the social bridge,
 * 2026-11-05). A visitor who came in through a Short's link or a bio link
 * and then reached /download from the nav or a team card arrives without
 * them in the query; this reads the session's stored UTMs and replaces the
 * URL with them, so the server renders the store links (buttons and QR codes)
 * with the App Store ct and the Play referrer that name the visit. Renders
 * nothing, does nothing when the URL already carries utm_source or the
 * session has none.
 */
export function DownloadSessionUtm({ hasUtm }: { hasUtm: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (hasUtm) return;
    const stored = getStoredUTMs();
    if (!stored?.utm_source) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('utm_source')) return;
    url.searchParams.set('utm_source', stored.utm_source);
    if (stored.utm_campaign) url.searchParams.set('utm_campaign', stored.utm_campaign);
    if (stored.utm_content) url.searchParams.set('utm_content', stored.utm_content);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [hasUtm, router]);
  return null;
}
