'use client';

import { useState } from 'react';

// Photo hero for a venue hub. Rendered ONLY when the building has a self-hosted
// photoUrl. A charcoal gradient sits behind the image at all times, so the venue
// name stays legible over ANY photo AND the hero degrades to the house charcoal
// treatment if the image ever fails to load (onError hides the <img>, leaving the
// gradient). No broken-image state is ever shown. When photoUrl is null the
// caller renders the plain charcoal hero instead and this component never mounts.
export function VenuePhotoHero({
  photoUrl,
  attribution,
  title,
  subtitle,
}: {
  photoUrl: string;
  attribution: string | null;
  title: string;
  subtitle: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !failed;

  return (
    <section className="relative overflow-hidden text-white" style={{ backgroundColor: '#211d18' }}>
      {/* Charcoal gradient — the always-present legibility floor and the
          fail-safe when the photo is absent/blocked. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #3a342c 0%, #262019 55%, #1b1712 100%)' }}
      />
      {/* Self-hosted photo. onError removes it so the gradient shows through. */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- self-hosted hero art with an onError charcoal fallback; next/image cannot express the fail-to-gradient degrade.
        <img
          src={photoUrl}
          alt={`${title} on gameday`}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: 'center 40%' }}
        />
      ) : null}
      {/* Legibility overlay: light at the top, heavy at the bottom, so the name
          reads over any photo. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(33,29,24,0.25) 0%, rgba(33,29,24,0.05) 40%, rgba(33,29,24,0.88) 100%)',
        }}
      />
      {/* Attribution chip (top-right) — only while a real photo is showing. */}
      {attribution && showImage ? (
        <div className="absolute right-2 top-2 z-10 rounded-md bg-black/40 px-2 py-[3px] font-rd text-[9px] leading-tight text-white/85">
          {attribution}
        </div>
      ) : null}
      {/* Name block over the gradient, bottom-left. The fixed-height content box
          gives the hero its height; the absolute layers fill it. */}
      <div className="relative z-10 mx-auto flex h-[210px] max-w-[1160px] flex-col justify-end px-4 pb-4 md:h-[320px] md:px-8 md:pb-6">
        <p className="font-rd text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
          Gameday Guide
        </p>
        <h1
          className="rd-display mt-1 text-3xl text-white md:text-5xl"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}
        >
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 font-rd text-[13px] text-white/80">{subtitle}</p> : null}
      </div>
    </section>
  );
}
