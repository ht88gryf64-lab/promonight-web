import Image from 'next/image';
import type { ReactNode } from 'react';
import { EVENTS_ACCENT, EVENT_HERO, type EventShowSlug } from '@/lib/events/event-pages';

// The dark band that heads a show's hub and stop pages (events restyle,
// 2026-11-18; docs/events-monster-jam-mockup-v2.html): breadcrumb, the photo,
// then whatever the page puts under it (badge, countdown, H1, dates), the
// photo credit, and the hazard stripe.
//
// NO CROP (ruling 2026-11-18). The photo renders in its own natural 3:2 box
// (width and height attributes, h-auto, no object-fit), so the whole frame is
// shown at every width: the truck with its grille, the crushed cars and the
// sky above. On a wide screen the box stops at 640px and the dark band fills
// the sides; nothing is ever cut to make it fit.
//
// A decorative show photo is a ruled exception to the never-stock rule and
// the ONLY fetched image on an /events page; the generated text card stays
// the og:image and is not repeated in the page.
export const EVENTS_ACCENT_TEXT = 'text-[#f5c518]';
export const EVENTS_ACCENT_BG = 'bg-[#f5c518]';

export function EventHero({ show, breadcrumb, children }: { show: EventShowSlug; breadcrumb: ReactNode; children: ReactNode }) {
  const hero = EVENT_HERO[show];
  return (
    <>
      <div className="-mx-4 bg-rd-ink text-white" data-event-hero={show}>
        <div className="px-4">{breadcrumb}</div>
        <div className="relative mx-auto w-full max-w-[640px]">
          <Image
            src={hero.src}
            alt={hero.alt}
            width={hero.width}
            height={hero.height}
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            className="block h-auto w-full"
            data-event-hero-photo=""
          />
          {/* A short fade into the band over the foreground dirt only. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[10%]" style={{ background: 'linear-gradient(to bottom, rgba(33,29,24,0), var(--color-rd-ink))' }} />
        </div>
        <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
          {children}
          <span className="font-rd text-[11px] leading-[1.4] text-[#d8d1c4]" data-event-hero-credit="">{hero.credit}</span>
        </div>
      </div>
      <div aria-hidden="true" className="-mx-4 h-2.5" style={{ background: `repeating-linear-gradient(135deg, ${EVENTS_ACCENT} 0 14px, var(--color-rd-ink) 14px 28px)` }} />
    </>
  );
}
