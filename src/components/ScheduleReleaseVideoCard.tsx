'use client';

import { track } from '@/lib/analytics';
import type { ScheduleReleaseVideo } from '@/lib/types';

// Top-of-schedule-section card linking to the team's official 2026 NFL
// schedule release video on YouTube. Static thumbnail + external link
// only; intentionally no iframe player or YouTube IFrame API JS. If we
// want inline playback later, lite-youtube-embed is the upgrade path,
// not the full YouTube SDK.
//
// Render gate is the parent: the card mounts only when
// team.scheduleReleaseVideo is present. MLB / NBA / NHL / MLS / WNBA
// team docs do not carry this field so they never reach this component.
// On top of that, extractVideoId returns null for any URL that isn't a
// recognizable youtube.com/watch?v= or youtu.be/ form, which short-
// circuits the render again as a defense.

interface ScheduleReleaseVideoCardProps {
  video: ScheduleReleaseVideo;
  teamSlug: string;
}

// Pulls the 11-char YouTube video id out of standard watch URLs and
// short-form youtu.be URLs. Returns null on anything we don't recognize.
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') {
      const v = u.searchParams.get('v');
      return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
    }
    return null;
  } catch {
    return null;
  }
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function ScheduleReleaseVideoCard({ video, teamSlug }: ScheduleReleaseVideoCardProps) {
  const videoId = extractVideoId(video.url);
  if (!videoId) return null;

  // hqdefault.jpg is the 480x360 thumbnail YouTube serves for every
  // public video. Cached globally on Google's CDN; no Next image
  // pipeline coupling needed.
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handleClick = () => {
    track('cta_click', {
      surface: 'web_team_page',
      cta_id: 'schedule_release_video',
      cta_label: 'Watch the 2026 schedule release',
      cta_destination: 'youtube',
      team_slug: teamSlug,
      sport: 'nfl',
    });
  };

  return (
    <section className="py-8 px-6 border-t border-border-subtle">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-accent-red">
            Schedule Release
          </span>
          <h2 className="font-display text-2xl md:text-3xl tracking-[1px] mt-1">
            2026 SEASON REVEAL
          </h2>
        </div>

        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="group block bg-bg-card border border-border-subtle rounded-2xl overflow-hidden hover:border-border-hover transition-colors"
        >
          <div className="flex flex-col md:flex-row">
            <div className="relative md:w-2/5 aspect-video md:aspect-auto bg-black overflow-hidden">
              {/* Plain img: YouTube serves the thumbnail from its own CDN
               *  with aggressive caching. No Next/image optimization
               *  coupling needed for content we don't host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-14 h-14 rounded-full bg-black/70 group-hover:bg-accent-red transition-colors flex items-center justify-center shadow-lg">
                  <PlayIcon />
                </span>
              </div>
            </div>
            <div className="flex-1 p-5 md:p-6 flex flex-col justify-center">
              <h3 className="font-display text-lg md:text-xl tracking-[0.5px] text-white leading-tight">
                {video.title}
              </h3>
              <span className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] tracking-[1px] uppercase text-accent-red group-hover:text-white transition-colors">
                Watch the 2026 schedule release
                <ExternalLinkIcon />
              </span>
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}
