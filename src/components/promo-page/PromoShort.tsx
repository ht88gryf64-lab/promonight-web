'use client';

import { useState } from 'react';
import { SHORT_BOX, shortEmbedUrl, shortThumbnailUrl, shortWatchUrl } from '@/lib/youtube-shorts';

// The promo's Short (the social bridge, 2026-11-05): a click-to-load player.
// Until the click the box holds the video's thumbnail and a play badge, at a
// fixed 236x420 (a 9:16 Short), and the click swaps in the privacy-enhanced
// YouTube iframe at the same size, so nothing on the page moves. Below the
// hero image and above the tiles as its own direct child of the article: one
// more ad anchor, the CTA row and the image untouched above it.
export function PromoShort({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const label = title ? `Play: ${title}` : 'Play the Short';
  return (
    <section className="mt-4 flex flex-col items-center gap-1.5" data-promo-short={videoId}>
      <div className="relative overflow-hidden rounded-2xl border border-rd-line bg-rd-ink" style={{ width: SHORT_BOX.width, height: SHORT_BOX.height }}>
        {playing ? (
          <iframe
            src={shortEmbedUrl(videoId)}
            title={title || 'PromoNight Short'}
            width={SHORT_BOX.width}
            height={SHORT_BOX.height}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="block h-full w-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={label} className="group absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, one fixed size. */}
            <img src={shortThumbnailUrl(videoId)} alt="" width={SHORT_BOX.width} height={SHORT_BOX.height} loading="lazy" decoding="async" className="block h-full w-full object-cover" />
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rd-red text-white shadow-lg transition-transform group-hover:scale-105">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </div>
      <p className="m-0 text-center font-rd text-[11px] text-rd-ink-faint">
        <a href={shortWatchUrl(videoId)} target="_blank" rel="noopener" className="text-rd-ink-faint no-underline hover:text-rd-ink">PromoNight on YouTube</a>
        {title ? <span>{` · ${title}`}</span> : null}
      </p>
    </section>
  );
}
