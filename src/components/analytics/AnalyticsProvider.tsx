'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { captureAttribution } from '@/lib/attribution';

/**
 * Routes session replay must never record.
 *
 * THIS IS AN EXPOSURE CONTROL AND IT IS NOT JUSTIFIED BY COST. Both of these
 * are reached only from a per-subscriber emailed link, and both render the
 * subscriber's email address. Until this branch they also carried a permanent
 * bearer manage token in the URL, which replay captured five ways. The token is
 * now in an httpOnly cookie, but the address is still on the page and the whole
 * surface is per-subscriber, so recording it buys debugging value that is not
 * worth what it holds.
 *
 * Ships regardless of the sampling rate. Raising sampling back to 1.0 does not
 * make this redundant, it makes it matter more.
 */
const REPLAY_EXCLUDED_PATHS = new Set(['/preferences', '/confirm']);

/**
 * STOPS the recorder on excluded routes rather than filtering events afterwards.
 *
 * A before_send hook that dropped $snapshot events would be the obvious
 * alternative and it is the wrong one: snapshots are batched and flushed
 * asynchronously, so a snapshot taken on /preferences can be sent after the
 * visitor has navigated away, at which point the hook inspects the WRONG
 * pathname and lets it through. Not capturing is the only version of this with
 * no race in it.
 */
function useSessionReplayRouteExclusion() {
  const pathname = usePathname();
  useEffect(() => {
    // Covers CLIENT-SIDE navigation into an excluded route, where posthog is
    // already loaded. The FIRST load of an excluded route is handled in the
    // `loaded` callback instead, because this effect runs before the dynamic
    // import resolves. Both are needed; see the note there.
    const ph = (window as unknown as { posthog?: {
      stopSessionRecording?: () => void;
      startSessionRecording?: () => void;
    } }).posthog;
    if (!ph) return;
    if (REPLAY_EXCLUDED_PATHS.has(pathname)) ph.stopSessionRecording?.();
    // Deliberately does NOT auto-resume on other routes. Resuming would restart
    // the recorder mid-session for someone who navigated preferences -> home,
    // stitching a fresh recording onto a session that just held a credential,
    // and the next full page load starts a clean one anyway.
  }, [pathname]);
}

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
          // SAMPLING IS NOT SET HERE, AND THAT IS NOT AN OVERSIGHT.
          //
          // posthog-js 1.370 reads a sample rate from `session_recording
          // .sampleRate`, but that key is absent from the client-facing
          // SessionRecordingOptions type; it appears only on the REMOTE config
          // types (module.d.ts:2416, :2422). Setting it here would work by
          // reaching for an undeclared runtime path that a minor release is free
          // to move. Sampling therefore lives in PostHog project settings, under
          // Session Replay, which is the supported surface for it.
          //
          // SO: SAMPLING IS NOT UNSET, IT IS SET SOMEWHERE ELSE. It is 0.25,
          // configured at
          // https://us.posthog.com/project/393054/settings/environment-replay
          // and not in this file. Do not read the absence of a sampleRate here
          // as "we record everything" and do not add one to "fix" it.
          //
          // It is a COST decision, recorded here because the reason has to
          // survive somewhere in the repo: July 2026 recorded 12,723 sessions
          // against a 5,000/month free tier, which billed $38.62, and the run
          // rate of roughly 580/day was trending to about $59 as it crossed into
          // the second pricing tier. 0.25 lands around 4,400/month, inside the
          // free tier, still capturing about 145 sessions a day. If nobody is
          // actually watching replays, a lower rate or zero is on the table;
          // that call was deliberately not made here.
          //
          // DO NOT reason "sampling protects privacy, so the route exclusion
          // below can go". Sampling reduces exposure proportionally. It closes
          // nothing: at 0.25, a quarter of visits to a credential-bearing page
          // are still recorded in full.
          // PREVENT THE START, DO NOT RACE A STOP.
          //
          // Calling stopSessionRecording() from the `loaded` callback is not
          // enough and this was demonstrated, not reasoned about: on a preview,
          // /preferences came back with recording stopped and /confirm came back
          // recording, from identical code. PostHog's remote config arrives
          // AFTER `loaded` and can start the recorder, so a stop issued there
          // wins or loses on timing. A recording that exists at all is a
          // failure here, so a coin flip is not a control.
          //
          // disable_session_recording is evaluated at init, before the recorder
          // is ever constructed, so there is nothing to race.
          disable_session_recording: REPLAY_EXCLUDED_PATHS.has(
            window.location.pathname,
          ),
          session_recording: {
            maskAllInputs: true,
          },
          loaded: (instance) => {
            // Expose on window so the framework-agnostic track() can reach it
            // without importing posthog-js (keeps analytics.ts SSR-safe).
            (window as unknown as { posthog?: unknown }).posthog = instance;

            // STOP HERE TOO, NOT ONLY IN THE PATHNAME EFFECT, AND THIS IS THE
            // CASE THAT ACTUALLY MATTERS.
            //
            // The effect below runs on mount, which happens BEFORE this dynamic
            // import resolves, so on a fresh load of an excluded route it finds
            // no window.posthog, bails, and never re-runs (its only dependency
            // is the pathname, which did not change). The recorder then starts
            // normally and the exclusion silently does nothing.
            //
            // That is not hypothetical. It was the first behaviour observed on
            // a real browser against a preview: URL clean, cookie httpOnly, and
            // sessionRecordingStarted() still true on /preferences. A direct
            // load from an emailed link is the ONLY way anyone reaches these
            // routes, so the missed case was the entire case.
            if (REPLAY_EXCLUDED_PATHS.has(window.location.pathname)) {
              instance.stopSessionRecording();
            }
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

  useSessionReplayRouteExclusion();

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
