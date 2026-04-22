'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { captureAttribution } from '@/lib/attribution';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

// Initializes PostHog on the client and emits the gtag bootstrap so every
// downstream track() call dual-emits to both. Also seeds the first-party
// attribution cookie on first mount so events carry source_* from the very
// first page view.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    captureAttribution();

    if (!POSTHOG_KEY) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          '[analytics] NEXT_PUBLIC_POSTHOG_KEY not set — PostHog will not initialize.',
        );
      }
      return;
    }

    let cancelled = false;
    // Dynamic import keeps PostHog out of the server bundle and off the
    // critical-path chunk for routes that never render before client hydrate.
    import('posthog-js')
      .then(({ default: posthog }) => {
        if (cancelled) return;
        const w = window as unknown as { __ph_inited?: boolean };
        if (w.__ph_inited) return;
        w.__ph_inited = true;

        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          person_profiles: 'identified_only',
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: false,
          session_recording: {
            maskAllInputs: true,
          },
          loaded: (instance) => {
            // Expose on window so the framework-agnostic track() can reach it
            // without importing posthog-js (keeps analytics.ts SSR-safe).
            (window as unknown as { posthog?: unknown }).posthog = instance;
          },
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[analytics] PostHog failed to load', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {GA4_ID && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA4_ID}', {
                  send_page_view: false,
                  debug_mode: ${process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'}
                });
              `,
            }}
          />
        </>
      )}
      {children}
    </>
  );
}
