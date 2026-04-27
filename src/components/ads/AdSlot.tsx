'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdSlotConfig, AdSize } from '@/lib/ads/slots';
import { resolveAdNetwork } from '@/lib/ads/network';
import { track } from '@/lib/analytics';

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

function currentBreakpoint(width: number): Breakpoint {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// Pick the size for the active breakpoint, falling back the way ad networks
// typically do (tablet borrows from desktop if no tablet size is configured).
function resolveSize(
  config: AdSlotConfig,
  bp: Breakpoint,
): AdSize | undefined {
  const { mobile, tablet, desktop } = config.sizes;
  if (bp === 'mobile') return mobile;
  if (bp === 'tablet') return tablet ?? desktop;
  return desktop;
}

export function AdSlot({
  config,
  pageType,
  className,
}: {
  config: AdSlotConfig;
  pageType?: string;
  className?: string;
}) {
  // When no ad network can fill (no real slot IDs assigned, or network='none'),
  // collapse the slot entirely. Previous behavior reserved space for an ad
  // that can never paint, leaving ~250px-tall dead zones on every page.
  // When real AdSense (or other) slot IDs are configured, the reservation
  // and creative-injection logic re-engages.
  const network = resolveAdNetwork();
  const ref = useRef<HTMLDivElement | null>(null);
  // Server render uses desktop dimensions to reserve roughly the right space;
  // the first client effect corrects to the actual breakpoint. Reserving any
  // sensible height up-front is what prevents CLS — getting it exactly right
  // on the first paint matters less than reserving _something_ stable.
  const [bp, setBp] = useState<Breakpoint>('desktop');
  const [visible, setVisible] = useState<boolean>(!config.lazyLoad);
  const firedRef = useRef(false);

  useEffect(() => {
    const update = () => setBp(currentBreakpoint(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Lazy-load: render the inner ad container only after the slot's reserved
  // box scrolls into the viewport. Eager slots skip this and render immediately.
  useEffect(() => {
    if (!config.lazyLoad) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [config.lazyLoad]);

  // Fire ad_slot_viewed once when the slot enters the viewport. Separate from
  // the lazy-load observer so eager slots also report a view.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            track('ad_slot_viewed', {
              slot_id: config.id,
              page_type: pageType ?? 'unknown',
            });
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [config.id, pageType]);

  // Network-level collapse — see top-of-component comment. Done after hooks
  // to keep React's hook order stable when env-driven values change.
  if (network === 'none') return null;

  const size = resolveSize(config, bp);
  // Hide entirely when no size is configured for this breakpoint (e.g. desktop-
  // only sticky sidebar on mobile). Returning null keeps the DOM clean.
  if (!size) return null;

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div
      ref={ref}
      data-ad-slot={config.id}
      aria-label="Advertisement"
      role="complementary"
      className={className}
      style={{
        minHeight: size.h,
        width: '100%',
        maxWidth: size.w,
        marginLeft: 'auto',
        marginRight: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {visible && isDev && (
        <div
          style={{
            width: '100%',
            height: size.h,
            border: '2px dashed #f97316',
            background: 'rgba(249, 115, 22, 0.08)',
            color: '#fed7aa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            fontSize: 12,
            textAlign: 'center',
            padding: 8,
          }}
        >
          <div style={{ fontWeight: 700, letterSpacing: 1 }}>
            AD · {config.id}
          </div>
          <div>
            {size.w} × {size.h} ({bp})
          </div>
          <div style={{ opacity: 0.7 }}>
            {config.lazyLoad ? 'lazy' : 'eager'}
          </div>
        </div>
      )}
      {/* In production, leave the inner empty so the ad network's script can
          target [data-ad-slot] and inject its creative into this reserved box. */}
    </div>
  );
}
